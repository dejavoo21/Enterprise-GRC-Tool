import { Router } from 'express';
import type {
  ApiResponse,
  Vendor,
  ApiError,
} from '../types/models.js';
import * as vendorsRepo from '../repositories/vendorsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/vendors
// Returns all vendors with optional filtering
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { riskLevel, status, owner } = req.query;

    let vendors = await vendorsRepo.getVendors(workspaceId, {
      riskLevel: typeof riskLevel === 'string' ? riskLevel : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    // Client-side owner filter (since DB doesn't store this as a simple column filter)
    if (owner && typeof owner === 'string') {
      vendors = vendors.filter(v => v.owner.toLowerCase().includes(owner.toLowerCase()));
    }

    const response: ApiResponse<Vendor[]> = {
      data: vendors,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_VENDORS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch vendors',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/vendors/:id
// Returns a single vendor by ID
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const vendor = await vendorsRepo.getVendorById(workspaceId, id);

    if (!vendor) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VENDOR_NOT_FOUND',
          message: `Vendor with ID ${id} not found`,
        },
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Vendor> = {
      data: vendor,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_VENDOR_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch vendor',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/vendors
// Creates a new vendor
router.post('/', async (req, res) => {
  try {
    const {
      name,
      category,
      owner,
      riskLevel,
      status,
      nextReviewDate,
      hasDPA,
      regions,
      dataTypesProcessed,
    } = req.body;

    // Validation
    if (!name || !category || !owner || !riskLevel || !status || !nextReviewDate) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, category, owner, riskLevel, status, nextReviewDate',
        },
      };
      res.status(400).json(response);
      return;
    }

    // Create new vendor in database
    const workspaceId = getWorkspaceId(req);
    const newVendor = await vendorsRepo.createVendor(workspaceId, {
      name,
      category,
      owner,
      riskLevel,
      status,
      nextReviewDate,
      hasDPA: hasDPA || false,
      regions: regions || [],
      dataTypesProcessed: dataTypesProcessed || [],
    });

    const response: ApiResponse<Vendor> = {
      data: newVendor,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_VENDOR_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create vendor',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
