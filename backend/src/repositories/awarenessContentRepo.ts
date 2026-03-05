import { AwarenessContent, CreateAwarenessContentInput, AwarenessContentType } from '../types/models';
import { query } from '../db';

export interface AwarenessContentFilter {
  type?: AwarenessContentType;
  frameworkCode?: string;
  search?: string;
}

// Map database row to AwarenessContent object
function rowToAwarenessContent(row: any): AwarenessContent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    title: row.title,
    summary: row.summary || undefined,
    source: row.source || undefined,
    linkUrl: row.link_url || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Get awareness content visible to a workspace (global + workspace-specific)
export async function getAwarenessContent(workspaceId: string, filters?: AwarenessContentFilter): Promise<AwarenessContent[]> {
  try {
    // Get both global content (workspace_id IS NULL) and workspace-specific content
    let whereClause = '(ac.workspace_id IS NULL OR ac.workspace_id = $1)';
    const params: any[] = [workspaceId];
    let joinClause = '';

    if (filters?.type) {
      whereClause += ' AND ac.type = $' + (params.length + 1);
      params.push(filters.type);
    }
    if (filters?.frameworkCode) {
      joinClause = ' INNER JOIN awareness_content_frameworks acf ON ac.id = acf.content_id';
      whereClause += ' AND acf.framework_code = $' + (params.length + 1);
      params.push(filters.frameworkCode);
    }
    if (filters?.search) {
      whereClause += ' AND (ac.title ILIKE $' + (params.length + 1) + ' OR ac.summary ILIKE $' + (params.length + 1) + ')';
      params.push(`%${filters.search}%`);
    }

    const result = await query<any>(
      `SELECT DISTINCT ac.* FROM awareness_content ac${joinClause} WHERE ${whereClause} ORDER BY ac.created_at DESC`,
      params
    );

    return result.rows.map(rowToAwarenessContent);
  } catch (error) {
    console.error('Error fetching awareness content:', error);
    throw error;
  }
}

export async function getAwarenessContentById(workspaceId: string, id: string): Promise<AwarenessContent | null> {
  try {
    // Allow access to global content or workspace-specific content
    const result = await query<any>(
      'SELECT * FROM awareness_content WHERE id = $1 AND (workspace_id IS NULL OR workspace_id = $2)',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToAwarenessContent(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching awareness content by ID:', error);
    throw error;
  }
}

// Create workspace-specific content (workspaceId required)
// For global content, pass null as workspaceId
export async function createAwarenessContent(
  workspaceId: string | null,
  input: CreateAwarenessContentInput
): Promise<AwarenessContent> {
  try {
    const id = `AWC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await query<any>(
      `INSERT INTO awareness_content (
        id, workspace_id, type, title, summary, source, link_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.type,
        input.title,
        input.summary || null,
        input.source || null,
        input.linkUrl || null,
      ]
    );

    // Set frameworks if provided
    if (input.frameworkCodes && input.frameworkCodes.length > 0) {
      await setAwarenessContentFrameworks(id, input.frameworkCodes);
    }

    const content = rowToAwarenessContent(result.rows[0]);
    content.frameworkCodes = input.frameworkCodes || [];
    return content;
  } catch (error) {
    console.error('Error creating awareness content:', error);
    throw error;
  }
}

export async function updateAwarenessContent(
  workspaceId: string,
  id: string,
  input: Partial<CreateAwarenessContentInput>
): Promise<AwarenessContent | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex}`);
      params.push(input.type);
      paramIndex++;
    }
    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(input.title);
      paramIndex++;
    }
    if (input.summary !== undefined) {
      updates.push(`summary = $${paramIndex}`);
      params.push(input.summary || null);
      paramIndex++;
    }
    if (input.source !== undefined) {
      updates.push(`source = $${paramIndex}`);
      params.push(input.source || null);
      paramIndex++;
    }
    if (input.linkUrl !== undefined) {
      updates.push(`link_url = $${paramIndex}`);
      params.push(input.linkUrl || null);
      paramIndex++;
    }

    if (updates.length === 0 && input.frameworkCodes === undefined) {
      return getAwarenessContentById(workspaceId, id);
    }

    let content: AwarenessContent | null = null;

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);

      // Only allow updating workspace-specific content (not global)
      const result = await query<any>(
        `UPDATE awareness_content SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
        params
      );

      content = result.rows.length > 0 ? rowToAwarenessContent(result.rows[0]) : null;
    } else {
      content = await getAwarenessContentById(workspaceId, id);
    }

    // Update frameworks if provided
    if (content && input.frameworkCodes !== undefined) {
      await setAwarenessContentFrameworks(id, input.frameworkCodes);
      content.frameworkCodes = input.frameworkCodes;
    }

    return content;
  } catch (error) {
    console.error('Error updating awareness content:', error);
    throw error;
  }
}

export async function deleteAwarenessContent(workspaceId: string, id: string): Promise<boolean> {
  try {
    // Only allow deleting workspace-specific content (not global)
    const result = await query(
      'DELETE FROM awareness_content WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting awareness content:', error);
    throw error;
  }
}

// ============================================
// Content-Framework Relationship Functions
// ============================================

export async function getAwarenessContentFrameworks(contentId: string): Promise<string[]> {
  try {
    const result = await query<{ framework_code: string }>(
      'SELECT framework_code FROM awareness_content_frameworks WHERE content_id = $1 ORDER BY framework_code',
      [contentId]
    );
    return result.rows.map(row => row.framework_code);
  } catch (error) {
    console.error('Error fetching awareness content frameworks:', error);
    throw error;
  }
}

export async function setAwarenessContentFrameworks(
  contentId: string,
  frameworkCodes: string[]
): Promise<void> {
  try {
    // First, delete existing mappings
    await query(
      'DELETE FROM awareness_content_frameworks WHERE content_id = $1',
      [contentId]
    );

    // Insert new mappings
    if (frameworkCodes.length > 0) {
      const values = frameworkCodes.map((code, idx) => {
        const id = `ACF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        return `('${id}', $1, $${idx + 2})`;
      }).join(', ');

      await query(
        `INSERT INTO awareness_content_frameworks (id, content_id, framework_code) VALUES ${values}`,
        [contentId, ...frameworkCodes]
      );
    }
  } catch (error) {
    console.error('Error setting awareness content frameworks:', error);
    throw error;
  }
}
