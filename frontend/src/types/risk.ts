// Risk Management Types

export type RiskStatus = 'identified' | 'assessed' | 'treated' | 'accepted' | 'closed';

export type RiskCategory = 'information_security' | 'privacy' | 'vendor' | 'operational' | 'compliance' | 'strategic';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type Risk = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  owner: string;
  category: RiskCategory;
  status: RiskStatus;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number;
  residualImpact: number;
  inherentRiskScore: number;
  residualRiskScore: number;
  severity: RiskSeverity;
  dueDate?: string;
  treatmentPlan?: string;
  controlIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateRiskInput = {
  title: string;
  description?: string;
  owner: string;
  category: RiskCategory;
  inherentLikelihood: number;
  inherentImpact: number;
  dueDate?: string;
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};

export type ApiError = {
  code: string;
  message: string;
};

// Display helpers
export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  identified: 'Identified',
  assessed: 'Assessed',
  treated: 'Treated',
  accepted: 'Accepted',
  closed: 'Closed',
};

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  information_security: 'Information Security',
  privacy: 'Privacy',
  vendor: 'Vendor',
  operational: 'Operational',
  compliance: 'Compliance',
  strategic: 'Strategic',
};

export function getRiskSeverity(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

export function getRiskSeverityLabel(score: number): string {
  const severity = getRiskSeverity(score);
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
