import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCorrectiveActionTransition, assertIndependentCorrectiveClosure, assertIndependentRecoveryPlanApproval, assertRecoveryPlanSubmission } from '../services/bcmLifecycleRules.js';

test('recovery plans require review and an independent approver', () => {
  assert.doesNotThrow(() => assertRecoveryPlanSubmission('draft'));
  assert.throws(() => assertRecoveryPlanSubmission('in_review'), /draft/i);
  assert.doesNotThrow(() => assertIndependentRecoveryPlanApproval('in_review', 'creator', 'approver'));
  assert.throws(() => assertIndependentRecoveryPlanApproval('draft', 'creator', 'approver'), /under review/i);
  assert.throws(() => assertIndependentRecoveryPlanApproval('in_review', 'same', 'same'), /creator cannot/i);
});

test('BCM corrective actions follow the controlled lifecycle', () => {
  assert.doesNotThrow(() => assertCorrectiveActionTransition('open', 'in_progress'));
  assert.doesNotThrow(() => assertCorrectiveActionTransition('in_progress', 'awaiting_review'));
  assert.throws(() => assertCorrectiveActionTransition('open', 'closed'), /cannot move/i);
  assert.throws(() => assertCorrectiveActionTransition('closed', 'in_progress'), /cannot move/i);
});

test('BCM corrective closure requires independent review and evidence', () => {
  assert.doesNotThrow(() => assertIndependentCorrectiveClosure('awaiting_review', 'creator', 'reviewer', ['EVD-1'], 'Verified recovery outcome.'));
  assert.throws(() => assertIndependentCorrectiveClosure('in_progress', 'creator', 'reviewer', ['EVD-1'], 'Verified.'), /awaiting review/i);
  assert.throws(() => assertIndependentCorrectiveClosure('awaiting_review', 'same', 'same', ['EVD-1'], 'Verified.'), /creator cannot/i);
  assert.throws(() => assertIndependentCorrectiveClosure('awaiting_review', 'creator', 'reviewer', [], 'Verified.'), /evidence/i);
});
