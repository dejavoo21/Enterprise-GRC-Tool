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

test('governance document creation uses a labelled accessible dialog and retains failures', async () => {
  const page = await read('frontend/src/pages/GovernanceDocuments.tsx');
  assert.match(page, /<Modal accessibleDialog isOpen=\{isOpen\}/);
  assert.match(page, /title="Create Policy or Document Record"/);
  assert.match(page, /htmlFor="document-title"/);
  assert.match(page, /htmlFor="document-expiry-date"/);
  assert.match(page, /repeat\(auto-fit, minmax\(min\(100%, 220px\), 1fr\)\)/);
  assert.match(page, /setSubmitError\(cause instanceof Error/);
  assert.match(page, /role="alert"/);
});

test('governance document mutations lock captured values and keep relationship selectors labelled', async () => {
  const page = await read('frontend/src/pages/GovernanceDocuments.tsx');
  assert.match(page, /<form onSubmit=\{handleSubmit\} aria-busy=\{isSubmitting\}>/);
  assert.match(page, /<fieldset disabled=\{isSubmitting\}/);
  assert.match(page, /htmlFor="governance-control-link"/);
  assert.match(page, /id="governance-control-link"[\s\S]*disabled=\{relationBusy === 'control'\}/);
  assert.match(page, /htmlFor="governance-control-relation"/);
  assert.match(page, /id="governance-control-relation"[\s\S]*disabled=\{relationBusy === 'control'\}/);
  assert.match(page, /htmlFor="governance-training-link"/);
  assert.match(page, /id="governance-training-link"[\s\S]*disabled=\{relationBusy === 'course'\}/);
  assert.match(page, /htmlFor="governance-training-relation"/);
  assert.match(page, /id="governance-training-relation"[\s\S]*disabled=\{relationBusy === 'course'\}/);
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

test('evidence entry locks its reviewed payload and labels every editable field', async () => {
  const modal = await read('frontend/src/components/EvidenceModal.tsx');

  assert.match(modal, /if \(isSubmitting\) return;/);
  assert.match(modal, /<form onSubmit=\{handleSubmit\} aria-busy=\{isSubmitting\}>/);
  assert.match(modal, /<fieldset disabled=\{isSubmitting\}/);
  assert.match(modal, /role="alert"/);
  for (const id of [
    'evidence-name',
    'evidence-description',
    'evidence-type',
    'evidence-collected-by',
    'evidence-collected-at',
    'evidence-linked-control',
    'evidence-source-type',
    'evidence-location-url',
    'evidence-source-system',
    'evidence-source-reference',
    'evidence-expires-at',
  ]) {
    assert.match(modal, new RegExp(`htmlFor="${id}"`));
    assert.match(modal, new RegExp(`id="${id}"`));
  }
});

test('evidence detail uses an accessible dialog and retains transition failures', async () => {
  const page = await read('frontend/src/pages/Evidence.tsx');
  assert.match(page, /<Modal[\s\S]*accessibleDialog[\s\S]*title=\{`Evidence:/);
  assert.match(page, /if \(!selectedEvidence \|\| transitionBusy\) return/);
  assert.match(page, /setTransitionError\(cause instanceof Error/);
  assert.match(page, /role="alert"/);
  assert.match(page, /disabled=\{transitionBusy\}/);
  assert.doesNotMatch(page, /<aside/);
  assert.doesNotMatch(page, /position: 'fixed'/);
});

test('evidence without an automation job does not inherit assurance claims', async () => {
  const assurance = await read('frontend/src/services/continuousAssurance/continuousAssurance.ts');
  assert.match(assurance, /collectionSource: job\?\.source \?\? null/);
  assert.match(assurance, /collectionJob: job\?\.name \?\? null/);
  assert.match(assurance, /freshnessStatus: job\?\.freshnessStatus \?\? null/);
  assert.match(assurance, /approvalStatus: job\?\.approvalStatus \?\? null/);
});
