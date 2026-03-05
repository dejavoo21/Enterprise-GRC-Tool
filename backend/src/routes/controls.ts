import { Router } from 'express';
import type {
  ApiResponse,
  Control,
  ControlFrameworkMapping,
  ControlWithFrameworks,
  ControlFramework,
} from '../types/models.js';
import * as controlsRepo from '../repositories/controlsRepo.js';
import * as controlMappingsRepo from '../repositories/controlMappingsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';

const router = Router();

// Helper to enrich control with frameworks array
async function enrichControl(workspaceId: string, control: Control): Promise<ControlWithFrameworks> {
  const frameworks = (await controlMappingsRepo.getFrameworksForControl(workspaceId, control.id)) as ControlFramework[];
  return {
    ...control,
    frameworks,
  };
}

// GET /api/v1/controls
// Returns all controls with optional filtering
// Supports ?framework=ISO27001 to filter controls with that framework mapping
// Supports ?status=implemented to filter by status
// Supports ?domain=Access+Control to filter by domain
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, domain, owner, framework } = req.query;

    let controls = await controlsRepo.getControls(workspaceId, {
      status: typeof status === 'string' ? status : undefined,
      domain: typeof domain === 'string' ? domain : undefined,
    });

    // Client-side owner filter
    if (owner && typeof owner === 'string') {
      controls = controls.filter(c => c.owner.toLowerCase().includes(owner.toLowerCase()));
    }

    // Framework filter
    if (framework && typeof framework === 'string') {
      const controlIdsForFramework = (await controlMappingsRepo.getAllMappings(workspaceId, framework))
        .map(m => m.controlId);
      controls = controls.filter(c => controlIdsForFramework.includes(c.id));
    }

    // Enrich controls with frameworks array
    const enrichedControls = await Promise.all(controls.map(c => enrichControl(workspaceId, c)));

    const response: ApiResponse<ControlWithFrameworks[]> = {
      data: enrichedControls,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_CONTROLS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch controls',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/controls/summary
// Returns summary statistics for controls
router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const allControls = await controlsRepo.getControls(workspaceId);
    const allMappings = await controlMappingsRepo.getAllMappings(workspaceId);

    const totalControls = allControls.length;

    // Count by status
    const implemented = allControls.filter(c => c.status === 'implemented').length;
    const inProgress = allControls.filter(c => c.status === 'in_progress').length;
    const notImplemented = allControls.filter(c => c.status === 'not_implemented').length;
    const notApplicable = allControls.filter(c => c.status === 'not_applicable').length;

    // Count by framework
    const frameworkCounts: Record<string, number> = {};
    allMappings.forEach(m => {
      frameworkCounts[m.framework] = (frameworkCounts[m.framework] || 0) + 1;
    });

    // Get unique frameworks
    const frameworks = [...new Set(allMappings.map(m => m.framework))];

    // Get unique domains
    const domains = [...new Set(allControls.map(c => c.domain).filter(Boolean))] as string[];

    const response: ApiResponse<{
      totalControls: number;
      statusCounts: {
        implemented: number;
        inProgress: number;
        notImplemented: number;
        notApplicable: number;
      };
      frameworkCounts: Record<string, number>;
      frameworks: string[];
      domains: string[];
    }> = {
      data: {
        totalControls,
        statusCounts: {
          implemented,
          inProgress,
          notImplemented,
          notApplicable,
        },
        frameworkCounts,
        frameworks,
        domains,
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch control summary',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/controls/:id
// Returns a single control by ID with frameworks array
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const control = await controlsRepo.getControlById(workspaceId, id);

    if (!control) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Control with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ControlWithFrameworks> = {
        data: await enrichControl(workspaceId, control),
        error: null,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'FETCH_CONTROL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch control',
        },
      };
      res.status(500).json(response);
    }
});

// POST /api/v1/controls
// Creates a new control
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Basic validation
    if (!input.title || !input.owner) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and owner are required',
        },
      };
      return res.status(400).json(response);
    }

    const newControl = await controlsRepo.createControl(workspaceId, {
      title: input.title,
      description: input.description || '',
      owner: input.owner,
      status: input.status || 'not_implemented',
      domain: input.domain,
      primaryFramework: input.primaryFramework,
    });

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'control',
        entityId: newControl.id,
        action: 'create',
        summary: `Created control "${newControl.title}"`,
        details: newControl,
      }));
    }

    const response: ApiResponse<ControlWithFrameworks> = {
      data: await enrichControl(workspaceId, newControl),
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_CONTROL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create control',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/controls/:id
// Updates an existing control
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    // Fetch existing control for logging
    const existingControl = await controlsRepo.getControlById(workspaceId, id);

    const updatedControl = await controlsRepo.updateControl(workspaceId, id, updates);

    if (!updatedControl) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Control with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      const isStatusChange = existingControl && updates.status && existingControl.status !== updates.status;
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'control',
        entityId: id,
        action: isStatusChange ? 'status_change' : 'update',
        summary: isStatusChange
          ? `Control "${updatedControl.title}" status changed from ${existingControl.status} to ${updates.status}`
          : `Updated control "${updatedControl.title}"`,
        details: { before: existingControl, after: updatedControl },
      }));
    }

    const response: ApiResponse<ControlWithFrameworks> = {
      data: await enrichControl(workspaceId, updatedControl),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_CONTROL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update control',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
