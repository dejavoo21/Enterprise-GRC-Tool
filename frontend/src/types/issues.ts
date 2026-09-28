export type IssueStatus = 'Open' | 'In Progress' | 'Blocked' | 'Awaiting Evidence' | 'Awaiting Review' | 'Completed' | 'Deferred' | 'Cancelled' | 'Pending' | 'Resolved';
export type IssuePriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type IssueSourceType = 'Risk' | 'Treatment' | 'Control' | 'Evidence' | 'Audit Readiness' | 'Access Review' | 'Asset Review' | 'Vendor' | 'Review Task' | 'Training' | 'Manual';
export type CiaImpact = 'Confidentiality' | 'Integrity' | 'Availability';

export type IssueRecord = {
  id: string;
  actionRef?: string;
  workspaceId: string;
  title: string;
  description?: string;
  owner: string;
  status: IssueStatus;
  priority: IssuePriority;
  dueDate?: string;
  domain: string;
  sourceType: IssueSourceType;
  sourceReference?: string;
  sourceStatus?: string;
  isOverdue: boolean;
  linkedRiskId?: string;
  linkedRiskRef?: string;
  linkedLibraryRiskId?: string;
  linkedTreatmentPlanId?: string;
  linkedControlIds: string[];
  linkedEvidenceIds: string[];
  linkedReviewTaskIds: string[];
  linkedTrainingAssignmentIds: string[];
  ciaImpacts: CiaImpact[];
  updatedAt?: string;
  completedAt?: string;
  notes?: string;
  outsideAppetite?: boolean;
  blockerReason?: string;
  evidenceRequired?: string;
  sourceManaged?: boolean;
  treatmentProgress?: number;
  targetRiskScore?: number | null;
  targetRiskRating?: string | null;
  expectedResidualScore?: number | null;
  expectedResidualRating?: string | null;
  activityHistory?: import('./activityLedger').ActivityLedgerEntry[];
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};

export type ApiError = {
  code: string;
  message: string;
};
