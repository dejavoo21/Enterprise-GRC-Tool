import { ControlFrameworkMapping } from '../types/models';
import { query } from '../db';

export interface CreateControlMappingInput {
  controlId: string;
  framework: string;
  reference: string;
  type?: 'TYPE_I' | 'TYPE_II' | null;
}

// Map database row to ControlFrameworkMapping object
function rowToMapping(row: any): ControlFrameworkMapping {
  return {
    id: row.id,
    controlId: row.control_id,
    framework: row.framework,
    reference: row.reference,
    type: row.type || null,
  };
}

export async function getMappingsForControl(workspaceId: string, controlId: string): Promise<ControlFrameworkMapping[]> {
  try {
    const result = await query<any>(
      `SELECT cm.* FROM control_mappings cm
       INNER JOIN controls c ON cm.control_id = c.id
       WHERE c.workspace_id = $1 AND cm.control_id = $2
       ORDER BY cm.framework, cm.reference`,
      [workspaceId, controlId]
    );
    return result.rows.map(rowToMapping);
  } catch (error) {
    console.error('Error fetching mappings for control:', error);
    throw error;
  }
}

export async function getAllMappings(workspaceId: string, framework?: string): Promise<ControlFrameworkMapping[]> {
  try {
    let query_text = `SELECT cm.* FROM control_mappings cm
                      INNER JOIN controls c ON cm.control_id = c.id
                      WHERE c.workspace_id = $1`;
    const params: any[] = [workspaceId];

    if (framework) {
      query_text += ' AND cm.framework = $2';
      params.push(framework);
    }

    query_text += ' ORDER BY cm.framework, cm.reference';

    const result = await query<any>(query_text, params);
    return result.rows.map(rowToMapping);
  } catch (error) {
    console.error('Error fetching all mappings:', error);
    throw error;
  }
}

export async function createControlMapping(workspaceId: string, input: CreateControlMappingInput): Promise<ControlFrameworkMapping> {
  try {
    const result = await query<any>(
      `INSERT INTO control_mappings (
        control_id, framework, reference, type
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        input.controlId,
        input.framework,
        input.reference,
        input.type || null,
      ]
    );

    return rowToMapping(result.rows[0]);
  } catch (error) {
    console.error('Error creating control mapping:', error);
    throw error;
  }
}

export async function deleteMapping(workspaceId: string, id: string): Promise<boolean> {
  try {
    // First verify the mapping belongs to this workspace
    const verify = await query<any>(
      `SELECT cm.id FROM control_mappings cm
       INNER JOIN controls c ON cm.control_id = c.id
       WHERE cm.id = $1 AND c.workspace_id = $2`,
      [id, workspaceId]
    );
    
    if (verify.rows.length === 0) return false;
    
    const result = await query('DELETE FROM control_mappings WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting mapping:', error);
    throw error;
  }
}

// Get frameworks for a specific control
export async function getFrameworksForControl(workspaceId: string, controlId: string): Promise<string[]> {
  try {
    const mappings = await getMappingsForControl(workspaceId, controlId);
    return [...new Set(mappings.map(m => m.framework))];
  } catch (error) {
    console.error('Error getting frameworks for control:', error);
    throw error;
  }
}
