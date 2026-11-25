import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (relativePath: string) => readFile(path.resolve(process.cwd(), relativePath), 'utf8');

test('policy rules are workspace scoped, permission guarded and limited to review responses', async () => {
  const [routes, repository, migration] = await Promise.all([
    read('src/routes/governance-documents.ts'),
    read('src/repositories/governanceDocumentsRepo.ts'),
    read('sql/migrations/20261125-governance-policy-rules.sql'),
  ]);

  assert.match(routes, /router\.get\('\/:id\/rules', requirePermission\('Policies', 'view'\)/);
  assert.match(routes, /router\.post\('\/:id\/rules', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /router\.delete\('\/:id\/rules\/:ruleId', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /POLICY_RULE_RESPONSES = \['monitor', 'review'\]/);
  assert.doesNotMatch(routes, /POLICY_RULE_RESPONSES[^\n]*(warn|block|enforce)/);
  assert.match(repository, /d\.workspace_id=r\.workspace_id/);
  assert.match(repository, /d\.status IN \('draft','rejected'\)/);
  assert.match(migration, /response_mode IN \('monitor', 'review'\)/);
  assert.match(migration, /governance_policy_rule_events/);
});

test('policy rule UI states the enforcement limitation and uses the canonical policy drawer', async () => {
  const page = await read('../frontend/src/pages/GovernanceDocuments.tsx');
  assert.match(page, /These rules do not monitor endpoints, block activity, or prove enforcement/);
  assert.match(page, /Endpoint warning, blocking and automated enforcement are intentionally unavailable/);
  assert.match(page, /document\.docType === 'policy' \? <PolicyRules/);
});
