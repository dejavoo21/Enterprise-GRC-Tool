import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('review register routes do not fabricate operational records', async () => {
  const [accessReview, applicationReview] = await Promise.all([
    read('frontend/src/pages/AccessReviewRegister.tsx'),
    read('frontend/src/pages/AppReviewRegister.tsx'),
  ]);
  assert.match(accessReview, /<AccessReviewsPage/);
  assert.doesNotMatch(accessReview, /ACR-\d|console\.log/);
  assert.match(applicationReview, /No application review source is configured/);
  assert.match(applicationReview, /will not create sample applications, findings, owners, or review outcomes/);
  assert.doesNotMatch(applicationReview, /APR-\d|console\.log/);
});
