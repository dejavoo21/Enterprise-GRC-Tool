import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('shared modals are accessible by default and retain nested scroll locks', async () => {
  const modal = await readFile(path.join(root, 'frontend/src/components/Modal.tsx'), 'utf8');
  assert.match(modal, /accessibleDialog = true/);
  assert.match(modal, /let openModalCount = 0/);
  assert.match(modal, /if \(openModalCount === 0\)[\s\S]*document\.body\.style\.overflow = 'hidden'/);
  assert.match(modal, /openModalCount \+= 1/);
  assert.match(modal, /openModalCount = Math\.max\(0, openModalCount - 1\)/);
  assert.match(modal, /document\.body\.style\.overflow = bodyOverflowBeforeModal/);
  assert.match(modal, /role=\{accessibleDialog \? 'dialog' : undefined\}/);
  assert.match(modal, /event\.key === 'Escape'/);
});
