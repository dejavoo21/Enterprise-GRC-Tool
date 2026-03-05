// Evidence Types

export type EvidenceType = 'policy' | 'configuration' | 'log' | 'screenshot' | 'report' | 'other';

export type EvidenceItem = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: EvidenceType;
  locationUrl?: string;
  controlId?: string;
  riskId?: string;
  collectedBy: string;
  collectedAt: string;
  lastReviewedAt?: string;
};

export type CreateEvidenceInput = {
  name: string;
  description?: string;
  type: EvidenceType;
  locationUrl?: string;
  controlId?: string;
  riskId?: string;
  collectedBy: string;
  collectedAt?: string;
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};

export type ApiError = {
  code: string;
  message: string;
};

// Display labels
export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  policy: 'Policy',
  configuration: 'Configuration',
  log: 'Log',
  screenshot: 'Screenshot',
  report: 'Report',
  other: 'Other',
};

export const EVIDENCE_TYPE_COLORS: Record<EvidenceType, string> = {
  policy: '#4F46E5', // indigo
  configuration: '#0891B2', // cyan
  log: '#D97706', // amber
  screenshot: '#7C3AED', // violet
  report: '#059669', // emerald
  other: '#6B7280', // gray
};
