/**
 * Authentication Service
 *
 * Handles password hashing, JWT generation and verification.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { WorkspaceRole } from '../types/models.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS = 10;

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

/**
 * Sign a JWT token with user information
 */
export function signAuthToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
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
