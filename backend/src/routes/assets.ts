import { Request, Router } from 'express';
import type {
  ApiResponse,
  Asset,
  AssetLifecycleEvent,
  AssetLocationHistoryEntry,
} from '../types/models.js';
import * as assetsRepo from '../repositories/assetsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { buildLogInputFromRequest, logActivity } from '../services/activityLogService.js';

const router = Router();

type AssetDetailResponse = {
  asset: Asset;
  events: AssetLifecycleEvent[];
  locationHistory: AssetLocationHistoryEntry[];
};

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim();
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

function parseAssetTagFromScan(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const customMatch = trimmed.match(/^grc-asset:\/\/asset\/([A-Z0-9-]+)$/i);
  if (customMatch) return customMatch[1].toUpperCase();

  const queryMatch = trimmed.match(/[?&]assetTag=([A-Z0-9-]+)/i);
  if (queryMatch) return queryMatch[1].toUpperCase();

  const rawTagMatch = trimmed.match(/^(AST-[A-Z0-9-]+)$/i);
  if (rawTagMatch) return rawTagMatch[1].toUpperCase();

  return null;
}

async function buildAssetDetail(workspaceId: string, asset: Asset): Promise<AssetDetailResponse> {
  const [events, locationHistory] = await Promise.all([
    assetsRepo.getAssetEvents(workspaceId, asset.id),
    assetsRepo.getAssetLocationHistory(workspaceId, asset.id),
  ]);

  return {
    asset,
    events,
    locationHistory,
  };
}

router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { type, criticality, status, owner } = req.query;

    let assets = await assetsRepo.getAssets(workspaceId, {
      type: typeof type === 'string' ? type : undefined,
      criticality: typeof criticality === 'string' ? criticality : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    if (owner && typeof owner === 'string') {
      assets = assets.filter((asset) => asset.owner.toLowerCase().includes(owner.toLowerCase()));
    }

    const response: ApiResponse<Asset[]> = {
      data: assets,
      error: null,
    };

    res.json(response);
  } catch (error) {
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

router.post('/scan', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { code, device } = req.body;

    if (!code || typeof code !== 'string') {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Scan payload is required',
        },
      };
      res.status(400).json(response);
      return;
    }

    const assetTag = parseAssetTagFromScan(code);
    if (!assetTag) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'INVALID_SCAN',
          message: 'The scanned code is not a recognized asset QR code',
        },
      };
      res.status(400).json(response);
      return;
    }

    const asset = await assetsRepo.getAssetByTag(workspaceId, assetTag);
    if (!asset) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: `No asset found for ${assetTag}`,
        },
      };
      res.status(404).json(response);
      return;
    }

    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'scanned',
      summary: `${req.authUser?.email || 'Unknown user'} scanned ${asset.assetTag}`,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: typeof device === 'string' ? device : req.get('user-agent'),
      ipAddress: getClientIp(req),
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: asset.id,
        action: 'other',
        summary: `${req.authUser.email} scanned asset ${asset.assetTag}`,
        details: {
          assetTag: asset.assetTag,
          device: typeof device === 'string' ? device : req.get('user-agent'),
          ipAddress: getClientIp(req),
        },
      }));
    }

    const response: ApiResponse<AssetDetailResponse> = {
      data: await buildAssetDetail(workspaceId, asset),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'SCAN_ASSET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to scan asset',
      },
    };
    res.status(500).json(response);
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const events = await assetsRepo.getAssetEvents(workspaceId, req.params.id);

    const response: ApiResponse<AssetLifecycleEvent[]> = {
      data: events,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ASSET_EVENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch asset events',
      },
    };
    res.status(500).json(response);
  }
});

router.get('/:id/locations', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const locationHistory = await assetsRepo.getAssetLocationHistory(workspaceId, req.params.id);

    const response: ApiResponse<AssetLocationHistoryEntry[]> = {
      data: locationHistory,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ASSET_LOCATIONS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch asset locations',
      },
    };
    res.status(500).json(response);
  }
});

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

    const response: ApiResponse<AssetDetailResponse> = {
      data: await buildAssetDetail(workspaceId, asset),
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
      notes,
    } = req.body;

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
      notes: notes || undefined,
    });

    await assetsRepo.createAssetEvent(workspaceId, newAsset.id, {
      eventType: 'created',
      summary: `${req.authUser?.email || 'Unknown user'} created ${newAsset.assetTag}`,
      notes: notes || undefined,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: newAsset.id,
        action: 'create',
        summary: `${req.authUser.email} created asset ${newAsset.assetTag}`,
        details: {
          assetTag: newAsset.assetTag,
          type: newAsset.type,
          criticality: newAsset.criticality,
        },
      }));
    }

    const response: ApiResponse<AssetDetailResponse> = {
      data: await buildAssetDetail(workspaceId, newAsset),
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

router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, owner, notes } = req.body;

    if (status === undefined && owner === undefined && notes === undefined) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one of status, owner, or notes must be provided',
        },
      };
      res.status(400).json(response);
      return;
    }

    const updatedAsset = await assetsRepo.updateAssetOperationalState(workspaceId, req.params.id, {
      status,
      owner,
      notes,
    });

    if (!updatedAsset) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found',
        },
      };
      res.status(404).json(response);
      return;
    }

    const eventType = status === 'retired' ? 'retired' : 'updated';
    const summary = status === 'retired'
      ? `${req.authUser?.email || 'Unknown user'} retired ${updatedAsset.assetTag}`
      : `${req.authUser?.email || 'Unknown user'} updated ${updatedAsset.assetTag}`;

    await assetsRepo.createAssetEvent(workspaceId, updatedAsset.id, {
      eventType,
      summary,
      notes,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: updatedAsset.id,
        action: status === 'retired' ? 'status_change' : 'update',
        summary,
        details: { status, owner, notes },
      }));
    }

    const response: ApiResponse<AssetDetailResponse> = {
      data: await buildAssetDetail(workspaceId, updatedAsset),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_ASSET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update asset',
      },
    };
    res.status(500).json(response);
  }
});

router.post('/:id/location', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { latitude, longitude, capturedAt, address, notes, device, source } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Latitude and longitude are required',
        },
      };
      res.status(400).json(response);
      return;
    }

    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!asset) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found',
        },
      };
      res.status(404).json(response);
      return;
    }

    const location = await assetsRepo.createAssetLocation(workspaceId, asset.id, {
      latitude,
      longitude,
      capturedAt,
      address,
      notes,
      capturedByUserId: req.authUser?.userId,
      capturedByEmail: req.authUser?.email,
      device: typeof device === 'string' ? device : req.get('user-agent'),
      source: typeof source === 'string' ? source : 'browser_geolocation',
    });

    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'location_updated',
      summary: `${req.authUser?.email || 'Unknown user'} updated location for ${asset.assetTag}`,
      notes,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: typeof device === 'string' ? device : req.get('user-agent'),
      ipAddress: getClientIp(req),
      latitude,
      longitude,
      address,
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: asset.id,
        action: 'update',
        summary: `${req.authUser.email} updated location for ${asset.assetTag}`,
        details: {
          latitude,
          longitude,
          address,
          device: typeof device === 'string' ? device : req.get('user-agent'),
        },
      }));
    }

    const refreshedAsset = await assetsRepo.getAssetById(workspaceId, asset.id);

    const response: ApiResponse<{ asset: Asset | null; location: AssetLocationHistoryEntry }> = {
      data: {
        asset: refreshedAsset,
        location,
      },
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CAPTURE_LOCATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to capture location',
      },
    };
    res.status(500).json(response);
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);

    if (!asset) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found',
        },
      };
      res.status(404).json(response);
      return;
    }

    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'verified',
      summary: `${req.authUser?.email || 'Unknown user'} verified ${asset.assetTag}`,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: asset.id,
        action: 'review',
        summary: `${req.authUser.email} verified asset ${asset.assetTag}`,
        details: {
          notes: req.body?.notes,
        },
      }));
    }

    const response: ApiResponse<AssetDetailResponse> = {
      data: await buildAssetDetail(workspaceId, asset),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'VERIFY_ASSET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to verify asset',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
