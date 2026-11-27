import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertDataClassificationTransition } from '../services/privacyClassificationRules.js';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

test('classification lifecycle is workspace scoped, permission protected and relationship validated', () => {
  const routes = read('src/routes/privacy.ts');
  const repository = read('src/repositories/privacyRepo.ts');
  assert.match(routes, /router\.get\('\/data-inventory\/:id\/classification-history', requirePermission\('Reports', 'view'\)/);
  assert.match(routes, /router\.patch\('\/data-inventory\/:id\/classification', requirePermission\('Reports', 'edit'\)/);
  assert.match(routes, /assertWorkspaceLinks\(workspaceId, \{ policies: req\.body\?\.linkedPolicyIds, controls: req\.body\?\.linkedControlIds, evidence: req\.body\?\.linkedEvidenceIds \}\)/);
  assert.match(repository, /privacy_data_inventory WHERE workspace_id=\$1 AND id=\$2/);
  assert.match(repository, /SELECT \* FROM privacy_data_inventory WHERE workspace_id=\$1 AND id=\$2 FOR UPDATE/);
  assert.match(repository, /assertDataClassificationTransition/);
  assert.match(repository, /privacy_data_classification_events WHERE workspace_id=\$1 AND inventory_id=\$2/);
  assert.match(repository, /event_type,actor_id,previous_classification,new_classification,rationale,snapshot/);
});

test('classification migration is additive and the UI rejects discovery claims', () => {
  const migration = read('sql/migrations/20261125-privacy-data-classification-lifecycle.sql');
  const modal = read('../frontend/src/components/PrivacyClassificationModal.tsx');
  const selector = read('../frontend/src/components/PrivacyCanonicalLinkSelector.tsx');
  const intake = read('../frontend/src/components/PrivacyRegisterModal.tsx');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS privacy_data_classification_events/);
  assert.match(migration, /linked_policy_ids JSONB/);
  assert.match(migration, /linked_control_ids JSONB/);
  assert.match(migration, /linked_evidence_ids JSONB/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
  assert.match(modal, /not a discovered dataset or monitoring result/);
  assert.match(modal, /<PrivacyCanonicalLinkSelector active=\{Boolean\(record\)\}/);
  assert.match(intake, /<PrivacyCanonicalLinkSelector active=\{kind === 'inventory'\}/);
  assert.match(selector, /governance-documents\?docType=policy/);
  assert.match(selector, /api\/v1\/controls/);
  assert.match(selector, /api\/v1\/evidence/);
  assert.match(selector, /Promise\.allSettled\(fields\.map/);
  assert.match(selector, /Evidence metadata does not prove that a binary attachment is stored/);
  assert.match(selector, /type="checkbox" checked=\{value\[field\]\.includes\(item\.id\)\}/);
  assert.match(selector, /sequence !== requestSequence\.current \|\| workspaceId !== currentWorkspace\.id/);
  assert.doesNotMatch(modal, /Existing IDs, comma-separated/);
  assert.doesNotMatch(intake, /Linked (policy|control|evidence) IDs/);
  assert.match(intake, /linkedPolicyIds: \[\] as string\[\]/);
  assert.match(intake, /linkedPolicyIds: \[\.\.\.inventory\.linkedPolicyIds\]/);
  assert.match(intake, /does not discover, scan, or monitor data/);
});

test('classification lifecycle permits forward progress and rejects regression', () => {
  assert.doesNotThrow(() => assertDataClassificationTransition('planned', 'planned'));
  assert.doesNotThrow(() => assertDataClassificationTransition('planned', 'in_progress'));
  assert.doesNotThrow(() => assertDataClassificationTransition('in_progress', 'complete'));
  assert.doesNotThrow(() => assertDataClassificationTransition('complete', 'complete'));
  assert.throws(
    () => assertDataClassificationTransition('planned', 'complete'),
    (error: any) => error?.code === 'INVALID_CLASSIFICATION_TRANSITION',
  );
  assert.throws(
    () => assertDataClassificationTransition('complete', 'in_progress'),
    (error: any) => error?.code === 'INVALID_CLASSIFICATION_TRANSITION',
  );
});
