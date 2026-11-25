import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('control entry locks its captured payload while saving', async () => {
  const modal = await readFile(path.join(root, 'frontend/src/components/ControlModal.tsx'), 'utf8');

  assert.match(modal, /const submitLock = useRef\(false\)/);
  assert.match(modal, /if \(submitLock\.current\) return;/);
  assert.match(modal, /submitLock\.current = false/);
  assert.match(modal, /const handleClose = \(\) => \{[\s\S]*if \(!isSubmitting && !submitLock\.current\)/);
  assert.match(modal, /<Modal[\s\S]*onClose=\{handleClose\}/);
  assert.match(modal, /<form onSubmit=\{handleSubmit\} aria-busy=\{isSubmitting\}>/);
  assert.match(modal, /<fieldset disabled=\{isSubmitting\} className="control-modal__fields">/);
  for (const id of ['control-title', 'control-description', 'control-owner', 'control-domain', 'control-status', 'control-primary-framework']) {
    assert.match(modal, new RegExp(`htmlFor="${id}"`));
    assert.match(modal, new RegExp(`id="${id}"`));
  }
  assert.match(modal, /Primary Framework/);
});

test('control entry reflows paired fields and retains visible keyboard focus', async () => {
  const styles = await readFile(path.join(root, 'frontend/src/components/ControlModal.css'), 'utf8');

  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /:focus-visible[\s\S]*outline:/);
});
