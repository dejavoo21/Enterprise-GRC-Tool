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
  assert.equal((page.match(/const submitLock = useRef\(false\);/g) || []).length, 2);
  assert.equal((page.match(/if \(submitLock\.current\) return;/g) || []).length, 2);
  assert.equal((page.match(/submitLock\.current = true;/g) || []).length, 2);
  assert.equal((page.match(/submitLock\.current = false;/g) || []).length, 2);
  assert.equal((page.match(/const requestClose = \(\) => \{ if \(!isSubmitting && !submitLock\.current\) onClose\(\); \};/g) || []).length, 2);
  assert.equal((page.match(/onClick=\{requestClose\}/g) || []).length, 2);
  assert.equal((page.match(/aria-busy=\{isSubmitting\}/g) || []).length, 2);
  assert.equal((page.match(/<fieldset disabled=\{isSubmitting\}/g) || []).length, 2);
  assert.doesNotMatch(page, /position: 'fixed'/);
  assert.match(page, /Unable to create the review task/);
  assert.match(page, /Unable to complete the review task/);
});

test('review task and document requests are independently generation controlled', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/ReviewTasks.tsx'), 'utf8');
  assert.match(page, /const taskRequestSequence = useRef\(0\)/);
  assert.match(page, /const documentRequestSequence = useRef\(0\)/);
  assert.match(page, /const sequence = \+\+taskRequestSequence\.current/);
  assert.match(page, /if \(sequence !== taskRequestSequence\.current\) return;/);
  assert.match(page, /setTasks\(result\.data \|\| \[\]\)/);
  assert.match(page, /sequence === documentRequestSequence\.current && !result\.error/);
  assert.match(page, /const sequenceRef = taskRequestSequence;\s*void fetchTasks\(\);\s*return \(\) => \{ sequenceRef\.current\+\+; \};\s*\}, \[fetchTasks\]\);/);
  assert.match(page, /const sequenceRef = documentRequestSequence;\s*void fetchDocuments\(\);\s*return \(\) => \{ sequenceRef\.current\+\+; \};\s*\}, \[fetchDocuments\]\);/);
});
