import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeScopedControls, validateScopeControlUpdate } from '../services/frameworkAssessmentScopeRules.js';

test('included controls require no exclusion metadata', () => assert.equal(validateScopeControlUpdate({ inclusionStatus: 'included' }), null));
test('non-included status requires a reason', () => assert.match(validateScopeControlUpdate({ inclusionStatus: 'excluded', justification: 'Business service is outside this assessment boundary.' }) || '', /Reason/));
test('non-included status requires justification', () => assert.match(validateScopeControlUpdate({ inclusionStatus: 'not_applicable', exclusionReason: 'not_applicable_to_scope' }) || '', /justification/));
test('Other requires detailed justification', () => assert.match(validateScopeControlUpdate({ inclusionStatus: 'excluded', exclusionReason: 'other', justification: 'Too short' }) || '', /20 characters/));
test('Deferred requires review date', () => assert.match(validateScopeControlUpdate({ inclusionStatus: 'deferred', exclusionReason: 'deferred_to_future_assessment', justification: 'Scheduled for the next formal assessment period.' }) || '', /review date/));
test('valid deferred scope passes validation', () => assert.equal(validateScopeControlUpdate({ inclusionStatus: 'deferred', exclusionReason: 'deferred_to_future_assessment', justification: 'Scheduled for the next formal assessment period.', reviewDate: '2027-01-15' }), null));
test('invalid free-text status is rejected', () => assert.match(validateScopeControlUpdate({ inclusionStatus: 'removed' }) || '', /Invalid inclusion status/));

test('readiness excludes excluded, not applicable, and out of scope controls', () => {
  const summary = summarizeScopedControls([
    { inclusionStatus: 'included', implementationStatus: 'implemented' },
    { inclusionStatus: 'included', implementationStatus: 'not_implemented' },
    { inclusionStatus: 'excluded', implementationStatus: 'not_implemented', exclusionReason: 'system_not_in_scope', justification: 'The system is outside the approved assessment boundary.' },
    { inclusionStatus: 'not_applicable', implementationStatus: 'not_implemented', exclusionReason: 'not_applicable_to_scope', justification: 'The requirement does not apply to services in scope.' },
    { inclusionStatus: 'out_of_scope', implementationStatus: 'not_implemented', exclusionReason: 'service_not_provided', justification: 'The organisation does not provide this service.' },
  ]);
  assert.equal(summary.total, 5); assert.equal(summary.applicable, 2); assert.equal(summary.completed, 1); assert.equal(summary.readinessPercent, 50);
});

test('inherited and deferred controls remain applicable', () => {
  const summary = summarizeScopedControls([
    { inclusionStatus: 'inherited', implementationStatus: 'implemented', exclusionReason: 'inherited_from_third_party', justification: 'Inherited from the contracted infrastructure provider.' },
    { inclusionStatus: 'deferred', implementationStatus: 'not_implemented', exclusionReason: 'deferred_to_future_assessment', justification: 'Scheduled for the next assessment period.' },
  ]);
  assert.equal(summary.applicable, 2); assert.equal(summary.readinessPercent, 50);
});

test('approval gaps count missing reasons and justifications', () => {
  const summary = summarizeScopedControls([{ inclusionStatus: 'excluded', implementationStatus: 'not_implemented' }]);
  assert.equal(summary.requiringJustification, 1);
});
