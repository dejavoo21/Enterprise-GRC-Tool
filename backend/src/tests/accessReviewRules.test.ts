import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateAccessReviewInput } from '../services/accessReviewRules.js';

const now = new Date('2026-11-24T12:00:00Z');
const valid = { name: 'Quarterly access review', selectedRoles: ['tenant_admin'], selectedModules: [], selectedUserIds: ['user-1'], reviewers: ['reviewer@example.com'], dueDate: '2026-12-24T00:00:00Z' };

test('access review campaigns require explicit future scope and reviewers', () => {
  assert.equal(validateAccessReviewInput(valid, now), null);
  assert.match(validateAccessReviewInput({ ...valid, selectedUserIds: [] }, now) || '', /workspace user/);
  assert.match(validateAccessReviewInput({ ...valid, reviewers: [] }, now) || '', /reviewer/);
  assert.match(validateAccessReviewInput({ ...valid, selectedRoles: [], selectedModules: [] }, now) || '', /role or module/);
  assert.match(validateAccessReviewInput({ ...valid, dueDate: '2026-05-31' }, now) || '', /future/);
});

test('access review persistence rejects foreign users and does not invent reviewers', async () => {
  const root = path.resolve(__dirname, '../../..');
  const [repository, page] = await Promise.all([
    readFile(path.join(root, 'backend/src/repositories/accessGovernanceRepo.ts'), 'utf8'),
    readFile(path.join(root, 'frontend/src/pages/admin/AccessGovernanceViews.tsx'), 'utf8'),
  ]);
  assert.match(repository, /selectedUsers\.some\(\(user\) => !user\)/);
  assert.match(repository, /createAccessReview[\s\S]*?client\.query\('BEGIN'\)[\s\S]*?client\.query\('COMMIT'\)/);
  assert.doesNotMatch(repository, /input\.reviewers\[0\] \|\| 'Security Office'/);
  assert.match(page, /useState<EnterpriseRoleKey\[]>\(\[\]\)/);
  assert.match(page, /useState<string\[]>\(\[\]\)/);
  assert.doesNotMatch(page, /2026-05-31|Security Office, Compliance Lead/);
});
