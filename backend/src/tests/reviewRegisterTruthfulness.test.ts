import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('review register routes do not fabricate operational records', async () => {
  const [accessReview, applicationReview, workspaces, shell] = await Promise.all([
    read('frontend/src/pages/AccessReviewRegister.tsx'),
    read('frontend/src/pages/AppReviewRegister.tsx'),
    read('frontend/src/pages/WorkspacePages.tsx'),
    read('frontend/src/lib/platformShell.tsx'),
  ]);
  assert.match(accessReview, /<AccessReviewsPage/);
  assert.doesNotMatch(accessReview, /ACR-\d|console\.log/);
  assert.match(applicationReview, /No application review source is configured/);
  assert.match(applicationReview, /will not create sample applications, findings, owners, or review outcomes/);
  assert.doesNotMatch(applicationReview, /APR-\d|console\.log/);
  assert.match(workspaces, /Access reviews are persisted; application reviews are not configured/);
  assert.match(workspaces, /Review Integration Status/);
  assert.doesNotMatch(workspaces, /Application and access reviews are in scope/);
  assert.match(shell, /Application Review Status/);
});
