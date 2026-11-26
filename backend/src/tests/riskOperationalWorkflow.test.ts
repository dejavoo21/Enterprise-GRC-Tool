import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('source-managed action status cannot diverge from its source workflow', () => {
  const action = { sourceManaged:true, status:'In Progress' } as DashboardIssueRecord;
  assert.match(validateActionStatusChange(action,'Completed')!, /authoritative source/i);
  assert.match(validateActionStatusChange(action,'Cancelled')!, /authoritative source/i);
  assert.match(validateActionStatusChange(action,'Awaiting Review')!, /authoritative source/i);
  assert.equal(validateActionStatusChange(action,'In Progress'), null);
  assert.equal(validateActionStatusChange({...action,sourceManaged:false},'Completed'), null);
});

test('treatment evidence mutations reject duplicates and stale workspace context', () => {
  const panel = readFileSync('../frontend/src/pages/TreatmentEvidencePanel.tsx', 'utf8');
  assert.match(panel, /const mutationLock = useRef\(false\)/);
  assert.match(panel, /const mutationSequence = useRef\(0\)/);
  assert.match(panel, /if \(mutationLock\.current\) return/);
  assert.match(panel, /mutationLock\.current = true/);
  assert.match(panel, /const request=\+\+generation\.current/);
  assert.match(panel, /const mutation=\+\+mutationSequence\.current/);
  assert.match(panel, /const capturedWorkspaceId=workspaceId/);
  assert.match(panel, /const capturedTreatmentId=treatmentId/);
  assert.match(panel, /const payload=JSON\.stringify\(\{evidenceId:id,linked\}\)/);
  assert.equal((panel.match(/capturedWorkspaceId===workspaceId&&capturedTreatmentId===treatmentId/g) || []).length, 2);
  assert.match(panel, /if\(mutation===mutationSequence\.current\)\{mutationLock\.current=false/);
  assert.match(panel, /\},\[workspaceId,treatmentId,retry\]\)/);
});

test('governed risk decisions reject duplicates and stale workspace context', () => {
  const page = readFileSync('../frontend/src/pages/Risks.tsx', 'utf8');
  assert.match(page, /const riskActionLock = useRef\(false\)/);
  assert.match(page, /const riskActionGeneration = useRef\(0\)/);
  assert.match(page, /riskActionGeneration\.current \+= 1/);
  assert.match(page, /if \(!riskActionTarget \|\| !riskAction \|\| riskActionLock\.current\) return/);
  assert.match(page, /const capturedWorkspaceId = workspaceId/);
  assert.match(page, /const actorRole = role/);
  assert.match(page, /const target = riskActionTarget/);
  assert.match(page, /const action = riskAction/);
  assert.equal((page.match(/generation !== riskActionGeneration\.current/g) || []).length, 2);
  assert.match(page, /riskActionLock\.current = false/);
});

test('risk intelligence configuration writes reject duplicates and stale workspace context', () => {
  const page = readFileSync('../frontend/src/pages/Risks.tsx', 'utf8');
  assert.match(page, /const intelligenceConfigLock = useRef\(false\)/);
  assert.match(page, /const intelligenceConfigGeneration = useRef\(0\)/);
  assert.match(page, /intelligenceConfigGeneration\.current \+= 1/);
  assert.match(page, /if \(intelligenceConfigLock\.current\) return/);
  assert.match(page, /if \(!state \|\| intelligenceConfigLock\.current\) return/);
  assert.equal((page.match(/intelligenceConfigLock\.current = true/g) || []).length, 2);
  assert.equal((page.match(/generation !== intelligenceConfigGeneration\.current/g) || []).length, 4);
  assert.equal((page.match(/intelligenceConfigLock\.current = false/g) || []).length, 2);
  assert.match(page, /updateRiskToleranceProfile\(category, payload\)/);
  assert.match(page, /updateRiskQuantificationWeights\(payload\)/);
});

test('risk operations KPI navigation carries the reviewed scope into its destination', () => {
  const overview = readFileSync('../frontend/src/pages/RiskOperationsOverview.tsx', 'utf8');
  const page = readFileSync('../frontend/src/pages/Issues.tsx', 'utf8');
  assert.match(overview, /\{ tab: 'tracker', intent: \{ priority: 'Critical', sort: 'priority' \} \}/);
  assert.match(overview, /\{ tab: 'overdue' \}/);
  assert.match(overview, /\{ tab: 'reports' \}/);
  assert.match(overview, /Review priority actions/);
  assert.match(page, /const openOverviewTab = \(tab: OperationsTab, intent: OverviewNavigationIntent = \{\}\)/);
  assert.match(page, /priority: intent\.priority \?\? null/);
  assert.match(page, /setSort\(intent\.sort \?\? 'source'\)/);
  assert.match(page, /setSelectedIssueId\(null\)/);
});

test('risk operations type intents open distinct persisted action workspaces', () => {
  const page = readFileSync('../frontend/src/pages/Issues.tsx', 'utf8');
  assert.match(page, /treatment: \{ tab: 'treatments', source: 'Treatment', label: 'Treatment actions' \}/);
  assert.match(page, /control: \{ tab: 'controls', source: 'Control', label: 'Control actions' \}/);
  assert.match(page, /evidence: \{ tab: 'evidence', source: 'Evidence', label: 'Evidence requests' \}/);
  assert.match(page, /'audit-blocker': \{ tab: 'tracker', source: 'Audit Readiness', label: 'Audit blockers' \}/);
  assert.match(page, /readIssueQueryType\(searchParams\.get\('type'\)\)/);
  assert.match(page, /queryType \? ISSUE_QUERY_VIEWS\[queryType\]\.source : explicitSourceFilter \?\? tabSource/);
  assert.match(page, /explicitSourceFilter && !queryType/);
  assert.match(page, /type: null/);
  assert.doesNotMatch(page, /This action source is route-ready/);
});

test('risk treatment submissions capture reviewed context and reject stale duplicates', () => {
  const page = readFileSync('../frontend/src/pages/Risks.tsx', 'utf8');
  assert.match(page, /const treatmentMutationLock = useRef\(false\)/);
  assert.match(page, /const treatmentMutationGeneration = useRef\(0\)/);
  assert.match(page, /treatmentMutationGeneration\.current \+= 1/);
  assert.match(page, /if \(!treatmentRisk \|\| treatmentMutationLock\.current\) return/);
  assert.match(page, /const riskId = treatmentRisk\.id/);
  assert.match(page, /const treatmentId = editingTreatment\?\.id \?\? null/);
  assert.match(page, /linkedControls: input\.linkedControls\?\.map\(\(control\) => \(\{ \.\.\.control \}\)\)/);
  assert.equal((page.match(/generation !== treatmentMutationGeneration\.current/g) || []).length, 2);
  assert.match(page, /if\(treatmentMutationLock\.current\)return/);
  assert.match(page, /treatmentMutationLock\.current = false/);
});
