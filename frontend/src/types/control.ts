// Control Library Types

// Flexible framework code - allows any string for data-driven frameworks
export type ControlFrameworkCode = string;

// Legacy alias for backwards compatibility
export type ControlFramework = ControlFrameworkCode;

export type ControlStatus =
  | 'not_implemented'
  | 'in_progress'
  | 'implemented'
  | 'not_applicable';

export type Control = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  owner: string;
  status: ControlStatus;
  domain?: string;
  primaryFramework?: ControlFramework;
  createdAt: string;
  updatedAt: string;
};

export type ControlFrameworkMapping = {
  id: string;
  controlId: string;
  framework: ControlFramework;
  reference: string;
  type?: 'TYPE_I' | 'TYPE_II' | null;
};

export type ControlWithFrameworks = Control & {
  frameworks: ControlFramework[];
};

export type CreateControlInput = {
  title: string;
  description?: string;
  owner: string;
  status?: ControlStatus;
  domain?: string;
  primaryFramework?: ControlFramework;
};

export type CreateControlMappingInput = {
  controlId: string;
  framework: ControlFramework;
  reference: string;
  type?: 'TYPE_I' | 'TYPE_II' | null;
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
export const CONTROL_STATUS_LABELS: Record<ControlStatus, string> = {
  not_implemented: 'Not Implemented',
  in_progress: 'In Progress',
  implemented: 'Implemented',
  not_applicable: 'Not Applicable',
};

export const CONTROL_STATUS_COLORS: Record<ControlStatus, string> = {
  not_implemented: '#EF4444', // red
  in_progress: '#F59E0B', // amber
  implemented: '#10B981', // green
  not_applicable: '#6B7280', // gray
};

// Legacy static lookups - prefer using useFrameworks() hook instead
// These are kept for backwards compatibility and fallback
export const FRAMEWORK_LABELS: Record<string, string> = {
  ISO27001: 'ISO 27001',
  ISO27701: 'ISO 27701',
  SOC1: 'SOC 1',
  SOC2: 'SOC 2',
  NIST_800_53: 'NIST 800-53',
  NIST_CSF: 'NIST CSF',
  CIS: 'CIS',
  PCI_DSS: 'PCI DSS',
  HIPAA: 'HIPAA',
  HITRUST: 'HITRUST CSF',
  ISO42001: 'ISO 42001 (AI)',
  EU_AI_ACT: 'EU AI Act',
  GDPR: 'GDPR',
  COBIT: 'COBIT',
  CUSTOM: 'Custom',
};

// Legacy static lookups - prefer using useFrameworks() hook instead
export const FRAMEWORK_COLORS: Record<string, string> = {
  ISO27001: '#4F46E5', // indigo
  ISO27701: '#7C3AED', // violet
  SOC1: '#0891B2', // cyan
  SOC2: '#0EA5E9', // sky
  NIST_800_53: '#059669', // emerald
  NIST_CSF: '#10B981', // green
  CIS: '#D97706', // amber
  PCI_DSS: '#DC2626', // red
  HIPAA: '#DB2777', // pink
  HITRUST: '#BE185D', // rose
  ISO42001: '#7C3AED', // violet (AI-focused)
  EU_AI_ACT: '#2563EB', // blue (EU regulation)
  GDPR: '#9333EA', // purple
  COBIT: '#6366F1', // indigo
  CUSTOM: '#6B7280', // gray
};

export const SOC_TYPE_LABELS: Record<'TYPE_I' | 'TYPE_II', string> = {
  TYPE_I: 'Type I',
  TYPE_II: 'Type II',
};
