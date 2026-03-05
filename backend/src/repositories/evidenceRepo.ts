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
        control_id, risk_id, collected_by, collected_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ]
    );

    return rowToEvidence(result.rows[0]);
  } catch (error) {
    console.error('Error creating evidence:', error);
    throw error;
  }
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

    if (updates.length === 0) return getEvidenceById(workspaceId, id);

    updates.push(`last_reviewed_at = NOW(), updated_at = NOW()`);

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

export async function deleteEvidence(workspaceId: string, id: string): Promise<boolean> {
  try {
    const result = await query('DELETE FROM evidence WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting evidence:', error);
    throw error;
  }
}
