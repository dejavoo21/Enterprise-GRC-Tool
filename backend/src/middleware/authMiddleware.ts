/**
 * Authentication Middleware
 *
 * Provides route protection and role-based access control.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../services/authService.js';
import { WorkspaceRole } from '../types/models.js';

// Extend Express Request type to include auth user
declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        email: string;
        workspaceId: string;
        role: WorkspaceRole;
      };
    }
  }
}

/**
 * Middleware that requires a valid JWT token.
 * Populates req.authUser with the user's info from the token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'No token provided' },
    });
  }

  const token = authHeader.slice('Bearer '.length);
  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }

  // Populate auth user on request
  req.authUser = {
    userId: payload.sub,
    email: payload.email,
    workspaceId: payload.workspaceId,
    role: payload.role,
  };

  next();
}

/**
 * Middleware factory that requires specific roles.
 * Must be used after requireAuth.
 */
export function requireRole(allowed: WorkspaceRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    if (!allowed.includes(req.authUser.role)) {
      return res.status(403).json({
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `This action requires one of the following roles: ${allowed.join(', ')}`,
        },
      });
    }

    next();
  };
}

/**
 * Predefined role sets for common access patterns
 */
export const ROLES = {
  // Can do everything
  ADMIN_LIKE: ['owner', 'admin'] as WorkspaceRole[],

  // Can create/edit GRC content
  CAN_EDIT: ['owner', 'admin', 'grc'] as WorkspaceRole[],

  // Can view but not edit
  CAN_VIEW: ['owner', 'admin', 'grc', 'auditor', 'viewer'] as WorkspaceRole[],

  // Auditor can view and export
  AUDITOR_PLUS: ['owner', 'admin', 'grc', 'auditor'] as WorkspaceRole[],
};

/**
 * Helper to get workspace ID from authenticated request.
 * Uses the workspace from the JWT token, ensuring workspace scoping.
 */
export function getAuthenticatedWorkspaceId(req: Request): string {
  if (!req.authUser) {
    throw new Error('Not authenticated');
  }
  return req.authUser.workspaceId;
}

/**
 * Optional auth middleware - populates req.authUser if token is present,
 * but doesn't block if missing.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length);
    const payload = verifyAuthToken(token);

    if (payload) {
      req.authUser = {
        userId: payload.sub,
        email: payload.email,
        workspaceId: payload.workspaceId,
        role: payload.role,
      };
    }
  }

  next();
}
