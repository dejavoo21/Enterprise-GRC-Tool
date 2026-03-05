/**
 * Workspaces Repository
 * Handles workspace CRUD operations and queries
 */

import { pool } from '../db.js';
import { WorkspaceRole } from '../types/models.js';
import crypto from 'crypto';

export interface Workspace {
  id: string;
  name: string;
  displayName: string | null;
  description?: string;
  industry: string | null;
  region: string | null;
  status: string;
  createdByUserId: string | null;
  createdAt: string;
}

export type WorkspaceSeedProfile = 'minimal' | 'standard' | 'full';

export interface CreateWorkspaceInput {
  id?: string;
  displayName: string;
  industry?: string;
  region?: string;
  seedProfile?: WorkspaceSeedProfile;
}

function rowToWorkspace(row: any): Workspace {
  return {
    id: row.id,
    name: row.name || row.display_name || row.id,
    displayName: row.display_name,
    description: row.description,
    industry: row.industry,
    region: row.region,
    status: row.status || 'active',
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getWorkspaces(): Promise<Workspace[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, display_name, description, industry, region, status, created_by_user_id, created_at
       FROM workspaces ORDER BY id`,
      []
    );
    return result.rows.map(rowToWorkspace);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    throw error;
  }
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, display_name, description, industry, region, status, created_by_user_id, created_at
       FROM workspaces WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0 ? rowToWorkspace(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching workspace by ID:', error);
    throw error;
  }
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  input: CreateWorkspaceInput,
  createdByUserId: string
): Promise<Workspace> {
  // Generate a URL-friendly ID if not provided
  const workspaceId = input.id || generateWorkspaceId(input.displayName);

  const result = await pool.query(
    `INSERT INTO workspaces (id, name, display_name, industry, region, status, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW())
     RETURNING id, name, display_name, description, industry, region, status, created_by_user_id, created_at`,
    [workspaceId, input.displayName, input.displayName, input.industry || null, input.region || null, createdByUserId]
  );

  return rowToWorkspace(result.rows[0]);
}

/**
 * Get all workspaces a user belongs to
 */
export async function getWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const result = await pool.query(
    `SELECT w.id, w.name, w.display_name, w.description, w.industry, w.region, w.status, w.created_by_user_id, w.created_at
     FROM workspaces w
     INNER JOIN workspace_user_memberships wum ON w.id = wum.workspace_id
     WHERE wum.user_id = $1
     ORDER BY w.display_name ASC NULLS LAST, w.id ASC`,
    [userId]
  );

  return result.rows.map(rowToWorkspace);
}

/**
 * Update workspace metadata
 */
export async function updateWorkspace(
  id: string,
  updates: Partial<Pick<Workspace, 'displayName' | 'industry' | 'region' | 'status'>>
): Promise<Workspace | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.displayName !== undefined) {
    setClauses.push(`display_name = $${paramIndex}`);
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.displayName);
  }
  if (updates.industry !== undefined) {
    setClauses.push(`industry = $${paramIndex++}`);
    values.push(updates.industry);
  }
  if (updates.region !== undefined) {
    setClauses.push(`region = $${paramIndex++}`);
    values.push(updates.region);
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }

  if (setClauses.length === 0) {
    return getWorkspaceById(id);
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, name, display_name, description, industry, region, status, created_by_user_id, created_at`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToWorkspace(result.rows[0]);
}

/**
 * Generate a URL-friendly workspace ID from display name
 */
function generateWorkspaceId(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  const suffix = crypto.randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}
