import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';

test('Evidence rejects unauthenticated and cross-workspace requests before database access', async () => {
  process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:1/unreachable_guard_test';
  const router: express.Router = require('../routes/evidence.js').default;
  const { pool } = await import('../db.js');
  const app = express();
  app.use((req, _res, next) => {
    if (req.headers['x-test-identity']) req.authUser = { userId: 'test', email: 'test@example.invalid', workspaceId: 'own', role: 'owner' };
    next();
  });
  app.use('/evidence', router);
  const server = await new Promise<Server>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/evidence`;
    assert.equal((await fetch(url)).status, 401);
    for (const method of ['GET', 'POST']) {
      assert.equal((await fetch(url, { method, headers: { 'x-test-identity': 'yes', 'x-workspace-id': 'other' } })).status, 403);
      assert.equal((await fetch(`${url}?workspaceId=other`, { method, headers: { 'x-test-identity': 'yes' } })).status, 403);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
