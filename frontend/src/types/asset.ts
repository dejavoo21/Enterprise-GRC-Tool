export type AssetType = 'application' | 'infrastructure' | 'database' | 'saas' | 'endpoint' | 'data_store' | 'other';
export type AssetCriticality = 'low' | 'medium' | 'high' | 'critical';
export type AssetStatus = 'active' | 'planned' | 'retired';

export interface Asset {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: AssetType;
  owner: string;
  businessUnit: string;
  criticality: AssetCriticality;
  dataClassification: string;
  status: AssetStatus;
  linkedVendorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetInput {
  name: string;
  description?: string;
  type: AssetType;
  owner: string;
  businessUnit: string;
  criticality: AssetCriticality;
  dataClassification: string;
  status: AssetStatus;
  linkedVendorId?: string;
}

export interface ApiResponse<T> {
  data: T;
  error: null | string | { code: string; message: string };
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  application: 'Application',
  infrastructure: 'Infrastructure',
  database: 'Database',
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
  active: 'Active',
  planned: 'Planned',
  retired: 'Retired',
};

export const ASSET_TYPE_COLORS: Record<AssetType, { bg: string; text: string; border: string }> = {
  application: { bg: '#EBF8FF', text: '#0D47A1', border: '#90CAF9' },
  infrastructure: { bg: '#F3E5F5', text: '#6A1B9A', border: '#CE93D8' },
  database: { bg: '#FFF3E0', text: '#E65100', border: '#FFB74D' },
  saas: { bg: '#E8F5E9', text: '#1B5E20', border: '#81C784' },
  endpoint: { bg: '#FCE4EC', text: '#880E4F', border: '#F48FB1' },
  data_store: { bg: '#F1F8E9', text: '#33691E', border: '#AED581' },
  other: { bg: '#EEEEEE', text: '#424242', border: '#BDBDBD' },
};

export const ASSET_CRITICALITY_COLORS: Record<AssetCriticality, { bg: string; text: string }> = {
  low: { bg: '#E8F5E9', text: '#1B5E20' },
  medium: { bg: '#FFF3E0', text: '#E65100' },
  high: { bg: '#FFE0B2', text: '#D84315' },
  critical: { bg: '#FFEBEE', text: '#B71C1C' },
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, { bg: string; text: string }> = {
  active: { bg: '#E8F5E9', text: '#1B5E20' },
  planned: { bg: '#E3F2FD', text: '#0D47A1' },
  retired: { bg: '#F5F5F5', text: '#424242' },
};
