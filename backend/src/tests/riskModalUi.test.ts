import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('risk entry locks the complete captured payload while saving', async () => {
  const modal = await readFile(path.join(root, 'frontend/src/components/RiskModal.tsx'), 'utf8');
  assert.match(modal, /const submitLock = useRef\(false\)/);
  assert.match(modal, /const submitGeneration = useRef\(0\)/);
  assert.match(modal, /const submitOperation = useRef\(0\)/);
  assert.match(modal, /submitGeneration\.current \+= 1/);
  assert.equal((modal.match(/submitOperation\.current \+= 1/g) || []).length, 1);
  assert.match(modal, /submitLock\.current = false/);
  assert.match(modal, /if \(submitLock\.current\) return/);
  assert.match(modal, /const operation = \+\+submitOperation\.current/);
  assert.match(modal, /ciaImpacts: \[\.\.\.formData\.ciaImpacts\]/);
  assert.match(modal, /targetFactors: formData\.targetFactors \? \{ \.\.\.formData\.targetFactors \}/);
  assert.match(modal, /generation !== submitGeneration\.current/);
  assert.match(modal, /if \(operation === submitOperation\.current\) \{[\s\S]*submitLock\.current = false;[\s\S]*generation === submitGeneration\.current/);
  assert.match(modal, /const handleClose = \(\) => \{[\s\S]*if \(!isSubmitting && !submitLock\.current\)/);
  assert.match(modal, /<Modal[\s\S]*onClose=\{handleClose\}/);
  assert.match(modal, /<form onSubmit=\{handleSubmit\} aria-busy=\{isSubmitting\}>/);
  assert.match(modal, /<fieldset disabled=\{isSubmitting\} style=\{\{ margin: 0, padding: 0, border: 0 \}\}>/);
  assert.match(modal, /CIA Impact/);
  assert.match(modal, /Acceptance rationale/);
  assert.match(modal, /Review notes/);
});
