import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db.js';
import { assertWorkspaceLinks, WorkspaceLinkValidationError } from '../services/workspaceLinkValidation.js';

test('workspace link validation accepts only records owned by the authenticated workspace', async () => {
  const original = pool.query.bind(pool);
  const calls: Array<{ text: string; values: unknown[] }> = [];
  pool.query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [{ id: 'risk-1' }, { id: 'risk-2' }], rowCount: 2 } as never;
  }) as typeof pool.query;

  try {
    await assertWorkspaceLinks('workspace-a', { risks: ['risk-1', 'risk-2', 'risk-1'] });
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /FROM risks WHERE workspace_id = \$1/);
    assert.deepEqual(calls[0].values, ['workspace-a', ['risk-1', 'risk-2']]);
  } finally {
    pool.query = original;
  }
});

test('workspace link validation rejects missing, foreign, and malformed records generically', async () => {
  const original = pool.query.bind(pool);
  let queryCount = 0;
  pool.query = (async () => {
    queryCount += 1;
    return { rows: [{ id: 'risk-1' }], rowCount: 1 } as never;
  }) as typeof pool.query;

  try {
    await assert.rejects(
      assertWorkspaceLinks('workspace-a', { risks: ['risk-1', 'foreign-risk'] }),
      (error: unknown) => error instanceof WorkspaceLinkValidationError && error.message === 'One or more linked records are unavailable',
    );
    assert.equal(queryCount, 1);
    await assert.rejects(assertWorkspaceLinks('workspace-a', { controls: ['control-1', ''] }), WorkspaceLinkValidationError);
    assert.equal(queryCount, 1, 'malformed links must fail before database access');
    await assertWorkspaceLinks('workspace-a', { controls: [], risks: undefined });
    assert.equal(queryCount, 1, 'empty and omitted links must not query');
  } finally {
    pool.query = original;
  }
});
