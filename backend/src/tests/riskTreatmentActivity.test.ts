import test from 'node:test';
import assert from 'node:assert/strict';
import { riskTreatmentActivityAction } from '../services/riskTreatmentActivity.js';

test('editing a completed plan does not record another completion', () => {
  const completed = { status: 'completed', progressPercent: 100 };
  assert.equal(riskTreatmentActivityAction(completed, completed), 'risk_treatment_updated');
});

test('only a transition into completed records completion', () => {
  assert.equal(riskTreatmentActivityAction({ status: 'in_progress', progressPercent: 80 }, { status: 'completed', progressPercent: 100 }), 'risk_treatment_completed');
  assert.equal(riskTreatmentActivityAction({ status: 'completed', progressPercent: 100 }, { status: 'under_review', progressPercent: 100 }), 'risk_treatment_status_changed');
});

test('progress edits and ordinary updates retain their own action labels', () => {
  assert.equal(riskTreatmentActivityAction({ status: 'in_progress', progressPercent: 20 }, { status: 'in_progress', progressPercent: 40 }), 'risk_treatment_progress_changed');
  assert.equal(riskTreatmentActivityAction({ status: 'planned', progressPercent: 0 }, { status: 'planned', progressPercent: 0 }), 'risk_treatment_updated');
});
