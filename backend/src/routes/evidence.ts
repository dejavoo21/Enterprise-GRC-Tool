import { Router } from 'express';
import type {
  ApiResponse,
  EvidenceItem,
} from '../types/models.js';
import * as evidenceRepo from '../repositories/evidenceRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';

const router = Router();

// GET /api/v1/evidence
// Returns all evidence items with optional filtering by controlId or riskId
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId, riskId, type } = req.query;

    let evidence = await evidenceRepo.getEvidence(workspaceId, {
      controlId: typeof controlId === 'string' ? controlId : undefined,
      riskId: typeof riskId === 'string' ? riskId : undefined,
      type: typeof type === 'string' ? type : undefined,
    });

    // Sort by collectedAt descending (most recent first)
    evidence = [...evidence].sort((a, b) =>
      new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
    );

    const response: ApiResponse<EvidenceItem[]> = {
      data: evidence,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_EVIDENCE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch evidence',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/evidence/:id
// Returns a single evidence item by ID
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const evidence = await evidenceRepo.getEvidenceById(workspaceId, id);

    if (!evidence) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Evidence with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<EvidenceItem> = {
      data: evidence,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_EVIDENCE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch evidence',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/evidence
// Creates a new evidence item
router.post('/', async (req, res) => {
  try {
    const input = req.body;

    // Basic validation
    if (!input.name || !input.type || !input.collectedBy) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name, type, and collectedBy are required',
        },
      };
      return res.status(400).json(response);
    }

    // Validate evidence type
    const validTypes = ['policy', 'configuration', 'log', 'screenshot', 'report', 'other'];
    if (!validTypes.includes(input.type)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid evidence type. Must be one of: ${validTypes.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    const workspaceId = getWorkspaceId(req);
    const newEvidence = await evidenceRepo.createEvidence(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      locationUrl: input.locationUrl,
      controlId: input.controlId,
      riskId: input.riskId,
      collectedBy: input.collectedBy,
      collectedAt: input.collectedAt || new Date().toISOString(),
    });

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'evidence',
        entityId: newEvidence.id,
        action: 'create',
        summary: `Added evidence "${newEvidence.name}" (type: ${newEvidence.type})`,
        details: newEvidence,
      }));
    }

    const response: ApiResponse<EvidenceItem> = {
      data: newEvidence,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_EVIDENCE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create evidence',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
