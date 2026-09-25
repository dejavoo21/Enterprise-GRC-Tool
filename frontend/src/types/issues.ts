export type IssueStatus = 'Open' | 'In Progress' | 'Pending' | 'Resolved';
export type IssuePriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type IssueSourceType = 'Risk' | 'Evidence' | 'Review Task' | 'Training';
export type CiaImpact = 'Confidentiality' | 'Integrity' | 'Availability';

export type IssueRecord = {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  owner: string;
  status: IssueStatus;
  priority: IssuePriority;
  dueDate?: string;
  domain: string;
  sourceType: IssueSourceType;
  sourceStatus?: string;
  isOverdue: boolean;
  linkedRiskId?: string;
  linkedRiskRef?: string;
  linkedControlIds: string[];
  linkedEvidenceIds: string[];
  linkedReviewTaskIds: string[];
  linkedTrainingAssignmentIds: string[];
  ciaImpacts: CiaImpact[];
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};

export type ApiError = {
  code: string;
  message: string;
};
