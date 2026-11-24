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

test('DPIA rejection requires rationale in an accessible reviewed dialog', () => {
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  assert.doesNotMatch(page, /window\.(prompt|alert|confirm)/);
  assert.match(page, /title="Reject DPIA"/);
  assert.match(page, /A rejection rationale is required/);
  assert.match(page, /The decision will be retained in DPIA history/);
  assert.match(page, /role="alert"/);
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

test('transfer intake records safeguards without implying legal approval', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/transfers', requirePermission\('Vendors', 'assign'\)/);
  assert.match(routes, /Transfer safeguard indicators must be explicit boolean values/);
  assert.match(page, /createTransferEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('transfer'\)/);
  assert.match(modal, /does not verify legal adequacy or approve the transfer/);
});

test('consent intake requires evidence without claiming independent verification', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/consents', requirePermission\('Users', 'edit'\)/);
  assert.match(routes, /New consent records must begin in granted status/);
  assert.match(routes, /Consent history is system-managed and must be empty at intake/);
  assert.match(page, /createConsentEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('consent'\)/);
  assert.match(modal, /status: 'granted', evidence: consent\.evidence\.trim\(\), consentHistory: \[\]/);
  assert.match(modal, /does not upload an attachment or independently verify that consent is valid/);
});

test('processor intake starts unassessed without inferred assurance', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/third-parties', requirePermission\('Vendors', 'assign'\)/);
  assert.match(routes, /New processor records must begin unassessed without inferred clauses, incidents, or compliance results/);
  assert.match(page, /createThirdPartyPrivacyEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('processor'\)/);
  assert.match(modal, /privacyAssessmentStatus: 'planned', dpaStatus: 'watch', complianceRating: 0, privacyIncidentCount: 0, contractClauses: \[\]/);
  assert.match(modal, /No contract clauses, incidents, compliance rating, or completed due diligence are inferred/);
});

test('data governance intake records ownership without inferred quality', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/governance', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /New governance records must begin planned with an unscored data quality result/);
  assert.match(page, /createDataGovernanceEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('governance'\)/);
  assert.match(modal, /dataQualityScore: 0, status: 'planned'/);
  assert.match(modal, /Data quality remains unscored until measured through an approved assessment/);
});

test('privacy intelligence failures remain explicit and do not imply a posture', () => {
  const page = read('../frontend/src/pages/DataProtection.tsx');
  assert.match(page, /Privacy posture summary is unavailable/);
  assert.match(page, /No privacy posture or recommendation has been inferred/);
  assert.match(page, /role="alert"/);
  assert.match(page, /aria-label="Ask the privacy assistant"/);
  assert.doesNotMatch(page, /console\.error\('Failed to fetch AI summary/);
});

test('privacy audit intake creates a plan without fabricated results', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/audits', requirePermission\('Audits', 'create'\)/);
  assert.match(routes, /New privacy audits must begin planned without findings or recommendations/);
  assert.match(page, /createPrivacyAuditEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('audit'\)/);
  assert.match(modal, /status: 'planned', findingsCount: 0, recommendationsCount: 0/);
  assert.match(modal, /does not execute the audit or assert assurance/);
});

test('privacy risk intake begins identified without fabricated scoring or links', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/risks', requirePermission\('Risks', 'create'\)/);
  assert.match(routes, /New privacy risks must begin identified, unscored, and without an inferred enterprise-risk link/);
  assert.match(page, /createPrivacyRiskEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('risk'\)/);
  assert.match(modal, /status: 'identified', riskScore: 0, linkedEnterpriseRiskId: null/);
  assert.match(modal, /Proposed mitigation is not evidence of treatment completion/);
});

test('discovery intake registers scope without claiming an automated scan', () => {
  const routes = read('src/routes/privacy.ts');
  const page = read('../frontend/src/pages/PrivacyDataGovernance.tsx');
  const modal = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(routes, /router\.post\('\/discovery', requirePermission\('Reports', 'create'\)/);
  assert.match(routes, /New discovery scopes must begin planned without inferred locations or data flows/);
  assert.match(page, /createDataDiscoveryEntry\(draft\)/);
  assert.match(page, /setRegisterEntry\('discovery'\)/);
  assert.match(page, /Register Discovery Scope/);
  assert.match(modal, /piiLocations: \[\], sensitiveDataLocations: \[\], dataFlowMapping: \[\], status: 'planned'/);
  assert.match(modal, /does not scan the repository or infer PII locations/);
});
