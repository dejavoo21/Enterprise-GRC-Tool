import { Control } from '../types/models';
import { query } from '../db';

export interface ControlFilter {
  status?: string;
  domain?: string;
  primaryFramework?: string;
  workspaceId?: string;
}

export interface CreateControlInput {
  title: string;
  description?: string;
  owner: string;
  status?: string;
  domain?: string;
  primaryFramework?: string;
}

// Map database row to Control object
function rowToControl(row: any): Control {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    status: row.status,
    domain: row.domain,
    primaryFramework: row.primary_framework,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getControls(workspaceId: string, filters?: ControlFilter): Promise<Control[]> {
  try {
    let whereClause = 'workspace_id = $1';
    const params: any[] = [workspaceId];

    if (filters?.status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(filters.status);
    }
    if (filters?.domain) {
      whereClause += ' AND domain = $' + (params.length + 1);
      params.push(filters.domain);
    }
    if (filters?.primaryFramework) {
      whereClause += ' AND primary_framework = $' + (params.length + 1);
      params.push(filters.primaryFramework);
    }

    const result = await query<any>(
      `SELECT * FROM controls WHERE ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(rowToControl);
  } catch (error) {
    console.error('Error fetching controls:', error);
    throw error;
  }
}

export async function getControlById(workspaceId: string, id: string): Promise<Control | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM controls WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToControl(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching control by ID:', error);
    throw error;
  }
}

export async function createControl(workspaceId: string, input: CreateControlInput): Promise<Control> {
  try {
    const id = `CTR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const result = await query<any>(
      `INSERT INTO controls (
        id, workspace_id, title, description, owner, status, domain, primary_framework
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.title,
        input.description || null,
        input.owner,
        input.status || 'not_implemented',
        input.domain || null,
        input.primaryFramework || null,
      ]
    );

    return rowToControl(result.rows[0]);
  } catch (error) {
    console.error('Error creating control:', error);
    throw error;
  }
}

export async function updateControl(workspaceId: string, id: string, input: Partial<CreateControlInput>): Promise<Control | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(input.title);
      paramIndex++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description || null);
      paramIndex++;
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }
    if (input.owner !== undefined) {
      updates.push(`owner = $${paramIndex}`);
      params.push(input.owner);
      paramIndex++;
    }

    if (updates.length === 0) return getControlById(workspaceId, id);

    updates.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE controls SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToControl(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating control:', error);
    throw error;
  }
}

export async function deleteControl(workspaceId: string, id: string): Promise<boolean> {
  try {
    const result = await query('DELETE FROM controls WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting control:', error);
    throw error;
  }
}
