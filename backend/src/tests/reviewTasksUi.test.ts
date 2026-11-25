import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('review task start failures remain in the accessible workflow context', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/ReviewTasks.tsx'), 'utf8');
  assert.doesNotMatch(page, /window\.(prompt|alert|confirm)/);
  assert.match(page, /setMutationError\(`Unable to start \$\{task\.title\}/);
  assert.match(page, /role="alert"/);
  assert.match(page, /theme\.colors\.semantic\.dangerLight/);
  assert.equal((page.match(/<Modal accessibleDialog/g) || []).length, 2);
  assert.match(page, /title="Create Review Task"/);
  assert.match(page, /title="Complete Review Task"/);
  assert.match(page, /htmlFor="review-task-document"/);
  assert.match(page, /htmlFor="review-task-decision"/);
  assert.match(page, /disabled=\{isSubmitting\}/);
  assert.equal((page.match(/if \(isSubmitting\) return;/g) || []).length, 2);
  assert.equal((page.match(/<fieldset disabled=\{isSubmitting\}/g) || []).length, 2);
  assert.doesNotMatch(page, /position: 'fixed'/);
  assert.match(page, /Unable to create the review task/);
  assert.match(page, /Unable to complete the review task/);
});
