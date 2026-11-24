import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db.js';
import {
  InvalidLinkTarget,
  getDocumentsForControl,
  linkControlToDocument,
  linkControlToTraining,
  linkDocumentToTraining,
} from '../repositories/controlLinkingRepo.js';
import { createAssetRelationship } from '../repositories/assetsRepo.js';
import { createControlMapping, deleteMapping } from '../repositories/controlMappingsRepo.js';

test('cross-module link writes validate both endpoints in the authorised workspace', async () => {
  const original = pool.query.bind(pool);
  const calls: Array<{ text: string; values: unknown[] }> = [];
  (pool as unknown as { query: typeof pool.query }).query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(linkControlToDocument('workspace-a', 'control-a', 'foreign-document'), InvalidLinkTarget);
    await assert.rejects(linkControlToTraining('workspace-a', 'control-a', 'foreign-course'), InvalidLinkTarget);
    await assert.rejects(linkDocumentToTraining('workspace-a', 'document-a', 'foreign-course'), InvalidLinkTarget);
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.match(call.text, /SELECT \$1/);
      assert.match(call.text, /workspace_id = \$1/);
      assert.equal(call.values[0], 'workspace-a');
    }
  } finally {
    (pool as unknown as { query: typeof pool.query }).query = original;
  }
});

test('control document reads constrain both sides of the join to one workspace', async () => {
  const original = pool.query.bind(pool);
  let sql = '';
  (pool as unknown as { query: typeof pool.query }).query = (async (text: string) => {
    sql = text;
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    assert.deepEqual(await getDocumentsForControl('workspace-a', 'control-a'), []);
    assert.match(sql, /cgd\.workspace_id = gd\.workspace_id/);
    assert.match(sql, /cgd\.workspace_id = \$1/);
  } finally {
    (pool as unknown as { query: typeof pool.query }).query = original;
  }
});

test('asset relationships and control mappings cannot target foreign workspace records', async () => {
  const original = pool.query.bind(pool);
  const calls: Array<{ text: string; values: unknown[] }> = [];
  (pool as unknown as { query: typeof pool.query }).query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(createAssetRelationship('workspace-a', 'asset-a', {
      relationshipType: 'risk',
      targetId: 'foreign-risk',
      targetName: 'Known foreign title',
    }), /unavailable/);
    await assert.rejects(createControlMapping('workspace-a', {
      controlId: 'foreign-control',
      framework: 'ISO 27001',
      reference: 'A.5.1',
    }), /unavailable/);
    assert.equal(await deleteMapping('workspace-a', 'foreign-mapping'), false);
    assert.match(calls[0].text, /FROM risks target\s+WHERE target\.workspace_id = \$2 AND target\.id::text = \$5/);
    assert.match(calls[1].text, /FROM controls WHERE workspace_id = \$5 AND id = \$1/);
    assert.match(calls[2].text, /USING controls/);
    assert.deepEqual(calls[2].values, ['foreign-mapping', 'workspace-a']);
  } finally {
    (pool as unknown as { query: typeof pool.query }).query = original;
  }
});
