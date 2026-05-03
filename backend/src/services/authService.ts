/**
 * Authentication Service
 *
 * Handles passwords, JWTs, TOTP MFA, recovery codes, and secret encryption.
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { generateSecret, generateURI, verify } from 'otplib';
import { WorkspaceRole } from '../types/models.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const MFA_CHALLENGE_EXPIRES_IN = process.env.MFA_CHALLENGE_EXPIRES_IN || '10m';
const MFA_ISSUER = process.env.MFA_ISSUER || 'Enterprise GRC Tool';
const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'dev-mfa-encryption-key-change-me';
const EMAIL_OTP_EXPIRES_MINUTES = parseInt(process.env.EMAIL_OTP_EXPIRES_MINUTES || '10', 10);
const FAILED_LOGIN_THRESHOLD = parseInt(process.env.FAILED_LOGIN_THRESHOLD || '5', 10);
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30', 10);
const SALT_ROUNDS = 10;
const RECOVERY_CODE_COUNT = 8;

// ============================================
// Password Utilities
// ============================================

/**
 * Hash a plaintext password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// JWT Utilities
// ============================================

export interface JwtPayload {
  sub: string;              // user id
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
  iat?: number;
  exp?: number;
}

export interface MfaChallengePayload extends JwtPayload {
  purpose: 'mfa_challenge';
}

/**
 * Sign a JWT token with user information
 */
export function signAuthToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function signMfaChallengeToken(payload: Omit<MfaChallengePayload, 'iat' | 'exp' | 'purpose'>): string {
  return jwt.sign(
    {
      ...payload,
      purpose: 'mfa_challenge',
    },
    JWT_SECRET,
    { expiresIn: MFA_CHALLENGE_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyMfaChallengeToken(token: string): MfaChallengePayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as MfaChallengePayload;
    return payload.purpose === 'mfa_challenge' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT token without verifying (for debugging)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(MFA_ENCRYPTION_KEY).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted secret format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildTotpKeyUri(email: string, secret: string): string {
  return generateURI({
    issuer: MFA_ISSUER,
    label: email,
    secret,
  });
}

export async function generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  const normalized = token.replace(/\s+/g, '').trim();
  const result = await verify({
    secret,
    token: normalized,
  });
  return result.valid;
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const blockA = crypto.randomBytes(2).toString('hex').toUpperCase();
    const blockB = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${blockA}-${blockB}`;
  });
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code.trim().toUpperCase(), SALT_ROUNDS)));
}

export async function consumeRecoveryCode(
  inputCode: string,
  existingHashes: string[]
): Promise<{ matched: boolean; remainingHashes: string[] }> {
  const normalizedInput = inputCode.trim().toUpperCase();

  for (let index = 0; index < existingHashes.length; index += 1) {
    const hash = existingHashes[index];
    const matched = await bcrypt.compare(normalizedInput, hash);
    if (matched) {
      return {
        matched: true,
        remainingHashes: existingHashes.filter((_, hashIndex) => hashIndex !== index),
      };
    }
  }

  return { matched: false, remainingHashes: existingHashes };
}

export function generateEmailOtp(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function hashOneTimeCode(code: string): Promise<string> {
  return bcrypt.hash(code.trim(), SALT_ROUNDS);
}

export async function verifyOneTimeCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.trim(), hash);
}

export function getEmailOtpExpiresAt(): string {
  return new Date(Date.now() + EMAIL_OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();
}

export function getEmailOtpExpiresMinutes(): number {
  return EMAIL_OTP_EXPIRES_MINUTES;
}

export function getFailedLoginThreshold(): number {
  return FAILED_LOGIN_THRESHOLD;
}

export function getLockoutDurationMinutes(): number {
  return LOCKOUT_DURATION_MINUTES;
}

export function getMfaIssuer(): string {
  return MFA_ISSUER;
}
