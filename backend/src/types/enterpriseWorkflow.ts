import type { PermissionModule } from './accessGovernance.js';

export type WorkflowMode = 'sequential' | 'parallel' | 'single';
export type WorkflowStatus = 'draft' | 'submitted' | 'awaiting_review' | 'changes_requested' | 'rejected' | 'approved' | 'completed' | 'overdue' | 'escalated' | 'cancelled';
export type AssignmentStatus = 'pending' | 'awaiting_acknowledgement' | 'acknowledged' | 'approved' | 'rejected' | 'changes_requested' | 'delegated' | 'cancelled';
export type WorkflowDecision = 'approve' | 'reject' | 'request_changes';
export type WorkflowNotificationStatus = 'active' | 'read' | 'archived';

export interface WorkflowStageDefinition {
  id: string;
  name: string;
  order: number;
  mode: WorkflowMode;
  kind: 'review' | 'approval' | 'verification' | 'escalation';
  assignedRole?: string;
  assignedUserIds: string[];
  quorum: number;
  dueDays: number;
  independentReview: boolean;
  evidenceRequired: boolean;
}

export interface WorkflowTemplate {
  id: string;
  workspaceId: string;
  name: string;
  sourceModule: PermissionModule;
  sourceRecordType: string;
  version: number;
  stages: WorkflowStageDefinition[];
  escalationRules: Array<{ afterDays: number; targetRole?: string; targetUserId?: string }>;
  notificationEvents: string[];
  status: 'draft' | 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInstance {
  id: string;
  workspaceId: string;
  templateId: string;
  templateVersion: number;
  name: string;
  sourceModule: PermissionModule;
  sourceRecordType: string;
  sourceRecordId: string;
  sourceRecordReference?: string;
  ownerUserId: string;
  requestedByUserId: string;
  currentStageOrder: number;
  status: WorkflowStatus;
  effectiveDate?: string;
  reviewDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowAssignment {
  id: string;
  workspaceId: string;
  workflowId: string;
  stageId: string;
  stageOrder: number;
  sequenceIndex: number;
  assignedUserId?: string;
  assignedRole?: string;
  requestedByUserId: string;
  assignedAt: string;
  acknowledgedAt?: string;
  dueDate?: string;
  status: AssignmentStatus;
  decision?: WorkflowDecision;
  decisionAt?: string;
  reviewerComments?: string;
  supportingEvidenceIds: string[];
  delegatedFromUserId?: string;
}

export interface WorkflowNotification {
  id: string;
  workflow_id: string;
  assignment_id?: string;
  event_type: string;
  recipient_user_id?: string;
  recipient_role?: string;
  channel: string;
  delivery_status: string;
  attempt_count: number;
  inbox_status: WorkflowNotificationStatus;
  read_at?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseWorkflowState {
  templates: WorkflowTemplate[];
  workflows: WorkflowInstance[];
  assignments: WorkflowAssignment[];
  escalations: Array<Record<string, unknown>>;
  notifications: WorkflowNotification[];
  history: Array<Record<string, unknown>>;
  summary: { active: number; awaitingApproval: number; overdue: number; escalated: number; completed: number; rejected: number };
}
