import { ReviewTask, CreateReviewTaskInput, ReviewTaskStatus } from '../types/models';
import { query } from '../db';

export interface ReviewTaskFilter {
  status?: ReviewTaskStatus;
  assignee?: string;
  documentId?: string;
}

// Map database row to ReviewTask object
function rowToReviewTask(row: any): ReviewTask {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    title: row.title,
    description: row.description || undefined,
    assignee: row.assignee,
    status: row.status,
    dueAt: new Date(row.due_at).toISOString().split('T')[0],
    reminderDaysBefore: row.reminder_days_before || [30, 7, 1],
    lastReminderSentAt: row.last_reminder_sent_at ? new Date(row.last_reminder_sent_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
  };
}

export async function getReviewTasks(
  workspaceId: string,
  filters?: ReviewTaskFilter
): Promise<ReviewTask[]> {
  try {
    let whereClause = 'workspace_id = $1';
    const params: any[] = [workspaceId];

    if (filters?.status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(filters.status);
    }
    if (filters?.assignee) {
      whereClause += ' AND assignee ILIKE $' + (params.length + 1);
      params.push(`%${filters.assignee}%`);
    }
    if (filters?.documentId) {
      whereClause += ' AND document_id = $' + (params.length + 1);
      params.push(filters.documentId);
    }

    const result = await query<any>(
      `SELECT * FROM review_tasks WHERE ${whereClause} ORDER BY due_at ASC, created_at DESC`,
      params
    );

    return result.rows.map(rowToReviewTask);
  } catch (error) {
    console.error('Error fetching review tasks:', error);
    throw error;
  }
}

export async function getReviewTaskById(
  workspaceId: string,
  id: string
): Promise<ReviewTask | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM review_tasks WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToReviewTask(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching review task by ID:', error);
    throw error;
  }
}

export async function createReviewTask(
  workspaceId: string,
  input: CreateReviewTaskInput
): Promise<ReviewTask> {
  try {
    const id = `RT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const reminderDaysBefore = input.reminderDaysBefore || [30, 7, 1];

    const result = await query<any>(
      `INSERT INTO review_tasks (
        id, workspace_id, document_id, title, description, assignee, status, due_at, reminder_days_before
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.documentId,
        input.title,
        input.description || null,
        input.assignee,
        'open',
        input.dueAt,
        reminderDaysBefore,
      ]
    );

    return rowToReviewTask(result.rows[0]);
  } catch (error) {
    console.error('Error creating review task:', error);
    throw error;
  }
}

export async function updateReviewTaskStatus(
  workspaceId: string,
  id: string,
  status: ReviewTaskStatus,
  completedAt?: string
): Promise<ReviewTask | null> {
  try {
    let sql = 'UPDATE review_tasks SET status = $3, updated_at = NOW()';
    const params: any[] = [id, workspaceId, status];

    if (completedAt) {
      sql += ', completed_at = $4';
      params.push(completedAt);
    }

    sql += ' WHERE id = $1 AND workspace_id = $2 RETURNING *';

    const result = await query<any>(sql, params);
    return result.rows.length > 0 ? rowToReviewTask(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating review task status:', error);
    throw error;
  }
}

export async function updateReviewTask(
  workspaceId: string,
  id: string,
  updates: Partial<CreateReviewTaskInput & { status?: ReviewTaskStatus }>
): Promise<ReviewTask | null> {
  try {
    const updateFields: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      params.push(updates.title);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(updates.description || null);
      paramIndex++;
    }
    if (updates.assignee !== undefined) {
      updateFields.push(`assignee = $${paramIndex}`);
      params.push(updates.assignee);
      paramIndex++;
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(updates.status);
      paramIndex++;
    }
    if (updates.dueAt !== undefined) {
      updateFields.push(`due_at = $${paramIndex}`);
      params.push(updates.dueAt);
      paramIndex++;
    }
    if (updates.reminderDaysBefore !== undefined) {
      updateFields.push(`reminder_days_before = $${paramIndex}`);
      params.push(updates.reminderDaysBefore);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return getReviewTaskById(workspaceId, id);
    }

    updateFields.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE review_tasks SET ${updateFields.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToReviewTask(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating review task:', error);
    throw error;
  }
}

export async function markReminderSent(
  workspaceId: string,
  id: string,
  sentAt: string
): Promise<void> {
  try {
    await query(
      'UPDATE review_tasks SET last_reminder_sent_at = $3, updated_at = NOW() WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId, sentAt]
    );
  } catch (error) {
    console.error('Error marking reminder sent:', error);
    throw error;
  }
}

export async function getTasksDueForReminder(
  workspaceId: string
): Promise<ReviewTask[]> {
  try {
    // Get open or in_progress tasks that have a due date
    const result = await query<any>(
      `SELECT * FROM review_tasks
       WHERE workspace_id = $1
       AND status IN ('open', 'in_progress')
       AND due_at IS NOT NULL
       ORDER BY due_at ASC`,
      [workspaceId]
    );

    return result.rows.map(rowToReviewTask);
  } catch (error) {
    console.error('Error fetching tasks due for reminder:', error);
    throw error;
  }
}

export async function getAllTasksDueForReminder(): Promise<ReviewTask[]> {
  try {
    // Get all open or in_progress tasks across all workspaces
    const result = await query<any>(
      `SELECT * FROM review_tasks
       WHERE status IN ('open', 'in_progress')
       AND due_at IS NOT NULL
       ORDER BY due_at ASC`
    );

    return result.rows.map(rowToReviewTask);
  } catch (error) {
    console.error('Error fetching all tasks due for reminder:', error);
    throw error;
  }
}

export async function deleteReviewTask(
  workspaceId: string,
  id: string
): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM review_tasks WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting review task:', error);
    throw error;
  }
}
