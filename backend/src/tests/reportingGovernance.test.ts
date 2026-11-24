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
