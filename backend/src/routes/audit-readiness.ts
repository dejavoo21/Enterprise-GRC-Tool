import { Router } from 'express';
import type { ApiResponse, ReadinessSummary, ReadinessArea, ReadinessItem, ControlFramework } from '../types/models.js';
import { readinessAreas, readinessItems } from '../store/index.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/audit-readiness/summary
// Returns overall readiness summary per framework
router.get('/summary', (_req, res) => {
  try {
    // Group areas by framework
    const frameworkGroups = readinessAreas.reduce((acc, area) => {
      if (!acc[area.framework]) {
        acc[area.framework] = [];
      }
      acc[area.framework].push(area);
      return acc;
    }, {} as Record<ControlFramework, ReadinessArea[]>);

    // Calculate summary for each framework
    const summaries: ReadinessSummary[] = Object.entries(frameworkGroups).map(([framework, areas]) => {
      const totalScore = areas.reduce((sum, a) => sum + a.score, 0);
      const avgScore = Math.round(totalScore / areas.length);

      // Count ready areas and open items (not ready)
      const readyCount = areas.filter(a => a.status === 'ready').length;
      const areaIds = areas.map(a => a.id);
      const relatedItems = readinessItems.filter(item => areaIds.includes(item.areaId));
      const openItemsCount = relatedItems.filter(item => item.status !== 'ready').length;

      return {
        framework: framework as ControlFramework,
        readinessPercent: avgScore,
        totalAreas: areas.length,
        readyAreas: readyCount,
        openItems: openItemsCount,
      };
    });

    const response: ApiResponse<ReadinessSummary[]> = {
      data: summaries,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch readiness summary',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/audit-readiness/areas
// Returns all ReadinessArea, optionally filtered by framework
router.get('/areas', (req, res) => {
  try {
    const { framework } = req.query;

    let areas = readinessAreas;
    if (framework && typeof framework === 'string') {
      areas = readinessAreas.filter(a => a.framework === framework);
    }

    const response: ApiResponse<ReadinessArea[]> = {
      data: areas,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch readiness areas',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/audit-readiness/areas/:id/items
// Returns ReadinessItem for a specific area
router.get('/areas/:id/items', (req, res) => {
  try {
    const { id } = req.params;

    // Check if area exists
    const area = readinessAreas.find(a => a.id === id);
    if (!area) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Area with id ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const items = readinessItems.filter(item => item.areaId === id);

    const response: ApiResponse<ReadinessItem[]> = {
      data: items,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch readiness items',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/audit-readiness/gaps
// Returns all items that are not ready (gaps), optionally filtered by framework
router.get('/gaps', (req, res) => {
  try {
    const { framework } = req.query;

    let gaps = readinessItems.filter(item => item.status !== 'ready');

    // If framework filter provided, filter areas by framework first
    if (framework && typeof framework === 'string') {
      const frameworkAreas = readinessAreas.filter(a => a.framework === framework);
      const frameworkAreaIds = frameworkAreas.map(a => a.id);
      gaps = gaps.filter(item => frameworkAreaIds.includes(item.areaId));
    }

    // Enrich with area info
    const enrichedGaps = gaps.map(item => {
      const area = readinessAreas.find(a => a.id === item.areaId);
      return {
        ...item,
        framework: area?.framework,
        domain: area?.domain,
      };
    });

    const response: ApiResponse<typeof enrichedGaps> = {
      data: enrichedGaps,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch gaps',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
