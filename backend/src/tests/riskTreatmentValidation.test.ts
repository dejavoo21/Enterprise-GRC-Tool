import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRiskTreatment } from '../services/riskTreatmentValidation.js';

const valid = { title:'Reduce privileged access exposure', strategy:'mitigate' as const, owner:'Risk Office', dueDate:'2026-12-01', status:'planned' as const, progressPercent:20, priority:'high' as const, approvalStatus:'not_required' as const };
test('accepts a valid treatment plan', () => assert.equal(validateRiskTreatment(valid), null));
test('rejects progress outside 0-100', () => assert.match(validateRiskTreatment({ ...valid, progressPercent: 101 })!, /between 0 and 100/));
test('requires acceptance rationale', () => assert.match(validateRiskTreatment({ ...valid, strategy:'accept', notes:'' })!, /requires rationale/));
test('requires 100 percent progress for completion', () => assert.match(validateRiskTreatment({ ...valid, status:'completed' })!, /100%/));
