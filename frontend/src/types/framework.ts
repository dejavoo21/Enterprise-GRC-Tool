// Framework Types - Data-driven framework configuration

// Flexible framework code - allows any string for data-driven frameworks
export type ControlFrameworkCode = string;

// Framework entity from the API
export interface Framework {
  id: string;
  code: ControlFrameworkCode;
  name: string;
  category: string;
  description?: string;
  isAiHealthcare: boolean;
  isPrivacy: boolean;
  isDefault: boolean;
  colorHex?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

// Default color for frameworks without a colorHex
export const DEFAULT_FRAMEWORK_COLOR = '#6B7280';

// Helper function to get display name for a framework
export function getFrameworkName(frameworks: Framework[], code: string): string {
  const framework = frameworks.find(f => f.code === code);
  return framework?.name || code;
}

// Helper function to get color for a framework
export function getFrameworkColor(frameworks: Framework[], code: string): string {
  const framework = frameworks.find(f => f.code === code);
  return framework?.colorHex || DEFAULT_FRAMEWORK_COLOR;
}
