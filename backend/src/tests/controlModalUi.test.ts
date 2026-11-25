import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('control entry locks its captured payload while saving', async () => {
  const modal = await readFile(path.join(root, 'frontend/src/components/ControlModal.tsx'), 'utf8');

  assert.match(modal, /if \(isSubmitting\) return;/);
  assert.match(modal, /const handleClose = \(\) => \{[\s\S]*if \(!isSubmitting\)/);
  assert.match(modal, /<Modal[\s\S]*onClose=\{handleClose\}/);
  assert.match(modal, /<form onSubmit=\{handleSubmit\} aria-busy=\{isSubmitting\}>/);
  assert.match(modal, /<fieldset disabled=\{isSubmitting\} style=\{\{ margin: 0, padding: 0, border: 0 \}\}>/);
  assert.match(modal, /Primary Framework/);
});
