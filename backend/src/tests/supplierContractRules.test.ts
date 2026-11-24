import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertAssessmentTransition,
  assertContractTransition,
  assertIndependentDecision,
  assertSupplierCanOffboard,
  assertSupplierTransition,
  calculateContractDates,
} from '../services/supplierContractRules.js';

test('supplier lifecycle accepts governed transitions and blocks shortcuts', () => {
  assert.doesNotThrow(() => assertSupplierTransition('onboarding', 'pending_approval'));
  assert.doesNotThrow(() => assertSupplierTransition('pending_approval', 'active'));
  assert.throws(() => assertSupplierTransition('onboarding', 'active'), /cannot transition/);
  assert.throws(() => assertSupplierTransition('archived', 'active'), /cannot transition/);
});

test('assessment decisions require review and independent approval', () => {
  assert.doesNotThrow(() => assertAssessmentTransition('submitted', 'under_review'));
  assert.doesNotThrow(() => assertAssessmentTransition('under_review', 'approved_with_conditions'));
  assert.throws(() => assertAssessmentTransition('in_progress', 'approved'), /cannot transition/);
  assert.throws(() => assertIndependentDecision('user-a', 'user-a', 'approved'), /creator cannot/);
  assert.doesNotThrow(() => assertIndependentDecision('user-a', 'user-b', 'approved'));
  assert.doesNotThrow(() => assertIndependentDecision('user-a', 'user-a', 'under_review'));
});

test('contract renewal dates are timezone-safe and transitions are constrained', () => {
  assert.deepEqual(calculateContractDates('2026-12-31', 30, new Date('2026-11-23T20:00:00Z')), {
    daysToExpiry: 38,
    noticeDate: '2026-12-01',
    renewalState: 'scheduled',
  });
  assert.equal(calculateContractDates('2026-12-01', 30, new Date('2026-11-23T20:00:00Z')).renewalState, 'action_required');
  assert.doesNotThrow(() => assertContractTransition('approved', 'active'));
  assert.throws(() => assertContractTransition('draft', 'active'), /cannot transition/);
});

test('supplier offboarding is blocked while operational obligations remain', () => {
  assert.throws(() => assertSupplierCanOffboard(1, 0), /OFFBOARDING|active contracts/i);
  assert.throws(() => assertSupplierCanOffboard(0, 2), /open actions/i);
  assert.doesNotThrow(() => assertSupplierCanOffboard(0, 0));
});
