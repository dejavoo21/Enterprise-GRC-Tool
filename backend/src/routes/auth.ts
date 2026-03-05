/**
 * Authentication Routes
 *
 * Handles login, registration, and user session management.
 */

import { Router, Request, Response } from 'express';
import { hashPassword, verifyPassword, signAuthToken, verifyAuthToken } from '../services/authService.js';
import * as authRepo from '../repositories/authRepo.js';
import { WorkspaceRole } from '../types/models.js';

const router = Router();

// ============================================
// POST /login
// ============================================

interface LoginRequest {
  email: string;
  password: string;
  workspaceId?: string; // Optional: switch to specific workspace
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, workspaceId: requestedWorkspaceId } = req.body as LoginRequest;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    // Find user by email
    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Get user's workspace memberships
    const memberships = await authRepo.getUserMemberships(user.id);
    if (memberships.length === 0) {
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'User has no workspace memberships' },
      });
    }

    // Select workspace (requested or first available)
    let selectedMembership = memberships[0];
    if (requestedWorkspaceId) {
      const requested = memberships.find(m => m.workspaceId === requestedWorkspaceId);
      if (!requested) {
        return res.status(403).json({
          data: null,
          error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
        });
      }
      selectedMembership = requested;
    }

    // Generate JWT
    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: selectedMembership.workspaceId,
      role: selectedMembership.role,
    });

    // Return success response
    return res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        workspaceId: selectedMembership.workspaceId,
        role: selectedMembership.role,
        availableWorkspaces: memberships.map(m => ({
          workspaceId: m.workspaceId,
          role: m.role,
        })),
      },
      error: null,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during login' },
    });
  }
});

// ============================================
// GET /me
// ============================================

router.get('/me', async (req: Request, res: Response) => {
  try {
    // Get token from Authorization header
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

    // Get fresh user data
    const user = await authRepo.findUserById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or disabled' },
      });
    }

    // Get all memberships
    const memberships = await authRepo.getUserMemberships(user.id);

    return res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        workspaceId: payload.workspaceId,
        role: payload.role,
        availableWorkspaces: memberships.map(m => ({
          workspaceId: m.workspaceId,
          role: m.role,
        })),
      },
      error: null,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

// ============================================
// POST /switch-workspace
// ============================================

router.post('/switch-workspace', async (req: Request, res: Response) => {
  try {
    // Get token from Authorization header
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

    const { workspaceId } = req.body as { workspaceId: string };
    if (!workspaceId) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'workspaceId is required' },
      });
    }

    // Get user's membership for the requested workspace
    const membership = await authRepo.getMembership(payload.sub, workspaceId);
    if (!membership) {
      return res.status(403).json({
        data: null,
        error: { code: 'NO_WORKSPACE_ACCESS', message: 'No access to requested workspace' },
      });
    }

    // Get user data
    const user = await authRepo.findUserById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found or disabled' },
      });
    }

    // Generate new JWT for the new workspace
    const newToken = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: membership.workspaceId,
      role: membership.role,
    });

    return res.json({
      data: {
        token: newToken,
        workspaceId: membership.workspaceId,
        role: membership.role,
      },
      error: null,
    });
  } catch (error) {
    console.error('Switch workspace error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

// ============================================
// POST /register (Dev/Admin only)
// ============================================

interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
  workspaceId: string;
  role: WorkspaceRole;
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    // Check if registration is enabled (dev mode or via env)
    const allowRegistration = process.env.ALLOW_REGISTRATION === 'true' ||
                              process.env.NODE_ENV === 'development';

    if (!allowRegistration) {
      return res.status(403).json({
        data: null,
        error: { code: 'REGISTRATION_DISABLED', message: 'Registration is disabled' },
      });
    }

    const { email, password, fullName, workspaceId, role } = req.body as RegisterRequest;

    // Validate input
    if (!email || !password || !workspaceId || !role) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'email, password, workspaceId, and role are required' },
      });
    }

    // Validate role
    const validRoles: WorkspaceRole[] = ['owner', 'admin', 'grc', 'auditor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_ROLE', message: `Role must be one of: ${validRoles.join(', ')}` },
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        data: null,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
      });
    }

    // Check if user already exists
    const existingUser = await authRepo.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        data: null,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
      });
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await authRepo.createUser(email, passwordHash, fullName);

    // Create workspace membership
    const membership = await authRepo.createWorkspaceMembership(user.id, workspaceId, role);

    // Generate JWT
    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      workspaceId: membership.workspaceId,
      role: membership.role,
    });

    return res.status(201).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        workspaceId: membership.workspaceId,
        role: membership.role,
      },
      error: null,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred during registration' },
    });
  }
});

// ============================================
// POST /change-password
// ============================================

router.post('/change-password', async (req: Request, res: Response) => {
  try {
    // Get token from Authorization header
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

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'currentPassword and newPassword are required' },
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        data: null,
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters' },
      });
    }

    // Get user with password
    const user = await authRepo.findUserByEmail(payload.email);
    if (!user) {
      return res.status(401).json({
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Verify current password
    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        data: null,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(newPassword);
    await authRepo.updateUserPassword(user.id, newPasswordHash);

    return res.json({
      data: { success: true },
      error: null,
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
    });
  }
});

export default router;
