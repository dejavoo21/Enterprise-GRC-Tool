import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPolicyCanBeAcknowledged,
  assertPolicyCanBePublished,
  policyStatusForWorkflowOutcome,
} from '../services/policyWorkflowRules.js';

test('workflow outcomes produce controlled policy states without auto-publication', () => {
  assert.equal(policyStatusForWorkflowOutcome('draft', 'submitted'), 'under_review');
  assert.equal(policyStatusForWorkflowOutcome('under_review', 'approved'), 'approved');
  assert.equal(policyStatusForWorkflowOutcome('under_review', 'rejected'), 'rejected');
  assert.equal(policyStatusForWorkflowOutcome('approved', 'changes_requested'), 'under_review');
  assert.equal(policyStatusForWorkflowOutcome('published', 'rejected'), 'published');
});

test('publication requires an approved source and approved workflow', () => {
  assert.doesNotThrow(() => assertPolicyCanBePublished('approved', 'approved'));
  assert.throws(() => assertPolicyCanBePublished('under_review', 'approved'));
  assert.throws(() => assertPolicyCanBePublished('approved', 'awaiting_review'));
});

test('acknowledgement is limited to published policy states', () => {
  assert.doesNotThrow(() => assertPolicyCanBeAcknowledged('published'));
  assert.doesNotThrow(() => assertPolicyCanBeAcknowledged('active'));
  assert.throws(() => assertPolicyCanBeAcknowledged('approved'));
});
