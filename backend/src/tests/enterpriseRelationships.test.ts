import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { supportedRelationships, validateRelationshipContext, validateRelationshipIdentifier, validateRelationshipSearch, validateRelationshipSearchTerm, validateRelationshipType } from '../services/relationships.js';
import { filterRelationshipDataByModules, relationshipPermissionModule } from '../routes/relationships.js';
import type { EnterpriseRelationship } from '../types/relationships.js';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('only the approved relationship directions are supported', () => {
  assert.equal(Object.keys(supportedRelationships).length, 10);
  assert.equal(validateRelationshipType('risk_asset', 'risk', 'asset'), 'risk_asset');
  assert.throws(() => validateRelationshipType('risk_asset', 'asset', 'risk'), /Unsupported relationship direction/);
  assert.throws(() => validateRelationshipType('invented', 'risk', 'asset'), /Unsupported relationship/);
  assert.deepEqual(validateRelationshipSearch('supplier', 'contract'), { source: 'supplier', target: 'contract' });
  assert.equal(validateRelationshipType('ai_system_data_asset', 'ai_system', 'data_asset'), 'ai_system_data_asset');
  assert.deepEqual(validateRelationshipSearch('ai_system', 'data_asset'), { source: 'ai_system', target: 'data_asset' });
  assert.throws(() => validateRelationshipSearch('risk', 'supplier'), /Unsupported relationship/);
});

test('manual relationship provenance and metadata are bounded', () => {
  assert.deepEqual(validateRelationshipContext({}), { provenance: 'manual', metadata: {} });
  assert.deepEqual(validateRelationshipContext({ provenance: 'manual', metadata: { sourceNote: 'Reviewed by owner', confidence: 1, tags: ['reviewed'] } }), {
    provenance: 'manual', metadata: { sourceNote: 'Reviewed by owner', confidence: 1, tags: ['reviewed'] },
  });
  assert.throws(() => validateRelationshipContext({ provenance: 'integration' }), /cannot claim another provenance/);
  assert.throws(() => validateRelationshipContext({ metadata: 'not-an-object' }), /must be an object/);
  assert.throws(() => validateRelationshipContext({ metadata: { note: 'x'.repeat(501) } }), /cannot exceed 500/);
  assert.throws(() => validateRelationshipContext({ metadata: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`field${index}`, 'x'.repeat(500)])) }), /cannot exceed 4096/);
  assert.throws(() => validateRelationshipContext({ metadata: { nested: { one: { two: { three: true } } } } }), /three nested levels/);
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.throws(() => validateRelationshipContext({ metadata: unsafe }), /invalid field name/);
});

test('relationship identifiers and searches are bounded before repository access', () => {
  assert.equal(validateRelationshipIdentifier(' record-1 '), 'record-1');
  assert.equal(validateRelationshipSearchTerm(' customer '), 'customer');
  assert.equal(validateRelationshipSearchTerm(''), '');
  assert.throws(() => validateRelationshipIdentifier(''), /is required/);
  assert.throws(() => validateRelationshipIdentifier('x'.repeat(201)), /cannot exceed 200/);
  assert.throws(() => validateRelationshipIdentifier('record\n1'), /control characters/);
  assert.throws(() => validateRelationshipSearchTerm('x'.repeat(201)), /cannot exceed 200/);
  assert.throws(() => validateRelationshipSearchTerm('customer\tdata'), /control characters/);
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
  assert.match(repository, /ORDER BY e\.created_at ASC/);
  assert.doesNotMatch(repository, /e\.occurred_at/);
  assert.match(repository, /ai_system: \{ table: 'ai_inventory', label: 'system_name', workspace: true \}/);
  assert.match(repository, /data_asset: \{ table: 'privacy_data_inventory', label: 'data_asset_name', workspace: true \}/);
});

test('relationship entity resolvers match their owning schemas', async () => {
  const [repository, core, assets, frameworks, governance, tprm, audit, resilience, ai, privacy, riskReferences] = await Promise.all([
    read('backend/src/repositories/relationshipsRepo.ts'),
    read('backend/sql/schema-core-grc.sql'),
    read('backend/sql/schema-assets-vendors.sql'),
    read('backend/sql/schema-frameworks.sql'),
    read('backend/sql/schema-governance-review.sql'),
    read('backend/sql/schema-tprm.sql'),
    read('backend/sql/migrations/20261125-audit-management-schema.sql'),
    read('backend/sql/migrations/20261125-bcm-schema.sql'),
    read('backend/sql/migrations/20261125-ai-governance-schema.sql'),
    read('backend/sql/migrations/20261125-privacy-data-governance-schema.sql'),
    read('backend/sql/migrations/20260924-risk-references.sql'),
  ]);
  const scopedSources = [
    ['risk', 'risks', 'risk_ref', core],
    ['asset', 'assets', 'name', assets],
    ['control', 'controls', 'title', core],
    ['evidence', 'evidence', 'name', core],
    ['supplier', 'vendors', 'name', assets],
    ['contract', 'vendor_contracts', 'contract_name', tprm],
    ['policy', 'governance_documents', 'title', governance],
    ['finding', 'audit_findings', 'title', audit],
    ['remediation', 'audit_corrective_actions', 'action_title', audit],
    ['business_process', 'bcm_bia_processes', 'process_name', resilience],
    ['ai_system', 'ai_inventory', 'system_name', ai],
    ['data_asset', 'privacy_data_inventory', 'data_asset_name', privacy],
  ] as const;
  for (const [type, table, label, schema] of scopedSources) {
    assert.match(repository, new RegExp(`${type}: \\{ table: '${table}', label: (?:'${label}'|"[^"]*${label}[^"]*"), workspace: true \\}`));
    assert.match(schema, new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, 'i'));
    assert.match(schema, new RegExp(`\\bworkspace_id\\s+TEXT\\b`, 'i'));
    assert.match(label === 'risk_ref' ? riskReferences : schema, new RegExp(`\\b${label}\\s+TEXT\\b`, 'i'));
  }
  assert.match(repository, /framework: \{ table: 'frameworks', label: "COALESCE\(code, name\)", workspace: false \}/);
  assert.match(frameworks, /CREATE TABLE IF NOT EXISTS frameworks/);
  assert.doesNotMatch(frameworks.match(/CREATE TABLE IF NOT EXISTS frameworks[\s\S]*?\);/)?.[0] || '', /workspace_id/);
  assert.match(riskReferences, /ALTER TABLE risks ADD COLUMN IF NOT EXISTS risk_ref TEXT/);
  assert.match(riskReferences, /ALTER TABLE risks ALTER COLUMN risk_ref SET NOT NULL/);
  assert.match(riskReferences, /CREATE UNIQUE INDEX IF NOT EXISTS risks_reference_unique ON risks\(risk_ref\)/);
});

test('relationship routes enforce source-module view and edit permissions', async () => {
  const route = await read('backend/src/routes/relationships.ts');
  assert.equal(relationshipPermissionModule('risk'), 'Risks');
  assert.equal(relationshipPermissionModule('supplier'), 'Vendors');
  assert.equal(relationshipPermissionModule('evidence'), 'Evidence');
  assert.equal(relationshipPermissionModule('finding'), 'Audits');
  assert.equal(relationshipPermissionModule('business_process'), 'Resilience');
  assert.equal(relationshipPermissionModule('ai_system'), 'AI');
  assert.equal(relationshipPermissionModule('data_asset'), 'Reports');
  assert.throws(() => relationshipPermissionModule('invented'), /Unsupported relationship entity type/);
  assert.match(route, /requireEntityPermission\('view'/);
  assert.match(route, /requireEntityPermission\('edit'/);
  assert.match(route, /sourceTypeFromRelationship/);
  assert.match(route, /\/history\/:id'[\s\S]*requireEntityPermission\('view', sourceTypeFromRelationship\)[\s\S]*requireEntityPermission\('view', targetTypeFromRelationship\)/);
  assert.match(route, /relationshipAuthorization = new WeakMap/);
  assert.match(route, /\/search\/:entityType'[\s\S]*requireEntityPermission\('view', req => req\.params\.entityType\)/);
  assert.match(route, /router\.post\('\/'[\s\S]*requireEntityPermission\('view', req => String\(req\.body\?\.targetEntityType \|\| ''\)\)/);
});

test('reverse traversal hides relationships and counts for unreadable modules', () => {
  const base = {
    id: 'rel-1', workspaceId: 'workspace-a', sourceEntityType: 'ai_system' as const, sourceEntityId: 'ai-1', sourceLabel: 'Restricted AI system',
    targetEntityType: 'data_asset' as const, targetEntityId: 'data-1', targetLabel: 'Customer records', relationshipType: 'ai_system_data_asset' as const,
    status: 'active' as const, provenance: 'manual', metadata: {}, createdBy: 'user-1', createdAt: '2026-11-25T00:00:00Z', updatedAt: '2026-11-25T00:00:00Z',
  } satisfies EnterpriseRelationship;
  const data = { entity: { type: 'data_asset' as const, id: 'data-1', label: 'Customer records' }, relationships: [{ ...base, direction: 'incoming' as const }], counts: { ai_system: 1 } };
  assert.deepEqual(filterRelationshipDataByModules(data, new Set(['Reports'])), { ...data, relationships: [], counts: {} });
  assert.deepEqual(filterRelationshipDataByModules(data, new Set(['Reports', 'AI'])), data);
});

test('explorer is selection-led and does not infer indirect impact', async () => {
  const [component, riskPage, register, privacyClassification] = await Promise.all([
    read('frontend/src/components/RelationshipExplorer.tsx'),
    read('frontend/src/pages/Risks.tsx'),
    read('frontend/src/pages/RiskRegisterView.tsx'),
    read('frontend/src/components/PrivacyClassificationModal.tsx'),
  ]);
  assert.match(component, /Direct, workspace-scoped relationships only/);
  assert.match(component, /No indirect dependency or impact score is inferred/);
  assert.doesNotMatch(component, /window\.(prompt|alert|confirm)/);
  assert.match(component, /<Modal accessibleDialog/);
  assert.match(component, /Immutable relationship history will be retained/);
  assert.match(component, /Unable to search relationship targets/);
  assert.match(component, /Unable to archive the relationship/);
  assert.match(component, /const closeArchive = \(\) => \{ if \(!busy && !mutationLock\.current\) setArchiving\(null\); \};/);
  assert.match(component, /onClose=\{closeArchive\}[\s\S]*onClick=\{closeArchive\} disabled=\{busy\}/);
  assert.match(component, /const mutationLock = useRef\(false\);/);
  assert.equal((component.match(/if \(mutationLock\.current\) return;/g) || []).length, 3);
  assert.equal((component.match(/mutationLock\.current = true;/g) || []).length, 3);
  assert.equal((component.match(/mutationLock\.current = false;/g) || []).length, 3);
  assert.match(component, /<fieldset disabled=\{busy\} aria-busy=\{busy\}/);
  assert.match(component, /onClick=\{\(\) => void load\(\)\} disabled=\{busy\}/);
  assert.match(component, /repeat\(auto-fit, minmax\(min\(100%, 220px\), 1fr\)\)/);
  assert.match(component, /gridColumn: '1 \/ -1'/);
  assert.match(component, /Open record/);
  assert.match(component, /getRelationshipHistory/);
  assert.match(component, /Relationship history/);
  assert.match(component, /Immutable create and archive events/);
  assert.match(component, /const historyLock = useRef\(false\)/);
  assert.match(component, /Managed from source/);
  assert.match(component, /incoming[\s\S]*Managed from source[\s\S]*setArchiving\(item\)/);
  assert.match(component, /ai_system_data_asset/);
  assert.doesNotMatch(riskPage, /Link Evidence — coming soon/);
  assert.match(riskPage, /relationshipExplorerRef\.current\?\.scrollIntoView/);
  assert.match(register, /Open full details to load persisted evidence and other direct links/);
  assert.match(register, /onClick=\{\(\) => props\.onSelectRisk\(selected\)\}>Manage Relationships/);
  assert.match(privacyClassification, /<RelationshipExplorer entityType="data_asset" entityId=\{record\.id\} onNavigate=\{\(key\) => navigate\(`\/\$\{key\}`\)\} \/>/);
});
