import type { WorkflowAssignment, WorkflowDecision, WorkflowStageDefinition, WorkflowStatus } from '../types/enterpriseWorkflow.js';

export class WorkflowRuleError extends Error {}

export function validateStage(stage: WorkflowStageDefinition) {
  if (!stage.id || !stage.name || stage.order < 1) throw new WorkflowRuleError('Every workflow stage requires an ID, name, and positive order');
  const reviewerCount = stage.assignedUserIds.length + (stage.assignedRole ? 1 : 0);
  if (reviewerCount === 0) throw new WorkflowRuleError('Every workflow stage requires an assigned user or role');
  if (stage.quorum < 1 || (stage.mode !== 'sequential' && stage.quorum > Math.max(1, reviewerCount))) throw new WorkflowRuleError('Stage quorum is invalid');
  if (stage.dueDays < 0) throw new WorkflowRuleError('Stage due days cannot be negative');
  return stage;
}

export function validateStages(stages: WorkflowStageDefinition[]) {
  if (!stages.length) throw new WorkflowRuleError('A workflow template requires at least one stage');
  const orders = stages.map((stage) => validateStage(stage).order);
  if (new Set(orders).size !== orders.length) throw new WorkflowRuleError('Workflow stage order must be unique');
  return [...stages].sort((a, b) => a.order - b.order);
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
  if (input.assignment.assignedUserId && input.assignment.assignedUserId !== input.actorUserId) throw new WorkflowRuleError('This assignment belongs to another reviewer');
  if (input.assignment.assignedUserId && input.assignment.status !== 'acknowledged') throw new WorkflowRuleError('Acknowledge this assignment before recording a decision');
  if (input.stage.independentReview && input.actorUserId === input.requesterUserId) throw new WorkflowRuleError('Independent review prevents self-approval');
  if (input.assignment.decision) throw new WorkflowRuleError('A decision has already been recorded');
  if (input.stage.evidenceRequired && input.decision === 'approve' && input.evidenceIds.length === 0) throw new WorkflowRuleError('Supporting evidence is required for approval');
}

export function nextWorkflowStatus(decision: WorkflowDecision): WorkflowStatus {
  if (decision === 'reject') return 'rejected';
  if (decision === 'request_changes') return 'changes_requested';
  return 'awaiting_review';
}

export function notificationKey(workflowId: string, assignmentId: string | undefined, event: string, recipient: string) {
  return `${workflowId}:${assignmentId || 'workflow'}:${event}:${recipient}`;
}
