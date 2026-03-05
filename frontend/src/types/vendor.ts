export type VendorRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type VendorStatus = 'active' | 'onboarding' | 'offboarded';

export interface Vendor {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  owner: string;
  riskLevel: VendorRiskLevel;
  status: VendorStatus;
  nextReviewDate: string;
  hasDPA: boolean;
  regions: string[];
  dataTypesProcessed: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  name: string;
  category: string;
  owner: string;
  riskLevel: VendorRiskLevel;
  status: VendorStatus;
  nextReviewDate: string;
  hasDPA: boolean;
  regions: string[];
  dataTypesProcessed: string[];
}

export interface ApiResponse<T> {
  data: T;
  error: null | string | { code: string; message: string };
}

export const VENDOR_RISK_LABELS: Record<VendorRiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  offboarded: 'Offboarded',
};

export const VENDOR_RISK_COLORS: Record<VendorRiskLevel, { bg: string; text: string }> = {
  low: { bg: '#E8F5E9', text: '#1B5E20' },
  medium: { bg: '#FFF3E0', text: '#E65100' },
  high: { bg: '#FFE0B2', text: '#D84315' },
  critical: { bg: '#FFEBEE', text: '#B71C1C' },
};

export const VENDOR_STATUS_COLORS: Record<VendorStatus, { bg: string; text: string }> = {
  active: { bg: '#E8F5E9', text: '#1B5E20' },
  onboarding: { bg: '#E3F2FD', text: '#0D47A1' },
  offboarded: { bg: '#F5F5F5', text: '#424242' },
};
