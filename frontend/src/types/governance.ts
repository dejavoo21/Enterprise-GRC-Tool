// Governance Document Types
export type GovernanceDocumentType =
  | 'policy'
  | 'standard'
  | 'procedure'
  | 'guideline'
  | 'framework_document'
  | 'risk_document'
  | 'control_document'
  | 'evidence_document'
  | 'audit_document'
  | 'training_material'
  | 'incident_document'
  | 'vendor_document'
  | 'compliance_register'
  | 'management_review_document'
  | 'custom';

export type GovernanceDocumentStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'published'
  | 'active'
  | 'expired'
  | 'superseded'
  | 'archived'
  | 'retired'
  | 'rejected'
  | 'pending_attestation';

export type GovernanceDocumentClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted';

export interface GovernanceDocument {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  docType: GovernanceDocumentType;
  owner: string;
  status: GovernanceDocumentStatus;
  classification?: GovernanceDocumentClassification;
  currentVersion?: string;
  locationUrl?: string;
  reviewFrequencyMonths?: number;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  publishedAt?: string;
  effectiveDate?: string;
  expiryDate?: string;
  archivedAt?: string;
  supersededById?: string;
  attestationRequired: boolean;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGovernanceDocumentInput {
  title: string;
  description?: string;
  docType: GovernanceDocumentType;
  owner: string;
  status?: GovernanceDocumentStatus;
  classification?: GovernanceDocumentClassification;
  currentVersion?: string;
  locationUrl?: string;
  reviewFrequencyMonths?: number;
  nextReviewDate?: string;
  publishedAt?: string;
  effectiveDate?: string;
  expiryDate?: string;
  archivedAt?: string;
  supersededById?: string;
  attestationRequired?: boolean;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
}

export type PolicyRuleOperator = 'equals' | 'contains' | 'in';
export type PolicyRuleField = 'data_classification' | 'business_unit' | 'system_type' | 'location' | 'provider';
export type PolicyRuleResponseMode = 'monitor' | 'review';

export interface PolicyRuleCriterion {
  field: PolicyRuleField;
  operator: PolicyRuleOperator;
  value: string;
}

export interface GovernancePolicyRule {
  id: string;
  workspaceId: string;
  documentId: string;
  name: string;
  description?: string;
  scopeSummary: string;
  matchCriteria: PolicyRuleCriterion[];
  excludeCriteria: PolicyRuleCriterion[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  responseMode: PolicyRuleResponseMode;
  plainLanguageSummary: string;
  status: 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';
  createdBy?: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateGovernancePolicyRuleInput = Omit<GovernancePolicyRule, 'id' | 'workspaceId' | 'documentId' | 'status' | 'createdBy' | 'submittedBy' | 'submittedAt' | 'approvedBy' | 'approvedAt' | 'decisionReason' | 'createdAt' | 'updatedAt'>;

export interface GovernancePolicyRuleEvent {
  id: string;
  eventType: 'created' | 'updated' | 'submitted' | 'activated' | 'rejected' | 'returned' | 'archived';
  actorUserId?: string;
  actorEmail?: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
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
  assigneeEmail?: string;
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
  assigneeEmail?: string;
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
