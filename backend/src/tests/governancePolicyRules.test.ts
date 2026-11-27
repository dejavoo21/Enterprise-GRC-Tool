import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validatePolicyRuleInput, validatePolicyRuleTransition } from '../services/policyRuleRules.js';

const read = (relativePath: string) => readFile(path.resolve(process.cwd(), relativePath), 'utf8');

test('policy rules are workspace scoped, permission guarded and limited to review responses', async () => {
  const [routes, repository, migration, repair, approval] = await Promise.all([
    read('src/routes/governance-documents.ts'),
    read('src/repositories/governanceDocumentsRepo.ts'),
    read('sql/migrations/20261125-governance-policy-rules.sql'),
    read('sql/migrations/20261125-governance-policy-rule-active-uniqueness.sql'),
    read('sql/migrations/20261127-governance-policy-rule-approval.sql'),
  ]);

  assert.match(routes, /router\.get\('\/:id\/rules', requirePermission\('Policies', 'view'\)/);
  assert.match(routes, /router\.post\('\/:id\/rules', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /router\.delete\('\/:id\/rules\/:ruleId', requirePermission\('Policies', 'approve'\)/);
  assert.match(routes, /rules\/:ruleId\/submit', requirePermission\('Policies', 'edit'\)/);
  assert.match(routes, /rules\/:ruleId\/decision', requirePermission\('Policies', 'approve'\)/);
  assert.match(routes, /validatePolicyRuleInput/);
  assert.match(routes, /POLICY_RULE_NAME_CONFLICT/);
  assert.match(repository, /d\.workspace_id=r\.workspace_id/);
  assert.match(repository, /d\.status IN \('draft','rejected'\)/);
  assert.match(repository, /r\.status='active'/);
  assert.match(migration, /response_mode IN \('monitor', 'review'\)/);
  assert.match(migration, /governance_policy_rule_events/);
  assert.match(repair, /DROP CONSTRAINT IF EXISTS governance_policy_rules_workspace_id_document_id_name_key/);
  assert.match(repair, /WHERE status = 'active'/);
  assert.match(approval, /DEFAULT 'draft'/);
  assert.match(approval, /pending_review/);
  assert.match(approval, /approved_by UUID REFERENCES users/);
  assert.match(approval, /submitted_by UUID REFERENCES users/);
  assert.match(approval, /submitted.*activated.*rejected.*returned.*archived/);
});

test('policy rule activation follows independent review transitions', () => {
  assert.equal(validatePolicyRuleTransition('draft', 'pending_review'), null);
  assert.equal(validatePolicyRuleTransition('pending_review', 'active'), null);
  assert.equal(validatePolicyRuleTransition('pending_review', 'rejected'), null);
  assert.equal(validatePolicyRuleTransition('rejected', 'pending_review'), null);
  assert.match(validatePolicyRuleTransition('draft', 'active') || '', /cannot move/);
});

test('policy rule decisions are transactional, workspace scoped and independently approved', async () => {
  const repository = await read('src/repositories/governanceDocumentsRepo.ts');
  assert.match(repository, /SELECT r\.\* FROM governance_policy_rules r[\s\S]*FOR UPDATE OF r/);
  assert.match(repository, /Policy rule author cannot approve or reject their own rule/);
  assert.match(repository, /r\.created_by IS DISTINCT FROM \$5/);
  assert.match(repository, /validatePolicyRuleTransition/);
  assert.match(repository, /INSERT INTO governance_policy_rule_events/);
  assert.match(repository, /previousStatus: current\.status/);
  assert.match(repository, /await client\.query\('COMMIT'\)/);
  assert.match(repository, /await client\.query\('ROLLBACK'\)/);
});

test('policy rule validation bounds review criteria and narrative fields', () => {
  const valid = { name: 'Restricted data review', description: 'Reviewed purpose', scopeSummary: 'Registered systems', matchCriteria: [{ field: 'data_classification', operator: 'equals', value: 'Restricted' }], excludeCriteria: [], severity: 'high', responseMode: 'review', plainLanguageSummary: 'Require a policy owner review.' };
  assert.equal(validatePolicyRuleInput(valid), null);
  assert.match(validatePolicyRuleInput({ ...valid, matchCriteria: Array(21).fill(valid.matchCriteria[0]) }) || '', /1-20/);
  assert.match(validatePolicyRuleInput({ ...valid, matchCriteria: [{ ...valid.matchCriteria[0], value: 'x'.repeat(501) }] }) || '', /500/);
  assert.match(validatePolicyRuleInput({ ...valid, responseMode: 'block' }) || '', /supported/);
  assert.match(validatePolicyRuleInput({ ...valid, plainLanguageSummary: 'x'.repeat(4001) }) || '', /4,000/);
});

test('policy rule UI states the enforcement limitation and uses the canonical policy drawer', async () => {
  const page = await read('../frontend/src/pages/GovernanceDocuments.tsx');
  assert.match(page, /These rules do not monitor endpoints, block activity, or prove enforcement/);
  assert.match(page, /Endpoint warning, blocking and automated enforcement are intentionally unavailable/);
  assert.match(page, /document\.docType === 'policy' \? <PolicyRules/);
  assert.match(page, /const mutationLock = useRef\(false\)/);
  assert.match(page, /const requestClose = \(\) => \{ if \(!busy && !mutationLock\.current\) setIsOpen\(false\); \}/);
  assert.equal((page.match(/if \(mutationLock\.current/g) || []).length, 3);
  assert.equal((page.match(/mutationLock\.current = true;/g) || []).length, 3);
  assert.equal((page.match(/mutationLock\.current = false;/g) || []).length, 3);
  assert.match(page, /<Modal accessibleDialog isOpen=\{isOpen\} onClose=\{requestClose\} title="Add policy review rule"/);
  assert.match(page, /<fieldset disabled=\{busy\} aria-busy=\{busy\}/);
  assert.match(page, /<Button variant="ghost" onClick=\{requestClose\}>Cancel<\/Button>/);
  assert.match(page, /Submit for review/);
  assert.match(page, /Activate rule/);
  assert.match(page, /Reject rule/);
  assert.match(page, /Activation requires a different authorised user from the rule author/);
});
