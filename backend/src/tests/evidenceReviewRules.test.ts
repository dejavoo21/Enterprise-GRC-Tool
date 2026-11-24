import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEvidenceDecision, assertEvidenceEditable, assertEvidenceSubmission, assertExternalReference } from '../services/evidenceReviewRules.js';

test('evidence review requires submission before decision', () => {
  assert.doesNotThrow(() => assertEvidenceSubmission('draft'));
  assert.throws(() => assertEvidenceDecision('draft', 'creator', 'reviewer'), /pending review/);
  assert.doesNotThrow(() => assertEvidenceDecision('pending_review', 'creator', 'reviewer'));
});

test('evidence creator cannot approve own submission', () => {
  assert.throws(() => assertEvidenceDecision('pending_review', 'same-user', 'same-user'), /cannot approve or reject/);
});

test('approved evidence metadata is immutable and references require HTTPS', () => {
  assert.doesNotThrow(() => assertEvidenceEditable('draft'));
  assert.throws(() => assertEvidenceEditable('approved'), /draft or rejected/);
  assert.doesNotThrow(() => assertExternalReference(undefined));
  assert.doesNotThrow(() => assertExternalReference('https://evidence.example/reference'));
  assert.throws(() => assertExternalReference('http://evidence.example/reference'), /HTTPS/);
});
