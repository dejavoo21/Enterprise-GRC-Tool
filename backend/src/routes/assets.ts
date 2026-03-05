import { Router } from 'express';
import type {
  ApiResponse,
  Asset,
  ApiError,
} from '../types/models.js';
import * as assetsRepo from '../repositories/assetsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/assets
// Returns all assets with optional filtering
router.get('/', async (req, res) => {
  console.log('[GET /assets] Request received');
  try {
    console.log('[GET /assets] Getting query parameters');
    const workspaceId = getWorkspaceId(req);
    const { type, criticality, status, owner } = req.query;

    console.log('[GET /assets] Calling assetsRepo.getAssets()');
    let assets = await assetsRepo.getAssets(workspaceId, {
      type: typeof type === 'string' ? type : undefined,
      criticality: typeof criticality === 'string' ? criticality : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    console.log('[GET /assets] Got assets:', assets.length);
    // Client-side owner filter
    if (owner && typeof owner === 'string') {
      assets = assets.filter(a => a.owner.toLowerCase().includes(owner.toLowerCase()));
    }

    const response: ApiResponse<Asset[]> = {
      data: assets,
      error: null,
    };

    console.log('[GET /assets] Sending response');
    res.json(response);
  } catch (error) {
    console.log('[GET /assets] Error caught:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ASSETS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch assets',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/assets/:id
// Returns a single asset by ID
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const asset = await assetsRepo.getAssetById(workspaceId, id);

    if (!asset) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: `Asset with ID ${id} not found`,
        },
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Asset> = {
      data: asset,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ASSET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch asset',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/assets
// Creates a new asset
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      owner,
      businessUnit,
      criticality,
      dataClassification,
      status,
      linkedVendorId,
    } = req.body;

    // Validation
    if (!name || !type || !owner || !businessUnit || !criticality || !dataClassification || !status) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, type, owner, businessUnit, criticality, dataClassification, status',
        },
      };
      res.status(400).json(response);
      return;
    }

    // Create new asset in database
    const workspaceId = getWorkspaceId(req);
    const newAsset = await assetsRepo.createAsset(workspaceId, {
      name,
      description: description || undefined,
      type,
      owner,
      businessUnit,
      criticality,
      dataClassification,
      status,
      linkedVendorId: linkedVendorId || null,
    });

    const response: ApiResponse<Asset> = {
      data: newAsset,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_ASSET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create asset',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
