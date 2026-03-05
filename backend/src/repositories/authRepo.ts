/**
 * Authentication Repository
 *
 * Database operations for users and workspace memberships.
 */

import { pool } from '../db.js';
import { User, UserWithPassword, WorkspaceUserMembership, WorkspaceRole } from '../types/models.js';

// ============================================
// User Operations
// ============================================

/**
 * Find a user by email
 */
export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const result = await pool.query(
    `SELECT id, email, password_hash, full_name, is_active, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find a user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT id, email, full_name, is_active, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  passwordHash: string,
  fullName?: string
): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, full_name, is_active, created_at, updated_at`,
    [email.toLowerCase(), passwordHash, fullName || null]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Update user's password
 */
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query(
    `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [userId, passwordHash]
  );
}

/**
 * Update user details
 */
export async function updateUser(
  userId: string,
  updates: { fullName?: string; isActive?: boolean }
): Promise<User | null> {
  const setClauses: string[] = [];
  const values: (string | boolean)[] = [];
  let paramIndex = 1;

  if (updates.fullName !== undefined) {
    setClauses.push(`full_name = $${paramIndex++}`);
    values.push(updates.fullName);
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);
  }

  if (setClauses.length === 0) {
    return findUserById(userId);
  }

  values.push(userId);
  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING id, email, full_name, is_active, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// Workspace Membership Operations
// ============================================

/**
 * Get all workspace memberships for a user
 */
export async function getUserMemberships(userId: string): Promise<WorkspaceUserMembership[]> {
  const result = await pool.query(
    `SELECT id, user_id, workspace_id, role, created_at
     FROM workspace_user_memberships
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role as WorkspaceRole,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific membership
 */
export async function getMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceUserMembership | null> {
  return getWorkspaceMembership(userId, workspaceId);
}

/**
 * Get workspace membership (alias for getMembership)
 */
export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceUserMembership | null> {
  const result = await pool.query(
    `SELECT id, user_id, workspace_id, role, created_at
     FROM workspace_user_memberships
     WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role as WorkspaceRole,
    createdAt: row.created_at,
  };
}

/**
 * Create a workspace membership
 */
export async function createWorkspaceMembership(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole
): Promise<WorkspaceUserMembership> {
  const result = await pool.query(
    `INSERT INTO workspace_user_memberships (user_id, workspace_id, role)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, workspace_id, role, created_at`,
    [userId, workspaceId, role]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role as WorkspaceRole,
    createdAt: row.created_at,
  };
}

/**
 * Update a membership's role
 */
export async function updateMembershipRole(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole
): Promise<WorkspaceUserMembership | null> {
  const result = await pool.query(
    `UPDATE workspace_user_memberships
     SET role = $3
     WHERE user_id = $1 AND workspace_id = $2
     RETURNING id, user_id, workspace_id, role, created_at`,
    [userId, workspaceId, role]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role as WorkspaceRole,
    createdAt: row.created_at,
  };
}

/**
 * Delete a membership
 */
export async function deleteMembership(userId: string, workspaceId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM workspace_user_memberships
     WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get all members of a workspace
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<(User & { role: WorkspaceRole })[]> {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.is_active, u.created_at, u.updated_at, m.role
     FROM users u
     JOIN workspace_user_memberships m ON u.id = m.user_id
     WHERE m.workspace_id = $1
     ORDER BY m.role, u.email`,
    [workspaceId]
  );

  return result.rows.map(row => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: row.role as WorkspaceRole,
  }));
}
