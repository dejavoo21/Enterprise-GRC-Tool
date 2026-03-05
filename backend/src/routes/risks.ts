import { Router } from 'express';
import type {
  ApiResponse,
  Risk,
} from '../types/models.js';
import * as risksRepo from '../repositories/risksRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';

const router = Router();

// Helper to compute severity from risk score
function computeSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

// Helper to enrich risk with computed fields
function enrichRisk(risk: Risk) {
  const inherentRiskScore = risk.inherentLikelihood * risk.inherentImpact;
  const residualRiskScore = risk.residualLikelihood * risk.residualImpact;
  return {
    ...risk,
    inherentRiskScore,
    residualRiskScore,
    severity: computeSeverity(residualRiskScore),
  };
}

// GET /api/v1/risks
// Returns all risks with optional filtering
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, category, owner } = req.query;

    let risks = await risksRepo.getRisks(workspaceId, {
      status: typeof status === 'string' ? status : undefined,
      category: typeof category === 'string' ? category : undefined,
    });

    // Client-side owner filter
    if (owner && typeof owner === 'string') {
      risks = risks.filter(r => r.owner.toLowerCase().includes(owner.toLowerCase()));
    }

    // Calculate scores and severity
    const risksWithScores = risks.map(enrichRisk);

    const response: ApiResponse<typeof risksWithScores> = {
      data: risksWithScores,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_RISKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch risks',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/risks/:id
// Returns a single risk by ID
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const risk = await risksRepo.getRiskById(workspaceId, id);

    if (!risk) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Risk with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ReturnType<typeof enrichRisk>> = {
      data: enrichRisk(risk),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_RISK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch risk',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/risks
// Creates a new risk
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Basic validation
    if (!input.title || !input.owner || !input.category) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title, owner, and category are required',
        },
      };
      return res.status(400).json(response);
    }

    if (
      input.inherentLikelihood < 1 || input.inherentLikelihood > 5 ||
      input.inherentImpact < 1 || input.inherentImpact > 5
    ) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Likelihood and impact must be between 1 and 5',
        },
      };
      return res.status(400).json(response);
    }

    const newRisk = await risksRepo.createRisk(workspaceId, {
      title: input.title,
      description: input.description || '',
      owner: input.owner,
      category: input.category,
      inherentLikelihood: input.inherentLikelihood,
      inherentImpact: input.inherentImpact,
      dueDate: input.dueDate,
    });

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'risk',
        entityId: newRisk.id,
        action: 'create',
        summary: `Created risk "${newRisk.title}"`,
        details: enrichRisk(newRisk),
      }));
    }

    const response: ApiResponse<ReturnType<typeof enrichRisk>> = {
      data: enrichRisk(newRisk),
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_RISK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create risk',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/risks/:id
// Updates an existing risk
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    // Fetch existing risk for logging
    const existingRisk = await risksRepo.getRiskById(workspaceId, id);

    const updatedRisk = await risksRepo.updateRisk(workspaceId, id, updates);

    if (!updatedRisk) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Risk with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      const isStatusChange = existingRisk && updates.status && existingRisk.status !== updates.status;
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'risk',
        entityId: id,
        action: isStatusChange ? 'status_change' : 'update',
        summary: isStatusChange
          ? `Risk "${updatedRisk.title}" status changed from ${existingRisk.status} to ${updates.status}`
          : `Updated risk "${updatedRisk.title}"`,
        details: { before: existingRisk ? enrichRisk(existingRisk) : null, after: enrichRisk(updatedRisk) },
      }));
    }

    const response: ApiResponse<ReturnType<typeof enrichRisk>> = {
      data: enrichRisk(updatedRisk),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_RISK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update risk',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
