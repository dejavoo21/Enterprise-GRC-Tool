import { Router } from 'express';
import type {
  ApiResponse,
  Vendor,
  ApiError,
} from '../types/models.js';
import * as vendorsRepo from '../repositories/vendorsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { recordActivity, buildActivityFromRequest } from '../services/activityLedger/activityLedger.js';
import type { NextFunction, Request, Response } from 'express';

function requireTransitionPermission(req: Request, res: Response, next: NextFunction) {
  return requirePermission('Vendors', req.body?.status === 'active' ? 'approve' : 'edit')(req, res, next);
}

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

router.get('/:id/history', async (req, res) => {
  const workspaceId = getWorkspaceId(req);
  const vendor = await vendorsRepo.getVendorById(workspaceId, req.params.id);
  if (!vendor) return res.status(404).json({ data: null, error: { code: 'VENDOR_NOT_FOUND', message: 'Supplier not found.' } });
  res.json({ data: await vendorsRepo.getVendorHistory(workspaceId, req.params.id), error: null });
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
      businessService,
      criticality,
      informationAccess,
      businessLocations,
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
      businessService,
      criticality,
      informationAccess,
      businessLocations: businessLocations || [],
    });

    await recordActivity(buildActivityFromRequest(req, { action: 'supplier_created', category: 'vendor', targetType: 'vendor', targetId: newVendor.id, targetName: newVendor.name, outcome: 'success', source: 'backend' }));

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

router.patch('/:id', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const current = await vendorsRepo.getVendorById(workspaceId, req.params.id);
    if (!current) return res.status(404).json({ data: null, error: { code: 'VENDOR_NOT_FOUND', message: 'Supplier not found.' } });
    const vendor = await vendorsRepo.updateVendor(workspaceId, req.params.id, req.body);
    await recordActivity(buildActivityFromRequest(req, { action: 'supplier_updated', category: 'vendor', targetType: 'vendor', targetId: req.params.id, targetName: vendor?.name, previousValue: current, newValue: vendor, outcome: 'success', source: 'backend' }));
    res.json({ data: vendor, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { code: 'UPDATE_VENDOR_ERROR', message: error instanceof Error ? error.message : 'Unable to update supplier.' } });
  }
});

router.post('/:id/transition', requireTransitionPermission, async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const current = await vendorsRepo.getVendorById(workspaceId, req.params.id);
    if (!current) return res.status(404).json({ data: null, error: { code: 'VENDOR_NOT_FOUND', message: 'Supplier not found.' } });
    const vendor = await vendorsRepo.transitionVendor(workspaceId, req.params.id, req.body.status, req.authUser!.userId, req.body.reason);
    await recordActivity(buildActivityFromRequest(req, { action: 'supplier_status_changed', category: 'vendor', targetType: 'vendor', targetId: req.params.id, targetName: vendor?.name, previousValue: current.status, newValue: vendor?.status, outcome: 'success', source: 'backend', notes: String(req.body.reason || '') }));
    res.json({ data: vendor, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'SUPPLIER_TRANSITION_FAILED';
    res.status(409).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Unable to change supplier status.' } });
  }
});

export default router;
