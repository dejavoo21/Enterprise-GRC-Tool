import { apiCall } from '../lib/api';
import type { EnterpriseRelationship, RelationshipEntityType, RelationshipExplorerData, RelationshipType } from '../types/relationships';

const base = '/api/v1/relationships';
export async function getRelationships(type: RelationshipEntityType, id: string, includeArchived = false) {
  const result = await apiCall<{ data: RelationshipExplorerData; error: null }>(`${base}/${type}/${encodeURIComponent(id)}?includeArchived=${includeArchived}`);
  return result.data;
}
export async function searchRelationshipTargets(sourceType: RelationshipEntityType, type: RelationshipEntityType, search: string) {
  const result = await apiCall<{ data: Array<{ id: string; label: string }>; error: null }>(`${base}/search/${type}?sourceEntityType=${sourceType}&q=${encodeURIComponent(search)}`);
  return result.data;
}
export async function createRelationship(input: { sourceEntityType: RelationshipEntityType; sourceEntityId: string; targetEntityType: RelationshipEntityType; targetEntityId: string; relationshipType: RelationshipType }) {
  const result = await apiCall<{ data: EnterpriseRelationship; error: null }>(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, provenance: 'manual' }) });
  return result.data;
}
export async function archiveRelationship(id: string) {
  const result = await apiCall<{ data: EnterpriseRelationship; error: null }>(`${base}/${id}`, { method: 'DELETE' });
  return result.data;
}
