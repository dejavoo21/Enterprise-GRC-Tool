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
  assert.match(page, /\['Linked Audit', 'Not recorded'\]/);
  assert.match(page, /\['Linked Exception', 'Not recorded'\]/);
  assert.match(page, /\['Expiry Date', 'Not recorded'\]/);
  assert.match(page, /automation\?\.freshnessStatus \|\| 'Not assessed'/);
  assert.doesNotMatch(page, /Version 1 uploaded during initial control assessment/);
  assert.doesNotMatch(page, /`AUD-\$\{selectedEvidence\.controlId\}`/);
  assert.doesNotMatch(page, /`EXC-\$\{selectedEvidence\.id\}`/);
  assert.match(modal, /No file is uploaded or stored by LAFLO/);
});

test('evidence without an automation job does not inherit assurance claims', async () => {
  const assurance = await read('frontend/src/services/continuousAssurance/continuousAssurance.ts');
  assert.match(assurance, /collectionSource: job\?\.source \?\? null/);
  assert.match(assurance, /collectionJob: job\?\.name \?\? null/);
  assert.match(assurance, /freshnessStatus: job\?\.freshnessStatus \?\? null/);
  assert.match(assurance, /approvalStatus: job\?\.approvalStatus \?\? null/);
});
