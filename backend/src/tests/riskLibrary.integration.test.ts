import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';
import type { Server } from 'node:http';
import pg from 'pg';

function requireDisposableTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required for the Risk Library integration test.');
  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  if (!['test', 'validation', 'disposable'].some((marker) => databaseName.includes(marker))) {
    throw new Error(`Refusing Risk Library integration testing against non-disposable database "${databaseName || '(missing)'}".`);
  }
  return value;
}

test('Risk Library repository, API isolation, references, linkage and audit events', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = requireDisposableTestDatabaseUrl();
  const parsed = new URL(url);
  assert.match(parsed.hostname, /^(localhost|127\.0\.0\.1|\[::1\])$/);
  const schema = `risk_library_test_${randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url });
  let pool: pg.Pool | undefined;
  let server: Server | undefined;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema};
      CREATE TABLE workspaces (id TEXT PRIMARY KEY);
      INSERT INTO workspaces VALUES ('workspace-a'), ('workspace-b');
      CREATE TABLE risks (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL);
    `);
    await client.query(await readFile(resolve(__dirname, '../../sql/migrations/20260927-risk-library.sql'), 'utf8'));
    parsed.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = parsed.toString();
    const database = await import('../db.js');
    pool = database.pool;
    const repo = await import('../repositories/riskLibraryRepo.js');
    const { ensureActivityLedgerSchema } = await import('../services/activityLedger/activityLedger.js');
    await ensureActivityLedgerSchema();

    const router: express.Router = require('../routes/riskLibrary.js').default;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.headers['x-test-auth'] !== 'none') req.authUser = { userId: 'tester', email: 'tester@example.invalid', workspaceId: 'workspace-a', role: 'owner' };
      next();
    });
    app.use('/risk-library', router);
    server = await new Promise<Server>((done) => { const instance = app.listen(0, '127.0.0.1', () => done(instance)); });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/risk-library`;
    const request = (path = '', init: RequestInit = {}) => fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } });

    assert.equal((await request('', { headers: { 'x-test-auth': 'none' } })).status, 401);
    assert.equal((await request('', { headers: { 'x-workspace-id': 'workspace-b' } })).status, 403);
    assert.equal((await request('', { method: 'POST', body: JSON.stringify({ title: 'Bad', category: 'operational', status: 'published' }) })).status, 400);

    const createResponse = await request('', { method: 'POST', body: JSON.stringify({ title: 'Privileged access event', description: 'Reusable scenario', category: 'information_security', status: 'active', scenarioType: 'event_based', suggestedCiaImpacts: ['Confidentiality'], relatedFrameworks: ['ISO 27001'], tags: ['identity'] }) });
    assert.equal(createResponse.status, 201);
    const created = ((await createResponse.json()) as any).data;
    assert.match(created.libraryRiskId, /^LIB-RSK-\d{3,}$/);
    assert.equal((await request(`/${created.id}`)).status, 200);

    const concurrent = await Promise.all(Array.from({ length: 4 }, (_, index) => repo.create('workspace-a', 'tester@example.invalid', { title: `Concurrent ${index}`, category: 'operational', status: 'draft' })));
    assert.equal(new Set([created.libraryRiskId, ...concurrent.map((item) => item.libraryRiskId)]).size, 5);
    assert.equal((await repo.list('workspace-b')).length, 0);
    await repo.seedRiskLibraryDefaults('workspace-b');
    assert.equal((await repo.list('workspace-b')).length, 25);
    await repo.seedRiskLibraryDefaults('workspace-b');
    assert.equal((await repo.list('workspace-b')).length, 25, 'default seeding must be idempotent');
    assert.equal((await repo.list('workspace-a', { status: 'active', category: 'information_security', search: 'identity' })).length, 1);

    const updateResponse = await request(`/${created.id}`, { method: 'PATCH', body: JSON.stringify({ description: 'Updated scenario' }) });
    assert.equal(updateResponse.status, 200);
    assert.equal(((await updateResponse.json()) as any).data.description, 'Updated scenario');
    assert.equal((await request(`/${created.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) })).status, 200);
    const usageResponse = await request(`/${created.id}/record-use`, { method: 'POST', body: JSON.stringify({ riskId: 'risk-from-template' }) });
    assert.equal(((await usageResponse.json()) as any).data.usageCount, 1);

    await client.query(`INSERT INTO risks (id, workspace_id, title, library_risk_id) VALUES ('risk-from-template','workspace-a','Created from template',$1),('ordinary-risk','workspace-a','Ordinary risk',NULL)`, [created.libraryRiskId]);
    assert.equal((await client.query("SELECT library_risk_id FROM risks WHERE id='risk-from-template'")).rows[0].library_risk_id, created.libraryRiskId);
    assert.equal((await client.query("SELECT library_risk_id FROM risks WHERE id='ordinary-risk'")).rows[0].library_risk_id, null);

    const actions = (await client.query("SELECT action FROM enterprise_activity_ledger WHERE workspace_id='workspace-a'")).rows.map((row) => row.action);
    for (const action of ['risk_library_template_created', 'risk_library_template_updated', 'risk_library_template_archived', 'risk_created_from_template']) assert.ok(actions.includes(action), `${action} audit event is required`);
  } finally {
    if (server) await new Promise<void>((done) => server!.close(() => done()));
    await pool?.end();
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
});
