import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAiSystemDecision, assertAssessmentTransition, assertControlTransition, assertIncidentTransition } from '../services/aiLifecycleRules.js';

test('AI system decisions require a review state', () => {
  assert.doesNotThrow(() => assertAiSystemDecision('under_review'));
  assert.doesNotThrow(() => assertAiSystemDecision('validation'));
  assert.throws(() => assertAiSystemDecision('proposed'), /under review/i);
});

test('AI assessments follow controlled workflow and reserve decisions for review', () => {
  assert.doesNotThrow(() => assertAssessmentTransition('draft', 'in_progress'));
  assert.doesNotThrow(() => assertAssessmentTransition('in_progress', 'under_review'));
  assert.doesNotThrow(() => assertAssessmentTransition('under_review', 'approved', true));
  assert.throws(() => assertAssessmentTransition('draft', 'approved', true), /under review/i);
  assert.throws(() => assertAssessmentTransition('in_progress', 'approved'), /cannot move/i);
});

test('AI control and incident terminal transitions are constrained', () => {
  assert.doesNotThrow(() => assertControlTransition('planned', 'implemented'));
  assert.throws(() => assertControlTransition('implemented', 'planned'), /cannot move/i);
  assert.doesNotThrow(() => assertIncidentTransition('open', 'investigating'));
  assert.doesNotThrow(() => assertIncidentTransition('investigating', 'resolved'));
  assert.throws(() => assertIncidentTransition('resolved', 'open'), /cannot move/i);
});
