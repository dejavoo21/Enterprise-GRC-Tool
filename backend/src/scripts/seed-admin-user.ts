/**
 * Seed or update an admin user.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Supported environment variables:
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *   ADMIN_FULL_NAME
 *   ADMIN_WORKSPACE_ID
 *   ADMIN_ROLE
 */

import { pool } from '../db.js';
import { hashPassword } from '../services/authService.js';

const DEFAULT_EMAIL = 'admin@example.com';
const DEFAULT_PASSWORD = 'Password123!';
const DEFAULT_FULL_NAME = 'Admin';
const DEFAULT_ROLE = 'owner';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME || DEFAULT_FULL_NAME;
const ADMIN_WORKSPACE_ID = process.env.ADMIN_WORKSPACE_ID || '';
const ADMIN_ROLE = process.env.ADMIN_ROLE || DEFAULT_ROLE;

async function resolveWorkspaceId(): Promise<string> {
  if (ADMIN_WORKSPACE_ID) {
    const workspaceResult = await pool.query('SELECT id FROM workspaces WHERE id = $1', [ADMIN_WORKSPACE_ID]);
    if (workspaceResult.rows.length === 0) {
      throw new Error(`Workspace "${ADMIN_WORKSPACE_ID}" does not exist.`);
    }
    return ADMIN_WORKSPACE_ID;
  }

  const workspaceResult = await pool.query('SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1');
  if (workspaceResult.rows.length === 0) {
    throw new Error('No workspace exists. Create a workspace first or provide ADMIN_WORKSPACE_ID.');
  }

  return workspaceResult.rows[0].id as string;
}

async function ensureMembership(userId: string, workspaceId: string) {
  const membershipResult = await pool.query(
    'SELECT id FROM workspace_user_memberships WHERE user_id = $1 AND workspace_id = $2',
    [userId, workspaceId]
  );

  if (membershipResult.rows.length > 0) {
    await pool.query(
      `UPDATE workspace_user_memberships
       SET role = $3
       WHERE user_id = $1 AND workspace_id = $2`,
      [userId, workspaceId, ADMIN_ROLE]
    );
    console.log(`Updated workspace membership for "${workspaceId}" to role "${ADMIN_ROLE}".`);
    return;
  }

  await pool.query(
    `INSERT INTO workspace_user_memberships (user_id, workspace_id, role)
     VALUES ($1, $2, $3)`,
    [userId, workspaceId, ADMIN_ROLE]
  );
  console.log(`Created workspace membership for "${workspaceId}" with role "${ADMIN_ROLE}".`);
}

async function seedAdminUser() {
  console.log(`Seeding admin user for ${ADMIN_EMAIL}...`);

  try {
    const workspaceId = await resolveWorkspaceId();
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    let userId: string;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id as string;
      await pool.query(
        `UPDATE users
         SET password_hash = $2, full_name = $3, is_active = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [userId, passwordHash, ADMIN_FULL_NAME]
      );
      console.log(`Updated existing user "${ADMIN_EMAIL}".`);
    } else {
      const userResult = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id`,
        [ADMIN_EMAIL, passwordHash, ADMIN_FULL_NAME]
      );
      userId = userResult.rows[0].id as string;
      console.log(`Created user "${ADMIN_EMAIL}".`);
    }

    await ensureMembership(userId, workspaceId);

    console.log('Admin account is ready.');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Workspace: ${workspaceId}`);
    console.log(`Role: ${ADMIN_ROLE}`);
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdminUser();
