import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { supportedRelationships, validateRelationshipSearch, validateRelationshipType } from '../services/relationships.js';
import { relationshipPermissionModule } from '../routes/relationships.js';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('only the approved relationship directions are supported', () => {
  assert.equal(Object.keys(supportedRelationships).length, 9);
  assert.equal(validateRelationshipType('risk_asset', 'risk', 'asset'), 'risk_asset');
  assert.throws(() => validateRelationshipType('risk_asset', 'asset', 'risk'), /Unsupported relationship direction/);
  assert.throws(() => validateRelationshipType('invented', 'risk', 'asset'), /Unsupported relationship/);
  assert.deepEqual(validateRelationshipSearch('supplier', 'contract'), { source: 'supplier', target: 'contract' });
  assert.throws(() => validateRelationshipSearch('risk', 'supplier'), /Unsupported relationship/);
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

test('relationship routes enforce source-module view and edit permissions', async () => {
  const route = await read('backend/src/routes/relationships.ts');
  assert.equal(relationshipPermissionModule('risk'), 'Risks');
  assert.equal(relationshipPermissionModule('supplier'), 'Vendors');
  assert.equal(relationshipPermissionModule('evidence'), 'Evidence');
  assert.equal(relationshipPermissionModule('finding'), 'Audits');
  assert.equal(relationshipPermissionModule('business_process'), 'Resilience');
  assert.throws(() => relationshipPermissionModule('invented'), /Unsupported relationship entity type/);
  assert.match(route, /requireEntityPermission\('view'/);
  assert.match(route, /requireEntityPermission\('edit'/);
  assert.match(route, /sourceTypeFromRelationship/);
  assert.match(route, /\/history\/:id/);
});

test('explorer is selection-led and does not infer indirect impact', async () => {
  const [component, riskPage, register] = await Promise.all([
    read('frontend/src/components/RelationshipExplorer.tsx'),
    read('frontend/src/pages/Risks.tsx'),
    read('frontend/src/pages/RiskRegisterView.tsx'),
  ]);
  assert.match(component, /Direct, workspace-scoped relationships only/);
  assert.match(component, /No indirect dependency or impact score is inferred/);
  assert.doesNotMatch(component, /window\.(prompt|alert|confirm)/);
  assert.match(component, /<Modal accessibleDialog/);
  assert.match(component, /Immutable relationship history will be retained/);
  assert.match(component, /Unable to search relationship targets/);
  assert.match(component, /Unable to archive the relationship/);
  assert.match(component, /Open record/);
  assert.doesNotMatch(riskPage, /Link Evidence — coming soon/);
  assert.match(riskPage, /relationshipExplorerRef\.current\?\.scrollIntoView/);
  assert.match(register, /Open full details to load persisted evidence and other direct links/);
  assert.match(register, /onClick=\{\(\) => props\.onSelectRisk\(selected\)\}>Manage Relationships/);
});
