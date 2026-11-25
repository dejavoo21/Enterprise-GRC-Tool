import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('reporting center uses explicit action permissions', () => {
  const index = read('src/index.ts');
  const routes = read('src/routes/reportingCenter.ts');
  assert.match(index, /reporting-center', requireAuth, requireAuthenticatedWorkspace, reportingCenterRouter/);
  assert.match(routes, /requirePermission\('Reports', 'view'\)/);
  assert.match(routes, /requirePermission\('Reports', 'configure'\)/);
  assert.match(routes, /requirePermission\('Reports', 'export'\)/);
  assert.match(routes, /requirePermission\('Reports', 'approve'\)/);
});

test('approval is independent and only approved reports can be distributed', () => {
  const service = read('src/services/reportingCenterService.ts');
  assert.match(service, /report\.generatedByUserId === input\.approverUserId/);
  assert.match(service, /Only an approved report can be distributed/);
  assert.match(service, /External report delivery is not configured/);
  assert.match(service, /attestGeneratedReport/);
  const repo = read('src/repositories/reportingCenterRepo.ts');
  assert.match(repo, /SELECT status, generated_by_user_id FROM generated_reports[^`]+FOR UPDATE/s);
  assert.match(repo, /BEGIN[\s\S]+report_attestations[\s\S]+generated_reports[\s\S]+COMMIT/);
});

test('unconfigured delivery cannot be recorded as sent', () => {
  const routes = read('src/routes/reportingCenter.ts');
  const repo = read('src/repositories/reportingCenterRepo.ts');
  const page = read('../frontend/src/pages/Reports.tsx');
  assert.match(routes, /DELIVERY_UNAVAILABLE/);
  assert.match(repo, /input\.sentAt \|\| null/);
  assert.match(repo, /publishApprovedReportToPortal/);
  assert.doesNotMatch(page, /deliveryMethods: \['portal_access', 'email'\]/);
  assert.match(page, /Publish to Portal/);
});

test('report schedules and attestations require reviewed user input', () => {
  const page = read('../frontend/src/pages/Reports.tsx');
  assert.doesNotMatch(page, /Ready for leadership circulation|Needs section refinement before committee use/);
  assert.doesNotMatch(page, /recipientValue: 'Board Committee'/);
  assert.match(page, /attestationComments\.trim\(\)\.length < 3/);
  assert.match(page, /comments: attestationComments\.trim\(\)/);
  assert.match(page, /scheduleDraft\.recipient\.trim\(\)/);
  assert.match(page, /deliveryMethods: \['portal_access'\]/);
  assert.match(page, /It does not email or externally distribute a report/);
  assert.match(page, /const closeSchedule = \(\) => \{ if \(!working && !mutationLock\.current\) setScheduleTemplateId\(null\); \};/);
  assert.match(page, /const closeAttestation = \(\) => \{[\s\S]*if \(!working && !mutationLock\.current\)[\s\S]*setAttestationDecision\(null\);[\s\S]*setAttestationComments\(''\);/);
  assert.match(page, /const closePublish = \(\) => \{ if \(!working && !mutationLock\.current\) setPublishOpen\(false\); \};/);
  assert.match(page, /onClose=\{closeSchedule\}[\s\S]*onClick=\{closeSchedule\}/);
  assert.match(page, /onClose=\{closeAttestation\}[\s\S]*onClick=\{closeAttestation\}/);
  assert.match(page, /onClose=\{closePublish\}[\s\S]*onClick=\{closePublish\}/);
});

test('reporting mutation dialogs lock reviewed payloads while saving', () => {
  const page = read('../frontend/src/pages/Reports.tsx');
  assert.match(page, /const mutationLock = useRef\(false\)/);
  assert.equal((page.match(/if \(mutationLock\.current\) return;/g) || []).length, 8);
  assert.equal((page.match(/mutationLock\.current = true;/g) || []).length, 5);
  assert.equal((page.match(/mutationLock\.current = false;/g) || []).length, 5);
  assert.equal((page.match(/<fieldset disabled=\{Boolean\(working\)\} aria-busy=\{Boolean\(working\)\}/g) || []).length, 3);
});

test('risk reports hand off governed scheduling without claiming automated distribution', () => {
  const riskReports = read('../frontend/src/pages/RiskReportsWorkspace.tsx');
  assert.match(riskReports, /Risk snapshots remain on demand/);
  assert.match(riskReports, /Open Board Reporting Center/);
  assert.match(riskReports, /navigate\('\/reports'\)/);
  assert.doesNotMatch(riskReports, /Scheduling and automated distribution are not implemented/);
});

test('saved report operations reject duplicates and lock reviewed values', () => {
  const history = read('../frontend/src/pages/RiskReportHistory.tsx');
  assert.match(history, /const operationLock=useRef\(false\)/);
  assert.equal((history.match(/if\(operationLock\.current/g) || []).length, 3);
  assert.equal((history.match(/operationLock\.current=true/g) || []).length, 3);
  assert.equal((history.match(/operationLock\.current=false/g) || []).length, 3);
  assert.equal((history.match(/const payload=JSON\.stringify/g) || []).length, 2);
  assert.match(history, /const closeReview=\(\)=>\{if\(!operationLock\.current\)setSelected\(null\);\}/);
  assert.match(history, /<fieldset disabled=\{busy\} aria-busy=\{busy\}/);
});

test('risk report export rejects duplicate snapshot creation and captures scope', () => {
  const page = read('../frontend/src/pages/Risks.tsx');
  assert.match(page, /const reportLock = useRef\(false\)/);
  assert.match(page, /if \(reportLock\.current\) return/);
  assert.match(page, /reportLock\.current = true/);
  assert.match(page, /const capturedReportType = reportType/);
  assert.match(page, /const capturedWorkspaceId = workspaceId/);
  assert.match(page, /const payload = JSON\.stringify\(\{ format, delivery, confirmed: delivery === 'email' \}\)/);
  assert.match(page, /workspaceId: capturedWorkspaceId/);
  assert.match(page, /reportLock\.current = false/);
});
