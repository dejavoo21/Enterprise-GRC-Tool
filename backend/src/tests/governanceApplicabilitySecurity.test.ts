import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const repositoryUrl = 'src/repositories/governanceApplicabilityRepo.ts';
const routeUrl = 'src/routes/governanceApplicability.ts';
const workflowRouteUrl = 'src/routes/enterpriseWorkflows.ts';

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
