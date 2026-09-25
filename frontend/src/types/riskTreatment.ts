export const CONTROL_ROLES = ['Preventive','Detective','Corrective','Compensating','Recovery','Other'] as const;
export interface TreatmentControl { controlId: string; title?: string; domain?: string; primaryFramework?: string; role: typeof CONTROL_ROLES[number]; implementationNote?: string }
export type RiskTreatmentStrategy = 'mitigate' | 'accept' | 'transfer' | 'avoid' | 'monitor';
export type RiskTreatmentStatus = 'draft' | 'planned' | 'in_progress' | 'awaiting_evidence' | 'under_review' | 'completed' | 'accepted' | 'deferred' | 'cancelled' | 'overdue';
export type RiskTreatmentPriority = 'critical' | 'high' | 'medium' | 'low';
export type RiskTreatmentApprovalStatus = 'not_required' | 'pending_approval' | 'approved' | 'rejected';

export interface RiskTreatmentPlan {
  riskRef?: string;
  id: string; workspaceId: string; riskId: string; riskTitle?: string; title: string; description: string;
  strategy: RiskTreatmentStrategy; owner: string; dueDate: string; status: RiskTreatmentStatus; progressPercent: number;
  priority: RiskTreatmentPriority; expectedResidualScore?: number | null; linkedControls?: TreatmentControl[]; effectivenessRating?: number; evidenceSummary?: string;
  approvalStatus: RiskTreatmentApprovalStatus; createdBy?: string; completedAt?: string; reviewDate?: string; notes?: string;
  createdAt: string; updatedAt: string;
}
export type RiskTreatmentPlanInput = Pick<RiskTreatmentPlan, 'title'|'description'|'strategy'|'owner'|'dueDate'|'status'|'progressPercent'|'priority'|'approvalStatus'> & Partial<Pick<RiskTreatmentPlan, 'linkedControls'|'expectedResidualScore'|'effectivenessRating'|'evidenceSummary'|'reviewDate'|'notes'>>;
export interface RiskTreatmentSummary { total:number; open:number; overdue:number; completed:number; averageProgress:number; byStatus:Record<string,number>; byStrategy:Record<string,number>; }
