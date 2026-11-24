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
});
