import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db.js';
import { createAssessment, createContract, createQuestion, getQuestionsByQuestionnaireId, upsertResponse } from '../repositories/tprmRepo.js';

test('TPRM questionnaire children are read and written through the authenticated workspace', async () => {
  const original = pool.query.bind(pool);
  const calls: Array<{ text: string; values: unknown[] }> = [];
  (pool as unknown as { query: typeof pool.query }).query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    assert.deepEqual(await getQuestionsByQuestionnaireId('workspace-a', 'questionnaire-a'), []);
    await assert.rejects(createQuestion('workspace-a', {
      questionnaireId: 'foreign-questionnaire',
      category: 'Security',
      questionText: 'Foreign question',
    }), /unavailable/);
    await assert.rejects(upsertResponse('workspace-a', {
      questionId: 'foreign-question',
      responseText: 'Attempted response',
    }), /unavailable/);

    assert.match(calls[0].text, /questionnaire\.workspace_id = \$1/);
    assert.deepEqual(calls[0].values, ['workspace-a', 'questionnaire-a']);
    assert.match(calls[1].text, /workspace_id = \$12/);
    assert.equal(calls[1].values[11], 'workspace-a');
    assert.match(calls[2].text, /questionnaire\.workspace_id = \$6/);
    assert.equal(calls[2].values[5], 'workspace-a');
  } finally {
    (pool as unknown as { query: typeof pool.query }).query = original;
  }
});

test('supplier assessments and contracts reject foreign-workspace supplier identifiers', async () => {
  const original = pool.query.bind(pool);
  const calls: Array<{ text: string; values: unknown[] }> = [];
  (pool as unknown as { query: typeof pool.query }).query = (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    return { rows: [], rowCount: 0 } as never;
  }) as typeof pool.query;
  try {
    await assert.rejects(createAssessment('workspace-a', { vendorId: 'foreign-vendor' }, 'user-a'), /unavailable in this workspace/);
    await assert.rejects(createContract('workspace-a', { vendorId: 'foreign-vendor', contractName: 'Foreign contract' }), /unavailable in this workspace/);
    assert.match(calls[0].text, /vendors WHERE id=\$3 AND workspace_id=\$2/);
    assert.deepEqual(calls[0].values.slice(1, 3), ['workspace-a', 'foreign-vendor']);
    assert.match(calls[1].text, /vendors WHERE id=\$3 AND workspace_id=\$2/);
    assert.deepEqual(calls[1].values.slice(1, 3), ['workspace-a', 'foreign-vendor']);
  } finally {
    (pool as unknown as { query: typeof pool.query }).query = original;
  }
});
