import { Router } from 'express';
import type { ApiResponse, KpiDefinition, KpiSnapshot } from '../types/models.js';
import * as kpiRepo from '../repositories/kpiRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// ============================================
// KPI Definitions Routes
// ============================================

// GET /api/v1/kpi-definitions
// Returns all KPI definitions (global)
router.get('/definitions', async (_req, res) => {
  try {
    const definitions = await kpiRepo.getKpiDefinitions();

    const response: ApiResponse<KpiDefinition[]> = {
      data: definitions,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_KPI_DEFINITIONS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch KPI definitions',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/kpi-definitions/:id
router.get('/definitions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const definition = await kpiRepo.getKpiDefinitionById(id);

    if (!definition) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `KPI definition with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<KpiDefinition> = {
      data: definition,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_KPI_DEFINITION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch KPI definition',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/kpi-definitions
router.post('/definitions', async (req, res) => {
  try {
    const input = req.body;

    // Basic validation
    if (!input.code || !input.name || !input.category || !input.targetDirection) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Code, name, category, and targetDirection are required',
        },
      };
      return res.status(400).json(response);
    }

    // Validate category
    const validCategories = ['training', 'phishing', 'behavior', 'audit'];
    if (!validCategories.includes(input.category)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    // Validate target direction
    if (!['up', 'down'].includes(input.targetDirection)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'targetDirection must be "up" or "down"',
        },
      };
      return res.status(400).json(response);
    }

    const newDefinition = await kpiRepo.createKpiDefinition({
      code: input.code,
      name: input.name,
      description: input.description,
      category: input.category,
      targetDirection: input.targetDirection,
    });

    const response: ApiResponse<KpiDefinition> = {
      data: newDefinition,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_KPI_DEFINITION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create KPI definition',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// KPI Snapshots Routes
// ============================================

// GET /api/v1/kpi-snapshots
// Returns KPI snapshots for the workspace with optional filters
router.get('/snapshots', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { engagementId, kpiId, kpiCode, periodStart, periodEnd } = req.query;

    const snapshots = await kpiRepo.getKpiSnapshots(workspaceId, {
      engagementId: typeof engagementId === 'string' ? engagementId : undefined,
      kpiId: typeof kpiId === 'string' ? kpiId : undefined,
      kpiCode: typeof kpiCode === 'string' ? kpiCode : undefined,
      periodStart: typeof periodStart === 'string' ? periodStart : undefined,
      periodEnd: typeof periodEnd === 'string' ? periodEnd : undefined,
    });

    const response: ApiResponse<KpiSnapshot[]> = {
      data: snapshots,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_KPI_SNAPSHOTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch KPI snapshots',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/kpi-snapshots/summary/:engagementId
// Returns KPI summary for an engagement
router.get('/snapshots/summary/:engagementId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { engagementId } = req.params;

    const summary = await kpiRepo.getKpiSummaryForEngagement(workspaceId, engagementId);

    const response: ApiResponse<kpiRepo.KpiSummary[]> = {
      data: summary,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_KPI_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch KPI summary',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/kpi-snapshots
router.post('/snapshots', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Basic validation
    if (!input.kpiId || !input.periodStart || !input.periodEnd || input.value === undefined) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'kpiId, periodStart, periodEnd, and value are required',
        },
      };
      return res.status(400).json(response);
    }

    const newSnapshot = await kpiRepo.createKpiSnapshot(workspaceId, {
      engagementId: input.engagementId,
      kpiId: input.kpiId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      value: input.value,
    });

    const response: ApiResponse<KpiSnapshot> = {
      data: newSnapshot,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_KPI_SNAPSHOT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create KPI snapshot',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/kpi-snapshots/:id
router.delete('/snapshots/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const deleted = await kpiRepo.deleteKpiSnapshot(workspaceId, id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `KPI snapshot with ID ${id} not found`,
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
        code: 'DELETE_KPI_SNAPSHOT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete KPI snapshot',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
