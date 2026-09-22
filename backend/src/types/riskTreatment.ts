export const RISK_TREATMENT_STRATEGIES = ['mitigate', 'accept', 'transfer', 'avoid', 'monitor'] as const;
export const RISK_TREATMENT_STATUSES = ['draft', 'planned', 'in_progress', 'awaiting_evidence', 'under_review', 'completed', 'accepted', 'deferred', 'cancelled'] as const;
export const RISK_TREATMENT_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export const RISK_TREATMENT_APPROVAL_STATUSES = ['not_required', 'pending_approval', 'approved', 'rejected'] as const;

export type RiskTreatmentStrategy = typeof RISK_TREATMENT_STRATEGIES[number];
export type RiskTreatmentStatus = typeof RISK_TREATMENT_STATUSES[number] | 'overdue';
export type RiskTreatmentPriority = typeof RISK_TREATMENT_PRIORITIES[number];
export type RiskTreatmentApprovalStatus = typeof RISK_TREATMENT_APPROVAL_STATUSES[number];

export interface RiskTreatmentPlan {
  id: string;
  workspaceId: string;
  riskId: string;
  riskTitle?: string;
  title: string;
  description: string;
  strategy: RiskTreatmentStrategy;
  owner: string;
  dueDate: string;
  status: RiskTreatmentStatus;
  progressPercent: number;
  priority: RiskTreatmentPriority;
  expectedResidualScore?: number;
  effectivenessRating?: number;
  evidenceSummary?: string;
  approvalStatus: RiskTreatmentApprovalStatus;
  createdBy?: string;
  completedAt?: string;
  reviewDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RiskTreatmentPlanInput = Omit<RiskTreatmentPlan, 'id' | 'workspaceId' | 'riskTitle' | 'createdAt' | 'updatedAt' | 'completedAt'> & { completedAt?: string };

export interface RiskTreatmentSummary {
  total: number;
  open: number;
  overdue: number;
  completed: number;
  averageProgress: number;
  byStatus: Record<string, number>;
  byStrategy: Record<string, number>;
}
