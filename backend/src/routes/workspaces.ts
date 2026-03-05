/**
 * Workspaces API Routes
 * Handles workspace management and invitations
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import type { ApiResponse } from '../types/models.js';
import * as workspacesRepo from '../repositories/workspacesRepo.js';
import * as invitesRepo from '../repositories/workspaceInvitesRepo.js';
import * as authRepo from '../repositories/authRepo.js';
import { seedWorkspaceData, getSeedProfileDescription } from '../services/workspaceSeedingService.js';
import { WorkspaceRole } from '../types/models.js';

const router = Router();

/**
 * GET /api/v1/workspaces
 * Returns all available workspaces (public route for workspace switcher)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // If authenticated, return workspaces the user belongs to
    if (req.authUser) {
      const workspaces = await workspacesRepo.getWorkspacesForUser(req.authUser.userId);
      const response: ApiResponse<typeof workspaces> = {
        data: workspaces,
        error: null,
      };
      return res.json(response);
    }

    // Otherwise return all workspaces (for backwards compatibility)
    const workspaces = await workspacesRepo.getWorkspaces();
    const response: ApiResponse<typeof workspaces> = {
      data: workspaces,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_WORKSPACES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch workspaces',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/workspaces/seed-profiles
 * Get available seed profile descriptions
 */
router.get('/seed-profiles', async (_req: Request, res: Response) => {
  const profiles = [
    { id: 'minimal', name: 'Minimal', description: getSeedProfileDescription('minimal') },
    { id: 'standard', name: 'Standard', description: getSeedProfileDescription('standard') },
    { id: 'full', name: 'Full', description: getSeedProfileDescription('full') },
  ];

  const response: ApiResponse<typeof profiles> = {
    data: profiles,
    error: null,
  };
  res.json(response);
});

/**
 * POST /api/v1/workspaces
 * Create a new workspace (authenticated users only)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
      return res.status(401).json(response);
    }

    const { displayName, industry, region, seedProfile } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'displayName is required' },
      };
      return res.status(400).json(response);
    }

    // Create the workspace
    const workspace = await workspacesRepo.createWorkspace(
      {
        displayName: displayName.trim(),
        industry: industry || undefined,
        region: region || undefined,
        seedProfile: seedProfile || 'minimal',
      },
      req.authUser.userId
    );

    // Create owner membership for the creating user
    await authRepo.createWorkspaceMembership(
      req.authUser.userId,
      workspace.id,
      'owner'
    );

    // Seed initial data based on profile
    const profile = (seedProfile || 'minimal') as workspacesRepo.WorkspaceSeedProfile;
    await seedWorkspaceData(workspace.id, profile);

    const response: ApiResponse<{ workspace: typeof workspace; role: WorkspaceRole }> = {
      data: { workspace, role: 'owner' },
      error: null,
    };
    res.status(201).json(response);
  } catch (err) {
    console.error('Error creating workspace:', err);
    const response: ApiResponse<null> = {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create workspace' },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/workspaces/:id
 * Returns a single workspace by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // If authenticated, verify access
    if (req.authUser) {
      const membership = await authRepo.getWorkspaceMembership(req.authUser.userId, id);
      if (!membership) {
        const response: ApiResponse<null> = {
          data: null,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this workspace' },
        };
        return res.status(403).json(response);
      }

      const workspace = await workspacesRepo.getWorkspaceById(id);
      if (!workspace) {
        const response: ApiResponse<null> = {
          data: null,
          error: { code: 'NOT_FOUND', message: `Workspace with ID ${id} not found` },
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse<{ workspace: typeof workspace; role: WorkspaceRole }> = {
        data: { workspace, role: membership.role },
        error: null,
      };
      return res.json(response);
    }

    // Unauthenticated - just return workspace (backwards compatibility)
    const workspace = await workspacesRepo.getWorkspaceById(id);

    if (!workspace) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'NOT_FOUND', message: `Workspace with ID ${id} not found` },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof workspace> = {
      data: workspace,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_WORKSPACE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch workspace',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/workspaces/:workspaceId/members
 * Get workspace members
 */
router.get('/:workspaceId/members', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
      return res.status(401).json(response);
    }

    const { workspaceId } = req.params;

    // Check user has access to this workspace
    const membership = await authRepo.getWorkspaceMembership(req.authUser.userId, workspaceId);
    if (!membership) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this workspace' },
      };
      return res.status(403).json(response);
    }

    const members = await authRepo.getWorkspaceMembers(workspaceId);

    const response: ApiResponse<typeof members> = {
      data: members,
      error: null,
    };
    res.json(response);
  } catch (err) {
    console.error('Error fetching workspace members:', err);
    const response: ApiResponse<null> = {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch members' },
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/v1/workspaces/:workspaceId/invitations
 * Get pending invitations (admin only)
 */
router.get('/:workspaceId/invitations', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
      return res.status(401).json(response);
    }

    const { workspaceId } = req.params;

    // Check user has admin access to this workspace
    const membership = await authRepo.getWorkspaceMembership(req.authUser.userId, workspaceId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'FORBIDDEN', message: 'Only owners and admins can view invitations' },
      };
      return res.status(403).json(response);
    }

    const invitations = await invitesRepo.getInvitationsForWorkspace(workspaceId);

    const response: ApiResponse<typeof invitations> = {
      data: invitations,
      error: null,
    };
    res.json(response);
  } catch (err) {
    console.error('Error fetching invitations:', err);
    const response: ApiResponse<null> = {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invitations' },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/workspaces/:workspaceId/invitations
 * Create a new invitation (admin only)
 */
router.post('/:workspaceId/invitations', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
      return res.status(401).json(response);
    }

    const { workspaceId } = req.params;
    const { email, role, expiresInDays } = req.body;

    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Valid email is required' },
      };
      return res.status(400).json(response);
    }

    const validRoles: WorkspaceRole[] = ['owner', 'admin', 'grc', 'auditor', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Valid role is required (owner, admin, grc, auditor, viewer)' },
      };
      return res.status(400).json(response);
    }

    // Check user has admin access to this workspace
    const membership = await authRepo.getWorkspaceMembership(req.authUser.userId, workspaceId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'FORBIDDEN', message: 'Only owners and admins can create invitations' },
      };
      return res.status(403).json(response);
    }

    // Calculate expiry date
    const days = typeof expiresInDays === 'number' ? expiresInDays : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invitation = await invitesRepo.createInvitation({
      workspaceId,
      email: email.toLowerCase().trim(),
      role,
      expiresAt,
      createdBy: req.authUser.userId,
    });

    // Include full token in response for dev/testing purposes
    const response: ApiResponse<typeof invitation & { inviteUrl: string }> = {
      data: {
        ...invitation,
        inviteUrl: `/accept-invite?token=${invitation.token}`,
      },
      error: null,
    };
    res.status(201).json(response);
  } catch (err) {
    console.error('Error creating invitation:', err);
    const response: ApiResponse<null> = {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create invitation' },
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId
 * Delete an invitation (admin only)
 */
router.delete('/:workspaceId/invitations/:invitationId', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
      return res.status(401).json(response);
    }

    const { workspaceId, invitationId } = req.params;

    // Check user has admin access to this workspace
    const membership = await authRepo.getWorkspaceMembership(req.authUser.userId, workspaceId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'FORBIDDEN', message: 'Only owners and admins can delete invitations' },
      };
      return res.status(403).json(response);
    }

    const deleted = await invitesRepo.deleteInvitation(invitationId);
    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ success: boolean }> = {
      data: { success: true },
      error: null,
    };
    res.json(response);
  } catch (err) {
    console.error('Error deleting invitation:', err);
    const response: ApiResponse<null> = {
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete invitation' },
    };
    res.status(500).json(response);
  }
});

export default router;
