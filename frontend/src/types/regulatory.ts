export type RegulationStatus = 'active' | 'draft' | 'retired' | 'under_review';
export type ObligationType = 'legal' | 'contractual' | 'regulatory' | 'industry' | 'internal' | 'customer';
export type ObligationStatus = 'open' | 'in_progress' | 'compliant' | 'at_risk' | 'overdue';
export type ChangeType = 'new_regulation' | 'updated_regulation' | 'retired_regulation' | 'clause_update';
export type ChangeSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'overdue';

export interface RegulatoryRequirement {
  id: string;
  workspaceId: string;
  requirementId: string;
  regulationName: string;
  clause?: string | null;
  article?: string | null;
  section?: string | null;
  title: string;
  description: string;
  jurisdiction: string;
  regulator: string;
  category: string;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  status: RegulationStatus;
  owner: string;
  businessUnit: string;
  complianceRating: number;
  riskRating: number;
  linkedControls: string[];
  linkedPolicies: string[];
  linkedRisks: string[];
  linkedEvidence: string[];
  frameworkCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryObligation {
  id: string;
  workspaceId: string;
  obligationType: ObligationType;
  title: string;
  description: string;
  owner: string;
  dueDate?: string | null;
  status: ObligationStatus;
  reviewFrequency: string;
  complianceEvidence: string[];
  linkedControls: string[];
  linkedPolicies: string[];
  linkedRisks: string[];
  sourceRequirementId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryChangeLogEntry {
  id: string;
  workspaceId: string;
  requirementId?: string | null;
  regulationName: string;
  changeType: ChangeType;
  changeSummary: string;
  impactAssessment: string;
  versionTag: string;
  reviewer: string;
  approvalStatus: ReviewStatus;
  severity: ChangeSeverity;
  changeDate: string;
  affectedControls: string[];
  affectedPolicies: string[];
  affectedRisks: string[];
  affectedVendors: string[];
  affectedAssets: string[];
  affectedAiSystems: string[];
  requiredActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryTask {
  id: string;
  workspaceId: string;
  changeLogId?: string | null;
  title: string;
  owner: string;
  dueDate?: string | null;
  status: TaskStatus;
  escalation?: string | null;
  workflowStage: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryJurisdiction {
  id: string;
  workspaceId: string;
  country: string;
  region?: string | null;
  state?: string | null;
  industry?: string | null;
  regulator: string;
  applicability: string;
  complianceStatus: string;
}

export interface RegulatoryMapping {
  id: string;
  workspaceId: string;
  regulationName: string;
  requirementId: string;
  controlId?: string | null;
  evidenceId?: string | null;
  riskId?: string | null;
  frameworkCode?: string | null;
}

export interface RegulatoryImpactAssessment {
  id: string;
  workspaceId: string;
  changeLogId: string;
  impactScore: number;
  severity: ChangeSeverity;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  affectedControls: string[];
  affectedPolicies: string[];
  affectedRisks: string[];
  affectedVendors: string[];
  affectedAssets: string[];
  affectedProcesses: string[];
  affectedAiSystems: string[];
  requiredActions: string[];
  completedAt: string;
}

export interface RegulatoryDashboardSummary {
  totalRegulations: number;
  activeObligations: number;
  newRegulatoryChanges: number;
  pendingReviews: number;
  overdueActions: number;
  highImpactChanges: number;
  complianceExposure: number;
  affectedBusinessUnits: number;
  upcomingDeadlines: number;
  trendPoints: Array<{ label: string; changes: number; obligations: number }>;
  obligationStatusChart: Array<{ status: string; count: number }>;
  impactHeatmap: Array<{ area: string; severity: string; count: number }>;
  jurisdictionBreakdown: Array<{ jurisdiction: string; count: number }>;
  frameworkCoverage: Array<{ framework: string; mappedRequirements: number }>;
  executiveSummary: string[];
}

export interface RegulatoryWorkspaceState {
  dashboard: RegulatoryDashboardSummary;
  requirements: RegulatoryRequirement[];
  obligations: RegulatoryObligation[];
  changes: RegulatoryChangeLogEntry[];
  tasks: RegulatoryTask[];
  jurisdictions: RegulatoryJurisdiction[];
  mappings: RegulatoryMapping[];
  impacts: RegulatoryImpactAssessment[];
}
