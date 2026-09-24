import { Router } from 'express';
import type {
  ApiResponse,
  Risk,
} from '../types/models.js';
import * as risksRepo from '../repositories/risksRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';
import { recordActivity, buildActivityFromRequest as buildLedgerActivityFromRequest } from '../services/activityLedger/activityLedger.js';

import { legacyMethodology, scoreRisk, MethodologyValidationError } from '../services/riskMethodologyRules.js';
const router = Router();
router.use((req, res, next) => {
  if (!req.authUser) return res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  if (getWorkspaceId(req) !== req.authUser.workspaceId) return res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Workspace does not match the authenticated session' } });
  next();
});
function validationMessage(error: unknown): string | null {
  if (error instanceof MethodologyValidationError) return error.message;
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P0001' && 'message' in error) return String(error.message);
  return null;
}
const VALID_RISK_STATUSES = new Set(['identified','assessed','treated','new','open','under_review','treatment_planned','treatment_in_progress','accepted','monitored','closed','deferred','cancelled']);
const VALID_TREATMENT_STRATEGIES = new Set(['mitigate','accept','transfer','avoid','monitor']);
const VALID_TREATMENT_STATUSES = new Set(['not_started','planned','in_progress','awaiting_evidence','under_review','completed','overdue','accepted','deferred','cancelled']);
const VALID_REVIEW_STATUSES = new Set(['not_reviewed','review_due','in_review','reviewed','overdue','reassessment_required']);
const RISK_TRANSITIONS: Record<string, Set<string>> = {
  identified: new Set(['open','under_review','deferred','cancelled']), assessed: new Set(['open','under_review','treatment_planned','accepted','deferred','cancelled']), treated: new Set(['monitored','closed','open','deferred']),
  new: new Set(['open','deferred','cancelled']), open: new Set(['under_review','accepted','deferred','cancelled']), under_review: new Set(['open','treatment_planned','accepted','deferred','cancelled']),
  treatment_planned: new Set(['treatment_in_progress','deferred','cancelled']), treatment_in_progress: new Set(['monitored','closed','deferred','cancelled']), accepted: new Set(['monitored','open','closed']),
  monitored: new Set(['closed','open','under_review','deferred']), deferred: new Set(['open','cancelled']), closed: new Set(['open']), cancelled: new Set(['open']),
};
const VALID_RISK_CATEGORIES = new Set([
  'information_security',
  'privacy',
  'vendor',
  'operational',
  'compliance',
  'strategic',
]);

// Persisted scores are authoritative; unpinned historical records retain legacy read compatibility.
function enrichRisk(risk: Risk) {
  const inherent = risk.methodologyId ? null : scoreRisk(legacyMethodology, risk.inherentLikelihood, risk.inherentImpact);
  const residual = risk.methodologyId ? null : scoreRisk(legacyMethodology, risk.residualLikelihood, risk.residualImpact);
  return { ...risk, inherentRiskScore: risk.inherentScore ?? inherent?.score ?? null,
    residualRiskScore: risk.residualScore ?? residual?.score ?? null,
    severity: (risk.residualRating ?? residual?.rating)?.toLowerCase() ?? null };
}

function isValidRiskScoreValue(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10;
}

function validateLifecycle(input: any, existing?: Risk): string | null {
  const effective = { ...existing, ...input };
  if (input.treatmentStrategy !== undefined && !VALID_TREATMENT_STRATEGIES.has(input.treatmentStrategy)) return 'Invalid treatment strategy';
  if (input.treatmentStatus !== undefined && !VALID_TREATMENT_STATUSES.has(input.treatmentStatus)) return 'Invalid treatment status';
  if (input.reviewStatus !== undefined && !VALID_REVIEW_STATUSES.has(input.reviewStatus)) return 'Invalid review status';
  if (input.treatmentProgress !== undefined && (!Number.isInteger(input.treatmentProgress) || input.treatmentProgress < 0 || input.treatmentProgress > 100)) return 'Treatment progress must be an integer between 0 and 100';
  if (['planned', 'in_progress'].includes(effective.treatmentStatus) && (!effective.treatmentOwner || !effective.treatmentDueDate)) return 'Treatment owner and due date are required for planned or in-progress treatment';
  if ((effective.status === 'accepted' || effective.treatmentStrategy === 'accept' || effective.treatmentStatus === 'accepted') && !String(effective.acceptanceRationale || '').trim()) return 'Acceptance rationale is required for accepted risks';
  for (const field of ['treatmentDueDate', 'nextReviewDate']) if (input[field] && Number.isNaN(Date.parse(input[field]))) return `${field} must be a valid date`;
  return null;
}

// GET /api/v1/risks
// Returns all risks with optional filtering
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, category, owner, ciaImpact } = req.query;
    const validCiaImpacts = new Set(['Confidentiality', 'Integrity', 'Availability']);

    if (typeof ciaImpact === 'string' && !validCiaImpacts.has(ciaImpact)) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid CIA impact filter' } });
    }

    let risks = await risksRepo.getRisks(workspaceId, {
      status: typeof status === 'string' ? status : undefined,
      category: typeof category === 'string' ? category : undefined,
      ciaImpact: typeof ciaImpact === 'string' ? ciaImpact as 'Confidentiality' | 'Integrity' | 'Availability' : undefined,
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
        message: validationMessage(error) ?? 'Failed to fetch risks',
      },
    };
    res.status(validationMessage(error) ? 400 : 500).json(response);
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
        message: validationMessage(error) ?? 'Failed to fetch risk',
      },
    };
    res.status(validationMessage(error) ? 400 : 500).json(response);
  }
});

// POST /api/v1/risks
// Creates a new risk
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;
    const validCiaImpacts = new Set(['Confidentiality', 'Integrity', 'Availability']);

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

    if (!Array.isArray(input.ciaImpacts) || input.ciaImpacts.length === 0 || input.ciaImpacts.some((value: unknown) => typeof value !== 'string' || !validCiaImpacts.has(value))) {
      const response: ApiResponse<null> = {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'At least one valid CIA impact is required' },
      };
      return res.status(400).json(response);
    }

    if (!VALID_RISK_CATEGORIES.has(input.category) || (input.status !== undefined && !VALID_RISK_STATUSES.has(input.status))) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid risk category or status' } });
    }
    const lifecycleError = validateLifecycle(input);
    if (lifecycleError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: lifecycleError } });

    if (![input.inherentLikelihood, input.inherentImpact, input.residualLikelihood, input.residualImpact].every(isValidRiskScoreValue)) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Inherent and current residual likelihood/impact must be valid integers on the methodology scale' } });
    }
    const newRisk = await risksRepo.createRisk(workspaceId, { ...input, ciaImpacts: [...new Set(input.ciaImpacts)] as Risk['ciaImpacts'] });

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'risk',
        entityId: newRisk.id,
        action: 'create',
        summary: `Created risk "${newRisk.title}"`,
        details: enrichRisk(newRisk),
      }));
      await recordActivity(buildLedgerActivityFromRequest(req, {
        action: 'risk_created',
        category: 'risk',
        targetType: 'risk',
        targetId: newRisk.id,
        targetName: newRisk.title,
        newValue: enrichRisk(newRisk),
        outcome: 'success',
        severity: 'medium',
        notes: `Created risk ${newRisk.title}`,
        source: 'backend',
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
        message: validationMessage(error) ?? 'Failed to create risk',
      },
    };
    res.status(validationMessage(error) ? 400 : 500).json(response);
  }
});

// PATCH /api/v1/risks/:id
// Updates an existing risk
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;
    const validCiaImpacts = new Set(['Confidentiality', 'Integrity', 'Availability']);

    if (updates.status !== undefined && !VALID_RISK_STATUSES.has(updates.status)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid risk status',
        },
      };
      return res.status(400).json(response);
    }

    if (updates.category !== undefined && !VALID_RISK_CATEGORIES.has(updates.category)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid risk category',
        },
      };
      return res.status(400).json(response);
    }
    const scoringFields = [
      ['inherentLikelihood', updates.inherentLikelihood],
      ['inherentImpact', updates.inherentImpact],
      ['residualLikelihood', updates.residualLikelihood],
      ['residualImpact', updates.residualImpact],
    ] as const;

    for (const [fieldName, fieldValue] of scoringFields) {
      if (fieldValue !== undefined && !isValidRiskScoreValue(fieldValue)) {
        const response: ApiResponse<null> = {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: `${fieldName} must be an integer on the methodology scale`,
          },
        };
        return res.status(400).json(response);
      }
    }

    // Fetch existing risk for logging
    const existingRisk = await risksRepo.getRiskById(workspaceId, id);

    if (!existingRisk) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: `Risk with ID ${id} not found` } });
    }

    if (updates.status !== undefined && updates.status !== existingRisk.status && !RISK_TRANSITIONS[existingRisk.status]?.has(updates.status)) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: `Invalid lifecycle transition from ${existingRisk.status} to ${updates.status}` } });
    }

    const lifecycleError = validateLifecycle(updates, existingRisk);
    if (lifecycleError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: lifecycleError } });

    const effectiveCiaImpacts = updates.ciaImpacts ?? existingRisk.ciaImpacts;
    if (!Array.isArray(effectiveCiaImpacts) || effectiveCiaImpacts.length === 0 || effectiveCiaImpacts.some((value: unknown) => typeof value !== 'string' || !validCiaImpacts.has(value))) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'At least one valid CIA impact is required' } });
    }

    if (updates.ciaImpacts !== undefined) {
      updates.ciaImpacts = [...new Set(updates.ciaImpacts)];
    }

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
      await recordActivity(buildLedgerActivityFromRequest(req, {
        action: isStatusChange ? 'risk_status_changed' : 'risk_updated',
        category: 'risk',
        targetType: 'risk',
        targetId: id,
        targetName: updatedRisk.title,
        previousValue: existingRisk ? enrichRisk(existingRisk) : null,
        newValue: enrichRisk(updatedRisk),
        outcome: 'success',
        severity: isStatusChange ? 'medium' : 'info',
        notes: isStatusChange
          ? `Risk status changed from ${existingRisk?.status} to ${updates.status}`
          : `Updated risk ${updatedRisk.title}`,
        source: 'backend',
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
        message: validationMessage(error) ?? 'Failed to update risk',
      },
    };
    res.status(validationMessage(error) ? 400 : 500).json(response);
  }
});

export default router;
