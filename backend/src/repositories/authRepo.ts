/**
 * Authentication Repository
 *
 * Database operations for users, sessions, passkeys, and workspace memberships.
 */

import { generateId, pool } from '../db.js';
import { mapLegacyWorkspaceRoleToEnterpriseRole } from '../services/accessGovernanceDefaults.js';
import {
  AuthSession,
  User,
  UserPasskey,
  UserWithPassword,
  WorkspaceRole,
  WorkspaceUserMembership,
} from '../types/models.js';

function mapUserRow(row: any): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isActive: row.is_active,
    mfaEnabled: row.mfa_enabled,
    mfaLoginRequired: row.mfa_login_required,
    sensitiveActionMfaRequired: row.sensitive_action_mfa_required,
    emailVerified: row.email_verified,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    emailOtpLastSentAt: row.email_otp_last_sent_at,
    emailOtpExpiresAt: row.email_otp_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserWithPasswordRow(row: any): UserWithPassword {
  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash,
    totpSecretEncrypted: row.totp_secret_encrypted,
    mfaTempSecretEncrypted: row.mfa_temp_secret_encrypted,
    recoveryCodeHashes: row.recovery_code_hashes ?? [],
    emailOtpCodeHash: row.email_otp_code_hash,
  };
}

function mapPasskeyRow(row: any): UserPasskey {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: Number(row.counter ?? 0),
    transports: row.transports ?? [],
    deviceType: row.device_type,
    backedUp: row.backed_up,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function mapSessionRow(row: any): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role as WorkspaceRole,
    authMethod: row.auth_method,
    deviceName: row.device_name,
    browserName: row.browser_name,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    lastStepUpAt: row.last_step_up_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

const USER_SELECT = `SELECT id, email, password_hash, full_name, is_active,
        mfa_enabled, mfa_login_required, sensitive_action_mfa_required, email_verified,
        failed_login_attempts, locked_until, last_login_at,
        email_otp_code_hash, email_otp_expires_at, email_otp_last_sent_at,
        totp_secret_encrypted, mfa_temp_secret_encrypted,
        COALESCE(recovery_code_hashes, ARRAY[]::TEXT[]) AS recovery_code_hashes,
        created_at, updated_at
 FROM users`;

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const result = await pool.query(`${USER_SELECT} WHERE email = $1`, [email.toLowerCase()]);
  return result.rows[0] ? mapUserWithPasswordRow(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT id, email, full_name, is_active,
            mfa_enabled, mfa_login_required, sensitive_action_mfa_required, email_verified,
            failed_login_attempts, locked_until, last_login_at,
            email_otp_expires_at, email_otp_last_sent_at,
            created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function findUserWithPasswordById(id: string): Promise<UserWithPassword | null> {
  const result = await pool.query(`${USER_SELECT} WHERE id = $1`, [id]);
  return result.rows[0] ? mapUserWithPasswordRow(result.rows[0]) : null;
}

export async function createUser(email: string, passwordHash: string, fullName?: string): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, full_name, is_active,
               mfa_enabled, mfa_login_required, sensitive_action_mfa_required, email_verified,
               failed_login_attempts, locked_until, last_login_at,
               email_otp_expires_at, email_otp_last_sent_at,
               created_at, updated_at`,
    [email.toLowerCase(), passwordHash, fullName || null],
  );
  return mapUserRow(result.rows[0]);
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [userId, passwordHash]);
}

export async function storeMfaSetupSecret(userId: string, encryptedSecret: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET mfa_temp_secret_encrypted = $2, updated_at = NOW()
     WHERE id = $1`,
    [userId, encryptedSecret],
  );
}

export async function enableMfa(userId: string, encryptedSecret: string, recoveryCodeHashes: string[]): Promise<void> {
  await pool.query(
    `UPDATE users
     SET mfa_enabled = TRUE,
         totp_secret_encrypted = $2,
         mfa_temp_secret_encrypted = NULL,
         recovery_code_hashes = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, encryptedSecret, recoveryCodeHashes],
  );
}

export async function disableMfa(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET mfa_enabled = FALSE,
         mfa_login_required = FALSE,
         totp_secret_encrypted = NULL,
         mfa_temp_secret_encrypted = NULL,
         recovery_code_hashes = ARRAY[]::TEXT[],
         updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
}

export async function updateRecoveryCodeHashes(userId: string, recoveryCodeHashes: string[]): Promise<void> {
  await pool.query(
    `UPDATE users
     SET recovery_code_hashes = $2, updated_at = NOW()
     WHERE id = $1`,
    [userId, recoveryCodeHashes],
  );
}

export async function updateMfaPolicy(
  userId: string,
  updates: { mfaLoginRequired?: boolean; sensitiveActionMfaRequired?: boolean },
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET mfa_login_required = COALESCE($2, mfa_login_required),
         sensitive_action_mfa_required = COALESCE($3, sensitive_action_mfa_required),
         updated_at = NOW()
     WHERE id = $1`,
    [
      userId,
      updates.mfaLoginRequired ?? null,
      updates.sensitiveActionMfaRequired ?? null,
    ],
  );
}

export async function recordFailedLoginAttempt(userId: string, lockedUntil: string | null): Promise<void> {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = COALESCE($2::timestamptz, locked_until),
         updated_at = NOW()
     WHERE id = $1`,
    [userId, lockedUntil],
  );
}

export async function resetLoginSecurity(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         email_otp_code_hash = NULL,
         email_otp_expires_at = NULL,
         last_login_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
}

export async function setEmailOtp(userId: string, otpHash: string, expiresAt: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET email_otp_code_hash = $2,
         email_otp_expires_at = $3,
         email_otp_last_sent_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId, otpHash, expiresAt],
  );
}

export async function clearEmailOtp(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users
     SET email_otp_code_hash = NULL,
         email_otp_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
}

export async function updateUser(
  userId: string,
  updates: { fullName?: string; isActive?: boolean },
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
     RETURNING id, email, full_name, is_active,
               mfa_enabled, mfa_login_required, sensitive_action_mfa_required, email_verified,
               failed_login_attempts, locked_until, last_login_at,
               email_otp_expires_at, email_otp_last_sent_at,
               created_at, updated_at`,
    values,
  );

  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
}

export async function listUserPasskeys(userId: string): Promise<UserPasskey[]> {
  const result = await pool.query(
    `SELECT id, user_id, name, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at
     FROM user_passkeys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapPasskeyRow);
}

export async function findPasskeyByCredentialId(credentialId: string): Promise<UserPasskey | null> {
  const result = await pool.query(
    `SELECT id, user_id, name, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at
     FROM user_passkeys
     WHERE credential_id = $1`,
    [credentialId],
  );
  return result.rows[0] ? mapPasskeyRow(result.rows[0]) : null;
}

export async function createPasskey(input: {
  userId: string;
  name: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType?: string | null;
  backedUp?: boolean;
}): Promise<UserPasskey> {
  const id = generateId('pk');
  const result = await pool.query(
    `INSERT INTO user_passkeys (id, user_id, name, credential_id, public_key, counter, transports, device_type, backed_up)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, name, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at`,
    [
      id,
      input.userId,
      input.name,
      input.credentialId,
      input.publicKey,
      input.counter,
      input.transports,
      input.deviceType ?? null,
      input.backedUp ?? false,
    ],
  );
  return mapPasskeyRow(result.rows[0]);
}

export async function updatePasskeyCounter(passkeyId: string, counter: number): Promise<void> {
  await pool.query(
    `UPDATE user_passkeys
     SET counter = $2, last_used_at = NOW()
     WHERE id = $1`,
    [passkeyId, counter],
  );
}

export async function deletePasskey(userId: string, passkeyId: string): Promise<void> {
  await pool.query(`DELETE FROM user_passkeys WHERE id = $1 AND user_id = $2`, [passkeyId, userId]);
}

export async function createSession(input: {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  authMethod: string;
  deviceName?: string | null;
  browserName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt?: string | null;
}): Promise<AuthSession> {
  const id = generateId('sess');
  const result = await pool.query(
    `INSERT INTO auth_sessions (id, user_id, workspace_id, role, auth_method, device_name, browser_name, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, user_id, workspace_id, role, auth_method, device_name, browser_name, ip_address, user_agent,
               last_step_up_at, last_seen_at, expires_at, created_at, revoked_at`,
    [
      id,
      input.userId,
      input.workspaceId,
      input.role,
      input.authMethod,
      input.deviceName ?? null,
      input.browserName ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.expiresAt ?? null,
    ],
  );
  return mapSessionRow(result.rows[0]);
}

export async function findActiveSessionById(sessionId: string): Promise<AuthSession | null> {
  const result = await pool.query(
    `SELECT id, user_id, workspace_id, role, auth_method, device_name, browser_name, ip_address, user_agent,
            last_step_up_at, last_seen_at, expires_at, created_at, revoked_at
     FROM auth_sessions
     WHERE id = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [sessionId],
  );
  return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
}

export async function touchSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE auth_sessions
     SET last_seen_at = NOW()
     WHERE id = $1`,
    [sessionId],
  );
}

export async function markSessionStepUp(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE auth_sessions
     SET last_step_up_at = NOW(), last_seen_at = NOW()
     WHERE id = $1`,
    [sessionId],
  );
}

export async function listActiveSessionsForUser(userId: string): Promise<AuthSession[]> {
  const result = await pool.query(
    `SELECT id, user_id, workspace_id, role, auth_method, device_name, browser_name, ip_address, user_agent,
            last_step_up_at, last_seen_at, expires_at, created_at, revoked_at
     FROM auth_sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY last_seen_at DESC, created_at DESC`,
    [userId],
  );
  return result.rows.map(mapSessionRow);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = NOW()
     WHERE id = $1`,
    [sessionId],
  );
}

export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE auth_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId],
  );
  return result.rowCount ?? 0;
}

export async function getUserMemberships(userId: string): Promise<WorkspaceUserMembership[]> {
  const result = await pool.query(
    `SELECT id, user_id, workspace_id, role, created_at
     FROM workspace_user_memberships
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role as WorkspaceRole,
    createdAt: row.created_at,
  }));
}

export async function getMembership(userId: string, workspaceId: string): Promise<WorkspaceUserMembership | null> {
  return getWorkspaceMembership(userId, workspaceId);
}

export async function getWorkspaceMembership(userId: string, workspaceId: string): Promise<WorkspaceUserMembership | null> {
  const result = await pool.query(
    `SELECT id, user_id, workspace_id, role, created_at
     FROM workspace_user_memberships
     WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    id: result.rows[0].id,
    userId: result.rows[0].user_id,
    workspaceId: result.rows[0].workspace_id,
    role: result.rows[0].role as WorkspaceRole,
    createdAt: result.rows[0].created_at,
  };
}

export async function createWorkspaceMembership(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole,
): Promise<WorkspaceUserMembership> {
  const result = await pool.query(
    `INSERT INTO workspace_user_memberships (user_id, workspace_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, workspace_id)
     DO UPDATE SET role = EXCLUDED.role
     RETURNING id, user_id, workspace_id, role, created_at`,
    [userId, workspaceId, role],
  );

  await pool.query(
    `INSERT INTO governance_user_roles (id, workspace_id, user_id, role_id, status, access_scope, reviewer)
     VALUES ($1, $2, $3, $4, 'active', COALESCE((SELECT name FROM workspaces WHERE id = $2), 'Workspace access'), 'Auth membership sync')
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active', updated_at = NOW()`,
    [generateId('gur'), workspaceId, userId, mapLegacyWorkspaceRoleToEnterpriseRole(role)],
  );

  return {
    id: result.rows[0].id,
    userId: result.rows[0].user_id,
    workspaceId: result.rows[0].workspace_id,
    role: result.rows[0].role as WorkspaceRole,
    createdAt: result.rows[0].created_at,
  };
}

export async function getWorkspaceMembers(workspaceId: string): Promise<Array<{
  id: string;
  email: string;
  fullName: string;
  role: WorkspaceRole;
  createdAt: string;
}>> {
  const result = await pool.query(
    `SELECT u.id, u.email, COALESCE(u.full_name, u.email) AS full_name, wum.role, wum.created_at
     FROM workspace_user_memberships wum
     INNER JOIN users u ON u.id = wum.user_id
     WHERE wum.workspace_id = $1
     ORDER BY wum.created_at ASC`,
    [workspaceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as WorkspaceRole,
    createdAt: row.created_at,
  }));
}
