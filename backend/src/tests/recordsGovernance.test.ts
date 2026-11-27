import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateRetention, validateArchiveTransition, validateDisposalTransition, validateHoldTransition, validateRetentionRule } from '../services/recordsGovernance.js';

test('retention calculation is unavailable without an explicit rule', () => assert.equal(calculateRetention({}).status, 'Retention Unavailable'));
test('legal hold takes precedence over retention eligibility', () => assert.equal(calculateRetention({ triggerDate: '2020-01-01', durationMonths: 12, activeHoldCount: 1, now: new Date('2026-01-01') }).status, 'On Hold'));
test('elapsed retention creates a review requirement rather than deletion', () => assert.deepEqual(calculateRetention({ triggerDate: '2020-01-01', durationMonths: 12, now: new Date('2026-01-01') }), { status: 'Disposal Review Required', eligibilityDate: '2021-01-01' }));
test('retention rules reject unsupported source types and invalid duration', () => assert.equal(validateRetentionRule({ name: 'x', recordType: 'incident', triggerEvent: 'created_at', durationMonths: 0 }).length, 2));
test('retention rules support canonical risk records without assuming a classification', () => assert.deepEqual(validateRetentionRule({ name: 'Risk schedule', recordType: 'risk', triggerEvent: 'updated_at', durationMonths: 12 }), []));
test('retention rules support canonical supplier records without assuming a classification', () => assert.deepEqual(validateRetentionRule({ name: 'Supplier schedule', recordType: 'supplier', triggerEvent: 'updated_at', durationMonths: 24 }), []));
test('retention rules support canonical audit findings without assuming a classification', () => assert.deepEqual(validateRetentionRule({ name: 'Audit finding schedule', recordType: 'audit_finding', triggerEvent: 'updated_at', durationMonths: 84 }), []));
test('retention rules support privacy data inventory records', () => assert.deepEqual(validateRetentionRule({ name: 'Privacy data schedule', recordType: 'privacy_data', triggerEvent: 'updated_at', durationMonths: 36, classification: 'Restricted' }), []));
test('retention rules support native incident and vulnerability dates', () => {
  assert.deepEqual(validateRetentionRule({ name: 'Incident schedule', recordType: 'security_incident', triggerEvent: 'detected_at', durationMonths: 72 }), []);
  assert.deepEqual(validateRetentionRule({ name: 'Vulnerability schedule', recordType: 'security_vulnerability', triggerEvent: 'discovered_at', durationMonths: 36 }), []);
});
test('retention rules support canonical AI system inventory records', () => assert.deepEqual(validateRetentionRule({ name: 'AI inventory schedule', recordType: 'ai_system', triggerEvent: 'updated_at', durationMonths: 60 }), []));
test('active hold blocks disposal progression', () => assert.match(validateDisposalTransition('Eligibility Review', 'Approval', 1) ?? '', /block/));
test('disposal completion requires the controlled lifecycle', () => assert.match(validateDisposalTransition('Proposed', 'Verified Completed') ?? '', /Cannot move/));
test('archive requests cannot skip review and approval', () => assert.match(validateArchiveTransition('Proposed', 'Scheduled') ?? '', /Cannot move/));
test('legal hold release requires an active approved hold', () => assert.match(validateHoldTransition('Pending Approval', 'Released') ?? '', /Cannot move/));
test('records lifecycle requests use a reviewed accessible dialog', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  assert.doesNotMatch(page, /window\.(prompt|alert|confirm)/);
  assert.match(page, /function RecordsRequestModal/);
  assert.match(page, /This records a controlled request only/);
  assert.match(page, /does not archive, dispose of, or delete/);
  assert.match(page, /role="alert"/);
  assert.match(page, /const requestClose=\(\)=>\{if\(!saving&&!submitLock\.current\)onClose\(\);\};/);
  assert.match(page, /onClose=\{requestClose\}[\s\S]*onClick=\{requestClose\} disabled=\{saving\}/);
  assert.match(page, /const submit=async\(\)=>\{if\(submitLock\.current\)return/);
  assert.match(page, /const submitLock=useRef\(false\)/);
  assert.match(page, /submitLock\.current=true/);
  assert.match(page, /submitLock\.current=false/);
  assert.match(page, /textarea rows=\{4\}.*disabled=\{saving\}/);
});

test('records governance mutations reject duplicate requests and announce persisted outcomes', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  assert.match(page, /async function sync\(\)\{if\(operationLock\.current\)return/);
  assert.match(page, /async function createRule\(form:HTMLFormElement\)\{if\(operationLock\.current\)return/);
  assert.match(page, /async function createRequest\(record:RecordItem,type:'Archive'\|'Disposal',reason:string\)\{if\(operationLock\.current\)throw new Error/);
  assert.match(page, /const operationLock=useRef\(false\)/);
  assert.equal((page.match(/operationLock\.current=true/g) || []).length, 6);
  assert.equal((page.match(/operationLock\.current=false/g) || []).length, 7);
  assert.match(page, /Governed records index refreshed from authorised source modules/);
  assert.match(page, /without changing the source record/);
  assert.match(page, /role="status"/);
});

test('records governance exposes governed legal hold and request decisions', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  assert.match(repository, /FROM governed_record_index WHERE workspace_id=\$1 AND id=ANY\(\$2::text\[\]\) FOR SHARE/);
  assert.match(repository, /governedRecords\.rows\.length!==recordIds\.length/);
  assert.match(repository, /'legal_hold',\$3,'created'/);
  assert.match(repository, /A decision rationale between 10 and 2000 characters is required/);
  assert.match(repository, /Destructive execution is disabled; completion cannot be verified/);
  assert.match(page, /function LegalHoldModal/);
  assert.match(page, /function LifecycleDecisionModal/);
  assert.match(page, />Place legal hold<\/Button>/);
  assert.match(page, /await apiCall\(`\$\{API_BASE\}\/records-governance\/holds\/\$\{hold\.id\}`/);
  assert.match(page, /await apiCall\(`\$\{API_BASE\}\/records-governance\/requests\/\$\{item\.id\}`/);
  assert.doesNotMatch(page, /disposalTransitions[^;]*Verified Completed/);
  assert.doesNotMatch(page, /archiveTransitions[^;]*Verified Completed/);
});

test('records governance rejects stale workspace reads and operation outcomes', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  assert.match(page, /const \{workspaceId\}=useWorkspace\(\);const activeWorkspaceId=workspaceId\|\|''/);
  assert.match(page, /const sequence=\+\+stateRequestSequence\.current;const requestedWorkspaceId=currentWorkspaceIdRef\.current/);
  assert.match(page, /sequence!==stateRequestSequence\.current\|\|requestedWorkspaceId!==currentWorkspaceIdRef\.current/);
  assert.match(page, /setOverview\(null\);setRecords\(\[\]\);setRules\(\[\]\);setHolds\(\[\]\);setRequests\(\[\]\);setSelected\(null\);setRequestDraft\(null\)/);
  assert.match(page, /\[activeWorkspaceId,load\]/);
  assert.equal((page.match(/const sequence=\+\+operationSequence\.current/g) || []).length, 6);
  assert.equal((page.match(/if\(requestedWorkspaceId!==currentWorkspaceIdRef\.current\)return/g) || []).length, 6);
  assert.match(page, /catch\(e\)\{if\(requestedWorkspaceId===currentWorkspaceIdRef\.current\)throw e;\}/);
});

test('records governance distinguishes loading, filtered-empty and complete source coverage states', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  assert.match(page, /Loading the governed records index and retention configuration/);
  assert.match(page, /Clear filters/);
  assert.match(page, /No indexed records match these filters/);
  assert.match(page, /All currently configured source groups are represented/);
  assert.doesNotMatch(page, /detail:'Policy and evidence sources'/);
});

test('records governance indexes workspace-scoped suppliers with stable references', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/recordsGovernance.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261124-records-governance-supplier-source.sql'), 'utf8');
  assert.match(repository, /FROM vendors WHERE workspace_id=\$1/);
  assert.match(repository, /row\.supplier_ref\|\|row\.id/);
  assert.match(repository, /'supplier',\$3,\$4,\$5,NULL/);
  assert.match(repository, /supportedSources:\[[^\]]*'Supplier records'/);
  assert.doesNotMatch(repository, /unsupportedSources:\[[^\]]*Supplier/);
  assert.match(routes, /requirePermission\('Vendors','view'\)/);
  assert.match(page, /<option value="supplier">Supplier record<\/option>/);
  assert.match(migration, /CHECK \(record_type IN \('governance_document', 'evidence', 'risk', 'supplier'\)\)/);
  assert.match(migration, /CHECK \(source_type IN \('governance_document', 'evidence', 'risk', 'supplier'\)\)/);
});

test('records governance indexes workspace-scoped audit findings without conflating audit entities', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/recordsGovernance.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261124-records-governance-audit-source.sql'), 'utf8');
  assert.match(repository, /FROM audit_findings WHERE workspace_id=\$1/);
  assert.match(repository, /row\.finding_id\|\|row\.id/);
  assert.match(repository, /'audit_finding',\$3,\$4,\$5,NULL/);
  assert.match(repository, /supportedSources:\[[^\]]*'Audit findings'/);
  assert.doesNotMatch(repository, /unsupportedSources:\[[^\]]*'Audit'/);
  assert.match(routes, /requirePermission\('Audits','view'\)/);
  assert.match(page, /<option value="audit_finding">Audit finding<\/option>/);
  assert.match(migration, /CHECK \(record_type IN \('governance_document', 'evidence', 'risk', 'supplier', 'audit_finding'\)\)/);
  assert.match(migration, /CHECK \(source_type IN \('governance_document', 'evidence', 'risk', 'supplier', 'audit_finding'\)\)/);
});

test('records governance preserves privacy inventory classification without inferring retention duration', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/recordsGovernance.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261124-records-governance-privacy-source.sql'), 'utf8');
  assert.match(repository, /FROM privacy_data_inventory WHERE workspace_id=\$1/);
  assert.match(repository, /row\.data_asset_id\|\|row\.id/);
  assert.match(repository, /ruleFor\('privacy_data',classification\)/);
  assert.match(repository, /retentionRequirement:row\.retention_requirement\|\|null/);
  assert.doesNotMatch(repository, /durationMonths:row\.retention_requirement/);
  assert.match(repository, /supportedSources:\[[^\]]*'Privacy data inventory'/);
  assert.doesNotMatch(repository, /unsupportedSources:\[[^\]]*'Privacy'/);
  assert.match(routes, /requirePermission\('Reports','view'\)/);
  assert.match(page, /<option value="privacy_data">Privacy data inventory record<\/option>/);
  assert.match(migration, /'audit_finding', 'privacy_data'/);
});

test('records governance indexes incidents and vulnerabilities as separate source classes', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/recordsGovernance.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261124-records-governance-incident-source.sql'), 'utf8');
  assert.match(repository, /FROM security_incidents WHERE workspace_id=\$1/);
  assert.match(repository, /FROM security_vulnerabilities WHERE workspace_id=\$1/);
  assert.match(repository, /row\.incident_ref\|\|row\.id/);
  assert.match(repository, /row\.vulnerability_ref\|\|row\.id/);
  assert.match(repository, /rule\?\.trigger_event==='detected_at'\?row\.detected_at/);
  assert.match(repository, /rule\?\.trigger_event==='discovered_at'\?row\.discovered_at/);
  assert.match(repository, /supportedSources:\[[^\]]*'Security incidents','Security vulnerabilities'/);
  assert.doesNotMatch(repository, /unsupportedSources:\[[^\]]*'Incident'/);
  assert.match(routes, /requirePermission\('Incidents','view'\)/);
  assert.match(page, /<option value="security_incident">Security incident<\/option>/);
  assert.match(page, /<option value="security_vulnerability">Security vulnerability<\/option>/);
  assert.match(page, /<option value="detected_at">Detected date<\/option>/);
  assert.match(page, /<option value="discovered_at">Discovered date<\/option>/);
  assert.match(migration, /'security_incident', 'security_vulnerability'/);
});

test('records governance indexes AI systems without misusing regulatory AI classification', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/recordsGovernance.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261124-records-governance-ai-source.sql'), 'utf8');
  assert.match(repository, /FROM ai_inventory WHERE workspace_id=\$1/);
  assert.match(repository, /VALUES\(\$1,\$2,'ai_system',\$3,\$3,\$4,NULL/);
  assert.match(repository, /aiClassification:row\.classification\|\|null/);
  assert.match(repository, /supportedSources:\[[^\]]*'AI systems'/);
  assert.match(repository, /unsupportedSources:\[\]/);
  assert.match(routes, /requirePermission\('AI','view'\)/);
  assert.match(page, /<option value="ai_system">AI system<\/option>/);
  assert.match(migration, /'security_vulnerability', 'ai_system'/);
});

test('records governance indexes workspace-scoped risks without fabricating classification', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/recordsGovernanceRepo.ts'), 'utf8');
  const routes = readFileSync(resolve(process.cwd(), 'src/routes/recordsGovernance.ts'), 'utf8');
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RecordsGovernance.tsx'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261124-records-governance-risk-source.sql'), 'utf8');
  assert.match(repository, /FROM risks WHERE workspace_id=\$1/);
  assert.match(repository, /row\.risk_ref\|\|row\.id/);
  assert.match(repository, /'risk',\$3,\$4,\$5,NULL/);
  assert.match(repository, /supportedSources:\[[^\]]*'Risk records'/);
  assert.doesNotMatch(repository, /unsupportedSources:\[[^\]]*Risk records/);
  assert.match(routes, /requirePermission\('Risks','view'\)/);
  assert.match(page, /<option value="risk">Risk record<\/option>/);
  assert.match(page, /item\.classification\|\|'Not classified'/);
  assert.match(migration, /CHECK \(record_type IN \('governance_document', 'evidence', 'risk'\)\)/);
  assert.match(migration, /CHECK \(source_type IN \('governance_document', 'evidence', 'risk'\)\)/);
});
