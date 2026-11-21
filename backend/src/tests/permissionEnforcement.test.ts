import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { response, state };
}

test('permission middleware rejects missing authentication before repository access', async () => {
  const original = pool.query.bind(pool);
  let queries = 0;
  pool.query = (async () => { queries += 1; return { rows: [], rowCount: 0 } as never; }) as typeof pool.query;
  const { response, state } = responseRecorder();
  let nextCalled = false;
  try {
    await requirePermission('Reports', 'view')({} as Request, response, (() => { nextCalled = true; }) as NextFunction);
    assert.equal(state.status, 401);
    assert.equal(nextCalled, false);
    assert.equal(queries, 0);
  } finally {
    pool.query = original;
  }
});

test('permission middleware denies a member lacking the required workspace permission', async () => {
  const original = pool.query.bind(pool);
  const permissionQueries: unknown[][] = [];
  pool.query = (async (text: string, values: unknown[] = []) => {
    if (text.includes('FROM governance_user_roles')) return { rows: [{ role_id: 'member-role' }], rowCount: 1 } as never;
    if (text.includes('FROM governance_role_permissions')) {
      permissionQueries.push(values);
      return { rows: [{ allowed: false }], rowCount: 1 } as never;
    }
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  const request = {
    authUser: { userId: 'member-a', email: 'member-a@example.invalid', workspaceId: 'workspace-a', role: 'member' },
    headers: {},
    body: {},
  } as unknown as Request;
  const { response, state } = responseRecorder();
  let nextCalled = false;
  try {
    await requirePermission('Reports', 'export')(request, response, (() => { nextCalled = true; }) as NextFunction);
    assert.equal(state.status, 403);
    assert.equal(nextCalled, false);
    assert.deepEqual(permissionQueries, [['workspace-a', 'member-role', 'Reports', 'export']]);
  } finally {
    pool.query = original;
  }
});
