import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { dropIntegrationTablesSql, integrationSchemaSql, requireDisposableTestDatabaseUrl } from './frameworkAssessmentScopeTestDb.js';

const testDatabaseUrl = requireDisposableTestDatabaseUrl();
process.env.DATABASE_URL = testDatabaseUrl;
process.env.LOG_DB_QUERIES = 'false';
process.env.LOG_DB_CONNECTIONS = 'false';

const WORKSPACE_ID = 'workspace-framework-scope-test';
const ACTOR_EMAIL = 'framework.scope.integration@test.invalid';

test('Framework Assessment Scope PostgreSQL API integration', async (t) => {
  const { query, pool, closePool } = await import('../db.js');
  const repo = await import('../repositories/frameworkAssessmentScopeRepo.js');
  const frameworkAssessmentScopesRouter = (await import('../routes/frameworkAssessmentScopes.js')).default as unknown as express.Router;

  await query(dropIntegrationTablesSql);
  await query(integrationSchemaSql);
  await repo.ensureFrameworkAssessmentScopeSchema();

  const seedControls = [
    ['iso-implemented', 'ISO implemented', 'implemented', 'ISO27001', 'A.5.1'],
    ['iso-progress', 'ISO in progress', 'in_progress', 'ISO27001', 'A.5.2'],
    ['iso-pending', 'ISO pending', 'not_implemented', 'ISO27001', 'A.5.3'],
    ['iso-inherited', 'ISO inherited candidate', 'implemented', 'ISO27001', 'A.5.4'],
    ['iso-deferred', 'ISO deferred candidate', 'not_implemented', 'ISO27001', 'A.5.5'],
    ['iso-out', 'ISO out-of-scope candidate', 'not_implemented', 'ISO27001', 'A.5.6'],
    ['ai-implemented', 'AI implemented', 'implemented', 'ISO42001', 'A.2.1'],
    ['ai-pending', 'AI pending', 'not_implemented', 'ISO42001', 'A.2.2'],
    ['custom-implemented', 'Custom implemented', 'implemented', 'CUSTOM', 'CUS-1'],
    ['custom-pending', 'Custom pending', 'not_implemented', 'CUSTOM', 'CUS-2'],
  ] as const;

  for (const [id, title, status, framework, reference] of seedControls) {
    await query('INSERT INTO controls(id,workspace_id,title,owner,status,primary_framework) VALUES($1,$2,$3,$4,$5,$6)', [id, WORKSPACE_ID, title, 'Test Owner', status, framework]);
    await query('INSERT INTO control_mappings(control_id,framework,reference) VALUES($1,$2,$3)', [id, framework, reference]);
  }

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authUser = { userId: 'framework-scope-test-user', email: ACTOR_EMAIL, role: 'owner', workspaceId: WORKSPACE_ID };
    next();
  });
  app.use('/api/framework-assessment-scopes', frameworkAssessmentScopesRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/framework-assessment-scopes`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await query(dropIntegrationTablesSql);
    await closePool();
  });

  const request = async (path = '', init?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
    return { response, body: await response.json() as any };
  };

  let isoScopeId = '';
  let libraryCount = 0;

  await t.test('persists scope metadata and defaults mapped controls to Included', async () => {
    libraryCount = Number((await query('SELECT COUNT(*)::int AS count FROM controls')).rows[0].count);
    const { response, body } = await request('', {
      method: 'POST',
      body: JSON.stringify({ frameworkCode: 'ISO27001', frameworkName: 'ISO 27001', frameworkVersion: '2022', name: 'ISO integration assessment' }),
    });
    assert.equal(response.status, 201);
    isoScopeId = body.data.id;
    assert.equal(body.data.frameworkCode, 'ISO27001');
    assert.equal(body.data.frameworkName, 'ISO 27001');
    assert.equal(body.data.frameworkVersion, '2022');
    assert.equal(body.data.summary.total, 6);
    assert.equal(body.data.summary.included, 6);
    assert.ok(body.data.controls.every((control: any) => control.inclusionStatus === 'included'));
  });

  await t.test('enforces the scope/control uniqueness constraint', async () => {
    await assert.rejects(
      pool.query(`INSERT INTO framework_scope_controls(scope_id,control_id,control_title,created_by,updated_by)
        VALUES($1,$2,$3,$4,$4)`, [isoScopeId, 'iso-implemented', 'Duplicate', ACTOR_EMAIL]),
      (error: any) => error?.code === '23505',
    );
    const duplicateCount = await query('SELECT COUNT(*)::int AS count FROM framework_scope_controls WHERE scope_id=$1 AND control_id=$2', [isoScopeId, 'iso-implemented']);
    assert.equal(Number(duplicateCount.rows[0].count), 1);
  });

  await t.test('rejects invalid API control updates', async () => {
    const invalidBodies = [
      { inclusionStatus: 'excluded', justification: 'Outside the assessment boundary.' },
      { inclusionStatus: 'excluded', exclusionReason: 'system_not_in_scope' },
      { inclusionStatus: 'excluded', exclusionReason: 'other', justification: 'Too short' },
      { inclusionStatus: 'deferred', exclusionReason: 'deferred_to_future_assessment', justification: 'Deferred to the next approved assessment window.' },
      { inclusionStatus: 'unsupported' },
      { inclusionStatus: 'excluded', exclusionReason: 'unsupported_reason', justification: 'A sufficiently detailed but unsupported reason.' },
    ];
    for (const payload of invalidBodies) {
      const { response, body } = await request(`/${isoScopeId}/controls/iso-progress`, { method: 'PATCH', body: JSON.stringify(payload) });
      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }
  });

  await t.test('persists exclusion metadata and updated actor', async () => {
    const payload = { inclusionStatus: 'excluded', exclusionReason: 'system_not_in_scope', justification: 'The system is outside the approved assessment boundary.', evidenceReference: 'ARCH-BOUNDARY-001' };
    const { response } = await request(`/${isoScopeId}/controls/iso-progress`, { method: 'PATCH', body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    const persisted = await query('SELECT * FROM framework_scope_controls WHERE scope_id=$1 AND control_id=$2', [isoScopeId, 'iso-progress']);
    assert.equal(persisted.rows[0].inclusion_status, 'excluded');
    assert.equal(persisted.rows[0].exclusion_reason, payload.exclusionReason);
    assert.equal(persisted.rows[0].justification, payload.justification);
    assert.equal(persisted.rows[0].evidence_reference, payload.evidenceReference);
    assert.equal(persisted.rows[0].updated_by, ACTOR_EMAIL);
    assert.ok(persisted.rows[0].updated_at instanceof Date);
  });

  await t.test('calculates applicable denominator and every status count from persisted controls', async () => {
    const updates = [
      ['iso-pending', { inclusionStatus: 'not_applicable', exclusionReason: 'not_applicable_to_scope', justification: 'The requirement is not applicable to the approved assessment scope.' }],
      ['iso-inherited', { inclusionStatus: 'inherited', exclusionReason: 'inherited_from_third_party', justification: 'The control is inherited from the contracted infrastructure provider.' }],
      ['iso-deferred', { inclusionStatus: 'deferred', exclusionReason: 'deferred_to_future_assessment', justification: 'The control is scheduled for the next approved assessment period.', reviewDate: '2027-01-15' }],
      ['iso-out', { inclusionStatus: 'out_of_scope', exclusionReason: 'service_not_provided', justification: 'The organisation does not provide the service addressed by this control.' }],
    ] as const;
    for (const [controlId, payload] of updates) {
      assert.equal((await request(`/${isoScopeId}/controls/${controlId}`, { method: 'PATCH', body: JSON.stringify(payload) })).response.status, 200);
    }
    const { body } = await request(`/${isoScopeId}`);
    assert.deepEqual(
      { total: body.data.summary.total, included: body.data.summary.included, excluded: body.data.summary.excluded, notApplicable: body.data.summary.notApplicable, inherited: body.data.summary.inherited, deferred: body.data.summary.deferred, outOfScope: body.data.summary.outOfScope, applicable: body.data.summary.applicable, assessed: body.data.summary.assessed, completed: body.data.summary.completed, readinessPercent: body.data.summary.readinessPercent },
      { total: 6, included: 1, excluded: 1, notApplicable: 1, inherited: 1, deferred: 1, outOfScope: 1, applicable: 3, assessed: 2, completed: 2, readinessPercent: 67 },
    );
  });

  await t.test('blocks approval gaps, then records authenticated approval metadata', async () => {
    await query("UPDATE framework_scope_controls SET inclusion_status='excluded',exclusion_reason=NULL,justification=NULL WHERE scope_id=$1 AND control_id='iso-implemented'", [isoScopeId]);
    assert.equal((await request(`/${isoScopeId}/approve`, { method: 'POST' })).response.status, 400);
    await query("UPDATE framework_scope_controls SET exclusion_reason='system_not_in_scope',justification='Direct persistence fixture with a complete audit-ready justification.' WHERE scope_id=$1 AND control_id='iso-implemented'", [isoScopeId]);
    const { response, body } = await request(`/${isoScopeId}/approve`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal(body.data.approvalStatus, 'approved');
    assert.equal(body.data.approvedBy, ACTOR_EMAIL);
    assert.ok(Number.isFinite(Date.parse(body.data.approvedAt)));
  });

  await t.test('Include All clears scope metadata, recalculates readiness, and preserves the control library', async () => {
    const { response, body } = await request(`/${isoScopeId}/include-all`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal(body.data.summary.included, 6);
    assert.equal(body.data.summary.applicable, 6);
    assert.equal(body.data.summary.completed, 2);
    assert.equal(body.data.summary.readinessPercent, 33);
    assert.ok(body.data.controls.every((control: any) => control.exclusionReason === null && control.justification === null && control.evidenceReference === null && control.reviewDate === null));
    assert.equal(Number((await query('SELECT COUNT(*)::int AS count FROM controls')).rows[0].count), libraryCount);
    assert.equal(Number((await query('SELECT COUNT(*)::int AS count FROM control_mappings')).rows[0].count), libraryCount);
  });

  await t.test('supports Custom and ISO 42001 scopes with real mapped controls', async () => {
    for (const framework of [
      { frameworkCode: 'CUSTOM', frameworkName: 'Custom Framework' },
      { frameworkCode: 'ISO42001', frameworkName: 'ISO 42001' },
    ]) {
      const { response, body } = await request('', { method: 'POST', body: JSON.stringify({ ...framework, name: `${framework.frameworkName} assessment` }) });
      assert.equal(response.status, 201);
      assert.equal(body.data.summary.total, 2);
      assert.equal(body.data.summary.included, 2);
    }
  });

  await t.test('returns a truthful zero-control summary for an empty framework', async () => {
    const { response, body } = await request('', { method: 'POST', body: JSON.stringify({ frameworkCode: 'DORA', frameworkName: 'DORA', name: 'Empty DORA assessment' }) });
    assert.equal(response.status, 201);
    assert.deepEqual(body.data.controls, []);
    assert.equal(body.data.summary.total, 0);
    assert.equal(body.data.summary.applicable, 0);
    assert.equal(body.data.summary.readinessPercent, 0);
  });

});
