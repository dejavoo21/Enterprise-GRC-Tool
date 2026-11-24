import { EvidenceItem } from '../types/models';
import { query } from '../db';

export interface EvidenceFilter {
  controlId?: string;
  riskId?: string;
  type?: string;
  workspaceId?: string;
}

export interface CreateEvidenceInput {
  name: string;
  description?: string;
  type: string;
  locationUrl?: string;
  controlId?: string;
  riskId?: string;
  collectedBy: string;
  collectedAt?: string;
  createdBy: string;
  sourceType?: 'manual_reference' | 'automated_collection' | 'external_system';
  sourceSystem?: string;
  sourceReference?: string;
  expiresAt?: string;
}

// Map database row to EvidenceItem object
function rowToEvidence(row: any): EvidenceItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    type: row.type,
    locationUrl: row.location_url,
    controlId: row.control_id,
    riskId: row.risk_id,
    collectedBy: row.collected_by,
    collectedAt: new Date(row.collected_at).toISOString(),
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : undefined,
    reviewStatus: row.review_status || 'draft',
    createdBy: row.created_by || undefined,
    submittedBy: row.submitted_by || undefined,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
    reviewNotes: row.review_notes || undefined,
    sourceType: row.source_type || 'manual_reference',
    sourceSystem: row.source_system || undefined,
    sourceReference: row.source_reference || undefined,
    attachmentStatus: row.attachment_status || (row.location_url ? 'external_reference' : 'none'),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
  };
}

export async function getEvidence(workspaceId: string, filters?: EvidenceFilter): Promise<EvidenceItem[]> {
  try {
    let whereClause = 'workspace_id = $1';
    const params: any[] = [workspaceId];

    if (filters?.controlId) {
      whereClause += ' AND control_id = $' + (params.length + 1);
      params.push(filters.controlId);
    }
    if (filters?.riskId) {
      whereClause += ' AND risk_id = $' + (params.length + 1);
      params.push(filters.riskId);
    }
    if (filters?.type) {
      whereClause += ' AND type = $' + (params.length + 1);
      params.push(filters.type);
    }

    const result = await query<any>(
      `SELECT * FROM evidence WHERE ${whereClause} ORDER BY collected_at DESC`,
      params
    );

    return result.rows.map(rowToEvidence);
  } catch (error) {
    console.error('Error fetching evidence:', error);
    throw error;
  }
}

export async function getEvidenceById(workspaceId: string, id: string): Promise<EvidenceItem | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM evidence WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToEvidence(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching evidence by ID:', error);
    throw error;
  }
}

export async function createEvidence(workspaceId: string, input: CreateEvidenceInput): Promise<EvidenceItem> {
  try {
    const result = await query<any>(
      `INSERT INTO evidence (
        workspace_id, name, description, type, location_url, 
        control_id, risk_id, collected_by, collected_at, created_by, review_status,
        source_type, source_system, source_reference, attachment_status, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        workspaceId,
        input.name,
        input.description || null,
        input.type,
        input.locationUrl || null,
        input.controlId || null,
        input.riskId || null,
        input.collectedBy,
        input.collectedAt || new Date().toISOString(),
        input.createdBy,
        input.sourceType || 'manual_reference',
        input.sourceSystem || null,
        input.sourceReference || null,
        input.locationUrl ? 'external_reference' : 'none',
        input.expiresAt || null,
      ]
    );

    return rowToEvidence(result.rows[0]);
  } catch (error) {
    console.error('Error creating evidence:', error);
    throw error;
  }
}

export async function validateEvidenceLinks(workspaceId: string, controlId?: string, riskId?: string): Promise<void> {
  if (controlId) {
    const control = await query('SELECT 1 FROM controls WHERE workspace_id = $1 AND id = $2', [workspaceId, controlId]);
    if (!control.rowCount) throw Object.assign(new Error('The selected control does not exist in this workspace.'), { code: 'INVALID_CONTROL' });
  }
  if (riskId) {
    const risk = await query('SELECT 1 FROM risks WHERE workspace_id = $1 AND id = $2', [workspaceId, riskId]);
    if (!risk.rowCount) throw Object.assign(new Error('The selected risk does not exist in this workspace.'), { code: 'INVALID_RISK' });
  }
}

export async function submitEvidence(workspaceId: string, id: string, actorId: string): Promise<EvidenceItem | null> {
  const result = await query<any>(
    `WITH current AS (SELECT * FROM evidence WHERE id=$1 AND workspace_id=$2 FOR UPDATE),
     changed AS (UPDATE evidence e SET review_status='pending_review', submitted_by=$3, submitted_at=NOW(), reviewed_by=NULL, reviewed_at=NULL, review_notes=NULL, updated_at=NOW()
       FROM current c WHERE e.id=c.id AND e.workspace_id=c.workspace_id RETURNING e.*),
     logged AS (INSERT INTO evidence_lifecycle_events(workspace_id,evidence_id,event_type,previous_status,new_status,actor_id)
       SELECT c.workspace_id,c.id,'submitted',c.review_status,'pending_review',$3::uuid FROM current c JOIN changed ch ON ch.id=c.id)
     SELECT * FROM changed`, [id, workspaceId, actorId]);
  return result.rows[0] ? rowToEvidence(result.rows[0]) : null;
}

export async function decideEvidence(workspaceId: string, id: string, actorId: string, decision: 'approved'|'rejected', notes?: string): Promise<EvidenceItem | null> {
  const result = await query<any>(
    `WITH changed AS (UPDATE evidence SET review_status=$3, reviewed_by=$4, reviewed_at=NOW(), last_reviewed_at=NOW(), review_notes=$5, updated_at=NOW()
     WHERE id=$1 AND workspace_id=$2 RETURNING *), logged AS (INSERT INTO evidence_lifecycle_events(workspace_id,evidence_id,event_type,previous_status,new_status,notes,actor_id) SELECT workspace_id,id,'review_decision','pending_review',$3,$5,$4::uuid FROM changed) SELECT * FROM changed`, [id, workspaceId, decision, actorId, notes || null]);
  return result.rows[0] ? rowToEvidence(result.rows[0]) : null;
}

export async function updateEvidence(workspaceId: string, id: string, input: Partial<CreateEvidenceInput>): Promise<EvidenceItem | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description || null);
      paramIndex++;
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex}`);
      params.push(input.type);
      paramIndex++;
    }
    const extraFields: Array<[keyof CreateEvidenceInput, string]> = [['locationUrl','location_url'],['controlId','control_id'],['riskId','risk_id'],['collectedBy','collected_by'],['collectedAt','collected_at'],['sourceType','source_type'],['sourceSystem','source_system'],['sourceReference','source_reference'],['expiresAt','expires_at']];
    for (const [key, column] of extraFields) if (input[key] !== undefined) { updates.push(`${column} = $${paramIndex}`); params.push(input[key] || null); paramIndex++; }
    if (input.locationUrl !== undefined) { updates.push(`attachment_status = $${paramIndex}`); params.push(input.locationUrl ? 'external_reference' : 'none'); paramIndex++; }

    if (updates.length === 0) return getEvidenceById(workspaceId, id);

    updates.push('updated_at = NOW()');

    const result = await query<any>(
      `UPDATE evidence SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToEvidence(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating evidence:', error);
    throw error;
  }
}

export async function recordEvidenceEvent(workspaceId:string,evidenceId:string,eventType:string,actorId:string,notes?:string) {
  await query('INSERT INTO evidence_lifecycle_events(workspace_id,evidence_id,event_type,notes,actor_id) SELECT $1,$2,$3,$4,$5::uuid WHERE EXISTS (SELECT 1 FROM evidence WHERE workspace_id=$1 AND id=$2)',[workspaceId,evidenceId,eventType,notes||null,actorId]);
}

export async function getEvidenceHistory(workspaceId:string,evidenceId:string) {
  return (await query(`SELECT id,event_type "eventType",previous_status "previousStatus",new_status "newStatus",notes,actor_id "actorId",created_at "createdAt" FROM evidence_lifecycle_events WHERE workspace_id=$1 AND evidence_id=$2 ORDER BY created_at DESC`,[workspaceId,evidenceId])).rows;
}

export async function listEvidenceUsage(workspaceId:string,evidenceId:string) {
  return (await query(`SELECT id,evidence_id "evidenceId",entity_type "entityType",entity_id "entityId",purpose,status,linked_by "linkedBy",created_at "createdAt",archived_at "archivedAt" FROM evidence_usage_links WHERE workspace_id=$1 AND evidence_id=$2 ORDER BY created_at DESC`,[workspaceId,evidenceId])).rows;
}

export async function addEvidenceUsage(workspaceId:string,evidenceId:string,actorId:string,input:{entityType:string;entityId:string;purpose?:string}) {
  const result=await query(`INSERT INTO evidence_usage_links(workspace_id,evidence_id,entity_type,entity_id,purpose,linked_by) SELECT $1,$2,$3,$4,$5,$6::uuid WHERE EXISTS(SELECT 1 FROM evidence WHERE workspace_id=$1 AND id=$2) ON CONFLICT(workspace_id,evidence_id,entity_type,entity_id) DO UPDATE SET purpose=EXCLUDED.purpose,status='active',archived_at=NULL RETURNING id,evidence_id "evidenceId",entity_type "entityType",entity_id "entityId",purpose,status,linked_by "linkedBy",created_at "createdAt",archived_at "archivedAt"`,[workspaceId,evidenceId,input.entityType,input.entityId,input.purpose||null,actorId]);
  if(!result.rows[0]) throw Object.assign(new Error('Evidence is unavailable in this workspace.'),{code:'NOT_FOUND'});
  return result.rows[0];
}

export async function validateEvidenceUsageTarget(workspaceId: string, entityType: string, entityId: string): Promise<void> {
  const targets: Record<string, { table: string; idColumn: string }> = {
    control: { table: 'controls', idColumn: 'id' },
    risk: { table: 'risks', idColumn: 'id' },
  };
  const target = targets[entityType];
  if (!target) throw Object.assign(new Error('Evidence reuse currently supports control and risk records only.'), { code: 'UNSUPPORTED_ENTITY_TYPE' });
  const result = await query(`SELECT 1 FROM ${target.table} WHERE workspace_id=$1 AND ${target.idColumn}=$2`, [workspaceId, entityId]);
  if (!result.rowCount) throw Object.assign(new Error(`The selected ${entityType} is unavailable in this workspace.`), { code: 'INVALID_RELATIONSHIP' });
}

export async function archiveEvidenceUsage(workspaceId:string,evidenceId:string,linkId:string) {
  const result=await query(`UPDATE evidence_usage_links SET status='archived',archived_at=NOW() WHERE workspace_id=$1 AND evidence_id=$2 AND id=$3 RETURNING id`,[workspaceId,evidenceId,linkId]);
  return Boolean(result.rowCount);
}

export async function deleteEvidence(workspaceId: string, id: string): Promise<boolean> {
  try {
    const result = await query('DELETE FROM evidence WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting evidence:', error);
    throw error;
  }
}
