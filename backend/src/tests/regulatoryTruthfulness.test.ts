import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('regulatory state reads do not seed workspace data', () => {
  const service = read('src/services/regulatoryChangeService.ts');
  assert.doesNotMatch(service, /seedRegulatoryData\(workspaceId\)/);
});

test('regulatory UI does not create synthetic records', () => {
  const page = read('../frontend/src/pages/RegulatoryChangeManagement.tsx');
  assert.doesNotMatch(page, /Date\.now|CTRL-00|POL-00|RISK-00|VENDOR-00|ASSET-00|AI-00/);
  assert.doesNotMatch(page, /createRegulatory(?:Requirement|Obligation|Change|Task)/);
});

test('regulatory mutations enforce module permissions', () => {
  const routes = read('src/routes/regulatory.ts');
  const mutations = [...routes.matchAll(/router\.(?:post|patch)\([^\n]+/g)].map((match) => match[0]);
  assert.ok(mutations.length >= 8);
  mutations.forEach((route) => assert.match(route, /requirePermission\('Regulatory', '(?:create|edit)'\)/));
});

test('impact analysis preserves recorded actions without fabricating defaults', () => {
  const service = read('src/services/regulatoryChangeService.ts');
  assert.match(service, /requiredActions: change\.requiredActions/);
  assert.doesNotMatch(service, /Review impacted controls|Notify accountable stakeholders/);
});
