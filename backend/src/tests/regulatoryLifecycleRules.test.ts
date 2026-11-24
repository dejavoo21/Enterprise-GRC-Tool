import assert from 'node:assert/strict';
import test from 'node:test';
import { assertChangeTransition, assertIndependentApproval, assertTaskTransition } from '../services/regulatoryLifecycleRules.js';

test('regulatory changes follow controlled review transitions', () => {
  assert.doesNotThrow(() => assertChangeTransition('pending', 'in_review'));
  assert.doesNotThrow(() => assertChangeTransition('in_review', 'approved'));
  assert.throws(() => assertChangeTransition('pending', 'approved'));
  assert.throws(() => assertChangeTransition('approved', 'in_review'));
});

test('regulatory decisions require an independent reviewer', () => {
  assert.doesNotThrow(() => assertIndependentApproval('creator', 'reviewer'));
  assert.throws(() => assertIndependentApproval('creator', 'creator'));
  assert.throws(() => assertIndependentApproval(null, 'reviewer'));
});

test('regulatory tasks cannot bypass active work', () => {
  assert.doesNotThrow(() => assertTaskTransition('open', 'in_progress'));
  assert.doesNotThrow(() => assertTaskTransition('in_progress', 'completed'));
  assert.throws(() => assertTaskTransition('open', 'completed'));
  assert.throws(() => assertTaskTransition('completed', 'in_progress'));
});
