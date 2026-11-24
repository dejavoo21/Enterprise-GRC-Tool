import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { isSafeExternalReference } from '../utils/externalReference.js';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('external-reference guards reject unsafe protocols', async () => {
  const route = await read('backend/src/routes/evidence.ts');
  assert.equal(isSafeExternalReference('https://evidence.example.test/file'), true);
  assert.equal(isSafeExternalReference('http://evidence.example.test/file'), true);
  assert.equal(isSafeExternalReference('javascript:alert(1)'), false);
  assert.equal(isSafeExternalReference('file:///sensitive.txt'), false);
  assert.equal(isSafeExternalReference('not a URL'), false);
  const frontendGuard = await read('frontend/src/lib/externalReference.ts');
  assert.match(frontendGuard, /url\.protocol === 'http:' \|\| url\.protocol === 'https:'/);
  assert.match(frontendGuard, /\? url\.href : null/);
  assert.match(route, /assertExternalReference\(input\.locationUrl\)/);
});

test('governance document locations use the same safe external-reference policy', async () => {
  const route = await read('backend/src/routes/governance-documents.ts');
  const page = await read('frontend/src/pages/GovernanceDocuments.tsx');
  assert.equal(route.match(/isSafeExternalReference\((input|updates)\.locationUrl\)/g)?.length, 2);
  assert.match(page, /safeExternalReference\(document\.locationUrl\)/);
  assert.match(page, /safeExternalReference\(item\.locationUrl\)/);
});

test('governance document relationships use accessible dialogs and truthful failure handling', async () => {
  const page = await read('frontend/src/pages/GovernanceDocuments.tsx');
  assert.match(page, /<Modal accessibleDialog/);
  assert.match(page, /!createResponse\.ok \|\| createResult\.error/);
  assert.match(page, /!response\.ok \|\| result\.error/);
  assert.match(page, /controlActionError/);
  assert.match(page, /courseActionError/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /console\.error\('Failed to (?:link|unlink|fetch linked)/);
});

test('evidence UI distinguishes metadata from stored attachments', async () => {
  const page = await read('frontend/src/pages/Evidence.tsx');
  const modal = await read('frontend/src/components/EvidenceModal.tsx');
  assert.match(page, /metadata only/);
  assert.match(page, /No file or external location is recorded/);
  assert.match(page, /durable binary evidence storage is not configured/);
  assert.match(page, /\['Linked Audit', 'Not recorded'\]/);
  assert.match(page, /\['Linked Exception', 'Not recorded'\]/);
  assert.match(page, /\['Expiry Date', selectedEvidence\.expiresAt \? .* : 'Not recorded'\]/);
  assert.doesNotMatch(page, /Version 1 uploaded during initial control assessment/);
  assert.doesNotMatch(page, /`AUD-\$\{selectedEvidence\.controlId\}`/);
  assert.doesNotMatch(page, /`EXC-\$\{selectedEvidence\.id\}`/);
  assert.match(modal, /No file is uploaded or stored by LAFLO/);
  assert.match(modal, /Control selection unavailable/);
  assert.match(modal, /Evidence can still be recorded without a control link/);
  assert.match(modal, /controlsLoading \|\| Boolean\(controlsError\)/);
  assert.match(modal, /role="alert"/);
  assert.doesNotMatch(modal, /console\.error\('Failed to fetch controls/);
});

test('evidence without an automation job does not inherit assurance claims', async () => {
  const assurance = await read('frontend/src/services/continuousAssurance/continuousAssurance.ts');
  assert.match(assurance, /collectionSource: job\?\.source \?\? null/);
  assert.match(assurance, /collectionJob: job\?\.name \?\? null/);
  assert.match(assurance, /freshnessStatus: job\?\.freshnessStatus \?\? null/);
  assert.match(assurance, /approvalStatus: job\?\.approvalStatus \?\? null/);
});
