import { TrainingEngagement, CreateTrainingEngagementInput, EngagementStatus } from '../types/models';
import { query } from '../db';

export interface EngagementFilter {
  status?: EngagementStatus;
  engagementType?: string;
  frameworkCode?: string;
}

// Map database row to TrainingEngagement object
function rowToEngagement(row: any): TrainingEngagement {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    clientName: row.client_name || undefined,
    engagementType: row.engagement_type,
    status: row.status,
    pricingModelId: row.pricing_model_id || undefined,
    estimatedUsers: row.estimated_users || undefined,
    startDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : undefined,
    endDate: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : undefined,
    primaryContact: row.primary_contact || undefined,
    proposalUrl: row.proposal_url || undefined,
    sowUrl: row.sow_url || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getTrainingEngagements(workspaceId: string, filters?: EngagementFilter): Promise<TrainingEngagement[]> {
  try {
    let whereClause = 'te.workspace_id = $1';
    const params: any[] = [workspaceId];
    let joinClause = '';

    if (filters?.status) {
      whereClause += ' AND te.status = $' + (params.length + 1);
      params.push(filters.status);
    }
    if (filters?.engagementType) {
      whereClause += ' AND te.engagement_type = $' + (params.length + 1);
      params.push(filters.engagementType);
    }
    if (filters?.frameworkCode) {
      joinClause = ' INNER JOIN training_engagement_frameworks tef ON te.id = tef.engagement_id';
      whereClause += ' AND tef.framework_code = $' + (params.length + 1);
      params.push(filters.frameworkCode);
    }

    const result = await query<any>(
      `SELECT DISTINCT te.* FROM training_engagements te${joinClause} WHERE ${whereClause} ORDER BY te.created_at DESC`,
      params
    );

    return result.rows.map(rowToEngagement);
  } catch (error) {
    console.error('Error fetching training engagements:', error);
    throw error;
  }
}

export async function getTrainingEngagementById(workspaceId: string, id: string): Promise<TrainingEngagement | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM training_engagements WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToEngagement(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching training engagement by ID:', error);
    throw error;
  }
}

export async function createTrainingEngagement(workspaceId: string, input: CreateTrainingEngagementInput): Promise<TrainingEngagement> {
  try {
    const id = `ENG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await query<any>(
      `INSERT INTO training_engagements (
        id, workspace_id, title, client_name, engagement_type, status,
        pricing_model_id, estimated_users, start_date, end_date, primary_contact, proposal_url, sow_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.title,
        input.clientName || null,
        input.engagementType,
        input.status || 'draft',
        input.pricingModelId || null,
        input.estimatedUsers || null,
        input.startDate || null,
        input.endDate || null,
        input.primaryContact || null,
        input.proposalUrl || null,
        input.sowUrl || null,
      ]
    );

    // Set frameworks if provided
    if (input.frameworkCodes && input.frameworkCodes.length > 0) {
      await setEngagementFrameworks(id, input.frameworkCodes);
    }

    const engagement = rowToEngagement(result.rows[0]);
    engagement.frameworkCodes = input.frameworkCodes || [];
    return engagement;
  } catch (error) {
    console.error('Error creating training engagement:', error);
    throw error;
  }
}

export async function updateTrainingEngagement(
  workspaceId: string,
  id: string,
  input: Partial<CreateTrainingEngagementInput>
): Promise<TrainingEngagement | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(input.title);
      paramIndex++;
    }
    if (input.clientName !== undefined) {
      updates.push(`client_name = $${paramIndex}`);
      params.push(input.clientName || null);
      paramIndex++;
    }
    if (input.engagementType !== undefined) {
      updates.push(`engagement_type = $${paramIndex}`);
      params.push(input.engagementType);
      paramIndex++;
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }
    if (input.pricingModelId !== undefined) {
      updates.push(`pricing_model_id = $${paramIndex}`);
      params.push(input.pricingModelId || null);
      paramIndex++;
    }
    if (input.estimatedUsers !== undefined) {
      updates.push(`estimated_users = $${paramIndex}`);
      params.push(input.estimatedUsers || null);
      paramIndex++;
    }
    if (input.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex}`);
      params.push(input.startDate || null);
      paramIndex++;
    }
    if (input.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex}`);
      params.push(input.endDate || null);
      paramIndex++;
    }
    if (input.primaryContact !== undefined) {
      updates.push(`primary_contact = $${paramIndex}`);
      params.push(input.primaryContact || null);
      paramIndex++;
    }
    if (input.proposalUrl !== undefined) {
      updates.push(`proposal_url = $${paramIndex}`);
      params.push(input.proposalUrl || null);
      paramIndex++;
    }
    if (input.sowUrl !== undefined) {
      updates.push(`sow_url = $${paramIndex}`);
      params.push(input.sowUrl || null);
      paramIndex++;
    }

    if (updates.length === 0) return getTrainingEngagementById(workspaceId, id);

    updates.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE training_engagements SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToEngagement(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating training engagement:', error);
    throw error;
  }
}

export async function deleteTrainingEngagement(workspaceId: string, id: string): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM training_engagements WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting training engagement:', error);
    throw error;
  }
}

// ============================================
// Engagement-Framework Relationship Functions
// ============================================

export async function getEngagementFrameworks(engagementId: string): Promise<string[]> {
  try {
    const result = await query<{ framework_code: string }>(
      'SELECT framework_code FROM training_engagement_frameworks WHERE engagement_id = $1 ORDER BY framework_code',
      [engagementId]
    );
    return result.rows.map(row => row.framework_code);
  } catch (error) {
    console.error('Error fetching engagement frameworks:', error);
    throw error;
  }
}

export async function setEngagementFrameworks(
  engagementId: string,
  frameworkCodes: string[]
): Promise<void> {
  try {
    // First, delete existing mappings
    await query(
      'DELETE FROM training_engagement_frameworks WHERE engagement_id = $1',
      [engagementId]
    );

    // Insert new mappings
    if (frameworkCodes.length > 0) {
      const values = frameworkCodes.map((code, idx) => {
        const id = `TEF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        return `('${id}', $1, $${idx + 2})`;
      }).join(', ');

      await query(
        `INSERT INTO training_engagement_frameworks (id, engagement_id, framework_code) VALUES ${values}`,
        [engagementId, ...frameworkCodes]
      );
    }
  } catch (error) {
    console.error('Error setting engagement frameworks:', error);
    throw error;
  }
}

export async function addFrameworkToEngagement(
  engagementId: string,
  frameworkCode: string
): Promise<void> {
  try {
    const id = `TEF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    await query(
      `INSERT INTO training_engagement_frameworks (id, engagement_id, framework_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (engagement_id, framework_code) DO NOTHING`,
      [id, engagementId, frameworkCode]
    );
  } catch (error) {
    console.error('Error adding framework to engagement:', error);
    throw error;
  }
}

export async function removeFrameworkFromEngagement(
  engagementId: string,
  frameworkCode: string
): Promise<void> {
  try {
    await query(
      'DELETE FROM training_engagement_frameworks WHERE engagement_id = $1 AND framework_code = $2',
      [engagementId, frameworkCode]
    );
  } catch (error) {
    console.error('Error removing framework from engagement:', error);
    throw error;
  }
}
