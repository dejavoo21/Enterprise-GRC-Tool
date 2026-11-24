import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { supportedRelationships, validateRelationshipType } from '../services/relationships.js';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('only the approved relationship directions are supported', () => {
  assert.equal(Object.keys(supportedRelationships).length, 9);
  assert.equal(validateRelationshipType('risk_asset', 'risk', 'asset'), 'risk_asset');
  assert.throws(() => validateRelationshipType('risk_asset', 'asset', 'risk'), /Unsupported relationship direction/);
  assert.throws(() => validateRelationshipType('invented', 'risk', 'asset'), /Unsupported relationship/);
});

test('relationship schema has tenant traversal indexes and retained history', async () => {
  const migration = await read('backend/sql/migrations/20261124-enterprise-relationships.sql');
  assert.match(migration, /workspace_id TEXT NOT NULL REFERENCES workspaces/);
  assert.match(migration, /enterprise_relationships_active_unique_idx/);
  assert.match(migration, /enterprise_relationships_source_idx/);
  assert.match(migration, /enterprise_relationships_target_idx/);
  assert.match(migration, /enterprise_relationship_events/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE[^\n]*source_entity_id/);
});

test('repository validates records in the workspace and archives without deletion', async () => {
  const repository = await read('backend/src/repositories/relationshipsRepo.ts');
  assert.match(repository, /AND workspace_id=\$2/);
  assert.match(repository, /status='archived'/);
  assert.doesNotMatch(repository, /DELETE FROM enterprise_relationships/);
  assert.match(repository, /enterprise_relationship_events/);
});

test('relationship routes require explicit view and edit permissions', async () => {
  const route = await read('backend/src/routes/relationships.ts');
  assert.match(route, /requirePermission\('Controls', 'view'\)/);
  assert.match(route, /requirePermission\('Controls', 'edit'\)/);
  assert.match(route, /\/history\/:id/);
});

test('explorer is selection-led and does not infer indirect impact', async () => {
  const component = await read('frontend/src/components/RelationshipExplorer.tsx');
  assert.match(component, /Direct, workspace-scoped relationships only/);
  assert.match(component, /No indirect dependency or impact score is inferred/);
  assert.match(component, /Archive this relationship/);
  assert.match(component, /Open record/);
});
