import { query } from '../db.js';

export async function ensureAuthSecuritySchema(): Promise<void> {
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
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
}
