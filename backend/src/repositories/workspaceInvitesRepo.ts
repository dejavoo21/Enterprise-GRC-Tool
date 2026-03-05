/**
 * Workspace Invitations Repository
 * Handles invitation CRUD operations for workspace onboarding
 */

import { pool } from '../db.js';
import { WorkspaceRole } from '../types/models.js';
import crypto from 'crypto';

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateInvitationInput {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: Date;
  createdBy: string;
}

function rowToInvitation(row: any): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role as WorkspaceRole,
    token: row.token,
    expiresAt: new Date(row.expires_at).toISOString(),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Generate a secure random token for invitations
 */
function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Create a new workspace invitation
 */
export async function createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
  const token = generateInviteToken();

  // Use UPSERT to handle duplicate invitations (update if exists)
  const result = await pool.query(
    `INSERT INTO workspace_invitations (workspace_id, email, role, token, expires_at, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (workspace_id, email) DO UPDATE SET
       role = EXCLUDED.role,
       token = EXCLUDED.token,
       expires_at = EXCLUDED.expires_at,
       accepted_at = NULL,
       created_by = EXCLUDED.created_by,
       created_at = NOW()
     RETURNING id, workspace_id, email, role, token, expires_at, accepted_at, created_by, created_at`,
    [input.workspaceId, input.email.toLowerCase(), input.role, token, input.expiresAt, input.createdBy]
  );

  return rowToInvitation(result.rows[0]);
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<WorkspaceInvitation | null> {
  const result = await pool.query(
    `SELECT id, workspace_id, email, role, token, expires_at, accepted_at, created_by, created_at
     FROM workspace_invitations
     WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToInvitation(result.rows[0]);
}

/**
 * Get invitation by ID
 */
export async function getInvitationById(id: string): Promise<WorkspaceInvitation | null> {
  const result = await pool.query(
    `SELECT id, workspace_id, email, role, token, expires_at, accepted_at, created_by, created_at
     FROM workspace_invitations
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToInvitation(result.rows[0]);
}

/**
 * Get all invitations for a workspace
 */
export async function getInvitationsForWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
  const result = await pool.query(
    `SELECT id, workspace_id, email, role, token, expires_at, accepted_at, created_by, created_at
     FROM workspace_invitations
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );

  return result.rows.map(rowToInvitation);
}

/**
 * Mark an invitation as accepted
 */
export async function markInvitationAccepted(id: string): Promise<void> {
  await pool.query(
    `UPDATE workspace_invitations SET accepted_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Delete an invitation
 */
export async function deleteInvitation(id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM workspace_invitations WHERE id = $1`,
    [id]
  );

  return (result.rowCount || 0) > 0;
}

/**
 * Check if an invitation is valid (exists and not expired)
 */
export function isInvitationValid(invitation: WorkspaceInvitation): boolean {
  if (invitation.acceptedAt) {
    return false; // Already accepted
  }

  const expiresAt = new Date(invitation.expiresAt);
  return expiresAt > new Date();
}
