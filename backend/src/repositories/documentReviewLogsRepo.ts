import { DocumentReviewLog, CreateDocumentReviewLogInput } from '../types/models';
import { query } from '../db';

// Map database row to DocumentReviewLog object
function rowToDocumentReviewLog(row: any): DocumentReviewLog {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    reviewTaskId: row.review_task_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: new Date(row.reviewed_at).toISOString(),
    decision: row.decision,
    comments: row.comments || undefined,
    newVersion: row.new_version || undefined,
  };
}

export async function getLogsForDocument(
  workspaceId: string,
  documentId: string
): Promise<DocumentReviewLog[]> {
  try {
    const result = await query<any>(
      `SELECT * FROM document_review_logs
       WHERE workspace_id = $1 AND document_id = $2
       ORDER BY reviewed_at DESC`,
      [workspaceId, documentId]
    );

    return result.rows.map(rowToDocumentReviewLog);
  } catch (error) {
    console.error('Error fetching document review logs:', error);
    throw error;
  }
}

export async function getLogsByTaskId(
  workspaceId: string,
  reviewTaskId: string
): Promise<DocumentReviewLog[]> {
  try {
    const result = await query<any>(
      `SELECT * FROM document_review_logs
       WHERE workspace_id = $1 AND review_task_id = $2
       ORDER BY reviewed_at DESC`,
      [workspaceId, reviewTaskId]
    );

    return result.rows.map(rowToDocumentReviewLog);
  } catch (error) {
    console.error('Error fetching logs by task ID:', error);
    throw error;
  }
}

export async function createReviewLog(
  workspaceId: string,
  input: CreateDocumentReviewLogInput
): Promise<DocumentReviewLog> {
  try {
    const id = `DRL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const reviewedAt = new Date().toISOString();

    const result = await query<any>(
      `INSERT INTO document_review_logs (
        id, workspace_id, document_id, review_task_id, reviewed_by, reviewed_at, decision, comments, new_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        workspaceId,
        input.documentId,
        input.reviewTaskId,
        input.reviewedBy,
        reviewedAt,
        input.decision,
        input.comments || null,
        input.newVersion || null,
      ]
    );

    return rowToDocumentReviewLog(result.rows[0]);
  } catch (error) {
    console.error('Error creating document review log:', error);
    throw error;
  }
}
