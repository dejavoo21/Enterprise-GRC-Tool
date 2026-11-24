import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAssuranceDecision, assertAssuranceSubmission } from '../services/controlAssuranceRules.js';

test('control effectiveness submission requires draft state and evidence', () => {
  assert.doesNotThrow(() => assertAssuranceSubmission('draft', ['evidence-id']));
  assert.doesNotThrow(() => assertAssuranceSubmission('rejected', ['evidence-id']));
  assert.throws(() => assertAssuranceSubmission('draft', []), /evidence/);
  assert.throws(() => assertAssuranceSubmission('approved', ['evidence-id']), /draft or rejected/);
});

test('control effectiveness decision requires an independent reviewer', () => {
  assert.doesNotThrow(() => assertAssuranceDecision('pending_review', 'creator', 'reviewer'));
  assert.throws(() => assertAssuranceDecision('draft', 'creator', 'reviewer'), /pending review/);
  assert.throws(() => assertAssuranceDecision('pending_review', 'same-user', 'same-user'), /cannot approve or reject/);
});
