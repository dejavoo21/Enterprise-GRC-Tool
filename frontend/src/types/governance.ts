// Governance Document Types
export type GovernanceDocumentType =
  | 'policy'
  | 'procedure'
  | 'standard'
  | 'guideline'
  | 'manual'
  | 'other';

export type GovernanceDocumentStatus =
  | 'draft'
  | 'approved'
  | 'in_review'
  | 'retired';

export interface GovernanceDocument {
  id: string;
  workspaceId: string;
  title: string;
  docType: GovernanceDocumentType;
  owner: string;
  status: GovernanceDocumentStatus;
  currentVersion?: string;
  locationUrl?: string;
  reviewFrequencyMonths?: number;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGovernanceDocumentInput {
  title: string;
  docType: GovernanceDocumentType;
  owner: string;
  status?: GovernanceDocumentStatus;
  currentVersion?: string;
  locationUrl?: string;
  reviewFrequencyMonths?: number;
  nextReviewDate?: string;
}

// Review Task Types
export type ReviewTaskStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export interface ReviewTask {
  id: string;
  workspaceId: string;
  documentId: string;
  title: string;
  description?: string;
  assignee: string;
  status: ReviewTaskStatus;
  dueAt: string;
  reminderDaysBefore: number[];
  lastReminderSentAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateReviewTaskInput {
  documentId: string;
  title: string;
  description?: string;
  assignee: string;
  dueAt: string;
  reminderDaysBefore?: number[];
}

// Document Review Log Types
export type DocumentReviewDecision =
  | 'no_change'
  | 'update_required'
  | 'retire';

export interface DocumentReviewLog {
  id: string;
  workspaceId: string;
  documentId: string;
  reviewTaskId: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: DocumentReviewDecision;
  comments?: string;
  newVersion?: string;
}

export interface CreateDocumentReviewLogInput {
  documentId: string;
  reviewTaskId: string;
  reviewedBy: string;
  decision: DocumentReviewDecision;
  comments?: string;
  newVersion?: string;
}

// Summary Types
export interface GovernanceDocumentSummary {
  total: number;
  byType: Record<GovernanceDocumentType, number>;
  byStatus: Record<GovernanceDocumentStatus, number>;
  dueForReview: number;
}

export interface ReviewTaskSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  overdue: number;
}
