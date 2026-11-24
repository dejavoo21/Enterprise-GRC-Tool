import type { ReviewStatus, TaskStatus } from '../types/regulatory.js';

export function assertChangeTransition(current: ReviewStatus, next: ReviewStatus) {
  const allowed: Record<ReviewStatus, ReviewStatus[]> = {
    pending: ['in_review'],
    in_review: ['approved', 'rejected'],
    approved: [],
    rejected: ['in_review'],
  };
  if (!allowed[current].includes(next)) throw new Error(`Invalid regulatory change transition: ${current} -> ${next}`);
}

export function assertIndependentApproval(createdBy: string | null | undefined, actorUserId: string) {
  if (!createdBy) throw new Error('Change creator provenance is required before approval');
  if (createdBy === actorUserId) throw new Error('The change creator cannot approve or reject their own change');
}

export function assertTaskTransition(current: TaskStatus, next: TaskStatus) {
  const allowed: Record<TaskStatus, TaskStatus[]> = {
    open: ['in_progress', 'blocked'],
    in_progress: ['blocked', 'completed'],
    blocked: ['in_progress'],
    completed: [],
    overdue: ['in_progress', 'blocked', 'completed'],
  };
  if (!allowed[current].includes(next)) throw new Error(`Invalid regulatory task transition: ${current} -> ${next}`);
}
