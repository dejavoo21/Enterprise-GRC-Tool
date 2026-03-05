import { Risk } from '../types/models';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface RiskFilter {
  status?: string;
  severity?: string;
  category?: string;
  workspaceId?: string;
}

export interface CreateRiskInput {
  title: string;
  description?: string;
  owner: string;
  category: string;
  inherentLikelihood: number;
  inherentImpact: number;
  dueDate?: string;
  treatmentPlan?: string;
}

// Map database row to Risk object
function rowToRisk(row: any): Risk {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    category: row.category,
    status: row.status,
    inherentLikelihood: row.inherent_likelihood,
    inherentImpact: row.inherent_impact,
    residualLikelihood: row.residual_likelihood,
    residualImpact: row.residual_impact,
    dueDate: row.due_date ? new Date(row.due_date).toISOString().split('T')[0] : undefined,
    treatmentPlan: row.treatment_plan,
    controlIds: [], // Will be fetched separately if needed
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Calculate severity based on likelihood and impact
function calculateSeverity(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

export async function getRisks(workspaceId: string, filters?: RiskFilter): Promise<Risk[]> {
  try {
    let whereClause = 'workspace_id = $1';
    const params: any[] = [workspaceId];

    if (filters?.status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(filters.status);
    }
    if (filters?.category) {
      whereClause += ' AND category = $' + (params.length + 1);
      params.push(filters.category);
    }

    const result = await query<any>(
      `SELECT * FROM risks WHERE ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(rowToRisk);
  } catch (error) {
    console.error('Error fetching risks:', error);
    throw error;
  }
}

export async function getRiskById(workspaceId: string, id: string): Promise<Risk | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM risks WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToRisk(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching risk by ID:', error);
    throw error;
  }
}

export async function createRisk(workspaceId: string, input: CreateRiskInput): Promise<Risk> {
  try {
    const id = `RSK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const residualLikelihood = input.inherentLikelihood;
    const residualImpact = input.inherentImpact;
    
    const result = await query<any>(
      `INSERT INTO risks (
        id, workspace_id, title, description, owner, category, status,
        inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
        due_date, treatment_plan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.title,
        input.description || null,
        input.owner,
        input.category,
        'identified',
        input.inherentLikelihood,
        input.inherentImpact,
        residualLikelihood,
        residualImpact,
        input.dueDate || null,
        input.treatmentPlan || null,
      ]
    );

    return rowToRisk(result.rows[0]);
  } catch (error) {
    console.error('Error creating risk:', error);
    throw error;
  }
}

export async function updateRisk(workspaceId: string, id: string, input: Partial<CreateRiskInput>): Promise<Risk | null> {
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
    if (input.owner !== undefined) {
      updates.push(`owner = $${paramIndex}`);
      params.push(input.owner);
      paramIndex++;
    }

    if (updates.length === 0) return getRiskById(workspaceId, id);

    updates.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE risks SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToRisk(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating risk:', error);
    throw error;
  }
}

export async function deleteRisk(workspaceId: string, id: string): Promise<boolean> {
  try {
    const result = await query('DELETE FROM risks WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting risk:', error);
    throw error;
  }
}
