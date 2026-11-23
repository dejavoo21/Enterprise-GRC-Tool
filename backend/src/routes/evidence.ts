import { Router } from 'express';
import type {
  ApiResponse,
  EvidenceItem,
} from '../types/models.js';
import * as evidenceRepo from '../repositories/evidenceRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { assertEvidenceDecision, assertEvidenceSubmission } from '../services/evidenceReviewRules.js';

const router = Router();
router.use((req, res, next) => {
  if (!req.authUser) return res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
  if (getWorkspaceId(req) !== req.authUser.workspaceId) return res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Workspace does not match your session.' } });
  next();
});

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
    await evidenceRepo.validateEvidenceLinks(workspaceId, input.controlId, input.riskId);
    const newEvidence = await evidenceRepo.createEvidence(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      locationUrl: input.locationUrl,
      controlId: input.controlId,
      riskId: input.riskId,
      collectedBy: input.collectedBy,
      collectedAt: input.collectedAt || new Date().toISOString(),
      createdBy: req.authUser!.userId,
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

router.post('/:id/submit', requirePermission('Evidence', 'edit'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const current = await evidenceRepo.getEvidenceById(workspaceId, req.params.id);
    if (!current) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Evidence not found.' } });
    assertEvidenceSubmission(current.reviewStatus || 'draft');
    const data = await evidenceRepo.submitEvidence(workspaceId, current.id, req.authUser!.userId);
    await logActivity(buildLogInputFromRequest(req, { entityType: 'evidence', entityId: current.id, action: 'review', summary: `Submitted evidence "${current.name}" for review`, details: data }));
    return res.json({ data, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'SUBMIT_EVIDENCE_ERROR';
    return res.status(code === 'INVALID_TRANSITION' ? 409 : 500).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Unable to submit evidence.' } });
  }
});

router.post('/:id/decision', requirePermission('Evidence', 'approve'), async (req, res) => {
  try {
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Decision must be approved or rejected.' } });
    const workspaceId = getWorkspaceId(req);
    const current = await evidenceRepo.getEvidenceById(workspaceId, req.params.id);
    if (!current) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Evidence not found.' } });
    assertEvidenceDecision(current.reviewStatus || 'draft', current.createdBy, req.authUser!.userId);
    const data = await evidenceRepo.decideEvidence(workspaceId, current.id, req.authUser!.userId, decision, req.body?.notes);
    await logActivity(buildLogInputFromRequest(req, { entityType: 'evidence', entityId: current.id, action: 'review', summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} evidence "${current.name}"`, details: data }));
    return res.json({ data, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'REVIEW_EVIDENCE_ERROR';
    return res.status(code === 'INVALID_TRANSITION' || code === 'SELF_APPROVAL' ? 409 : 500).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Unable to review evidence.' } });
  }
});

export default router;
