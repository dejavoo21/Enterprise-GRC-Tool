import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateAccessReviewDecision, validateAccessReviewInput } from '../services/accessReviewRules.js';

const now = new Date('2026-11-24T12:00:00Z');
const valid = { name: 'Quarterly access review', selectedRoles: ['tenant_admin'], selectedModules: [], selectedUserIds: ['user-1'], reviewers: ['reviewer@example.com'], dueDate: '2026-12-24T00:00:00Z' };

test('access review campaigns require explicit future scope and reviewers', () => {
  assert.equal(validateAccessReviewInput(valid, now), null);
  assert.match(validateAccessReviewInput({ ...valid, selectedUserIds: [] }, now) || '', /workspace user/);
  assert.match(validateAccessReviewInput({ ...valid, reviewers: [] }, now) || '', /reviewer/);
  assert.match(validateAccessReviewInput({ ...valid, selectedRoles: [], selectedModules: [] }, now) || '', /role or module/);
  assert.match(validateAccessReviewInput({ ...valid, selectedRoles: [], selectedModules: ['Forged module'] }, now) || '', /modules are invalid/);
  assert.match(validateAccessReviewInput({ ...valid, dueDate: '2026-05-31' }, now) || '', /future/);
});

test('access review decisions use the governed lifecycle and reviewed rationale', () => {
  assert.equal(validateAccessReviewDecision('approved', ''), null);
  assert.match(validateAccessReviewDecision('flagged', '') || '', /notes are required/);
  assert.match(validateAccessReviewDecision('revoked', undefined) || '', /notes are required/);
  assert.match(validateAccessReviewDecision('bypassed', 'forged') || '', /valid access review decision/);
  assert.equal(validateAccessReviewDecision('flagged', 'Investigate excessive privilege.'), null);
});

test('access review persistence rejects foreign users and does not invent reviewers', async () => {
  const root = path.resolve(__dirname, '../../..');
  const [repository, route, page] = await Promise.all([
    readFile(path.join(root, 'backend/src/repositories/accessGovernanceRepo.ts'), 'utf8'),
    readFile(path.join(root, 'backend/src/routes/adminAccessGovernance.ts'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/admin/AccessGovernanceViews.tsx'), 'utf8'),
  ]);
  assert.match(repository, /selectedUsers\.some\(\(user\) => !user\)/);
  assert.match(repository, /availableRoleIds\.has\(roleId\)/);
  assert.match(repository, /workspaceUsersByEmail\.get\(reviewer\.toLowerCase\(\)\)/);
  assert.match(repository, /selectedUserIdSet\.has\(reviewer\.id\)/);
  assert.match(repository, /reviewer\.status !== 'active'/);
  assert.match(repository, /createAccessReview[\s\S]*?client\.query\('BEGIN'\)[\s\S]*?client\.query\('COMMIT'\)/);
  assert.match(repository, /selectedUsers\.entries\(\)[\s\S]*?input\.reviewers\[index % input\.reviewers\.length\]/);
  assert.match(repository, /const updatedItem = await query[\s\S]*?if \(!updatedItem\.rowCount\) return null/);
  assert.match(repository, /LOWER\(reviewer\) = LOWER\(\$6\)/);
  assert.match(repository, /reviewer_role\.status = 'active'[\s\S]*?LOWER\(reviewer_user\.email\) = LOWER\(\$6\)/);
  assert.match(repository, /governance_access_reviews review[\s\S]*?review\.evidence_exported_at IS NULL/);
  assert.match(repository, /markAccessReviewEvidenceExported[\s\S]*?status = 'completed'[\s\S]*?if \(!updated\.rowCount\) return null/);
  assert.match(route, /access-reviews\/:id\/export-evidence', requirePermission\('Users', 'export'\), requireStepUp\('export_access_review'\)/);
  assert.doesNotMatch(repository, /input\.reviewers\[0\] \|\| 'Security Office'/);
  assert.match(page, /useState<EnterpriseRoleKey\[]>\(\[\]\)/);
  assert.match(page, /useState<string\[]>\(\[\]\)/);
  assert.doesNotMatch(page, /2026-05-31|Security Office, Compliance Lead|Reviewers, comma separated/);
  assert.doesNotMatch(page, /Retained during review|Excessive privilege requires remediation|Access revoked by reviewer decision/);
  assert.match(page, /disabled=\{review\.status !== 'completed'\}/);
  assert.match(page, /disabled=\{Boolean\(review\.evidenceExportedAt\)\}/);
  assert.match(page, /role="region" aria-label="Role permission matrix" tabIndex=\{0\}/);
  assert.match(page, /aria-label=\{`\$\{role\.name\}: \$\{moduleName\} \$\{action\}`\}/);
  assert.match(page, /repeat\(auto-fit, minmax\(min\(100%, 380px\), 1fr\)\)/);
  assert.match(page, /repeat\(auto-fit, minmax\(min\(100%, 420px\), 1fr\)\)/);
  assert.match(page, /Search roles<input type="search"/);
  assert.match(page, /Copy permissions from<select/);
  assert.match(page, /title="Disable custom role"/);
  assert.match(page, /Role and audit history are preserved for review/);
  assert.match(page, /await actions\.createRole/);
  assert.match(page, /await actions\.disableRole/);
  assert.match(page, /const runRoleMutation = async/);
  assert.match(page, /setRoleFeedback\(\{ error: true, message: error instanceof Error \? error\.message : fallbackMessage \}\)/);
  assert.doesNotMatch(page, /onDisable=\{\(\) => actions\.disableRole/);
  assert.match(page, /const assignRole = async \(user: RbacUser, roleId: EnterpriseRoleKey\)/);
  assert.match(page, /await actions\.assignUserRole\(user\.id, roleId\)/);
  assert.match(page, /setAssignmentError\(error instanceof Error/);
  assert.match(page, /busy=\{assignmentBusy\}/);
  assert.match(page, /error=\{assignmentError\}/);
  assert.doesNotMatch(page, /actions\.assignUserRole\(user\.id, role\.id\);/);
});
