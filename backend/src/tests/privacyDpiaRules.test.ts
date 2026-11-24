import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDpiaDecision, assertDpiaSubmission } from '../services/privacyDpiaRules.js';

test('DPIA submission requires a mutable state and validated evidence', () => {
  assert.doesNotThrow(() => assertDpiaSubmission('draft', ['evidence-id']));
  assert.doesNotThrow(() => assertDpiaSubmission('rejected', ['evidence-id']));
  assert.throws(() => assertDpiaSubmission('draft', []), /evidence/);
  assert.throws(() => assertDpiaSubmission('approved', ['evidence-id']), /draft or rejected/);
});

test('DPIA decision requires pending review and an independent reviewer', () => {
  assert.doesNotThrow(() => assertDpiaDecision('in_review', 'creator', 'reviewer'));
  assert.throws(() => assertDpiaDecision('draft', 'creator', 'reviewer'), /pending review/);
  assert.throws(() => assertDpiaDecision('in_review', 'same', 'same'), /cannot approve or reject/);
});
