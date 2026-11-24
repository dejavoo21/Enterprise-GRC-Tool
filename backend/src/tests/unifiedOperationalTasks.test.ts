import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('operations federation includes native audit, regulatory and workflow sources', async () => {
  const repository = await read('backend/src/repositories/issuesRepo.ts');
  assert.match(repository, /getAuditActions\(workspaceId\)/);
  assert.match(repository, /getRegulatoryTasks\(workspaceId\)/);
  assert.match(repository, /getWorkflowAssignments\(workspaceId\)/);
  assert.match(repository, /sourceType: 'Audit Readiness'/);
  assert.match(repository, /sourceType: 'Regulatory'/);
  assert.match(repository, /sourceType: 'Workflow'/);
  assert.match(repository, /sourceType: 'Incident'/);
  assert.match(repository, /sourceType: 'Vulnerability'/);
  assert.match(repository, /domain: 'Audit Evidence Request',/);
  assert.match(repository, /domain: 'Continuous Control Assurance', sourceType: 'Control'/);
  assert.match(repository, /getAssuranceTasks\(workspaceId\)/);
  assert.match(repository, /linkedEvidenceIds: linkedException\?\.evidenceIds \|\| \[\]/);
  assert.match(repository, /evidenceRequired: request\.requestTitle/);
  assert.match(repository, /sourceManaged: true/);
});

test('native source references drive synchronization identity', async () => {
  const repository = await read('backend/src/repositories/riskActionsRepo.ts');
  assert.match(repository, /const sourceReference = item\.sourceReference \|\| item\.id/);
  assert.match(repository, /existing\.get\(`\$\{item\.sourceType\}:\\0\$\{sourceReference\}`\)/);
  assert.match(repository, /sourceType:item\.sourceType, sourceReference/);
  assert.match(repository, /existing\.sourceManaged\?\{blockerReason:/);
  assert.match(
    repository,
    /evidence_required=COALESCE\(risk_actions\.evidence_required,EXCLUDED\.evidence_required\)/,
  );
  assert.doesNotMatch(repository, /sets\.push\('source_managed=FALSE'/);
});

test('new sources are filterable in the API and action tracker', async () => {
  const route = await read('backend/src/routes/issues.ts');
  const page = await read('frontend/src/pages/Issues.tsx');
  for (const source of ['Regulatory', 'Workflow']) {
    assert.match(route, new RegExp(`'${source}'`));
    assert.match(page, new RegExp(`'${source}'`));
  }
});

test('audit evidence actions deep-link to a workspace-scoped source record', async () => {
  const operations = await read('frontend/src/pages/Issues.tsx');
  const audit = await read('frontend/src/pages/AuditReadiness.tsx');
  assert.match(operations, /audit-readiness\?request=/);
  assert.match(operations, /Open Audit request/);
  assert.match(audit, /searchParams\.get\('request'\)/);
  assert.match(audit, /state\?\.evidenceRequests\.find\(item=>item\.id===requestFilter\)/);
  assert.match(audit, /Evidence request unavailable/);
});

test('control actions deep-link to persisted assurance remediation tasks', async () => {
  const operations = await read('frontend/src/pages/Issues.tsx');
  const assurance = await read('frontend/src/pages/ContinuousAssurancePages.tsx');
  assert.match(operations, /continuous-assurance\?task=/);
  assert.match(operations, /Open assurance task/);
  assert.match(assurance, /searchParams\.get\('task'\)/);
  assert.match(assurance, /remediationTasks\.find\(\(task\) => task\.id === taskFilter\)/);
  assert.match(assurance, /Remediation task unavailable/);
});

test('treatment actions deep-link to the authoritative selected plan', async () => {
  const operations = await read('frontend/src/pages/Issues.tsx');
  const treatments = await read('frontend/src/pages/RiskTreatmentWorkspace.tsx');
  assert.match(operations, /risks\?tab=treatment-plans&plan=/);
  assert.match(operations, /Open treatment plan/);
  assert.match(treatments, /searchParams\.get\('plan'\)/);
  assert.match(treatments, /useState<string \| null>\(planFilter\)/);
});

test('audit corrective actions deep-link to the authoritative CAP record', async () => {
  const operations = await read('frontend/src/pages/Issues.tsx');
  const audit = await read('frontend/src/pages/AuditReadiness.tsx');
  assert.match(operations, /audit-readiness\?action=/);
  assert.match(operations, /Open corrective action/);
  assert.match(audit, /searchParams\.get\('action'\)/);
  assert.match(audit, /useState<string\|null>\(actionFilter\)/);
});

test('regulatory actions deep-link to the authoritative task', async () => {
  const operations = await read('frontend/src/pages/Issues.tsx');
  const regulatory = await read('frontend/src/pages/RegulatoryChangeManagement.tsx');
  assert.match(operations, /regulatory-change-management\?task=/);
  assert.match(operations, /Open regulatory task/);
  assert.match(regulatory, /searchParams\.get\('task'\)/);
  assert.match(regulatory, /state\?\.tasks\.find\(\(task\) => task\.id === taskFilter\)/);
  assert.match(regulatory, /Regulatory task unavailable/);
});

test('workflow actions deep-link to the authoritative assignment', async () => {
  const operations = await read('frontend/src/pages/Issues.tsx');
  const workflows = await read('frontend/src/pages/WorkflowManagement.tsx');
  assert.match(operations, /workflows\?assignment=/);
  assert.match(operations, /Open workflow assignment/);
  assert.match(workflows, /searchParams\.get\('assignment'\)/);
  assert.match(workflows, /useState<string\|null>\(assignmentFilter\)/);
  assert.match(workflows, /Workflow assignment unavailable/);
});
