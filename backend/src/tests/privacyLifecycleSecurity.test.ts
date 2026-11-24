import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('privacy reads are non-mutating and do not seed fabricated defaults', () => {
  const repository = read('src/repositories/privacyRepo.ts');
  assert.doesNotMatch(repository, /seedPrivacyDefaults/);
  const stateSource = repository.slice(repository.indexOf('export async function getPrivacyState'));
  assert.doesNotMatch(stateSource, /INSERT INTO|createDpiaRecord|createDataInventoryRecord/);
});

test('DPIA links and lifecycle operations are workspace scoped and permission protected', () => {
  const repository = read('src/repositories/privacyRepo.ts');
  const routes = read('src/routes/privacy.ts');
  assert.match(routes, /evidence: req\.body\?\.linkedEvidenceIds/);
  assert.match(routes, /requirePermission\('Risks', 'edit'\)/);
  assert.match(routes, /requirePermission\('Risks', 'approve'\)/);
  assert.match(repository, /privacy_dpia_events WHERE workspace_id=\$1 AND dpia_id=\$2/);
  assert.match(repository, /privacy_dpias WHERE workspace_id=\$1 AND id=\$2/);
});

test('privacy report summaries derive from current workspace state', () => {
  const routes = read('src/routes/privacy.ts');
  assert.match(routes, /const state = await getPrivacyState\(getWorkspaceId\(req\)\)/);
  assert.match(routes, /No distribution or approval is implied/);
  assert.doesNotMatch(routes, /Privacy program posture refreshed/);
});

test('privacy lifecycle migration is additive and constrains approval status', () => {
  const migration = read('sql/migrations/20261124-privacy-dpia-lifecycle.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS privacy_dpia_events/);
  assert.match(migration, /linked_evidence_ids JSONB/);
  assert.match(migration, /approval_status IN \('draft', 'in_review', 'approved', 'rejected'\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('data inventory and RoPA entry use governed persisted workflows', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/data-inventory', requirePermission\('Reports', 'create'\)/);
  assert.match(routes, /router\.post\('\/ropa', requirePermission\('Reports', 'create'\)/);
  assert.match(routes, /required\.some\(\(field\) => !String\(req\.body\?\.\[field\]/);
  assert.match(page, /createDataInventoryEntry\(draft\)/);
  assert.match(page, /createRopaEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('inventory'\)/);
  assert.match(page, /setRegisterEntry\('ropa'\)/);
  assert.match(modal, /Asset ID, name, owner, system, data category, classification, retention requirement, and legal basis are required/);
  assert.match(modal, /Processing activity, purpose, legal basis, and retention period are required/);
  assert.doesNotMatch(modal, /Math\.random|sample|demo/i);
});

test('DSAR intake is persisted, permission protected and validated', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/dsars', requirePermission\('Users', 'edit'\)/);
  assert.match(routes, /validRequestTypes\.includes\(req\.body\.requestType\)/);
  assert.match(routes, /Date\.parse\(req\.body\.dueDate\)/);
  assert.match(page, /createDsarEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('dsar'\)/);
  assert.match(modal, /status: 'submitted', evidence: \[\]/);
  assert.match(modal, /Request ID, request type, data subject, owner, and due date are required/);
});

test('privacy breach intake records facts without claiming notification delivery', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/breaches', requirePermission\('Audits', 'create'\)/);
  assert.match(routes, /Affected counts must be non-negative whole numbers/);
  assert.match(routes, /Notification status must be required or not_required at intake/);
  assert.match(page, /createPrivacyBreachEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('breach'\)/);
  assert.match(modal, /status: 'open'/);
  assert.match(modal, /does not send or confirm a regulator or customer notification/);
  assert.doesNotMatch(modal, /<option value="sent">/);
});

test('retention intake creates a planned schedule without claiming disposal', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/retention', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /New retention schedules must begin in planned archive and disposal states/);
  assert.match(page, /createRetentionEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('retention'\)/);
  assert.match(modal, /archiveStatus: 'planned', disposalStatus: 'planned'/);
  assert.match(modal, /does not archive, delete, or dispose of data automatically/);
});
