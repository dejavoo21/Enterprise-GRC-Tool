import { Router } from 'express';
import type { ApiResponse, Framework } from '../types/models.js';
import * as frameworksRepo from '../repositories/frameworksRepo.js';

const router = Router();

// GET /api/v1/frameworks
// Returns all frameworks with optional filtering
// Supports ?isDefault=true to filter default frameworks only
// Supports ?isAiHealthcare=true to filter AI/Healthcare frameworks
// Supports ?isPrivacy=true to filter privacy frameworks
// Supports ?category=security to filter by category
router.get('/', async (req, res) => {
  try {
    const { isDefault, isAiHealthcare, isPrivacy, category } = req.query;

    const filters: frameworksRepo.FrameworkFilter = {};

    if (isDefault !== undefined) {
      filters.isDefault = isDefault === 'true';
    }
    if (isAiHealthcare !== undefined) {
      filters.isAiHealthcare = isAiHealthcare === 'true';
    }
    if (isPrivacy !== undefined) {
      filters.isPrivacy = isPrivacy === 'true';
    }
    if (category && typeof category === 'string') {
      filters.category = category;
    }

    const frameworks = await frameworksRepo.getFrameworks(filters);

    const response: ApiResponse<Framework[]> = {
      data: frameworks,
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

// GET /api/v1/frameworks/:code
// Returns a single framework by its code
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const framework = await frameworksRepo.getFrameworkByCode(code);

    if (!framework) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Framework with code ${code} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Framework> = {
      data: framework,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_FRAMEWORK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch framework',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
