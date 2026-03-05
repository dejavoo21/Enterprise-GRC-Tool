import { Router } from 'express';
import type { ApiResponse, TrainingEngagement } from '../types/models.js';
import * as trainingEngagementsRepo from '../repositories/trainingEngagementsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/training-engagements
// Returns all training engagements for the current workspace
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, engagementType, frameworkCode } = req.query;

    const engagements = await trainingEngagementsRepo.getTrainingEngagements(workspaceId, {
      status: typeof status === 'string' ? status as any : undefined,
      engagementType: typeof engagementType === 'string' ? engagementType : undefined,
      frameworkCode: typeof frameworkCode === 'string' ? frameworkCode : undefined,
    });

    const response: ApiResponse<TrainingEngagement[]> = {
      data: engagements,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ENGAGEMENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch training engagements',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/training-engagements/summary
// Returns summary statistics for training engagements
router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const allEngagements = await trainingEngagementsRepo.getTrainingEngagements(workspaceId);

    const currentYear = new Date().getFullYear();

    const active = allEngagements.filter(e =>
      e.status === 'signed' || e.status === 'in_delivery'
    ).length;

    const proposed = allEngagements.filter(e => e.status === 'proposed').length;

    const completedThisYear = allEngagements.filter(e =>
      e.status === 'completed' &&
      e.endDate &&
      new Date(e.endDate).getFullYear() === currentYear
    ).length;

    const draft = allEngagements.filter(e => e.status === 'draft').length;

    const totalEstimatedUsers = allEngagements
      .filter(e => e.status === 'signed' || e.status === 'in_delivery')
      .reduce((sum, e) => sum + (e.estimatedUsers || 0), 0);

    const response: ApiResponse<{
      total: number;
      active: number;
      proposed: number;
      completedThisYear: number;
      draft: number;
      totalEstimatedUsers: number;
    }> = {
      data: {
        total: allEngagements.length,
        active,
        proposed,
        completedThisYear,
        draft,
        totalEstimatedUsers,
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch engagement summary',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/training-engagements/:id
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const engagement = await trainingEngagementsRepo.getTrainingEngagementById(workspaceId, id);

    if (!engagement) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<TrainingEngagement> = {
      data: engagement,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ENGAGEMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch training engagement',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/training-engagements
// Creates a new training engagement
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Basic validation
    if (!input.title || !input.engagementType) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and engagementType are required',
        },
      };
      return res.status(400).json(response);
    }

    // Validate engagement type
    const validTypes = ['one_off', 'ongoing_program', 'managed_service', 'retainer'];
    if (!validTypes.includes(input.engagementType)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid engagement type. Must be one of: ${validTypes.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    const newEngagement = await trainingEngagementsRepo.createTrainingEngagement(workspaceId, {
      title: input.title,
      clientName: input.clientName,
      engagementType: input.engagementType,
      status: input.status || 'draft',
      pricingModelId: input.pricingModelId,
      estimatedUsers: input.estimatedUsers,
      startDate: input.startDate,
      endDate: input.endDate,
      primaryContact: input.primaryContact,
      proposalUrl: input.proposalUrl,
      sowUrl: input.sowUrl,
      frameworkCodes: input.frameworkCodes,
    });

    const response: ApiResponse<TrainingEngagement> = {
      data: newEngagement,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_ENGAGEMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create training engagement',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/training-engagements/:id
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    const updatedEngagement = await trainingEngagementsRepo.updateTrainingEngagement(workspaceId, id, updates);

    if (!updatedEngagement) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<TrainingEngagement> = {
      data: updatedEngagement,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_ENGAGEMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update training engagement',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/training-engagements/:id
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const deleted = await trainingEngagementsRepo.deleteTrainingEngagement(workspaceId, id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      data: { deleted: true },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'DELETE_ENGAGEMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete training engagement',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Engagement-Framework Relationship Endpoints
// ============================================

// GET /api/v1/training-engagements/:id/frameworks
router.get('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    // Verify engagement exists
    const engagement = await trainingEngagementsRepo.getTrainingEngagementById(workspaceId, id);
    if (!engagement) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const frameworks = await trainingEngagementsRepo.getEngagementFrameworks(id);

    const response: ApiResponse<string[]> = {
      data: frameworks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_FRAMEWORKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch engagement frameworks',
      },
    };
    res.status(500).json(response);
  }
});

// PUT /api/v1/training-engagements/:id/frameworks
router.put('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { frameworkCodes } = req.body;

    // Verify engagement exists
    const engagement = await trainingEngagementsRepo.getTrainingEngagementById(workspaceId, id);
    if (!engagement) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    if (!Array.isArray(frameworkCodes)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'frameworkCodes must be an array of strings',
        },
      };
      return res.status(400).json(response);
    }

    await trainingEngagementsRepo.setEngagementFrameworks(id, frameworkCodes);
    const updatedFrameworks = await trainingEngagementsRepo.getEngagementFrameworks(id);

    const response: ApiResponse<string[]> = {
      data: updatedFrameworks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'SET_FRAMEWORKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to set engagement frameworks',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
