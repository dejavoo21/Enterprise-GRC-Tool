import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRiskTreatment } from '../services/riskTreatmentValidation.js';
import { validateActionStatusChange } from '../services/riskActionWorkflow.js';
import type { RiskTreatmentPlan } from '../types/riskTreatment.js';
import type { DashboardIssueRecord } from '../types/models.js';

const treatment = { title:'Contain exposure', strategy:'mitigate', owner:'Risk Office', dueDate:'2027-01-15', status:'under_review', progressPercent:100, priority:'high', approvalStatus:'approved', effectivenessRating:80, evidenceSummary:'Reviewed evidence supports implementation.', linkedControls:[] } as unknown as RiskTreatmentPlan;

test('treatment completion requires review, evidence summary, effectiveness and approval', () => {
  assert.equal(validateRiskTreatment({status:'completed'}, treatment), null);
  assert.match(validateRiskTreatment({status:'completed'}, {...treatment,status:'in_progress'})!, /under review/i);
  assert.match(validateRiskTreatment({status:'completed',evidenceSummary:''}, treatment)!, /evidence review summary/i);
  assert.match(validateRiskTreatment({status:'completed',effectivenessRating:0}, treatment)!, /effectiveness rating/i);
  assert.match(validateRiskTreatment({status:'completed',approvalStatus:'pending_approval'}, treatment)!, /approval/i);
});

test('source-managed actions cannot be closed outside their source workflow', () => {
  const action = { sourceManaged:true, status:'In Progress' } as DashboardIssueRecord;
  assert.match(validateActionStatusChange(action,'Completed')!, /authoritative source/i);
  assert.match(validateActionStatusChange(action,'Cancelled')!, /authoritative source/i);
  assert.equal(validateActionStatusChange(action,'Awaiting Review'), null);
  assert.equal(validateActionStatusChange({...action,sourceManaged:false},'Completed'), null);
});
