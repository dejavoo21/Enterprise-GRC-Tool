import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateRiskTreatment } from '../services/riskTreatmentValidation.js';

const valid = { title:'Reduce privileged access exposure', strategy:'mitigate' as const, owner:'Risk Office', dueDate:'2026-12-01', status:'planned' as const, progressPercent:20, priority:'high' as const, approvalStatus:'not_required' as const };
test('accepts a valid treatment plan', () => assert.equal(validateRiskTreatment(valid), null));
test('rejects progress outside 0-100', () => assert.match(validateRiskTreatment({ ...valid, progressPercent: 101 })!, /between 0 and 100/));
test('requires acceptance rationale', () => assert.match(validateRiskTreatment({ ...valid, strategy:'accept', notes:'' })!, /requires rationale/));
test('requires 100 percent progress for completion', () => assert.match(validateRiskTreatment({ ...valid, status:'completed' })!, /100%/));
test('accepts decimal weighted forecasts and numeric factor profiles', () => {
  assert.equal(validateRiskTreatment({ ...valid, expectedResidualScore:2.6, expectedResidualFactors:{ likelihood:3, impact:3, control_weakness:2, exposure:2 } }), null);
  assert.match(validateRiskTreatment({ ...valid, expectedResidualFactors:{ likelihood:Number.NaN } })!, /numeric scores/);
});

test('treatment dialog locks captured values and dismissal while saving', () => {
  const modal = readFileSync(resolve(process.cwd(), '../frontend/src/components/RiskTreatmentModal.tsx'), 'utf8');
  const styles = readFileSync(resolve(process.cwd(), '../frontend/src/components/RiskTreatmentModal.css'), 'utf8');
  assert.match(modal, /const requestClose=\(\)=>\{if\(!saving\)onClose\(\);\};/);
  assert.match(modal, /onClose=\{requestClose\}/);
  assert.match(modal, /<form className="treatmentForm" aria-busy=\{saving\}/);
  assert.match(modal, /<fieldset className="treatmentFormFields" disabled=\{saving\}>/);
  assert.match(styles, /\.treatmentFormFields\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:680px\)\{\.treatmentFormFields\{grid-template-columns:1fr\}/);
});
