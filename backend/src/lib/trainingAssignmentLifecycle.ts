export const TRAINING_ASSIGNMENT_STATUSES = [
  'assigned',
  'not_started',
  'awaiting_acknowledgement',
  'in_progress',
  'completed',
  'passed',
  'failed',
  'overdue',
  'exempted',
  'cancelled',
  'expired',
  'refresher_required',
] as const;

export type TrainingAssignmentStatus = typeof TRAINING_ASSIGNMENT_STATUSES[number];

const transitions: Record<TrainingAssignmentStatus, readonly TrainingAssignmentStatus[]> = {
  assigned: ['not_started', 'awaiting_acknowledgement', 'in_progress', 'exempted', 'cancelled'],
  not_started: ['awaiting_acknowledgement', 'in_progress', 'exempted', 'cancelled'],
  awaiting_acknowledgement: ['in_progress', 'exempted', 'cancelled'],
  in_progress: ['completed', 'passed', 'failed', 'cancelled'],
  completed: ['expired', 'refresher_required'],
  passed: ['expired', 'refresher_required'],
  failed: ['refresher_required', 'in_progress', 'cancelled'],
  overdue: ['in_progress', 'completed', 'passed', 'failed', 'cancelled'],
  exempted: ['assigned', 'refresher_required'],
  cancelled: [],
  expired: ['refresher_required'],
  refresher_required: ['assigned', 'in_progress', 'cancelled'],
};

export function isTrainingAssignmentStatus(value: unknown): value is TrainingAssignmentStatus {
  return typeof value === 'string' && TRAINING_ASSIGNMENT_STATUSES.includes(value as TrainingAssignmentStatus);
}

export function canTransitionTrainingAssignment(from: TrainingAssignmentStatus, to: TrainingAssignmentStatus): boolean {
  return transitions[from].includes(to);
}

export function isTrainingCompletionStatus(status: TrainingAssignmentStatus): boolean {
  return status === 'completed' || status === 'passed';
}

export type AwarenessCampaignStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export function canTransitionAwarenessCampaign(from: AwarenessCampaignStatus, to: AwarenessCampaignStatus): boolean {
  if (from === 'planned') return to === 'active' || to === 'cancelled';
  if (from === 'active') return to === 'completed' || to === 'cancelled';
  return false;
}
