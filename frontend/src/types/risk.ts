// Risk Management Types

export type RiskStatus = 'identified' | 'assessed' | 'treated' | 'new' | 'open' | 'under_review' | 'treatment_planned' | 'treatment_in_progress' | 'accepted' | 'monitored' | 'closed' | 'deferred' | 'cancelled';
export type RiskTreatmentStrategy = 'mitigate' | 'accept' | 'transfer' | 'avoid' | 'monitor';
export type RiskTreatmentStatus = 'not_started' | 'planned' | 'in_progress' | 'awaiting_evidence' | 'under_review' | 'completed' | 'overdue' | 'accepted' | 'deferred' | 'cancelled';
export type RiskReviewStatus = 'not_reviewed' | 'review_due' | 'in_review' | 'reviewed' | 'overdue' | 'reassessment_required';

export type RiskCategory = 'information_security' | 'privacy' | 'vendor' | 'operational' | 'compliance' | 'strategic';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CiaImpact = 'Confidentiality' | 'Integrity' | 'Availability';

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
  ciaImpacts: CiaImpact[];
  dueDate?: string;
  treatmentPlan?: string;
  treatmentStrategy?: RiskTreatmentStrategy;
  treatmentOwner?: string;
  treatmentStatus?: RiskTreatmentStatus;
  treatmentProgress?: number;
  treatmentDueDate?: string;
  targetLikelihood?: number;
  targetImpact?: number;
  acceptanceRationale?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  reviewStatus?: RiskReviewStatus;
  reviewNotes?: string;
  reviewOwner?: string;
  reassessmentRequired?: boolean;
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
  residualLikelihood?: number;
  residualImpact?: number;
  ciaImpacts: CiaImpact[];
  dueDate?: string;
  treatmentPlan?: string;
  treatmentStrategy?: RiskTreatmentStrategy;
  treatmentOwner?: string;
  treatmentStatus?: RiskTreatmentStatus;
  treatmentProgress?: number;
  treatmentDueDate?: string;
  targetLikelihood?: number;
  targetImpact?: number;
  acceptanceRationale?: string;
  nextReviewDate?: string;
  reviewStatus?: RiskReviewStatus;
  reviewNotes?: string;
  reviewOwner?: string;
  reassessmentRequired?: boolean;
  status?: RiskStatus;
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
  new: 'New', open: 'Open', under_review: 'Under Review', treatment_planned: 'Treatment Planned', treatment_in_progress: 'Treatment In Progress',
  accepted: 'Accepted',
  monitored: 'Monitored', deferred: 'Deferred', cancelled: 'Cancelled',
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
