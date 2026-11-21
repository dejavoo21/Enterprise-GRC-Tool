import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db.js';
import { createQuestion, getQuestionsByQuestionnaireId, upsertResponse } from '../repositories/tprmRepo.js';

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
