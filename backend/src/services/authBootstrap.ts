import { query } from '../db.js';

export async function ensureAuthSecuritySchema(): Promise<void> {
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mfa_login_required BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS sensitive_action_mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS mfa_temp_secret_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS recovery_code_hashes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS email_otp_code_hash TEXT,
      ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS email_otp_last_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL,
      auth_method TEXT NOT NULL,
      device_name TEXT,
      browser_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      last_step_up_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
      ON auth_sessions(user_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_active
      ON auth_sessions(user_id, revoked_at)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      device_type TEXT,
      backed_up BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id
      ON user_passkeys(user_id)
  `);
}
