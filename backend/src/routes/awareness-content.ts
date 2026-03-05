import { Router } from 'express';
import type { ApiResponse, AwarenessContent, AwarenessContentType } from '../types/models.js';
import * as awarenessContentRepo from '../repositories/awarenessContentRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/awareness-content
// Returns all awareness content visible to the current workspace
// (global content + workspace-specific content)
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { type, frameworkCode, search } = req.query;

    const content = await awarenessContentRepo.getAwarenessContent(workspaceId, {
      type: typeof type === 'string' ? type as AwarenessContentType : undefined,
      frameworkCode: typeof frameworkCode === 'string' ? frameworkCode : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    const response: ApiResponse<AwarenessContent[]> = {
      data: content,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_AWARENESS_CONTENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch awareness content',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/awareness-content/types
// Returns available content types for filtering
router.get('/types', (_req, res) => {
  const types: AwarenessContentType[] = [
    'proposal_template',
    'sow_template',
    'breach_report',
    'regulatory_case',
    'incident_summary',
    'risk_assessment',
    'audit_finding_template',
    'statistic',
    'board_expectation',
    'training_deck',
    'outline',
  ];

  const response: ApiResponse<AwarenessContentType[]> = {
    data: types,
    error: null,
  };

  res.json(response);
});

// GET /api/v1/awareness-content/:id
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const content = await awarenessContentRepo.getAwarenessContentById(workspaceId, id);

    if (!content) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Awareness content with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Get frameworks for this content
    const frameworkCodes = await awarenessContentRepo.getAwarenessContentFrameworks(id);
    content.frameworkCodes = frameworkCodes;

    const response: ApiResponse<AwarenessContent> = {
      data: content,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_AWARENESS_CONTENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch awareness content',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/awareness-content
// Creates new workspace-specific awareness content
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Basic validation
    if (!input.title || !input.type) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and type are required',
        },
      };
      return res.status(400).json(response);
    }

    // Validate content type
    const validTypes = [
      'proposal_template',
      'sow_template',
      'breach_report',
      'regulatory_case',
      'incident_summary',
      'risk_assessment',
      'audit_finding_template',
      'statistic',
      'board_expectation',
      'training_deck',
      'outline',
    ];
    if (!validTypes.includes(input.type)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid content type. Must be one of: ${validTypes.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    // Validate source if provided
    if (input.source) {
      const validSources = ['internal', 'external', 'regulator', 'news'];
      if (!validSources.includes(input.source)) {
        const response: ApiResponse<null> = {
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid source. Must be one of: ${validSources.join(', ')}`,
          },
        };
        return res.status(400).json(response);
      }
    }

    // Create as workspace-specific content (not global)
    const newContent = await awarenessContentRepo.createAwarenessContent(workspaceId, {
      type: input.type,
      title: input.title,
      summary: input.summary,
      source: input.source,
      linkUrl: input.linkUrl,
      frameworkCodes: input.frameworkCodes || [],
    });

    const response: ApiResponse<AwarenessContent> = {
      data: newContent,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_AWARENESS_CONTENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create awareness content',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/awareness-content/:id
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    const updatedContent = await awarenessContentRepo.updateAwarenessContent(workspaceId, id, updates);

    if (!updatedContent) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Awareness content with ID ${id} not found or is global (cannot be updated)`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<AwarenessContent> = {
      data: updatedContent,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_AWARENESS_CONTENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update awareness content',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/awareness-content/:id
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const deleted = await awarenessContentRepo.deleteAwarenessContent(workspaceId, id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Awareness content with ID ${id} not found or is global (cannot be deleted)`,
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
        code: 'DELETE_AWARENESS_CONTENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete awareness content',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Content-Framework Relationship Endpoints
// ============================================

// GET /api/v1/awareness-content/:id/frameworks
router.get('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    // Verify content exists
    const content = await awarenessContentRepo.getAwarenessContentById(workspaceId, id);
    if (!content) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Awareness content with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const frameworks = await awarenessContentRepo.getAwarenessContentFrameworks(id);

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
        message: error instanceof Error ? error.message : 'Failed to fetch content frameworks',
      },
    };
    res.status(500).json(response);
  }
});

// PUT /api/v1/awareness-content/:id/frameworks
router.put('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { frameworkCodes } = req.body;

    // Verify content exists
    const content = await awarenessContentRepo.getAwarenessContentById(workspaceId, id);
    if (!content) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Awareness content with ID ${id} not found`,
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

    await awarenessContentRepo.setAwarenessContentFrameworks(id, frameworkCodes);
    const updatedFrameworks = await awarenessContentRepo.getAwarenessContentFrameworks(id);

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
        message: error instanceof Error ? error.message : 'Failed to set content frameworks',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
