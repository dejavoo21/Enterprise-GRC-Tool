import { generateId, pool, query } from '../db.js';
import type { EnterpriseRelationship, RelationshipActor, RelationshipEntityType, RelationshipEvent, RelationshipType } from '../types/relationships.js';

const entitySources: Record<RelationshipEntityType, { table: string; label: string; workspace: boolean }> = {
  risk: { table: 'risks', label: "COALESCE(risk_ref, title)", workspace: true },
  asset: { table: 'assets', label: 'name', workspace: true },
  control: { table: 'controls', label: 'title', workspace: true },
  evidence: { table: 'evidence', label: 'name', workspace: true },
  supplier: { table: 'vendors', label: 'name', workspace: true },
  contract: { table: 'vendor_contracts', label: 'contract_name', workspace: true },
  policy: { table: 'governance_documents', label: 'title', workspace: true },
  framework: { table: 'frameworks', label: "COALESCE(code, name)", workspace: false },
  finding: { table: 'audit_findings', label: 'title', workspace: true },
  remediation: { table: 'audit_corrective_actions', label: 'action_title', workspace: true },
  business_process: { table: 'bcm_bia_processes', label: 'process_name', workspace: true },
};

function mapRow(row: any): EnterpriseRelationship {
  return {
    id: row.id, workspaceId: row.workspace_id, sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id, sourceLabel: row.source_label || row.source_entity_id,
    targetEntityType: row.target_entity_type, targetEntityId: row.target_entity_id,
    targetLabel: row.target_label || row.target_entity_id, relationshipType: row.relationship_type,
    status: row.status, provenance: row.provenance, metadata: row.metadata || {},
    createdBy: row.created_by_name, createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(), direction: row.direction,
  };
}

export async function resolveEntity(workspaceId: string, type: RelationshipEntityType, id: string) {
  const source = entitySources[type];
  const result = await query<{ id: string; label: string }>(
    `SELECT id, ${source.label}::text AS label FROM ${source.table} WHERE id=$1${source.workspace ? ' AND workspace_id=$2' : ''} LIMIT 1`,
    source.workspace ? [id, workspaceId] : [id],
  );
  return result.rows[0] || null;
}

export async function findRelationship(workspaceId: string, id: string) {
  const result = await query<any>(
    `SELECT * FROM enterprise_relationships WHERE workspace_id=$1 AND id=$2 LIMIT 1`,
    [workspaceId, id],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function searchEntities(workspaceId: string, type: RelationshipEntityType, search: string) {
  const source = entitySources[type];
  const params = source.workspace ? [workspaceId, `%${search}%`] : [`%${search}%`];
  const workspaceClause = source.workspace ? 'workspace_id=$1 AND ' : '';
  const searchParam = source.workspace ? '$2' : '$1';
  const result = await query<{ id: string; label: string }>(
    `SELECT id, ${source.label}::text AS label FROM ${source.table}
     WHERE ${workspaceClause}(${source.label} ILIKE ${searchParam} OR id::text ILIKE ${searchParam})
     ORDER BY ${source.label} LIMIT 25`, params,
  );
  return result.rows;
}

export async function createRelationship(workspaceId: string, input: {
  sourceEntityType: RelationshipEntityType; sourceEntityId: string; targetEntityType: RelationshipEntityType;
  targetEntityId: string; relationshipType: RelationshipType; provenance: string; metadata?: Record<string, unknown>;
}, actor: RelationshipActor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = generateId('rel');
    const row = (await client.query(
      `INSERT INTO enterprise_relationships
       (id,workspace_id,source_entity_type,source_entity_id,target_entity_type,target_entity_id,relationship_type,provenance,metadata,created_by_user_id,created_by_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING *`,
      [id, workspaceId, input.sourceEntityType, input.sourceEntityId, input.targetEntityType, input.targetEntityId,
        input.relationshipType, input.provenance, JSON.stringify(input.metadata || {}), actor.userId, actor.name],
    )).rows[0];
    await client.query(
      `INSERT INTO enterprise_relationship_events (id,workspace_id,relationship_id,event_type,actor_user_id,actor_name,snapshot)
       VALUES($1,$2,$3,'created',$4,$5,$6::jsonb)`,
      [generateId('rel-event'), workspaceId, id, actor.userId, actor.name, JSON.stringify(row)],
    );
    await client.query('COMMIT');
    return mapRow(row);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function archiveRelationship(workspaceId: string, id: string, actor: RelationshipActor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      `UPDATE enterprise_relationships SET status='archived',archived_by_user_id=$3,archived_by_name=$4,archived_at=NOW(),updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 AND status='active' RETURNING *`, [workspaceId, id, actor.userId, actor.name],
    )).rows[0];
    if (!row) { await client.query('ROLLBACK'); return null; }
    await client.query(
      `INSERT INTO enterprise_relationship_events (id,workspace_id,relationship_id,event_type,actor_user_id,actor_name,snapshot)
       VALUES($1,$2,$3,'archived',$4,$5,$6::jsonb)`,
      [generateId('rel-event'), workspaceId, id, actor.userId, actor.name, JSON.stringify(row)],
    );
    await client.query('COMMIT');
    return mapRow(row);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function listForEntity(workspaceId: string, type: RelationshipEntityType, id: string, includeArchived = false) {
  const result = await query<any>(
    `SELECT r.*, CASE WHEN r.source_entity_type=$2 AND r.source_entity_id=$3 THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM enterprise_relationships r WHERE r.workspace_id=$1
       AND ((r.source_entity_type=$2 AND r.source_entity_id=$3) OR (r.target_entity_type=$2 AND r.target_entity_id=$3))
       ${includeArchived ? '' : "AND r.status='active'"} ORDER BY r.updated_at DESC`, [workspaceId, type, id],
  );
  return Promise.all(result.rows.map(async row => {
    const [source, target] = await Promise.all([
      resolveEntity(workspaceId, row.source_entity_type, row.source_entity_id),
      resolveEntity(workspaceId, row.target_entity_type, row.target_entity_id),
    ]);
    return mapRow({ ...row, source_label: source?.label, target_label: target?.label });
  }));
}

export async function relatedCounts(workspaceId: string, type: RelationshipEntityType, id: string) {
  const result = await query<{ entity_type: RelationshipEntityType; count: number }>(
    `SELECT CASE WHEN source_entity_type=$2 AND source_entity_id=$3 THEN target_entity_type ELSE source_entity_type END AS entity_type,
       COUNT(*)::int AS count FROM enterprise_relationships WHERE workspace_id=$1 AND status='active'
       AND ((source_entity_type=$2 AND source_entity_id=$3) OR (target_entity_type=$2 AND target_entity_id=$3)) GROUP BY 1`,
    [workspaceId, type, id],
  );
  return Object.fromEntries(result.rows.map(row => [row.entity_type, Number(row.count)]));
}

export async function listRelationshipHistory(workspaceId: string, relationshipId: string): Promise<RelationshipEvent[]> {
  const result = await query<any>(
    `SELECT e.id,e.relationship_id,e.event_type,e.actor_name,e.created_at,e.snapshot
     FROM enterprise_relationship_events e
     JOIN enterprise_relationships r ON r.id=e.relationship_id AND r.workspace_id=e.workspace_id
     WHERE e.workspace_id=$1 AND e.relationship_id=$2 ORDER BY e.occurred_at ASC`,
    [workspaceId, relationshipId],
  );
  return result.rows.map(row => ({
    id: row.id,
    relationshipId: row.relationship_id,
    eventType: row.event_type,
    actorName: row.actor_name,
    occurredAt: new Date(row.created_at).toISOString(),
    snapshot: row.snapshot || {},
  }));
}
