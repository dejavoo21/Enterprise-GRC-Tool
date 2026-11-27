import type { WorkflowAssignment, WorkflowDecision, WorkflowStageDefinition, WorkflowStatus } from '../types/enterpriseWorkflow.js';
import type { PermissionModule } from '../types/accessGovernance.js';
import type { WorkspaceRole } from '../types/models.js';

export class WorkflowRuleError extends Error {}

const templateSources: Record<string, string[]> = {
  Risks: ['risk', 'treatment'],
  Controls: ['control'],
  Evidence: ['evidence'],
  Policies: ['policy'],
  Vendors: ['supplier', 'vendor'],
  Assets: ['asset'],
  Audits: ['finding'],
};
export const workflowNotificationEvents = ['assignment_created', 'approval_requested', 'assignment_acknowledged', 'changes_requested', 'approval_completed', 'rejection', 'due_date_approaching', 'overdue', 'escalation', 'workflow_completion'] as const;
export const workflowAssignmentRoles: WorkspaceRole[] = ['owner', 'admin', 'grc', 'auditor', 'viewer'];

function isWorkflowAssignmentRole(value: string): value is WorkspaceRole {
  return workflowAssignmentRoles.includes(value as WorkspaceRole);
}

export function validateTemplateSource(sourceModule: PermissionModule, sourceRecordType: string) {
  if (!templateSources[sourceModule]?.includes(sourceRecordType)) throw new WorkflowRuleError('Workflow template source module and record type are not supported');
}

export function validateStage(stage: WorkflowStageDefinition) {
  if (typeof stage.id !== 'string' || !stage.id.trim() || typeof stage.name !== 'string' || !stage.name.trim() || stage.name.trim().length > 160 || !Number.isInteger(stage.order) || stage.order < 1 || stage.order > 20) throw new WorkflowRuleError('Every workflow stage requires a valid ID, name, and order from 1 to 20');
  if (!['single', 'sequential', 'parallel'].includes(stage.mode) || !['review', 'approval', 'verification', 'escalation'].includes(stage.kind)) throw new WorkflowRuleError('Workflow stage mode or purpose is invalid');
  if (!Array.isArray(stage.assignedUserIds)) throw new WorkflowRuleError('Workflow stage reviewers must be supplied as a list');
  if (stage.assignedUserIds.some((userId) => typeof userId !== 'string' || !userId.trim())) throw new WorkflowRuleError('Workflow stage reviewer IDs must be non-empty strings');
  if (stage.assignedRole !== undefined && (typeof stage.assignedRole !== 'string' || !isWorkflowAssignmentRole(stage.assignedRole.trim()))) throw new WorkflowRuleError('Workflow stage role must be a valid workspace role');
  if (new Set(stage.assignedUserIds).size !== stage.assignedUserIds.length) throw new WorkflowRuleError('Workflow stage reviewers must be unique');
  const reviewerCount = stage.assignedUserIds.length + (stage.assignedRole?.trim() ? 1 : 0);
  if (reviewerCount === 0) throw new WorkflowRuleError('Every workflow stage requires an assigned user or role');
  if (stage.mode === 'single' && reviewerCount !== 1) throw new WorkflowRuleError('Single-reviewer stages require exactly one assigned user or role');
  if (!Number.isInteger(stage.quorum) || stage.quorum < 1 || stage.quorum > reviewerCount) throw new WorkflowRuleError('Stage quorum is invalid');
  if (!Number.isInteger(stage.dueDays) || stage.dueDays < 0 || stage.dueDays > 365) throw new WorkflowRuleError('Stage due days must be between 0 and 365');
  return stage;
}

export function validateStages(stages: WorkflowStageDefinition[]) {
  if (!stages.length) throw new WorkflowRuleError('A workflow template requires at least one stage');
  if (stages.length > 20) throw new WorkflowRuleError('A workflow template supports at most 20 stages');
  const orders = stages.map((stage) => validateStage(stage).order);
  if (new Set(orders).size !== orders.length) throw new WorkflowRuleError('Workflow stage order must be unique');
  if (new Set(stages.map((stage) => stage.id)).size !== stages.length) throw new WorkflowRuleError('Workflow stage IDs must be unique');
  return [...stages].sort((a, b) => a.order - b.order);
}

export function validateTemplateConfiguration(input: { sourceModule: PermissionModule; sourceRecordType: string; stages: WorkflowStageDefinition[]; escalationRules: Array<{ afterDays: number; targetRole?: string; targetUserId?: string }>; notificationEvents: string[] }) {
  validateTemplateSource(input.sourceModule, input.sourceRecordType);
  validateStages(input.stages);
  for (const rule of input.escalationRules) {
    const targetRole = typeof rule.targetRole === 'string' ? rule.targetRole.trim() : '';
    const targetUserId = typeof rule.targetUserId === 'string' ? rule.targetUserId.trim() : '';
    if (!Number.isInteger(rule.afterDays) || rule.afterDays < 1 || rule.afterDays > 365 || (!targetRole && !targetUserId) || (targetRole && !isWorkflowAssignmentRole(targetRole))) throw new WorkflowRuleError('Escalation rules require 1 to 365 days and a valid workspace role or member');
  }
  if (input.notificationEvents.some((event) => typeof event !== 'string' || !workflowNotificationEvents.includes(event as typeof workflowNotificationEvents[number]))) throw new WorkflowRuleError('Workflow notification event is not supported');
}

export function stageSatisfied(stage: WorkflowStageDefinition, assignments: WorkflowAssignment[]) {
  const relevant = assignments.filter((assignment) => assignment.stageId === stage.id);
  const approvals = relevant.filter((assignment) => assignment.decision === 'approve').length;
  if (relevant.some((assignment) => assignment.decision === 'reject')) return false;
  if (stage.mode === 'sequential') {
    const ordered = relevant.slice().sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    const firstPending = ordered.findIndex((assignment) => assignment.decision !== 'approve');
    return firstPending === -1 && approvals >= stage.quorum;
  }
  return approvals >= stage.quorum;
}

export function assertSequentialTurn(stage: WorkflowStageDefinition, assignment: WorkflowAssignment, assignments: WorkflowAssignment[]) {
  if (stage.mode !== 'sequential') return;
  const blocked = assignments.some((item) => item.stageId === stage.id && item.sequenceIndex < assignment.sequenceIndex && item.decision !== 'approve');
  if (blocked) throw new WorkflowRuleError('An earlier sequential reviewer must approve first');
}

export function assertDecisionAllowed(input: {
  workflowStatus: WorkflowStatus;
  stage: WorkflowStageDefinition;
  assignment: WorkflowAssignment;
  actorUserId: string;
  requesterUserId: string;
  evidenceIds: string[];
  decision: WorkflowDecision;
}) {
  if (['completed', 'cancelled', 'rejected'].includes(input.workflowStatus)) throw new WorkflowRuleError('This workflow no longer accepts decisions');
  if (['cancelled', 'delegated'].includes(input.assignment.status)) throw new WorkflowRuleError('This assignment no longer accepts decisions');
  if (input.assignment.assignedUserId && input.assignment.assignedUserId !== input.actorUserId) throw new WorkflowRuleError('This assignment belongs to another reviewer');
  if (input.assignment.status !== 'acknowledged') throw new WorkflowRuleError('Acknowledge this assignment before recording a decision');
  if (input.stage.independentReview && input.actorUserId === input.requesterUserId) throw new WorkflowRuleError('Independent review prevents self-approval');
  if (input.assignment.decision) throw new WorkflowRuleError('A decision has already been recorded');
  if (input.stage.evidenceRequired && input.decision === 'approve' && input.evidenceIds.length === 0) throw new WorkflowRuleError('Supporting evidence is required for approval');
}

export function validateDecisionPayload(decision: unknown, comments: unknown, evidenceIds: unknown) {
  if (!['approve', 'reject', 'request_changes'].includes(String(decision))) throw new WorkflowRuleError('Workflow decision is invalid');
  const rationale = typeof comments === 'string' ? comments.trim() : '';
  if (rationale.length < 5 || rationale.length > 2000) throw new WorkflowRuleError('Reviewer rationale must contain 5 to 2000 characters');
  if (!Array.isArray(evidenceIds) || evidenceIds.length > 50 || evidenceIds.some((id) => typeof id !== 'string' || !id.trim())) throw new WorkflowRuleError('Supporting evidence must contain at most 50 valid record IDs');
  const supportingEvidenceIds = [...new Set(evidenceIds.map((id) => id.trim()))];
  return { decision: decision as WorkflowDecision, comments: rationale, evidenceIds: supportingEvidenceIds };
}

export function nextWorkflowStatus(decision: WorkflowDecision): WorkflowStatus {
  if (decision === 'reject') return 'rejected';
  if (decision === 'request_changes') return 'changes_requested';
  return 'awaiting_review';
}

export function escalationEligibleAt(dueDate: string | Date, afterDays: number) {
  const dueAt = new Date(dueDate).getTime();
  if (!Number.isFinite(dueAt) || !Number.isInteger(afterDays) || afterDays < 0 || afterDays > 365) throw new WorkflowRuleError('Workflow escalation timing is invalid');
  return dueAt + afterDays * 86_400_000;
}

export function validateCancellationRationale(value: unknown) {
  const rationale = typeof value === 'string' ? value.trim() : '';
  return rationale.length >= 10 && rationale.length <= 1000 ? null : 'Cancellation rationale must contain 10 to 1000 characters';
}

export function notificationKey(workflowId: string, assignmentId: string | undefined, event: string, recipient: string) {
  return `${workflowId}:${assignmentId || 'workflow'}:${event}:${recipient}`;
}
