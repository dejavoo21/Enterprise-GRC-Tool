import { Request, Router } from 'express';
import type {
  ApiResponse,
  Asset,
  AssetLifecycleEvent,
  AssetLocationHistoryEntry,
  AssetRelationship,
  AssetReviewRecord,
} from '../types/models.js';
import * as assetsRepo from '../repositories/assetsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { buildLogInputFromRequest, logActivity } from '../services/activityLogService.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';

const router = Router();

type AssetDetailResponse = {
  asset: Asset;
  events: AssetLifecycleEvent[];
  locationHistory: AssetLocationHistoryEntry[];
  relationships: AssetRelationship[];
  reviews: AssetReviewRecord[];
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

function getEventTypeForLifecycleStatus(status?: string): AssetLifecycleEvent['eventType'] {
  if (status === 'assigned') return 'assigned';
  if (status === 'retired') return 'retired';
  if (status === 'disposed') return 'disposed';
  return 'status_changed';
}

async function buildAssetDetail(workspaceId: string, asset: Asset): Promise<AssetDetailResponse> {
  const [events, locationHistory, relationships, reviews] = await Promise.all([
    assetsRepo.getAssetEvents(workspaceId, asset.id),
    assetsRepo.getAssetLocationHistory(workspaceId, asset.id),
    assetsRepo.getAssetRelationships(workspaceId, asset.id),
    assetsRepo.getAssetReviews(workspaceId, asset.id),
  ]);

  return {
    asset,
    events,
    locationHistory,
    relationships,
    reviews,
  };
}

async function logAssetLedger(
  req: Request,
  asset: Asset,
  action: string,
  notes: string,
  newValue?: unknown,
  previousValue?: unknown,
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical' = 'medium',
) {
  await recordActivity(buildActivityFromRequest(req, {
    action,
    category: 'asset',
    targetType: 'asset',
    targetId: asset.id,
    targetName: asset.assetTag,
    previousValue,
    newValue,
    outcome: 'success',
    severity,
    source: 'backend',
    notes,
  }));
}

router.get('/dashboard', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const response: ApiResponse<Awaited<ReturnType<typeof assetsRepo.getAssetDashboard>>> = {
      data: await assetsRepo.getAssetDashboard(workspaceId),
      error: null,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_ASSET_DASHBOARD_ERROR',
        message: error instanceof Error ? error.message : 'Failed to load asset dashboard',
      },
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { type, criticality, status, owner, classification, search, lifecycleStatus } = req.query;

    const assets = await assetsRepo.getAssets(workspaceId, {
      type: typeof type === 'string' ? type : undefined,
      criticality: typeof criticality === 'string' ? criticality : undefined,
      status: typeof status === 'string' ? status : undefined,
      owner: typeof owner === 'string' ? owner : undefined,
      classification: typeof classification === 'string' ? classification : undefined,
      search: typeof search === 'string' ? search : undefined,
      lifecycleStatus: typeof lifecycleStatus === 'string' ? lifecycleStatus : undefined,
    });

    const response: ApiResponse<Asset[]> = { data: assets, error: null };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_ASSETS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch assets',
      },
    });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { assetIds, owner, location, classification, lifecycleStatus, status } = req.body || {};

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'assetIds is required for bulk operations' },
      });
    }

    const updated = await assetsRepo.bulkUpdateAssets(workspaceId, {
      assetIds,
      owner,
      location,
      classification,
      lifecycleStatus,
      status,
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: assetIds.join(','),
        action: 'update',
        summary: `${req.authUser.email} ran a bulk asset update`,
        details: { owner, location, classification, lifecycleStatus, status, count: updated.length },
      }));
    }

    for (const asset of updated) {
      await logAssetLedger(req, asset, 'asset.bulk_updated', 'Asset updated through bulk operation.', {
        owner,
        location,
        classification,
        lifecycleStatus,
        status,
      });
    }

    const response: ApiResponse<Asset[]> = { data: updated, error: null };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'BULK_ASSET_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to run bulk asset update',
      },
    });
  }
});

router.post('/scan', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { code, device } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Scan payload is required' },
      });
    }

    const assetTag = parseAssetTagFromScan(code);
    if (!assetTag) {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_SCAN', message: 'The scanned code is not a recognized asset QR or barcode value' },
      });
    }

    const asset = await assetsRepo.getAssetByTag(workspaceId, assetTag);
    if (!asset) {
      return res.status(404).json({
        data: null,
        error: { code: 'ASSET_NOT_FOUND', message: `No asset found for ${assetTag}` },
      });
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
        details: { assetTag: asset.assetTag, device: typeof device === 'string' ? device : req.get('user-agent') },
      }));
    }

    await logAssetLedger(req, asset, 'asset.scanned', 'Asset scanned via QR or barcode.', {
      device: typeof device === 'string' ? device : req.get('user-agent'),
    });

    const response: ApiResponse<AssetDetailResponse> = {
      data: await buildAssetDetail(workspaceId, asset),
      error: null,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'SCAN_ASSET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to scan asset',
      },
    });
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const response: ApiResponse<AssetLifecycleEvent[]> = {
      data: await assetsRepo.getAssetEvents(getWorkspaceId(req), req.params.id),
      error: null,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'FETCH_ASSET_EVENTS_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch asset events' } });
  }
});

router.get('/:id/locations', async (req, res) => {
  try {
    const response: ApiResponse<AssetLocationHistoryEntry[]> = {
      data: await assetsRepo.getAssetLocationHistory(getWorkspaceId(req), req.params.id),
      error: null,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'FETCH_ASSET_LOCATIONS_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch asset locations' } });
  }
});

router.get('/:id/relationships', async (req, res) => {
  try {
    const response: ApiResponse<AssetRelationship[]> = {
      data: await assetsRepo.getAssetRelationships(getWorkspaceId(req), req.params.id),
      error: null,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'FETCH_ASSET_RELATIONSHIPS_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch asset relationships' } });
  }
});

router.get('/:id/reviews', async (req, res) => {
  try {
    const response: ApiResponse<AssetReviewRecord[]> = {
      data: await assetsRepo.getAssetReviews(getWorkspaceId(req), req.params.id),
      error: null,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'FETCH_ASSET_REVIEWS_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch asset reviews' } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: `Asset with ID ${req.params.id} not found` } });
    }
    const response: ApiResponse<AssetDetailResponse> = { data: await buildAssetDetail(workspaceId, asset), error: null };
    res.json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'FETCH_ASSET_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch asset' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, owner, criticality } = req.body || {};
    if (!name || !type || !owner || !criticality) {
      return res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, type, owner, criticality' },
      });
    }

    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.createAsset(workspaceId, req.body);

    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'created',
      summary: `${req.authUser?.email || 'Unknown user'} created ${asset.assetTag}`,
      notes: asset.notes,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });
    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'qr_generated',
      summary: `${req.authUser?.email || 'Unknown user'} generated QR for ${asset.assetTag}`,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });
    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'barcode_generated',
      summary: `${req.authUser?.email || 'Unknown user'} generated ${asset.barcodeType || 'code128'} barcode for ${asset.assetTag}`,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: asset.id,
        action: 'create',
        summary: `${req.authUser.email} created asset ${asset.assetTag}`,
        details: {
          assetTag: asset.assetTag,
          type: asset.type,
          criticality: asset.criticality,
          classification: asset.classification,
          lifecycleStatus: asset.lifecycleStatus,
        },
      }));
    }

    await logAssetLedger(req, asset, 'asset.created', 'Enterprise asset created.', asset, null, 'medium');

    const response: ApiResponse<AssetDetailResponse> = { data: await buildAssetDetail(workspaceId, asset), error: null };
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'CREATE_ASSET_ERROR', message: error instanceof Error ? error.message : 'Failed to create asset' } });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const existingAsset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!existingAsset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }

    const updatedAsset = await assetsRepo.updateAsset(workspaceId, req.params.id, req.body || {});
    if (!updatedAsset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }

    const lifecycleEvent = getEventTypeForLifecycleStatus(req.body?.lifecycleStatus || req.body?.status);
    await assetsRepo.createAssetEvent(workspaceId, updatedAsset.id, {
      eventType: lifecycleEvent,
      summary: `${req.authUser?.email || 'Unknown user'} updated ${updatedAsset.assetTag}`,
      notes: req.body?.notes,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: updatedAsset.id,
        action: 'update',
        summary: `${req.authUser.email} updated asset ${updatedAsset.assetTag}`,
        details: req.body || {},
      }));
    }

    await logAssetLedger(req, updatedAsset, 'asset.updated', 'Enterprise asset record updated.', updatedAsset, existingAsset, 'medium');

    const response: ApiResponse<AssetDetailResponse> = { data: await buildAssetDetail(workspaceId, updatedAsset), error: null };
    res.json(response);
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'UPDATE_ASSET_ERROR', message: error instanceof Error ? error.message : 'Failed to update asset' } });
  }
});

router.post('/:id/location', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { latitude, longitude } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Latitude and longitude are required' } });
    }

    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }

    const location = await assetsRepo.createAssetLocation(workspaceId, asset.id, {
      ...req.body,
      capturedByUserId: req.authUser?.userId,
      capturedByEmail: req.authUser?.email,
      device: typeof req.body?.device === 'string' ? req.body.device : req.get('user-agent'),
      source: typeof req.body?.source === 'string' ? req.body.source : 'browser_geolocation',
    });

    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'location_updated',
      summary: `${req.authUser?.email || 'Unknown user'} updated location for ${asset.assetTag}`,
      notes: req.body?.notes,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: typeof req.body?.device === 'string' ? req.body.device : req.get('user-agent'),
      ipAddress: getClientIp(req),
      latitude,
      longitude,
      address: req.body?.address,
      building: req.body?.building,
      floor: req.body?.floor,
      room: req.body?.room,
      rack: req.body?.rack,
    });

    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'asset',
        entityId: asset.id,
        action: 'update',
        summary: `${req.authUser.email} updated location for ${asset.assetTag}`,
        details: req.body || {},
      }));
    }

    const refreshedAsset = await assetsRepo.getAssetById(workspaceId, asset.id);
    if (refreshedAsset) {
      await logAssetLedger(req, refreshedAsset, 'asset.location_updated', 'Asset location updated.', location);
    }

    res.status(201).json({ data: { asset: refreshedAsset, location }, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'CAPTURE_LOCATION_ERROR', message: error instanceof Error ? error.message : 'Failed to capture location' } });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
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
        details: { notes: req.body?.notes },
      }));
    }

    await logAssetLedger(req, asset, 'asset.verified', 'Asset verification recorded.', { notes: req.body?.notes }, null, 'low');
    res.json({ data: await buildAssetDetail(workspaceId, asset), error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'VERIFY_ASSET_ERROR', message: error instanceof Error ? error.message : 'Failed to verify asset' } });
  }
});

router.post('/:id/reviews', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }

    if (!req.body?.reviewType || !req.body?.reviewer) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'reviewType and reviewer are required' } });
    }

    const review = await assetsRepo.createAssetReview(workspaceId, asset.id, req.body);
    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'review_completed',
      summary: `${req.authUser?.email || review.reviewer} completed ${review.reviewType} review for ${asset.assetTag}`,
      notes: review.notes,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });
    await logAssetLedger(req, asset, 'asset.review_completed', 'Asset review completed.', review);
    res.status(201).json({ data: review, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'CREATE_ASSET_REVIEW_ERROR', message: error instanceof Error ? error.message : 'Failed to create asset review' } });
  }
});

router.post('/:id/relationships', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.getAssetById(workspaceId, req.params.id);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }
    const { relationshipType, targetId, targetName } = req.body || {};
    if (!relationshipType || !targetId || !targetName) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'relationshipType, targetId, and targetName are required' } });
    }

    const relationship = await assetsRepo.createAssetRelationship(workspaceId, asset.id, { relationshipType, targetId, targetName });
    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: relationshipType === 'risk' ? 'linked_to_risk' : 'updated',
      summary: `${req.authUser?.email || 'Unknown user'} linked ${asset.assetTag} to ${targetName}`,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });
    await logAssetLedger(req, asset, 'asset.relationship_linked', 'Asset relationship linked.', relationship);
    res.status(201).json({ data: relationship, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'CREATE_ASSET_RELATIONSHIP_ERROR', message: error instanceof Error ? error.message : 'Failed to create asset relationship' } });
  }
});

router.post('/:id/qrcode/regenerate', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.regenerateAssetQrCode(workspaceId, req.params.id);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }
    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'qr_generated',
      summary: `${req.authUser?.email || 'Unknown user'} generated QR for ${asset.assetTag}`,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });
    await logAssetLedger(req, asset, 'asset.qr_generated', 'Asset QR regenerated.', { qrCodeValue: asset.qrCodeValue }, null, 'low');
    res.json({ data: asset, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'REGENERATE_QR_ERROR', message: error instanceof Error ? error.message : 'Failed to regenerate QR code' } });
  }
});

router.post('/:id/barcode/regenerate', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const asset = await assetsRepo.regenerateAssetBarcode(workspaceId, req.params.id, req.body?.barcodeType);
    if (!asset) {
      return res.status(404).json({ data: null, error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } });
    }
    await assetsRepo.createAssetEvent(workspaceId, asset.id, {
      eventType: 'barcode_generated',
      summary: `${req.authUser?.email || 'Unknown user'} generated ${asset.barcodeType || 'code128'} barcode for ${asset.assetTag}`,
      actorUserId: req.authUser?.userId,
      actorEmail: req.authUser?.email,
      device: req.get('user-agent'),
      ipAddress: getClientIp(req),
    });
    await logAssetLedger(req, asset, 'asset.barcode_generated', 'Asset barcode regenerated.', { barcodeType: asset.barcodeType, barcodeValue: asset.barcodeValue }, null, 'low');
    res.json({ data: asset, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'REGENERATE_BARCODE_ERROR', message: error instanceof Error ? error.message : 'Failed to regenerate barcode' } });
  }
});

export default router;
