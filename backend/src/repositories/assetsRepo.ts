import QRCode from 'qrcode';
import { query } from '../db.js';
import {
  Asset,
  AssetLifecycleEvent,
  AssetLifecycleEventType,
  AssetLocationHistoryEntry,
} from '../types/models.js';
import { v4 as uuidv4 } from 'uuid';

export interface AssetFilter {
  type?: string;
  criticality?: string;
  status?: string;
  workspaceId?: string;
}

export interface CreateAssetInput {
  name: string;
  description?: string;
  type: string;
  owner: string;
  businessUnit?: string;
  criticality: string;
  dataClassification?: string;
  status: string;
  linkedVendorId?: string | null;
  notes?: string;
}

export interface UpdateAssetOperationalInput {
  owner?: string;
  status?: string;
  notes?: string;
}

export interface CreateAssetLocationInput {
  latitude: number;
  longitude: number;
  capturedAt?: string;
  address?: string;
  capturedByUserId?: string;
  capturedByEmail?: string;
  device?: string;
  source?: string;
  notes?: string;
}

export interface CreateAssetEventInput {
  eventType: AssetLifecycleEventType;
  summary: string;
  notes?: string;
  actorUserId?: string;
  actorEmail?: string;
  device?: string;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  createdAt?: string;
}

function buildAssetQrValue(assetTag: string): string {
  return `grc-asset://asset/${assetTag}`;
}

async function buildQrCodeDataUrl(qrCodeValue: string): Promise<string> {
  return QRCode.toDataURL(qrCodeValue, {
    margin: 1,
    width: 240,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

function generateAssetTag(): string {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const random = uuidv4().slice(0, 6).toUpperCase();
  return `AST-${timestamp}-${random}`;
}

function mapLocation(row: any) {
  if (
    row.last_known_latitude === null ||
    row.last_known_latitude === undefined ||
    row.last_known_longitude === null ||
    row.last_known_longitude === undefined ||
    !row.last_known_location_at
  ) {
    return null;
  }

  return {
    latitude: Number(row.last_known_latitude),
    longitude: Number(row.last_known_longitude),
    capturedAt: new Date(row.last_known_location_at).toISOString(),
    address: row.last_known_location_address || undefined,
  };
}

async function rowToAsset(row: any): Promise<Asset> {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetTag: row.asset_tag,
    name: row.name,
    description: row.description,
    type: row.type,
    owner: row.owner,
    businessUnit: row.business_unit,
    criticality: row.criticality,
    dataClassification: row.data_classification,
    status: row.status,
    notes: row.notes,
    linkedVendorId: row.linked_vendor_id,
    qrCodeValue: row.qr_code_value,
    qrCodeDataUrl: await buildQrCodeDataUrl(row.qr_code_value),
    lastKnownLocation: mapLocation(row),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function rowToAssetLocation(row: any): AssetLocationHistoryEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    capturedAt: new Date(row.captured_at).toISOString(),
    address: row.address || undefined,
    capturedByUserId: row.captured_by_user_id || undefined,
    capturedByEmail: row.captured_by_email || undefined,
    device: row.device || undefined,
    source: row.source || undefined,
    notes: row.notes || undefined,
  };
}

function rowToAssetEvent(row: any): AssetLifecycleEvent {
  const hasLocation = row.latitude !== null && row.longitude !== null;

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    eventType: row.event_type,
    summary: row.summary,
    notes: row.notes || undefined,
    actorUserId: row.actor_user_id || undefined,
    actorEmail: row.actor_email || undefined,
    device: row.device || undefined,
    ipAddress: row.ip_address || undefined,
    location: hasLocation
      ? {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          capturedAt: new Date(row.created_at).toISOString(),
          address: row.address || undefined,
        }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getAssets(workspaceId: string, filter?: AssetFilter): Promise<Asset[]> {
  let queryText = 'SELECT * FROM assets WHERE workspace_id = $1';
  const params: any[] = [workspaceId];
  let paramCount = 2;

  if (filter?.type) {
    queryText += ` AND type = $${paramCount}`;
    params.push(filter.type);
    paramCount++;
  }

  if (filter?.criticality) {
    queryText += ` AND criticality = $${paramCount}`;
    params.push(filter.criticality);
    paramCount++;
  }

  if (filter?.status) {
    queryText += ` AND status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query<any>(queryText, params);
  return Promise.all(result.rows.map(rowToAsset));
}

export async function getAssetById(workspaceId: string, id: string): Promise<Asset | null> {
  const result = await query<any>(
    'SELECT * FROM assets WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function getAssetByTag(workspaceId: string, assetTag: string): Promise<Asset | null> {
  const result = await query<any>(
    'SELECT * FROM assets WHERE asset_tag = $1 AND workspace_id = $2',
    [assetTag, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function createAsset(workspaceId: string, input: CreateAssetInput): Promise<Asset> {
  const id = uuidv4();
  const assetTag = generateAssetTag();
  const qrCodeValue = buildAssetQrValue(assetTag);

  const result = await query<any>(
    `INSERT INTO assets (
      id, workspace_id, asset_tag, name, description, type, owner, business_unit,
      criticality, data_classification, status, linked_vendor_id, notes, qr_code_value
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      id,
      workspaceId,
      assetTag,
      input.name,
      input.description || null,
      input.type,
      input.owner,
      input.businessUnit || null,
      input.criticality,
      input.dataClassification || null,
      input.status,
      input.linkedVendorId || null,
      input.notes || null,
      qrCodeValue,
    ],
  );

  return rowToAsset(result.rows[0]);
}

export async function updateAssetOperationalState(
  workspaceId: string,
  id: string,
  input: UpdateAssetOperationalInput,
): Promise<Asset | null> {
  const fields: string[] = [];
  const params: any[] = [id, workspaceId];
  let paramCount = 3;

  if (input.owner !== undefined) {
    fields.push(`owner = $${paramCount}`);
    params.push(input.owner);
    paramCount++;
  }

  if (input.status !== undefined) {
    fields.push(`status = $${paramCount}`);
    params.push(input.status);
    paramCount++;
  }

  if (input.notes !== undefined) {
    fields.push(`notes = $${paramCount}`);
    params.push(input.notes || null);
    paramCount++;
  }

  if (fields.length === 0) {
    return getAssetById(workspaceId, id);
  }

  fields.push('updated_at = NOW()');

  const result = await query<any>(
    `UPDATE assets
       SET ${fields.join(', ')}
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    params,
  );

  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function createAssetLocation(
  workspaceId: string,
  assetId: string,
  input: CreateAssetLocationInput,
): Promise<AssetLocationHistoryEntry> {
  const result = await query<any>(
    `INSERT INTO asset_location_history (
      id, workspace_id, asset_id, latitude, longitude, captured_at, address,
      captured_by_user_id, captured_by_email, device, source, notes
    ) VALUES (
      $1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9, $10, $11, $12
    )
    RETURNING *`,
    [
      uuidv4(),
      workspaceId,
      assetId,
      input.latitude,
      input.longitude,
      input.capturedAt || new Date().toISOString(),
      input.address || null,
      input.capturedByUserId || null,
      input.capturedByEmail || null,
      input.device || null,
      input.source || 'browser_geolocation',
      input.notes || null,
    ],
  );

  await query(
    `UPDATE assets
       SET last_known_latitude = $3,
           last_known_longitude = $4,
           last_known_location_at = $5::timestamptz,
           last_known_location_address = $6,
           updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2`,
    [
      assetId,
      workspaceId,
      input.latitude,
      input.longitude,
      input.capturedAt || new Date().toISOString(),
      input.address || null,
    ],
  );

  return rowToAssetLocation(result.rows[0]);
}

export async function getAssetLocationHistory(
  workspaceId: string,
  assetId: string,
): Promise<AssetLocationHistoryEntry[]> {
  const result = await query<any>(
    `SELECT *
       FROM asset_location_history
      WHERE workspace_id = $1 AND asset_id = $2
      ORDER BY captured_at DESC`,
    [workspaceId, assetId],
  );

  return result.rows.map(rowToAssetLocation);
}

export async function createAssetEvent(
  workspaceId: string,
  assetId: string,
  input: CreateAssetEventInput,
): Promise<AssetLifecycleEvent> {
  const result = await query<any>(
    `INSERT INTO asset_lifecycle_events (
      id, workspace_id, asset_id, event_type, summary, notes, actor_user_id,
      actor_email, device, ip_address, latitude, longitude, address, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz
    )
    RETURNING *`,
    [
      uuidv4(),
      workspaceId,
      assetId,
      input.eventType,
      input.summary,
      input.notes || null,
      input.actorUserId || null,
      input.actorEmail || null,
      input.device || null,
      input.ipAddress || null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.address || null,
      input.createdAt || new Date().toISOString(),
    ],
  );

  return rowToAssetEvent(result.rows[0]);
}

export async function getAssetEvents(workspaceId: string, assetId: string): Promise<AssetLifecycleEvent[]> {
  const result = await query<any>(
    `SELECT *
       FROM asset_lifecycle_events
      WHERE workspace_id = $1 AND asset_id = $2
      ORDER BY created_at DESC`,
    [workspaceId, assetId],
  );

  return result.rows.map(rowToAssetEvent);
}

export async function deleteAsset(workspaceId: string, id: string): Promise<boolean> {
  const result = await query('DELETE FROM assets WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
  return result.rowCount ? result.rowCount > 0 : false;
}
