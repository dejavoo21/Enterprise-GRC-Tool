export type AssetType =
  | 'information_asset'
  | 'hardware_asset'
  | 'software_asset'
  | 'cloud_asset'
  | 'application'
  | 'database'
  | 'network_device'
  | 'facility'
  | 'ai_system'
  | 'vendor_owned_asset'
  | 'mobile_device'
  | 'infrastructure'
  | 'saas'
  | 'endpoint'
  | 'data_store'
  | 'other';

export type AssetCriticality = 'low' | 'medium' | 'high' | 'critical';
export type AssetStatus =
  | 'requested'
  | 'approved'
  | 'procured'
  | 'received'
  | 'assigned'
  | 'active'
  | 'under_maintenance'
  | 'retired'
  | 'disposed'
  | 'planned';
export type AssetClassification = 'Public' | 'Internal' | 'Confidential' | 'Restricted';
export type AssetRiskRating = 'low' | 'medium' | 'high' | 'critical';
export type AssetBarcodeType = 'code128' | 'code39' | 'ean13';
export type AssetLifecycleEventType =
  | 'created'
  | 'assigned'
  | 'scanned'
  | 'location_updated'
  | 'verified'
  | 'retired'
  | 'disposed'
  | 'classified'
  | 'risk_updated'
  | 'linked_to_risk'
  | 'review_completed'
  | 'qr_generated'
  | 'barcode_generated'
  | 'status_changed'
  | 'updated';

export interface AssetLocationSnapshot {
  latitude: number;
  longitude: number;
  capturedAt: string;
  address?: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
}

export interface Asset {
  id: string;
  workspaceId: string;
  assetTag: string;
  name: string;
  description?: string;
  type: AssetType;
  owner: string;
  assetCategory?: string;
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
  lifecycleStatus?: AssetStatus;
  status: AssetStatus;
  purchaseDate?: string;
  warrantyDate?: string;
  endOfLifeDate?: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  vendorDependency?: AssetRiskRating;
  vulnerabilities?: number;
  riskRating?: AssetRiskRating;
  riskScore?: number;
  riskTrend?: 'down' | 'flat' | 'up';
  openIssuesCount?: number;
  openFindingsCount?: number;
  missingControlsCount?: number;
  evidenceGapCount?: number;
  missingOwner?: boolean;
  complianceStatus?: string;
  frameworkCodes?: string[];
  linkedRiskIds?: string[];
  linkedControlIds?: string[];
  linkedEvidenceIds?: string[];
  linkedPolicyIds?: string[];
  linkedIssueIds?: string[];
  linkedAuditIds?: string[];
  notes?: string;
  linkedVendorId?: string;
  qrCodeValue: string;
  qrCodeDataUrl?: string;
  barcodeValue?: string;
  barcodeType?: AssetBarcodeType;
  barcodeDataUrl?: string;
  lastKnownLocation?: AssetLocationSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetLocationHistoryEntry extends AssetLocationSnapshot {
  id: string;
  workspaceId: string;
  assetId: string;
  capturedByUserId?: string;
  capturedByEmail?: string;
  device?: string;
  source?: string;
  notes?: string;
}

export interface AssetLifecycleEvent {
  id: string;
  workspaceId: string;
  assetId: string;
  eventType: AssetLifecycleEventType;
  summary: string;
  notes?: string;
  actorUserId?: string;
  actorEmail?: string;
  device?: string;
  ipAddress?: string;
  location?: AssetLocationSnapshot | null;
  createdAt: string;
}

export interface AssetRelationship {
  id: string;
  workspaceId: string;
  assetId: string;
  relationshipType: 'risk' | 'control' | 'evidence' | 'policy' | 'vendor' | 'issue' | 'audit';
  targetId: string;
  targetName: string;
  createdAt: string;
}

export interface AssetReviewRecord {
  id: string;
  workspaceId: string;
  assetId: string;
  reviewType: 'quarterly' | 'annual' | 'ad_hoc';
  status: 'pending' | 'completed' | 'overdue';
  ownerConfirmed: boolean;
  classificationValidated: boolean;
  riskValidated: boolean;
  locationValidated: boolean;
  reviewer: string;
  completedAt?: string;
  dueAt?: string;
  notes?: string;
}

export interface AssetDashboardData {
  totalAssets: number;
  criticalAssets: number;
  highRiskAssets: number;
  assetsMissingOwner: number;
  assetsMissingReview: number;
  assetsNearEndOfLife: number;
  assetsMissingEvidence: number;
  assetsWithOpenFindings: number;
  distributionByType: Array<{ label: string; count: number }>;
  classificationBreakdown: Array<{ label: string; count: number }>;
  riskLevels: Array<{ label: string; count: number }>;
  lifecycleBreakdown: Array<{ label: string; count: number }>;
  ownershipCoverage: {
    assetOwners: number;
    businessOwners: number;
    custodians: number;
    orphanedAssets: number;
  };
  geographicDistribution: Array<{ label: string; count: number }>;
}

export interface AssetDetailResponse {
  asset: Asset;
  events: AssetLifecycleEvent[];
  locationHistory: AssetLocationHistoryEntry[];
  relationships: AssetRelationship[];
  reviews: AssetReviewRecord[];
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
  lifecycleStatus?: AssetStatus;
  status: AssetStatus;
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
  linkedVendorId?: string;
  barcodeType?: AssetBarcodeType;
  notes?: string;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export interface CaptureAssetLocationInput {
  latitude: number;
  longitude: number;
  capturedAt?: string;
  address?: string;
  building?: string;
  floor?: string;
  room?: string;
  rack?: string;
  notes?: string;
  device?: string;
  source?: string;
}

export interface BulkAssetUpdateInput {
  assetIds: string[];
  owner?: string;
  location?: string;
  classification?: AssetClassification;
  lifecycleStatus?: AssetStatus;
  status?: AssetStatus;
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

export interface CreateAssetRelationshipInput {
  relationshipType: AssetRelationship['relationshipType'];
  targetId: string;
  targetName: string;
}

export interface ApiResponse<T> {
  data: T;
  error: null | string | { code: string; message: string };
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  information_asset: 'Information Asset',
  hardware_asset: 'Hardware Asset',
  software_asset: 'Software Asset',
  cloud_asset: 'Cloud Asset',
  application: 'Application',
  database: 'Database',
  network_device: 'Network Device',
  facility: 'Facility',
  ai_system: 'AI System',
  vendor_owned_asset: 'Vendor-Owned Asset',
  mobile_device: 'Mobile Device',
  infrastructure: 'Infrastructure',
  saas: 'SaaS',
  endpoint: 'Endpoint',
  data_store: 'Data Store',
  other: 'Other',
};

export const ASSET_CRITICALITY_LABELS: Record<AssetCriticality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  procured: 'Procured',
  received: 'Received',
  assigned: 'Assigned',
  active: 'Active',
  under_maintenance: 'Under Maintenance',
  retired: 'Retired',
  disposed: 'Disposed',
  planned: 'Planned',
};

export const ASSET_CLASSIFICATION_LABELS: Record<AssetClassification, string> = {
  Public: 'Public',
  Internal: 'Internal',
  Confidential: 'Confidential',
  Restricted: 'Restricted',
};

export const ASSET_CRITICALITY_COLORS: Record<AssetCriticality, { bg: string; text: string }> = {
  low: { bg: '#E8F5E9', text: '#1B5E20' },
  medium: { bg: '#FFF3E0', text: '#E65100' },
  high: { bg: '#FFE0B2', text: '#D84315' },
  critical: { bg: '#FFEBEE', text: '#B71C1C' },
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, { bg: string; text: string }> = {
  requested: { bg: '#E3F2FD', text: '#0D47A1' },
  approved: { bg: '#E8F5E9', text: '#1B5E20' },
  procured: { bg: '#FFF3E0', text: '#E65100' },
  received: { bg: '#F3E5F5', text: '#6A1B9A' },
  assigned: { bg: '#E0F2F1', text: '#00695C' },
  active: { bg: '#E8F5E9', text: '#1B5E20' },
  under_maintenance: { bg: '#FFF8E1', text: '#F57F17' },
  retired: { bg: '#F5F5F5', text: '#424242' },
  disposed: { bg: '#FCE4EC', text: '#880E4F' },
  planned: { bg: '#E3F2FD', text: '#0D47A1' },
};
