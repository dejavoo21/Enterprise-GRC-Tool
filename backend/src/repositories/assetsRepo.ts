import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import type {
  Asset,
  AssetBarcodeType,
  AssetClassification,
  AssetCriticality,
  AssetLifecycleEvent,
  AssetLifecycleEventType,
  AssetLocationHistoryEntry,
  AssetRelationship,
  AssetReviewRecord,
  AssetRiskRating,
  AssetStatus,
  AssetType,
} from '../types/models.js';

export interface AssetFilter {
  type?: string;
  criticality?: string;
  status?: string;
  owner?: string;
  classification?: string;
  search?: string;
  lifecycleStatus?: string;
}

export interface CreateAssetInput {
  name: string;
  description?: string;
  type: AssetType;
  assetCategory?: string;
  owner: string;
  assetOwner?: string;
  businessOwner?: string;
  technicalOwner?: string;
  custodian?: string;
  reviewer?: string;
  approver?: string;
  department?: string;
  businessUnit?: string;
  location?: string;
  criticality: AssetCriticality;
  classification?: AssetClassification;
  dataClassification?: string;
  status: AssetStatus;
  lifecycleStatus?: AssetStatus;
  purchaseDate?: string;
  warrantyDate?: string;
  endOfLifeDate?: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  vendorDependency?: AssetRiskRating;
  vulnerabilities?: number;
  riskRating?: AssetRiskRating;
  openIssuesCount?: number;
  openFindingsCount?: number;
  missingControlsCount?: number;
  evidenceGapCount?: number;
  complianceStatus?: string;
  frameworkCodes?: string[];
  linkedRiskIds?: string[];
  linkedControlIds?: string[];
  linkedEvidenceIds?: string[];
  linkedPolicyIds?: string[];
  linkedIssueIds?: string[];
  linkedAuditIds?: string[];
  linkedVendorId?: string | null;
  barcodeType?: AssetBarcodeType;
  notes?: string;
}

export interface UpdateAssetInput extends Partial<CreateAssetInput> {
  reviewType?: AssetReviewRecord['reviewType'];
}

export interface BulkAssetUpdateInput {
  assetIds: string[];
  owner?: string;
  location?: string;
  classification?: AssetClassification;
  lifecycleStatus?: AssetStatus;
  status?: AssetStatus;
}

export interface CreateAssetLocationInput {
  latitude: number;
  longitude: number;
  capturedAt?: string;
  address?: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
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
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
  createdAt?: string;
}

export interface CreateAssetRelationshipInput {
  relationshipType: AssetRelationship['relationshipType'];
  targetId: string;
  targetName: string;
}

export interface CreateAssetReviewInput {
  reviewType: AssetReviewRecord['reviewType'];
  status?: AssetReviewRecord['status'];
  ownerConfirmed?: boolean;
  classificationValidated?: boolean;
  riskValidated?: boolean;
  locationValidated?: boolean;
  reviewer: string;
  completedAt?: string;
  dueAt?: string;
  notes?: string;
}

type AssetRow = {
  id: string;
  workspace_id: string;
  asset_tag: string;
  name: string;
  description: string | null;
  type: AssetType;
  owner: string;
  asset_category: string | null;
  asset_owner: string | null;
  business_owner: string | null;
  technical_owner: string | null;
  custodian: string | null;
  reviewer: string | null;
  approver: string | null;
  department: string | null;
  business_unit: string | null;
  location: string | null;
  criticality: AssetCriticality;
  classification: AssetClassification | null;
  data_classification: string | null;
  lifecycle_status: AssetStatus | null;
  status: AssetStatus;
  purchase_date: string | null;
  warranty_date: string | null;
  end_of_life_date: string | null;
  last_review_date: string | null;
  next_review_date: string | null;
  vendor_dependency: AssetRiskRating | null;
  vulnerabilities: number | null;
  risk_rating: AssetRiskRating | null;
  open_issues_count: number | null;
  open_findings_count: number | null;
  missing_controls_count: number | null;
  evidence_gap_count: number | null;
  compliance_status: string | null;
  framework_codes: string[] | null;
  linked_risk_ids: string[] | null;
  linked_control_ids: string[] | null;
  linked_evidence_ids: string[] | null;
  linked_policy_ids: string[] | null;
  linked_issue_ids: string[] | null;
  linked_audit_ids: string[] | null;
  linked_vendor_id: string | null;
  notes: string | null;
  qr_code_value: string;
  barcode_value: string | null;
  barcode_type: AssetBarcodeType | null;
  last_known_latitude: number | null;
  last_known_longitude: number | null;
  last_known_location_at: string | null;
  last_known_location_address: string | null;
  last_known_building: string | null;
  last_known_floor: string | null;
  last_known_room: string | null;
  last_known_rack: string | null;
  created_at: string;
  updated_at: string;
};

function toArray(value?: string[] | null) {
  return value || [];
}

function generateAssetTag(): string {
  const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const random = uuidv4().slice(0, 6).toUpperCase();
  return `AST-${timestamp}-${random}`;
}

function buildAssetQrValue(assetTag: string): string {
  return `grc-asset://asset/${assetTag}`;
}

function buildBarcodeValue(assetTag: string): string {
  return assetTag;
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

function buildBarcodeSvgDataUrl(value: string, type: AssetBarcodeType = 'code128'): string {
  const safeValue = value.replace(/[<>&"]/g, '');
  const label = `${type.toUpperCase()} · ${safeValue}`;
  const barPattern = Array.from(safeValue)
    .map((char, index) => {
      const x = 12 + index * 7;
      const height = 52 + ((char.charCodeAt(0) + index) % 18);
      const width = index % 3 === 0 ? 4 : 2;
      return `<rect x="${x}" y="16" width="${width}" height="${height}" fill="#0F172A" />`;
    })
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120">
      <rect width="360" height="120" fill="#FFFFFF" />
      ${barPattern}
      <text x="180" y="104" text-anchor="middle" fill="#0F172A" font-size="14" font-family="Arial, sans-serif">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function calculateRiskScore(row: AssetRow): number {
  const criticalityScore = row.criticality === 'critical' ? 35 : row.criticality === 'high' ? 25 : row.criticality === 'medium' ? 15 : 8;
  const classificationScore =
    (row.classification || row.data_classification) === 'Restricted'
      ? 25
      : (row.classification || row.data_classification) === 'Confidential'
        ? 18
        : (row.classification || row.data_classification) === 'Internal'
          ? 10
          : 4;
  const vendorScore = row.vendor_dependency === 'critical' ? 12 : row.vendor_dependency === 'high' ? 9 : row.vendor_dependency === 'medium' ? 5 : 2;
  const vulnerabilityScore = Math.min((row.vulnerabilities || 0) * 2, 12);
  const missingControlScore = Math.min((row.missing_controls_count || 0) * 4, 12);
  const evidenceGapScore = Math.min((row.evidence_gap_count || 0) * 4, 12);
  const linkedRiskScore = Math.min(toArray(row.linked_risk_ids).length * 5, 15);
  return Math.min(100, criticalityScore + classificationScore + vendorScore + vulnerabilityScore + missingControlScore + evidenceGapScore + linkedRiskScore);
}

function deriveRiskRating(score: number): AssetRiskRating {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function deriveRiskTrend(row: AssetRow): 'down' | 'flat' | 'up' {
  if ((row.open_findings_count || 0) > 3 || (row.vulnerabilities || 0) > 5) return 'up';
  if ((row.open_findings_count || 0) === 0 && (row.evidence_gap_count || 0) === 0) return 'down';
  return 'flat';
}

function mapLocation(row: AssetRow) {
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
    building: row.last_known_building || undefined,
    floor: row.last_known_floor || undefined,
    room: row.last_known_room || undefined,
    rack: row.last_known_rack || undefined,
  };
}

async function rowToAsset(row: AssetRow): Promise<Asset> {
  const riskScore = calculateRiskScore(row);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetTag: row.asset_tag,
    name: row.name,
    description: row.description || undefined,
    type: row.type,
    owner: row.owner,
    assetCategory: row.asset_category || undefined,
    assetOwner: row.asset_owner || row.owner,
    businessOwner: row.business_owner || row.owner,
    technicalOwner: row.technical_owner || undefined,
    custodian: row.custodian || undefined,
    reviewer: row.reviewer || undefined,
    approver: row.approver || undefined,
    department: row.department || undefined,
    businessUnit: row.business_unit || undefined,
    location: row.location || undefined,
    criticality: row.criticality,
    classification: (row.classification as AssetClassification | null) || undefined,
    dataClassification: row.data_classification || undefined,
    lifecycleStatus: row.lifecycle_status || row.status,
    status: row.status,
    purchaseDate: row.purchase_date || undefined,
    warrantyDate: row.warranty_date || undefined,
    endOfLifeDate: row.end_of_life_date || undefined,
    lastReviewDate: row.last_review_date || undefined,
    nextReviewDate: row.next_review_date || undefined,
    vendorDependency: row.vendor_dependency || undefined,
    vulnerabilities: row.vulnerabilities || 0,
    riskRating: row.risk_rating || deriveRiskRating(riskScore),
    riskScore,
    riskTrend: deriveRiskTrend(row),
    openIssuesCount: row.open_issues_count || 0,
    openFindingsCount: row.open_findings_count || 0,
    missingControlsCount: row.missing_controls_count || 0,
    evidenceGapCount: row.evidence_gap_count || 0,
    missingOwner: !(row.asset_owner || row.owner),
    complianceStatus: row.compliance_status || 'Needs review',
    frameworkCodes: toArray(row.framework_codes),
    linkedRiskIds: toArray(row.linked_risk_ids),
    linkedControlIds: toArray(row.linked_control_ids),
    linkedEvidenceIds: toArray(row.linked_evidence_ids),
    linkedPolicyIds: toArray(row.linked_policy_ids),
    linkedIssueIds: toArray(row.linked_issue_ids),
    linkedAuditIds: toArray(row.linked_audit_ids),
    linkedVendorId: row.linked_vendor_id || undefined,
    notes: row.notes || undefined,
    qrCodeValue: row.qr_code_value,
    qrCodeDataUrl: await buildQrCodeDataUrl(row.qr_code_value),
    barcodeValue: row.barcode_value || undefined,
    barcodeType: row.barcode_type || 'code128',
    barcodeDataUrl: buildBarcodeSvgDataUrl(row.barcode_value || row.asset_tag, row.barcode_type || 'code128'),
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
    building: row.building || undefined,
    floor: row.floor || undefined,
    room: row.room || undefined,
    rack: row.rack || undefined,
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
          building: row.building || undefined,
          floor: row.floor || undefined,
          room: row.room || undefined,
          rack: row.rack || undefined,
        }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function rowToRelationship(row: any): AssetRelationship {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    relationshipType: row.relationship_type,
    targetId: row.target_id,
    targetName: row.target_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function rowToReview(row: any): AssetReviewRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    reviewType: row.review_type,
    status: row.status,
    ownerConfirmed: row.owner_confirmed,
    classificationValidated: row.classification_validated,
    riskValidated: row.risk_validated,
    locationValidated: row.location_validated,
    reviewer: row.reviewer,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : undefined,
    notes: row.notes || undefined,
  };
}

export async function getAssets(workspaceId: string, filter?: AssetFilter): Promise<Asset[]> {
  let queryText = 'SELECT * FROM assets WHERE workspace_id = $1';
  const params: any[] = [workspaceId];
  let paramCount = 2;

  if (filter?.type) {
    queryText += ` AND type = $${paramCount++}`;
    params.push(filter.type);
  }
  if (filter?.criticality) {
    queryText += ` AND criticality = $${paramCount++}`;
    params.push(filter.criticality);
  }
  if (filter?.status) {
    queryText += ` AND status = $${paramCount++}`;
    params.push(filter.status);
  }
  if (filter?.lifecycleStatus) {
    queryText += ` AND lifecycle_status = $${paramCount++}`;
    params.push(filter.lifecycleStatus);
  }
  if (filter?.classification) {
    queryText += ` AND COALESCE(classification, data_classification) = $${paramCount++}`;
    params.push(filter.classification);
  }
  if (filter?.owner) {
    queryText += ` AND (owner ILIKE $${paramCount} OR COALESCE(asset_owner, '') ILIKE $${paramCount} OR COALESCE(business_owner, '') ILIKE $${paramCount})`;
    params.push(`%${filter.owner}%`);
    paramCount++;
  }
  if (filter?.search) {
    queryText += ` AND (asset_tag ILIKE $${paramCount} OR name ILIKE $${paramCount} OR COALESCE(location, '') ILIKE $${paramCount} OR COALESCE(department, '') ILIKE $${paramCount})`;
    params.push(`%${filter.search}%`);
    paramCount++;
  }

  queryText += ' ORDER BY created_at DESC';

  const result = await query<AssetRow>(queryText, params);
  return Promise.all(result.rows.map(rowToAsset));
}

export async function getAssetById(workspaceId: string, id: string): Promise<Asset | null> {
  const result = await query<AssetRow>('SELECT * FROM assets WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function getAssetByTag(workspaceId: string, assetTag: string): Promise<Asset | null> {
  const result = await query<AssetRow>('SELECT * FROM assets WHERE asset_tag = $1 AND workspace_id = $2', [assetTag, workspaceId]);
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function createAsset(workspaceId: string, input: CreateAssetInput): Promise<Asset> {
  const id = uuidv4();
  const assetTag = generateAssetTag();
  const qrCodeValue = buildAssetQrValue(assetTag);
  const barcodeType = input.barcodeType || 'code128';
  const barcodeValue = buildBarcodeValue(assetTag);

  const result = await query<AssetRow>(
    `INSERT INTO assets (
      id, workspace_id, asset_tag, name, description, type, owner, asset_category, asset_owner, business_owner, technical_owner, custodian, reviewer, approver,
      department, business_unit, location, criticality, classification, data_classification, lifecycle_status, status, purchase_date, warranty_date, end_of_life_date,
      last_review_date, next_review_date, vendor_dependency, vulnerabilities, risk_rating, open_issues_count, open_findings_count, missing_controls_count, evidence_gap_count,
      compliance_status, framework_codes, linked_risk_ids, linked_control_ids, linked_evidence_ids, linked_policy_ids, linked_issue_ids, linked_audit_ids,
      linked_vendor_id, notes, qr_code_value, barcode_value, barcode_type
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
      $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
      $26,$27,$28,$29,$30,$31,$32,$33,$34,
      $35,$36,$37,$38,$39,$40,$41,$42,
      $43,$44,$45,$46,$47
    ) RETURNING *`,
    [
      id,
      workspaceId,
      assetTag,
      input.name,
      input.description || null,
      input.type,
      input.owner,
      input.assetCategory || null,
      input.assetOwner || input.owner,
      input.businessOwner || input.owner,
      input.technicalOwner || null,
      input.custodian || null,
      input.reviewer || null,
      input.approver || null,
      input.department || null,
      input.businessUnit || null,
      input.location || null,
      input.criticality,
      input.classification || input.dataClassification || 'Internal',
      input.dataClassification || input.classification || 'Internal',
      input.lifecycleStatus || input.status,
      input.status,
      input.purchaseDate || null,
      input.warrantyDate || null,
      input.endOfLifeDate || null,
      input.lastReviewDate || null,
      input.nextReviewDate || null,
      input.vendorDependency || input.criticality,
      input.vulnerabilities || 0,
      input.riskRating || input.criticality,
      input.openIssuesCount || 0,
      input.openFindingsCount || 0,
      input.missingControlsCount || 0,
      input.evidenceGapCount || 0,
      input.complianceStatus || 'Needs review',
      input.frameworkCodes || [],
      input.linkedRiskIds || [],
      input.linkedControlIds || [],
      input.linkedEvidenceIds || [],
      input.linkedPolicyIds || [],
      input.linkedIssueIds || [],
      input.linkedAuditIds || [],
      input.linkedVendorId || null,
      input.notes || null,
      qrCodeValue,
      barcodeValue,
      barcodeType,
    ],
  );

  return rowToAsset(result.rows[0]);
}

export async function updateAsset(workspaceId: string, id: string, input: UpdateAssetInput): Promise<Asset | null> {
  const fields: string[] = [];
  const params: any[] = [id, workspaceId];
  let index = 3;

  const fieldMap: Array<[keyof UpdateAssetInput, string]> = [
    ['name', 'name'],
    ['description', 'description'],
    ['type', 'type'],
    ['assetCategory', 'asset_category'],
    ['owner', 'owner'],
    ['assetOwner', 'asset_owner'],
    ['businessOwner', 'business_owner'],
    ['technicalOwner', 'technical_owner'],
    ['custodian', 'custodian'],
    ['reviewer', 'reviewer'],
    ['approver', 'approver'],
    ['department', 'department'],
    ['businessUnit', 'business_unit'],
    ['location', 'location'],
    ['criticality', 'criticality'],
    ['classification', 'classification'],
    ['dataClassification', 'data_classification'],
    ['lifecycleStatus', 'lifecycle_status'],
    ['status', 'status'],
    ['purchaseDate', 'purchase_date'],
    ['warrantyDate', 'warranty_date'],
    ['endOfLifeDate', 'end_of_life_date'],
    ['lastReviewDate', 'last_review_date'],
    ['nextReviewDate', 'next_review_date'],
    ['vendorDependency', 'vendor_dependency'],
    ['vulnerabilities', 'vulnerabilities'],
    ['riskRating', 'risk_rating'],
    ['openIssuesCount', 'open_issues_count'],
    ['openFindingsCount', 'open_findings_count'],
    ['missingControlsCount', 'missing_controls_count'],
    ['evidenceGapCount', 'evidence_gap_count'],
    ['complianceStatus', 'compliance_status'],
    ['frameworkCodes', 'framework_codes'],
    ['linkedRiskIds', 'linked_risk_ids'],
    ['linkedControlIds', 'linked_control_ids'],
    ['linkedEvidenceIds', 'linked_evidence_ids'],
    ['linkedPolicyIds', 'linked_policy_ids'],
    ['linkedIssueIds', 'linked_issue_ids'],
    ['linkedAuditIds', 'linked_audit_ids'],
    ['linkedVendorId', 'linked_vendor_id'],
    ['notes', 'notes'],
    ['barcodeType', 'barcode_type'],
  ];

  for (const [key, column] of fieldMap) {
    if (input[key] !== undefined) {
      fields.push(`${column} = $${index++}`);
      params.push(input[key] as any);
    }
  }

  if (input.barcodeType !== undefined) {
    fields.push(`barcode_value = $${index++}`);
    params.push(buildBarcodeValue((await getAssetById(workspaceId, id))?.assetTag || ''));
  }

  if (fields.length === 0) {
    return getAssetById(workspaceId, id);
  }

  fields.push('updated_at = NOW()');
  const result = await query<AssetRow>(`UPDATE assets SET ${fields.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`, params);
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
}

export async function regenerateAssetQrCode(workspaceId: string, assetId: string): Promise<Asset | null> {
  const asset = await getAssetById(workspaceId, assetId);
  if (!asset) return null;
  const qrCodeValue = buildAssetQrValue(asset.assetTag || `AST-${asset.id.slice(0, 8).toUpperCase()}`);
  const result = await query<AssetRow>(
    `UPDATE assets SET qr_code_value = $3, updated_at = NOW() WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    [assetId, workspaceId, qrCodeValue],
  );
  return result.rows[0] ? rowToAsset(result.rows[0]) : null;
}

export async function regenerateAssetBarcode(workspaceId: string, assetId: string, barcodeType: AssetBarcodeType = 'code128'): Promise<Asset | null> {
  const asset = await getAssetById(workspaceId, assetId);
  if (!asset) return null;
  const result = await query<AssetRow>(
    `UPDATE assets SET barcode_type = $3, barcode_value = $4, updated_at = NOW() WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    [assetId, workspaceId, barcodeType, buildBarcodeValue(asset.assetTag || `AST-${asset.id.slice(0, 8).toUpperCase()}`)],
  );
  return result.rows[0] ? rowToAsset(result.rows[0]) : null;
}

export async function createAssetLocation(workspaceId: string, assetId: string, input: CreateAssetLocationInput): Promise<AssetLocationHistoryEntry> {
  const capturedAt = input.capturedAt || new Date().toISOString();
  const result = await query<any>(
    `INSERT INTO asset_location_history (
      id, workspace_id, asset_id, latitude, longitude, captured_at, address, building, floor, room, rack, captured_by_user_id, captured_by_email, device, source, notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
    ) RETURNING *`,
    [
      uuidv4(),
      workspaceId,
      assetId,
      input.latitude,
      input.longitude,
      capturedAt,
      input.address || null,
      input.building || null,
      input.floor || null,
      input.room || null,
      input.rack || null,
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
           last_known_building = $7,
           last_known_floor = $8,
           last_known_room = $9,
           last_known_rack = $10,
           location = COALESCE($6, location),
           updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2`,
    [assetId, workspaceId, input.latitude, input.longitude, capturedAt, input.address || null, input.building || null, input.floor || null, input.room || null, input.rack || null],
  );

  return rowToAssetLocation(result.rows[0]);
}

export async function getAssetLocationHistory(workspaceId: string, assetId: string): Promise<AssetLocationHistoryEntry[]> {
  const result = await query<any>(`SELECT * FROM asset_location_history WHERE workspace_id = $1 AND asset_id = $2 ORDER BY captured_at DESC`, [workspaceId, assetId]);
  return result.rows.map(rowToAssetLocation);
}

export async function createAssetEvent(workspaceId: string, assetId: string, input: CreateAssetEventInput): Promise<AssetLifecycleEvent> {
  const result = await query<any>(
    `INSERT INTO asset_lifecycle_events (
      id, workspace_id, asset_id, event_type, summary, notes, actor_user_id, actor_email, device, ip_address, latitude, longitude, address, building, floor, room, rack, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz
    ) RETURNING *`,
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
      input.building || null,
      input.floor || null,
      input.room || null,
      input.rack || null,
      input.createdAt || new Date().toISOString(),
    ],
  );

  return rowToAssetEvent(result.rows[0]);
}

export async function getAssetEvents(workspaceId: string, assetId: string): Promise<AssetLifecycleEvent[]> {
  const result = await query<any>(`SELECT * FROM asset_lifecycle_events WHERE workspace_id = $1 AND asset_id = $2 ORDER BY created_at DESC`, [workspaceId, assetId]);
  return result.rows.map(rowToAssetEvent);
}

export async function createAssetRelationship(workspaceId: string, assetId: string, input: CreateAssetRelationshipInput): Promise<AssetRelationship> {
  const result = await query<any>(
    `INSERT INTO asset_relationships (id, workspace_id, asset_id, relationship_type, target_id, target_name)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [uuidv4(), workspaceId, assetId, input.relationshipType, input.targetId, input.targetName],
  );
  return rowToRelationship(result.rows[0]);
}

export async function getAssetRelationships(workspaceId: string, assetId: string): Promise<AssetRelationship[]> {
  const result = await query<any>(`SELECT * FROM asset_relationships WHERE workspace_id = $1 AND asset_id = $2 ORDER BY created_at DESC`, [workspaceId, assetId]);
  return result.rows.map(rowToRelationship);
}

export async function createAssetReview(workspaceId: string, assetId: string, input: CreateAssetReviewInput): Promise<AssetReviewRecord> {
  const result = await query<any>(
    `INSERT INTO asset_reviews (
      id, workspace_id, asset_id, review_type, status, owner_confirmed, classification_validated, risk_validated, location_validated, reviewer, completed_at, due_at, notes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13
    ) RETURNING *`,
    [
      uuidv4(),
      workspaceId,
      assetId,
      input.reviewType,
      input.status || 'pending',
      input.ownerConfirmed ?? false,
      input.classificationValidated ?? false,
      input.riskValidated ?? false,
      input.locationValidated ?? false,
      input.reviewer,
      input.completedAt || null,
      input.dueAt || null,
      input.notes || null,
    ],
  );

  if (input.completedAt) {
    await query(`UPDATE assets SET last_review_date = $3::timestamptz, updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, [assetId, workspaceId, input.completedAt]);
  }

  return rowToReview(result.rows[0]);
}

export async function getAssetReviews(workspaceId: string, assetId: string): Promise<AssetReviewRecord[]> {
  const result = await query<any>(`SELECT * FROM asset_reviews WHERE workspace_id = $1 AND asset_id = $2 ORDER BY COALESCE(completed_at, due_at, created_at) DESC`, [workspaceId, assetId]);
  return result.rows.map(rowToReview);
}

export async function getAssetDashboard(workspaceId: string) {
  const assets = await getAssets(workspaceId);
  return {
    totalAssets: assets.length,
    criticalAssets: assets.filter((asset) => asset.criticality === 'critical').length,
    highRiskAssets: assets.filter((asset) => (asset.riskScore || 0) >= 60).length,
    assetsMissingOwner: assets.filter((asset) => asset.missingOwner).length,
    assetsMissingReview: assets.filter((asset) => !asset.nextReviewDate).length,
    assetsNearEndOfLife: assets.filter((asset) => asset.endOfLifeDate && new Date(asset.endOfLifeDate).getTime() < Date.now() + 90 * 86400000).length,
    assetsMissingEvidence: assets.filter((asset) => (asset.evidenceGapCount || 0) > 0).length,
    assetsWithOpenFindings: assets.filter((asset) => (asset.openFindingsCount || 0) > 0).length,
    distributionByType: Object.entries(assets.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })),
    classificationBreakdown: Object.entries(assets.reduce<Record<string, number>>((acc, asset) => {
      const key = asset.classification || asset.dataClassification || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })),
    riskLevels: Object.entries(assets.reduce<Record<string, number>>((acc, asset) => {
      const key = asset.riskRating || 'low';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })),
    lifecycleBreakdown: Object.entries(assets.reduce<Record<string, number>>((acc, asset) => {
      const key = asset.lifecycleStatus || asset.status;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })),
    ownershipCoverage: {
      assetOwners: assets.filter((asset) => asset.assetOwner).length,
      businessOwners: assets.filter((asset) => asset.businessOwner).length,
      custodians: assets.filter((asset) => asset.custodian).length,
      orphanedAssets: assets.filter((asset) => asset.missingOwner).length,
    },
    geographicDistribution: Object.entries(assets.reduce<Record<string, number>>((acc, asset) => {
      const key = asset.location || asset.lastKnownLocation?.address || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).slice(0, 10).map(([label, count]) => ({ label, count })),
  };
}

export async function bulkUpdateAssets(workspaceId: string, input: BulkAssetUpdateInput): Promise<Asset[]> {
  if (!input.assetIds.length) return [];
  const updated: Asset[] = [];
  for (const assetId of input.assetIds) {
    const asset = await updateAsset(workspaceId, assetId, {
      owner: input.owner,
      location: input.location,
      classification: input.classification,
      lifecycleStatus: input.lifecycleStatus,
      status: input.status,
    });
    if (asset) updated.push(asset);
  }
  return updated;
}

export async function deleteAsset(workspaceId: string, id: string): Promise<boolean> {
  const result = await query('DELETE FROM assets WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
  return Boolean(result.rowCount && result.rowCount > 0);
}
