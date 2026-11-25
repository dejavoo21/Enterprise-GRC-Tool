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
  assert.match(applicationReview, /\?type=application/);
  assert.match(applicationReview, /\/reviews/);
  assert.match(applicationReview, /No application assets recorded/);
  assert.match(applicationReview, /does not generate sample applications, owners, findings, or review outcomes/);
  assert.match(applicationReview, /const requestClose = \(\) => \{ if \(!submitting\) onClose\(\); \};/);
  assert.match(applicationReview, /onClose=\{requestClose\}[\s\S]*onClick=\{requestClose\} disabled=\{submitting\}/);
  assert.doesNotMatch(applicationReview, /APR-\d|console\.log/);
  assert.match(workspaces, /Access reviews and application asset reviews use persisted workspace records/);
  assert.match(workspaces, /Open Application Reviews/);
  assert.match(shell, /Periodic reviews for persisted application assets/);
});
