import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('evidence creation accepts only HTTP or HTTPS external references', async () => {
  const route = await read('backend/src/routes/evidence.ts');
  assert.match(route, /\['http:', 'https:'\]\.includes\(location\.protocol\)/);
  assert.match(route, /valid HTTP or HTTPS external reference/);
});

test('evidence UI distinguishes metadata from stored attachments', async () => {
  const page = await read('frontend/src/pages/Evidence.tsx');
  const modal = await read('frontend/src/components/EvidenceModal.tsx');
  assert.match(page, /metadata only/);
  assert.match(page, /No file or external location is recorded/);
  assert.match(page, /durable binary evidence storage is not configured/);
  assert.doesNotMatch(page, /Version 1 uploaded during initial control assessment/);
  assert.match(modal, /No file is uploaded or stored by LAFLO/);
});
