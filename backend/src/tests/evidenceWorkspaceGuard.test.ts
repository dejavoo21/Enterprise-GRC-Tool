import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { requireAuthenticatedWorkspace } from '../workspace.js';

const root = path.resolve(__dirname, '../../..');

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { response, state };
}

async function invoke(request: Request) {
  const { response, state } = responseRecorder();
  let nextCalled = false;
  await requireAuthenticatedWorkspace(request, response, (() => { nextCalled = true; }) as NextFunction);
  return { state, nextCalled };
}

test('Evidence is registered behind authentication and workspace guards', async () => {
  const index = await readFile(path.join(root, 'backend/src/index.ts'), 'utf8');
  assert.match(index, /app\.use\('\/api\/v1\/evidence', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions\('Evidence'\), evidenceRouter\)/);
});

test('workspace guard rejects missing authentication and forged workspace selectors without a server', async () => {
  const missing = await invoke({ headers: {}, query: {}, body: {} } as Request);
  assert.equal(missing.state.status, 401);
  assert.equal(missing.nextCalled, false);

  for (const request of [
    { headers: { 'x-workspace-id': 'other' }, query: {}, body: {} },
    { headers: {}, query: { workspaceId: 'other' }, body: {} },
    { headers: {}, query: {}, body: { workspaceId: 'other' } },
  ]) {
    const forged = await invoke({
      ...request,
      authUser: { userId: 'test', email: 'test@example.invalid', workspaceId: 'own', role: 'owner' },
    } as unknown as Request);
    assert.equal(forged.state.status, 403);
    assert.equal(forged.nextCalled, false);
  }

  const authorised = await invoke({
    headers: {}, query: {}, body: {},
    authUser: { userId: 'test', email: 'test@example.invalid', workspaceId: 'own', role: 'owner' },
  } as unknown as Request);
  assert.equal(authorised.nextCalled, true);
});
