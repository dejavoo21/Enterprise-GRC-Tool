/**
 * Workspaces Repository
 * Handles workspace CRUD operations and queries
 */

import { pool } from '../db.js';
import { WorkspaceRole } from '../types/models.js';
import crypto from 'crypto';

export interface TenantRecord {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  tenantId: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  displayName: string | null;
  description?: string;
  industry: string | null;
  region: string | null;
  status: string;
  organizationId: string;
  organizationName: string;
  tenantId: string;
  tenantName: string;
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
    organizationId: row.organization_id,
    organizationName: row.organization_name || row.display_name || row.name || row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || row.organization_name || row.display_name || row.name || row.id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

function generateStableIdentityId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

export async function ensureWorkspaceIdentitySchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_by_user_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS industry TEXT,
      ADD COLUMN IF NOT EXISTS region TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
      ADD COLUMN IF NOT EXISTS tenant_id TEXT,
      ADD COLUMN IF NOT EXISTS organization_id TEXT,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    UPDATE workspaces
    SET
      display_name = COALESCE(NULLIF(display_name, ''), name),
      status = CASE
        WHEN id = 'demo-workspace' OR COALESCE(display_name, name, '') ILIKE '%demo workspace%' THEN 'archived'
        ELSE COALESCE(status, 'active')
      END
    WHERE display_name IS NULL
       OR status IS NULL
       OR id = 'demo-workspace'
       OR COALESCE(display_name, name, '') ILIKE '%demo workspace%'
  `);

  const result = await pool.query<{
    id: string;
    display_name: string | null;
    name: string;
    created_by_user_id: string | null;
    tenant_id: string | null;
    organization_id: string | null;
  }>(`
    SELECT id, display_name, name, created_by_user_id, tenant_id, organization_id
    FROM workspaces
    WHERE tenant_id IS NULL OR organization_id IS NULL
  `);

  for (const row of result.rows) {
    const tenantId = row.tenant_id || generateStableIdentityId('tenant');
    const organizationId = row.organization_id || generateStableIdentityId('org');
    const identityName = row.display_name || row.name || row.id;

    await pool.query(
      `INSERT INTO tenants (id, name, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, identityName],
    );

    await pool.query(
      `INSERT INTO organizations (id, tenant_id, name, created_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [organizationId, tenantId, identityName, row.created_by_user_id],
    );

    await pool.query(
      `UPDATE workspaces
       SET tenant_id = $2, organization_id = $3, updated_at = NOW()
       WHERE id = $1`,
      [row.id, tenantId, organizationId],
    );
  }
}

export async function getWorkspaces(): Promise<Workspace[]> {
  try {
    const result = await pool.query(
      `SELECT
         w.id,
         w.name,
         w.display_name,
         w.description,
         w.industry,
         w.region,
         w.status,
         w.organization_id,
         w.tenant_id,
         w.created_by_user_id,
         w.created_at,
         o.name AS organization_name,
         t.name AS tenant_name
       FROM workspaces w
       LEFT JOIN organizations o ON o.id = w.organization_id
       LEFT JOIN tenants t ON t.id = w.tenant_id
       WHERE COALESCE(w.status, 'active') <> 'archived'
       ORDER BY COALESCE(w.display_name, w.name, w.id)`,
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
      `SELECT
         w.id,
         w.name,
         w.display_name,
         w.description,
         w.industry,
         w.region,
         w.status,
         w.organization_id,
         w.tenant_id,
         w.created_by_user_id,
         w.created_at,
         o.name AS organization_name,
         t.name AS tenant_name
       FROM workspaces w
       LEFT JOIN organizations o ON o.id = w.organization_id
       LEFT JOIN tenants t ON t.id = w.tenant_id
       WHERE w.id = $1`,
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
  const workspaceId = input.id || generateWorkspaceId(input.displayName);
  const tenantId = generateStableIdentityId('tenant');
  const organizationId = generateStableIdentityId('org');

  await pool.query(
    `INSERT INTO tenants (id, name, status)
     VALUES ($1, $2, 'active')`,
    [tenantId, input.displayName],
  );

  await pool.query(
    `INSERT INTO organizations (id, tenant_id, name, created_by_user_id)
     VALUES ($1, $2, $3, $4)`,
    [organizationId, tenantId, input.displayName, createdByUserId],
  );

  const result = await pool.query(
    `INSERT INTO workspaces (id, name, display_name, industry, region, status, created_by_user_id, organization_id, tenant_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, NOW(), NOW())
     RETURNING
       id,
       name,
       display_name,
       description,
       industry,
       region,
       status,
       organization_id,
       tenant_id,
       created_by_user_id,
       created_at,
       $3::text AS organization_name,
       $3::text AS tenant_name`,
    [workspaceId, input.displayName, input.displayName, input.industry || null, input.region || null, createdByUserId, organizationId, tenantId]
  );

  return rowToWorkspace(result.rows[0]);
}

/**
 * Get all workspaces a user belongs to
 */
export async function getWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const result = await pool.query(
    `SELECT
       w.id,
       w.name,
       w.display_name,
       w.description,
       w.industry,
       w.region,
       w.status,
       w.organization_id,
       w.tenant_id,
       w.created_by_user_id,
       w.created_at,
       o.name AS organization_name,
       t.name AS tenant_name
     FROM workspaces w
     INNER JOIN workspace_user_memberships wum ON w.id = wum.workspace_id
     LEFT JOIN organizations o ON o.id = w.organization_id
     LEFT JOIN tenants t ON t.id = w.tenant_id
     WHERE wum.user_id = $1
       AND COALESCE(w.status, 'active') <> 'archived'
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

  setClauses.push(`updated_at = NOW()`);
  const result = await pool.query(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
     RETURNING
       id, name, display_name, description, industry, region, status,
       organization_id, tenant_id, created_by_user_id, created_at`,
    values,
  );

  if (result.rows.length === 0) {
    return null;
  }

  if (updates.displayName !== undefined) {
    await pool.query(
      `UPDATE organizations SET name = $2 WHERE id = (SELECT organization_id FROM workspaces WHERE id = $1)`,
      [id, updates.displayName],
    );
    await pool.query(
      `UPDATE tenants SET name = $2 WHERE id = (SELECT tenant_id FROM workspaces WHERE id = $1)`,
      [id, updates.displayName],
    );
  }

  return getWorkspaceById(id);
}

export async function archiveWorkspace(id: string): Promise<Workspace | null> {
  await pool.query(
    `UPDATE workspaces
     SET status = 'archived', archived_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
  return getWorkspaceById(id);
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
