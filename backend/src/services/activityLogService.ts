/**
 * Activity Log Service
 *
 * Provides functions for logging and querying activity/audit trail entries.
 */

import { pool } from '../db.js';
import { ActivityEntityType, ActivityActionType, ActivityLogEntry } from '../types/models.js';
import { Request } from 'express';

// ============================================
// Types
// ============================================

export interface LogActivityInput {
  workspaceId: string;
  userId: string;
  userEmail: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityActionType;
  summary: string;
  details?: any;
}

export interface ActivityLogFilters {
  workspaceId: string;
  entityType?: ActivityEntityType;
  entityId?: string;
  userId?: string;
  before?: string;
  limit?: number;
}

// ============================================
// Logging Functions
// ============================================

/**
 * Log an activity entry to the database
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  const { workspaceId, userId, userEmail, entityType, entityId, action, summary, details } = input;

  try {
    await pool.query(
      `INSERT INTO activity_log
        (workspace_id, user_id, user_email, entity_type, entity_id, action, summary, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        workspaceId,
        userId,
        userEmail,
        entityType,
        entityId,
        action,
        summary,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (error) {
    // Log error but don't throw - activity logging should not break the main operation
    console.error('Failed to log activity:', error);
  }
}

/**
 * Convenience helper to build LogActivityInput from an Express Request.
 * Requires authMiddleware to have set req.authUser.
 */
export function buildLogInputFromRequest(
  req: Request,
  partial: Omit<LogActivityInput, 'workspaceId' | 'userId' | 'userEmail'>
): LogActivityInput {
  if (!req.authUser) {
    throw new Error('Cannot log activity without authenticated user');
  }
  return {
    workspaceId: req.authUser.workspaceId,
    userId: req.authUser.userId,
    userEmail: req.authUser.email,
    ...partial,
  };
}

// ============================================
// Query Functions
// ============================================

/**
 * Fetch activity log entries with optional filters
 */
export async function getActivityLog(filters: ActivityLogFilters): Promise<ActivityLogEntry[]> {
  const { workspaceId, entityType, entityId, userId, before, limit = 50 } = filters;

  // Cap limit at 200
  const safeLimit = Math.min(limit, 200);

  // Build WHERE clauses
  const conditions: string[] = ['workspace_id = $1'];
  const params: any[] = [workspaceId];
  let paramIndex = 2;

  if (entityType) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(entityType);
  }

  if (entityId) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(entityId);
  }

  if (userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(userId);
  }

  if (before) {
    conditions.push(`created_at < $${paramIndex++}`);
    params.push(before);
  }

  params.push(safeLimit);

  const query = `
    SELECT
      id,
      workspace_id,
      user_id,
      user_email,
      entity_type,
      entity_id,
      action,
      summary,
      details,
      created_at
    FROM activity_log
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
  `;

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    userEmail: row.user_email,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    details: row.details,
    createdAt: row.created_at,
  }));
}

/**
 * Get a single activity log entry by ID
 */
export async function getActivityLogEntry(
  workspaceId: string,
  entryId: string
): Promise<ActivityLogEntry | null> {
  const result = await pool.query(
    `SELECT
      id,
      workspace_id,
      user_id,
      user_email,
      entity_type,
      entity_id,
      action,
      summary,
      details,
      created_at
    FROM activity_log
    WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, entryId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    userEmail: row.user_email,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    details: row.details,
    createdAt: row.created_at,
  };
}
