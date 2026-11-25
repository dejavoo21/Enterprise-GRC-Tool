import * as repo from '../repositories/relationshipsRepo.js';
import type { RelationshipActor, RelationshipEntityType, RelationshipType } from '../types/relationships.js';
import { recordActivity } from './activityLedger/activityLedger.js';

export const supportedRelationships: Record<RelationshipType, readonly [RelationshipEntityType, RelationshipEntityType]> = {
  risk_asset: ['risk', 'asset'], risk_control: ['risk', 'control'], risk_evidence: ['risk', 'evidence'],
  supplier_asset: ['supplier', 'asset'], supplier_contract: ['supplier', 'contract'], policy_control: ['policy', 'control'],
  framework_control: ['framework', 'control'], finding_remediation: ['finding', 'remediation'],
  asset_business_process: ['asset', 'business_process'],
  ai_system_data_asset: ['ai_system', 'data_asset'],
};

function failure(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

const forbiddenMetadataKeys = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeMetadataValue(value: unknown, depth = 0): void {
  if (depth > 3) throw failure('Relationship metadata cannot exceed three nested levels');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw failure('Relationship metadata numbers must be finite');
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 500) throw failure('Relationship metadata text cannot exceed 500 characters');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 20) throw failure('Relationship metadata arrays cannot exceed 20 items');
    value.forEach(item => assertSafeMetadataValue(item, depth + 1));
    return;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw failure('Relationship metadata must contain JSON values only');
  const entries = Object.entries(value);
  if (entries.length > 20) throw failure('Relationship metadata cannot exceed 20 fields per level');
  entries.forEach(([key, item]) => {
    if (!key || key.length > 64 || forbiddenMetadataKeys.has(key)) throw failure('Relationship metadata contains an invalid field name');
    assertSafeMetadataValue(item, depth + 1);
  });
}

export function validateRelationshipContext(input: Record<string, unknown>) {
  const provenance = input.provenance === undefined ? 'manual' : String(input.provenance).trim();
  if (provenance !== 'manual') throw failure('Manual relationship creation cannot claim another provenance');
  const metadata = input.metadata === undefined ? {} : input.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw failure('Relationship metadata must be an object');
  assertSafeMetadataValue(metadata);
  if (JSON.stringify(metadata).length > 4096) throw failure('Relationship metadata cannot exceed 4096 characters');
  return { provenance, metadata: metadata as Record<string, unknown> };
}

export function validateRelationshipType(type: string, source: string, target: string) {
  const pair = supportedRelationships[type as RelationshipType];
  if (!pair || pair[0] !== source || pair[1] !== target) throw failure('Unsupported relationship direction or type');
  return type as RelationshipType;
}

export function validateRelationshipSearch(source: string, target: string) {
  const supported = Object.values(supportedRelationships).some(([allowedSource, allowedTarget]) => allowedSource === source && allowedTarget === target);
  if (!supported) throw failure('Unsupported relationship direction or entity type');
  return { source: source as RelationshipEntityType, target: target as RelationshipEntityType };
}

export async function createEnterpriseRelationship(workspaceId: string, input: Record<string, unknown>, actor: RelationshipActor) {
  const sourceEntityType = String(input.sourceEntityType || '') as RelationshipEntityType;
  const targetEntityType = String(input.targetEntityType || '') as RelationshipEntityType;
  const sourceEntityId = String(input.sourceEntityId || '').trim();
  const targetEntityId = String(input.targetEntityId || '').trim();
  const relationshipType = validateRelationshipType(String(input.relationshipType || ''), sourceEntityType, targetEntityType);
  const context = validateRelationshipContext(input);
  if (!sourceEntityId || !targetEntityId) throw failure('Source and target record IDs are required');
  const [source, target] = await Promise.all([
    repo.resolveEntity(workspaceId, sourceEntityType, sourceEntityId),
    repo.resolveEntity(workspaceId, targetEntityType, targetEntityId),
  ]);
  if (!source || !target) throw failure('Source or target record was not found in the authenticated workspace', 404);
  const relationship = await repo.createRelationship(workspaceId, {
    sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, relationshipType,
    provenance: context.provenance,
    metadata: context.metadata,
  }, actor);
  await recordActivity({ workspaceId, actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    action: 'relationship_created', category: 'system', targetType: 'enterprise_relationship', targetId: relationship.id,
    targetName: `${source.label} -> ${target.label}`, outcome: 'success', severity: 'low', source: 'backend',
    notes: `${relationshipType} relationship created from ${sourceEntityType}:${sourceEntityId} to ${targetEntityType}:${targetEntityId}.` });
  return { ...relationship, sourceLabel: source.label, targetLabel: target.label };
}

export async function archiveEnterpriseRelationship(workspaceId: string, id: string, actor: RelationshipActor) {
  const relationship = await repo.archiveRelationship(workspaceId, id, actor);
  if (!relationship) throw failure('Active relationship not found in this workspace', 404);
  await recordActivity({ workspaceId, actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
    action: 'relationship_archived', category: 'system', targetType: 'enterprise_relationship', targetId: id,
    targetName: relationship.relationshipType, outcome: 'success', severity: 'low', source: 'backend',
    notes: 'Canonical relationship archived without deleting audit history.' });
  return relationship;
}

export async function getEntityRelationships(workspaceId: string, type: RelationshipEntityType, id: string, includeArchived = false) {
  const entity = await repo.resolveEntity(workspaceId, type, id);
  if (!entity) throw failure('Selected record was not found in the authenticated workspace', 404);
  const [relationships, counts] = await Promise.all([repo.listForEntity(workspaceId, type, id, includeArchived), repo.relatedCounts(workspaceId, type, id)]);
  return { entity: { type, id, label: entity.label }, relationships, counts };
}

export async function searchRelationshipEntities(workspaceId: string, source: RelationshipEntityType, target: RelationshipEntityType, search: string) {
  validateRelationshipSearch(source, target);
  return repo.searchEntities(workspaceId, target, search.trim());
}

export async function getRelationshipAuthorizationContext(workspaceId: string, id: string) {
  const relationship = await repo.findRelationship(workspaceId, id);
  if (!relationship) throw failure('Relationship was not found in this workspace', 404);
  return relationship;
}

export async function getRelationshipHistory(workspaceId: string, id: string) {
  const history = await repo.listRelationshipHistory(workspaceId, id);
  if (!history.length) throw failure('Relationship history was not found in this workspace', 404);
  return history;
}
