import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIndependentModelDecision, assertModelSubmission } from '../services/aiModelReviewRules.js';

test('model submission requires a validated or conditional result', () => {
  assert.doesNotThrow(() => assertModelSubmission('pending', 'validated'));
  assert.throws(() => assertModelSubmission('pending', 'pending'), /validation/i);
  assert.throws(() => assertModelSubmission('approved', 'validated'), /pending or rejected/i);
});

test('model decision requires independent review', () => {
  assert.doesNotThrow(() => assertIndependentModelDecision('in_review', 'creator', 'reviewer'));
  assert.throws(() => assertIndependentModelDecision('in_review', 'same', 'same'), /creator cannot/i);
  assert.throws(() => assertIndependentModelDecision('in_review', undefined, 'reviewer'), /creator provenance/i);
  assert.throws(() => assertIndependentModelDecision('pending', 'creator', 'reviewer'), /under review/i);
});
