import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('ESG entry actions do not create synthetic production records', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/EsgManagement.tsx'), 'utf8');
  assert.doesNotMatch(page, /create(EnvironmentalMetricRecord|CarbonRecordEntry|SocialMetricRecord|GovernanceMetricRecord|EsgRiskRecord|EsgKpiRecord|EsgTargetRecord|SupplierEsgReview|EsgIncidentRecord)/);
  assert.doesNotMatch(page, /Date\.now\(\)\.toString\(\)\.slice/);
  assert.match(page, /Reviewed ESG entry forms are not implemented yet\. No sample record will be created\./);
  assert.equal((page.match(/disabled title=\{entryUnavailable\}/g) || []).length, 10);
  assert.match(page, /No persisted environmental, social, governance, carbon, supplier, or reporting records are available/);
  assert.match(page, /role="status"/);
});

test('ESG reporting remains backed by the persisted report endpoint', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/EsgManagement.tsx'), 'utf8');
  assert.match(page, /generateEsgReport\(reportType\)/);
  assert.match(page, /handleAction\('report-csrd'/);
  assert.match(page, /handleAction\('report-esg'/);
});
