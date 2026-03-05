import { Router } from 'express';
import type {
  ApiResponse,
  ControlFrameworkMapping,
  CreateControlMappingInput,
  ControlFramework,
} from '../types/models.js';
import * as controlsRepo from '../repositories/controlsRepo.js';
import * as controlMappingsRepo from '../repositories/controlMappingsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/control-mappings
// Returns control mappings with optional filtering
// Supports ?controlId=CTR-001 to get mappings for a specific control
// Supports ?framework=ISO27001 to get mappings for a specific framework
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId, framework } = req.query;

    let mappings: ControlFrameworkMapping[] = [];

    if (controlId && typeof controlId === 'string') {
      mappings = await controlMappingsRepo.getMappingsForControl(workspaceId, controlId);
    } else if (framework && typeof framework === 'string') {
      mappings = await controlMappingsRepo.getAllMappings(workspaceId, framework);
    } else {
      mappings = await controlMappingsRepo.getAllMappings(workspaceId);
    }

    const response: ApiResponse<ControlFrameworkMapping[]> = {
      data: mappings,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_MAPPINGS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch control mappings',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/control-mappings/frameworks
// Returns list of available frameworks with control counts
router.get('/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const frameworks: { id: ControlFramework; name: string; controlCount: number }[] = [
      { id: 'ISO27001', name: 'ISO 27001:2022', controlCount: 0 },
      { id: 'ISO27701', name: 'ISO 27701', controlCount: 0 },
      { id: 'SOC1', name: 'SOC 1', controlCount: 0 },
      { id: 'SOC2', name: 'SOC 2', controlCount: 0 },
      { id: 'NIST_800_53', name: 'NIST 800-53', controlCount: 0 },
      { id: 'NIST_CSF', name: 'NIST CSF', controlCount: 0 },
      { id: 'CIS', name: 'CIS Controls', controlCount: 0 },
      { id: 'PCI_DSS', name: 'PCI DSS v4.0', controlCount: 0 },
      { id: 'HIPAA', name: 'HIPAA', controlCount: 0 },
      { id: 'GDPR', name: 'GDPR', controlCount: 0 },
      { id: 'COBIT', name: 'COBIT', controlCount: 0 },
      { id: 'CUSTOM', name: 'Custom', controlCount: 0 },
    ];

    // Count unique mappings per framework
    const allMappings = await controlMappingsRepo.getAllMappings(workspaceId);
    allMappings.forEach(m => {
      const fw = frameworks.find(f => f.id === m.framework);
      if (fw) {
        fw.controlCount++;
      }
    });

    // Filter to only frameworks with mappings
    const activeFrameworks = frameworks.filter(f => f.controlCount > 0);

    const response: ApiResponse<typeof activeFrameworks> = {
      data: activeFrameworks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_FRAMEWORKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch frameworks',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/control-mappings/by-framework/:framework
// Returns all mappings for a specific framework grouped by control
router.get('/by-framework/:framework', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { framework } = req.params;

    const mappings = await controlMappingsRepo.getAllMappings(workspaceId, framework);

    // Group by control with control details
    const controlIds = [...new Set(mappings.map(m => m.controlId))];
    const controlsWithMappings = await Promise.all(
      controlIds.map(async (controlId) => {
        const control = await controlsRepo.getControlById(workspaceId, controlId);
        const controlMaps = mappings.filter(m => m.controlId === controlId);
        return {
          control,
          mappings: controlMaps,
        };
      })
    );

    // Remove any with missing controls
    const filtered = controlsWithMappings.filter(item => item.control);

    const response: ApiResponse<typeof filtered> = {
      data: filtered,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_FRAMEWORK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch framework mappings',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/control-mappings
// Creates a new control mapping
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input: CreateControlMappingInput = req.body;

    // Basic validation
    if (!input.controlId || !input.framework || !input.reference) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'controlId, framework, and reference are required',
        },
      };
      return res.status(400).json(response);
    }

    // Check if control exists
    const control = await controlsRepo.getControlById(workspaceId, input.controlId);
    if (!control) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Control with ID ${input.controlId} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const newMapping = await controlMappingsRepo.createControlMapping(workspaceId, input);

    const response: ApiResponse<ControlFrameworkMapping> = {
      data: newMapping,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_MAPPING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create control mapping',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/control-mappings/:id
// Deletes a control mapping
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const deleted = await controlMappingsRepo.deleteMapping(workspaceId, id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Mapping with ID ${id} not found`,
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
        code: 'DELETE_MAPPING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete control mapping',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
