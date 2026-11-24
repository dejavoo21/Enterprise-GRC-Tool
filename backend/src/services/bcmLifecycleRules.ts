function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: 'INVALID_TRANSITION' });
}

export function assertRecoveryPlanSubmission(status: string): void {
  if (status !== 'draft') invalid('Only draft recovery plans can be submitted for review.');
}

export function assertIndependentRecoveryPlanApproval(status: string, creatorId: string | null | undefined, approverId: string | null | undefined): asserts approverId is string {
  if (status !== 'in_review') invalid('Recovery plan must be under review before approval.');
  if (!approverId) invalid('Authenticated approver identity is required.');
  if (creatorId && creatorId === approverId) invalid('The recovery plan creator cannot independently approve it.');
}

export function assertCorrectiveActionTransition(current: string, next: string): void {
  const allowed: Record<string, string[]> = {
    open: ['in_progress', 'blocked'],
    in_progress: ['blocked', 'awaiting_review'],
    blocked: ['in_progress'],
    awaiting_review: ['in_progress'],
    closed: [],
  };
  if (!allowed[current]?.includes(next)) invalid(`Corrective action cannot move from ${current} to ${next}.`);
}

export function assertIndependentCorrectiveClosure(currentStatus: string, creatorId: string | null | undefined, reviewerId: string | null | undefined, evidenceIds: string[], closureNotes: string): asserts reviewerId is string {
  if (currentStatus !== 'awaiting_review') invalid('Corrective action must be awaiting review before closure.');
  if (!reviewerId) invalid('Authenticated reviewer identity is required.');
  if (creatorId && creatorId === reviewerId) invalid('The corrective action creator cannot independently close it.');
  if (!evidenceIds.length || !closureNotes.trim()) invalid('Evidence and closure notes are required.');
}
