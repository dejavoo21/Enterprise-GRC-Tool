import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiAnswer, parseAiSummary, validateAiText } from '../services/aiResponseValidation.js';

test('AI response validators accept bounded provider output', () => {
  assert.equal(validateAiText('  Recorded narrative  ', 'narrative'), 'Recorded narrative');
  assert.deepEqual(parseAiSummary('```json\n{"narrative":"Posture summary","keyInsights":["Recorded gap"],"recommendations":["Review control"]}\n```'), {
    narrative: 'Posture summary', keyInsights: ['Recorded gap'], recommendations: ['Review control'],
  });
  assert.deepEqual(parseAiAnswer('{"answer":"Recorded answer","confidence":"high","sources":["Control register"]}', 'answer'), {
    answer: 'Recorded answer', confidence: 'high', sources: ['Control register'],
  });
  assert.deepEqual(parseAiAnswer('Result: {"answer":"Use {recorded} evidence","confidence":"medium","sources":[]} trailing {not JSON}', 'answer'), {
    answer: 'Use {recorded} evidence', confidence: 'medium', sources: [],
  });
});

test('AI response validators reject malformed or unbounded provider output', () => {
  assert.throws(() => validateAiText('   ', 'narrative'), /invalid narrative/);
  assert.throws(() => validateAiText('x'.repeat(50_001), 'narrative'), /exceeding 50000/);
  assert.throws(() => parseAiSummary('{"narrative":"Summary","keyInsights":"not-a-list","recommendations":[]}'), /invalid key insights/);
  assert.throws(() => parseAiSummary('{"narrative":"Summary","keyInsights":[],"recommendations":[""]}'), /invalid recommendations\[0\]/);
  assert.throws(() => parseAiAnswer('{"answer":"Answer","confidence":"certain","sources":[]}', 'answer'), /invalid answer confidence/);
  assert.throws(() => parseAiAnswer('{"answer":"Answer","confidence":"low","sources":[1]}', 'answer'), /invalid answer sources\[0\]/);
  assert.throws(() => parseAiAnswer('not json', 'answer'), /invalid answer/);
  assert.throws(() => parseAiAnswer('{"answer":"unterminated', 'answer'), /invalid answer/);
  assert.throws(() => parseAiAnswer('x'.repeat(100_001), 'answer'), /invalid answer/);
});
