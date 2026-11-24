import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const repositoryUrl = 'src/repositories/governanceApplicabilityRepo.ts';
const routeUrl = 'src/routes/governanceApplicability.ts';
const workflowRouteUrl = 'src/routes/enterpriseWorkflows.ts';
const governanceSummaryUrl = '../frontend/src/components/ControlGovernanceSummary.tsx';
const controlPanelUrl = '../frontend/src/components/ControlDetailPanel.tsx';
const evidencePageUrl = '../frontend/src/pages/Evidence.tsx';
const risksPageUrl = '../frontend/src/pages/Risks.tsx';
const issuesPageUrl = '../frontend/src/pages/Issues.tsx';
const regulatoryPageUrl = '../frontend/src/pages/RegulatoryChangeManagement.tsx';
const aiPageUrl = '../frontend/src/pages/AiGovernance.tsx';
const bcmPageUrl = '../frontend/src/pages/BusinessContinuity.tsx';
const privacyPageUrl = '../frontend/src/pages/PrivacyDataGovernance.tsx';

test('governance persistence predicates all mutable records by workspace', async () => {
  const source = await readFile(repositoryUrl, 'utf8');
  assert.match(source, /controls WHERE workspace_id=\$1 AND id=\$2/);
  assert.match(source, /governance_scopes WHERE workspace_id=\$1 AND id=\$2/);
  assert.match(source, /WHERE workspace_id=\$1 AND id=\$2 FOR UPDATE/);
  assert.match(source, /id::text=ANY\(\$2::text\[\]\)/);
  assert.match(source, /authenticated workspace/);
});

test('governance mutations and approvals require explicit module permissions', async () => {
  const source = await readFile(routeUrl, 'utf8');
  assert.match(source, /requirePermission\('Controls','create'\)/);
  assert.match(source, /router\.get\('\/controls\/:controlId\/context',requirePermission\('Controls','view'\)/);
  assert.match(source, /requirePermission\('Controls','edit'\)/);
  assert.match(source, /requirePermission\('Controls','approve'\)/);
  assert.match(source, /requirePermission\('Reports','approve'\)/);
  assert.match(source, /requirePermission\('Reports','export'\)/);
});

test('external SoA export remains separately publication-gated and redacted', async () => {
  const source = await readFile(repositoryUrl, 'utf8');
  assert.match(source, /publication_status!=='approved'/);
  assert.match(source, /document\.controls\.map\(redactSoaControl\)/);
  assert.match(source, /assertIndependentApproval\(current\.approved_by\|\|current\.created_by,actor\)/);
});

test('workflow ownership recommendations remain advisory and never replace explicit owners', async () => {
  const source = await readFile(workflowRouteUrl, 'utf8');
  const explicitOwnerCheck = source.indexOf("getWorkspaceMembership(String(req.body?.ownerUserId || '')");
  const recommendation = source.indexOf('resolveResponsibility(req.authUser!.workspaceId');
  const workflowCreation = source.indexOf('workflowRepo.createWorkflow');
  assert.ok(explicitOwnerCheck >= 0 && recommendation > explicitOwnerCheck && workflowCreation > recommendation);
  assert.match(source, /ownershipRecommendation/);
  assert.doesNotMatch(source, /ownerUserId\s*=\s*ownershipRecommendation/);
});

test('specialist views reuse read-only workspace-scoped control governance context', async () => {
  const [route, summary, controlPanel, evidencePage, risksPage, issuesPage, regulatoryPage, aiPage, bcmPage, privacyPage] = await Promise.all([
    readFile(routeUrl, 'utf8'),
    readFile(governanceSummaryUrl, 'utf8'),
    readFile(controlPanelUrl, 'utf8'),
    readFile(evidencePageUrl, 'utf8'),
    readFile(risksPageUrl, 'utf8'),
    readFile(issuesPageUrl, 'utf8'),
    readFile(regulatoryPageUrl, 'utf8'),
    readFile(aiPageUrl, 'utf8'),
    readFile(bcmPageUrl, 'utf8'),
    readFile(privacyPageUrl, 'utf8'),
  ]);

  assert.match(route, /router\.get\('\/controls\/:controlId\/context'/);
  assert.match(route, /getControlGovernanceContext\(getWorkspaceId\(req\),req\.params\.controlId\)/);
  assert.match(summary, /apiCall<ContextResponse>/);
  assert.doesNotMatch(summary, /method:\s*['"](?:POST|PUT|PATCH|DELETE)/);
  assert.match(controlPanel, /ControlGovernanceSummary controlIds=\{\[control\.id\]\}/);
  assert.match(evidencePage, /ControlGovernanceSummary controlIds=\{\[selectedEvidence\.controlId\]\}/);
  assert.match(risksPage, /ControlGovernanceSummary controlIds=\{plan\.linkedControls\.map/);
  assert.match(issuesPage, /ControlGovernanceSummary controlIds=\{selectedIssue\.linkedControlIds\}/);
  assert.match(regulatoryPage, /ControlGovernanceSummary controlIds=\{selectedObligation\.linkedControls\}/);
  assert.doesNotMatch(regulatoryPage, /linkedControls:\s*\['CTRL-|affectedControls:\s*\['CTRL-/);
  assert.match(aiPage, /ControlGovernanceSummary controlIds=\{selectedSystem\.linkedControlIds\}/);
  assert.match(bcmPage, /ControlGovernanceSummary controlIds=\{selectedBia\.linkedControlIds\}/);
  assert.match(privacyPage, /ControlGovernanceSummary controlIds=\{selectedDpia\.linkedControlIds\}/);
  assert.doesNotMatch(aiPage, /linkedControlIds:\s*\['AI-CTRL-/);
  assert.doesNotMatch(bcmPage, /linkedControlIds:\s*\['CTR-/);
  assert.doesNotMatch(summary, /ownerUserId|createRelationship|updateRelationship/);
});
