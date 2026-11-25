import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const index = read('src/index.ts');
const routes = read('src/routes/riskMethodologies.ts');

test('risk methodology routes use business-action permissions', () => {
  assert.match(routes, /router\.get\('\/', requirePermission\('Risks', 'view'\)/);
  assert.match(routes, /router\.get\('\/history', requirePermission\('Risks', 'view'\)/);
  assert.match(routes, /router\.post\('\/', requirePermission\('Risks', 'create'\), requireMethodologyAdministrator, save\)/);
  assert.match(routes, /router\.patch\('\/:id', requirePermission\('Risks', 'edit'\), requireMethodologyAdministrator, save\)/);
  assert.match(routes, /router\.post\('\/preview', requirePermission\('Risks', 'view'\)/);
  assert.match(routes, /router\.post\('\/:id\/activate', requirePermission\('Risks', 'approve'\), requireMethodologyAdministrator/);
  assert.match(routes, /router\.patch\('\/state', requirePermission\('Risks', 'approve'\), requireMethodologyAdministrator/);
});

test('methodology history is workspace scoped, bounded and hides configuration snapshots', () => {
  const repository = read('src/repositories/riskMethodologyRepo.ts');
  const historyQuery = repository.slice(repository.indexOf('export async function history'), repository.indexOf('export async function activate'));
  const page = read('../frontend/src/pages/RiskMethodology.tsx');
  assert.equal((historyQuery.match(/WHERE e\.workspace_id = \$1/g) || []).length, 2);
  assert.match(historyQuery, /LIMIT 100/);
  assert.match(historyQuery, /jsonb_typeof\(e\.snapshot -> 'historicalRisksPreserved'\) = 'number'/);
  assert.doesNotMatch(historyQuery, /AS "snapshot"/);
  assert.match(routes, /repo\.history\(getWorkspaceId\(req\)\)/);
  assert.match(page, /Configuration snapshots remain protected and are not displayed here/);
  assert.match(page, /No methodology history has been recorded for this workspace/);
  assert.match(page, /Unable to refresh methodology history/);
});

test('methodology mode changes require active policy, release gate and explicit review', () => {
  const page = read('../frontend/src/pages/RiskMethodology.tsx');
  assert.match(routes, /confirmModeChange !== true/);
  assert.match(routes, /Activate a methodology before enabling enforced mode/);
  assert.match(routes, /RISK_METHODOLOGY_ACTIVATION_ENABLED !== 'true'/);
  assert.match(routes, /repo\.setWorkspaceMode\(getWorkspaceId\(req\), req\.authUser!\.userId, mode\)/);
  assert.match(page, /body: JSON\.stringify\(\{ mode: requestedMode, confirmModeChange: true \}\)/);
  assert.match(page, /if \(!modeTarget \|\| !modeConfirmed \|\| submitLock\.current\) return/);
  assert.match(page, /Existing methodology pins, scores and activation history will remain recorded/);
});

test('methodology router keeps authentication and workspace scope without method-derived permissions', () => {
  assert.match(index, /app\.use\('\/api\/v1\/risk-methodologies', requireAuth, requireAuthenticatedWorkspace, riskMethodologiesRouter\)/);
  assert.doesNotMatch(index, /risk-methodologies'.*requireModulePermissions\('Risks'\)/);
  assert.match(routes, /getWorkspaceId\(req\) !== req\.authUser\.workspaceId/);
});

test('methodology save and preview serialize captured configuration', () => {
  const page = read('../frontend/src/pages/RiskMethodology.tsx');
  assert.match(page, /const submitLock = useRef\(false\)/);
  assert.match(page, /if \(!config \|\| submitLock\.current\) return/);
  assert.match(page, /submitLock\.current = true/);
  assert.match(page, /const capturedConfig = structuredClone\(config\)/);
  assert.match(page, /const selectedId = selected\?\.id/);
  assert.match(page, /const expectedUpdatedAt = selected\?\.updatedAt/);
  assert.equal((page.match(/const payload = JSON\.stringify/g) || []).length, 2);
  assert.match(page, /finally \{ submitLock\.current = false/);
});

test('methodology activation uses the governed endpoint and reviewed confirmation', () => {
  const page = read('../frontend/src/pages/RiskMethodology.tsx');
  assert.match(page, /const \[activationTarget, setActivationTarget\] = useState<Version \| null>\(null\)/);
  assert.match(page, /if \(!activationTarget \|\| !activationConfirmed \|\| submitLock\.current\) return/);
  assert.match(page, /confirmPreserveExisting: true/);
  assert.match(page, /\/activate`/);
  assert.match(page, /role === 'owner' \|\| role === 'admin'/);
  assert.match(page, /Existing risks will not be recalculated or silently moved to this version/);
  assert.match(page, /setActivationTarget\(null\); setActivationConfirmed\(false\); setSelected\(null\)/);
  assert.doesNotMatch(page, /<button type="button" disabled aria-describedby="methodology-activation-note">Activate version<\/button>/);
});
