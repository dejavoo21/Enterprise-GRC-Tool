import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Server } from 'node:http';
import pg from 'pg';
import type { DashboardIssueRecord, DashboardIssueSourceType } from '../types/models.js';
import { requireDisposableTestDatabaseUrl } from './frameworkAssessmentScopeTestDb.js';

function action(id: string, sourceType: DashboardIssueSourceType, overrides: Partial<DashboardIssueRecord> = {}): DashboardIssueRecord {
  return {
    id,
    workspaceId: 'workspace-a',
    title: `${sourceType} action ${id}`,
    description: `Derived from ${sourceType}`,
    owner: 'Source Owner',
    status: 'Open',
    priority: 'High',
    dueDate: '2020-01-01',
    domain: 'Enterprise Risk',
    sourceType,
    sourceReference: id,
    isOverdue: true,
    linkedLibraryRiskId: 'LIB-RSK-001',
    linkedRiskId: 'risk-001',
    linkedRiskRef: 'RSK-0001',
    linkedTreatmentPlanId: 'treatment-001',
    linkedControlIds: ['CTRL-001'],
    linkedEvidenceIds: ['EVD-001'],
    linkedReviewTaskIds: ['review-001'],
    linkedTrainingAssignmentIds: ['training-001'],
    ciaImpacts: ['Confidentiality'],
    outsideAppetite: true,
    ...overrides,
  };
}

test('Risk Actions bulk synchronization, lifecycle, filtering, isolation and API audit history', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = requireDisposableTestDatabaseUrl();
  const parsed = new URL(url);
  assert.match(parsed.hostname, /^(localhost|127\.0\.0\.1|\[::1\])$/);
  const schema = `risk_actions_test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url });
  let pool: pg.Pool | undefined;
  let server: Server | undefined;
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE workspaces (id TEXT PRIMARY KEY);
      INSERT INTO workspaces VALUES ('workspace-a'), ('workspace-b');
    `);
    parsed.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = parsed.toString();

    const database = await import('../db.js');
    pool = database.pool;
    const repo = await import('../repositories/riskActionsRepo.js');
    const { ensureActivityLedgerSchema } = await import('../services/activityLedger/activityLedger.js');
    await repo.ensureRiskActionsSchema();
    await ensureActivityLedgerSchema();

    const sources = [
      action('risk-source', 'Risk'),
      action('treatment-source', 'Treatment', { treatmentProgress: 35 }),
      action('evidence-source', 'Evidence', { status: 'Awaiting Evidence' }),
      action('review-source', 'Review Task', { status: 'Awaiting Review' }),
      action('training-source', 'Training', { priority: 'Medium' }),
    ];
    await repo.syncDerived('workspace-a', sources);
    const first = await repo.list('workspace-a');
    assert.equal(first.length, 5);
    assert.equal(new Set(first.map((item) => item.actionRef)).size, 5);
    assert.ok(first.every((item) => item.linkedRiskRef === 'RSK-0001'));

    await repo.syncDerived('workspace-a', sources);
    const repeated = await repo.list('workspace-a');
    assert.deepEqual(
      repeated.map((item) => [item.sourceType, item.sourceReference, item.id, item.actionRef]).sort(),
      first.map((item) => [item.sourceType, item.sourceReference, item.id, item.actionRef]).sort(),
    );
    assert.equal((await repo.list('workspace-b')).length, 0);

    const riskAction = repeated.find((item) => item.sourceType === 'Risk')!;
    await repo.update('workspace-a', riskAction.id, {
      owner: 'User Managed Owner',
      dueDate: '2030-06-30',
      status: 'Blocked',
      blockerReason: 'Awaiting executive decision',
      evidenceRequired: 'Signed approval',
      notes: 'Preserve this note',
    });
    await repo.syncDerived('workspace-a', sources.map((item) => item.id === 'risk-source'
      ? { ...item, owner: 'Changed Source Owner', dueDate: '2021-01-01', status: 'In Progress' }
      : item));
    const preserved = (await repo.list('workspace-a')).find((item) => item.sourceType === 'Risk')!;
    assert.equal(preserved.owner, 'User Managed Owner');
    assert.equal(preserved.dueDate, '2030-06-30');
    assert.equal(preserved.status, 'Blocked');
    assert.equal(preserved.blockerReason, 'Awaiting executive decision');
    assert.equal(preserved.evidenceRequired, 'Signed approval');
    assert.equal(preserved.notes, 'Preserve this note');

    await repo.update('workspace-a', preserved.id, { status: 'Completed' });
    assert.ok((await repo.get('workspace-a', preserved.id))?.completedAt);
    await repo.syncDerived('workspace-a', sources);
    assert.equal((await repo.get('workspace-a', preserved.id))?.status, 'Completed');
    await repo.update('workspace-a', preserved.id, { status: 'Open' });
    assert.equal((await repo.get('workspace-a', preserved.id))?.completedAt, undefined);

    await repo.update('workspace-a', preserved.id, { status: 'Cancelled' });
    await repo.syncDerived('workspace-a', sources);
    assert.equal((await repo.get('workspace-a', preserved.id))?.status, 'Cancelled');
    await repo.update('workspace-a', preserved.id, { status: 'Open' });

    const treatment = repeated.find((item) => item.sourceType === 'Treatment')!;
    await repo.update('workspace-a', treatment.id, { status: 'Blocked' });
    await repo.syncDerived('workspace-a', sources.map((item) => item.id === 'treatment-source'
      ? { ...item, status: 'Completed', sourceStatus: 'completed' }
      : item));
    const completedTreatment = await repo.get('workspace-a', treatment.id);
    assert.equal(completedTreatment?.status, 'Completed');
    assert.ok(completedTreatment?.completedAt);

    assert.ok((await repo.list('workspace-a', { source: 'Treatment' })).every((item) => item.sourceType === 'Treatment'));
    assert.ok((await repo.list('workspace-a', { status: 'Completed' })).every((item) => item.status === 'Completed'));
    assert.ok((await repo.list('workspace-a', { priority: 'Medium' })).every((item) => item.priority === 'Medium'));
    assert.ok((await repo.list('workspace-a', { overdue: true })).every((item) => item.isOverdue));

    const evidence = repeated.find((item) => item.sourceType === 'Evidence')!;
    const withoutEvidence = sources.filter((item) => item.id !== 'evidence-source');
    await repo.syncDerived('workspace-a', withoutEvidence);
    assert.equal((await repo.get('workspace-a', evidence.id))?.status, 'Completed');

    const manual = await Promise.all(Array.from({ length: 8 }, (_, index) => repo.createManual('workspace-a', {
      title: `Manual action ${index}`,
      owner: 'Risk Office',
      status: 'Open',
      priority: 'Medium',
    })));
    assert.equal(new Set(manual.map((item) => item.actionRef)).size, manual.length);

    const router: express.Router = require('../routes/issues.js').default;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.authUser = { userId: 'tester', email: 'tester@example.invalid', workspaceId: 'workspace-a', role: 'owner' };
      next();
    });
    app.use('/issues', router);
    server = await new Promise<Server>((done) => {
      const instance = app.listen(0, '127.0.0.1', () => done(instance));
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/issues`;
    const request = (path = '', init: RequestInit = {}) => fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });

    const createResponse = await request('', { method: 'POST', body: JSON.stringify({ title: 'API action', owner: 'Risk Office', priority: 'Critical' }) });
    assert.equal(createResponse.status, 201);
    const created = ((await createResponse.json()) as { data: DashboardIssueRecord }).data;
    assert.match(created.actionRef || '', /^ACT-\d{4,}$/);
    assert.equal((await request(`/${created.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Completed' }) })).status, 200);
    assert.equal((await request(`/${created.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Open' }) })).status, 200);
    const detail = ((await (await request(`/${created.id}`)).json()) as { data: DashboardIssueRecord }).data;
    const activityNames = detail.activityHistory?.map((entry) => entry.action) || [];
    for (const event of ['risk_action_created', 'risk_action_completed', 'risk_action_reopened']) {
      assert.ok(activityNames.includes(event), `${event} audit event is required`);
    }
    await request(`/${preserved.id}`, { method: 'PATCH', body: JSON.stringify({ notes: 'Audited derived action' }) });
    const historyBeforeSync = ((await (await request(`/${preserved.id}`)).json()) as { data: DashboardIssueRecord }).data.activityHistory || [];
    await repo.syncDerived('workspace-a', sources);
    const historyAfterSync = ((await (await request(`/${preserved.id}`)).json()) as { data: DashboardIssueRecord }).data.activityHistory || [];
    assert.equal(historyAfterSync.length, historyBeforeSync.length);
    assert.ok(historyAfterSync.some((entry) => entry.action === 'risk_action_updated'));
    assert.equal((await request('?source=Unknown')).status, 400);

    const bulk = Array.from({ length: 1_363 }, (_, index) => action(`bulk-${index}`, index % 2 ? 'Risk' : 'Treatment', {
      title: `Bulk action ${index}`,
      linkedRiskId: `risk-${index}`,
      linkedRiskRef: `RSK-${String(index + 1).padStart(4, '0')}`,
    }));
    const started = performance.now();
    await repo.syncDerived('workspace-b', bulk.map((item) => ({ ...item, workspaceId: 'workspace-b' })));
    const bulkDurationMs = performance.now() - started;
    assert.equal((await repo.list('workspace-b')).length, 1_363);
    assert.ok(bulkDurationMs < 5_000, `Bulk sync took ${bulkDurationMs.toFixed(0)}ms`);
    process.stdout.write(`\nRisk Actions bulk sync: 1363 records in ${bulkDurationMs.toFixed(0)}ms\n`);
  } finally {
    if (server) await new Promise<void>((done) => server!.close(() => done()));
    await pool?.end();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
