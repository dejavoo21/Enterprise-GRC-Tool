export type PolicyWorkflowOutcome = 'submitted' | 'approved' | 'rejected' | 'changes_requested';

export function policyStatusForWorkflowOutcome(
  currentStatus: string,
  outcome: PolicyWorkflowOutcome,
): string {
  if (['published', 'active', 'expired', 'superseded', 'archived', 'retired'].includes(currentStatus)) {
    return currentStatus;
  }
  if (outcome === 'approved') return 'approved';
  if (outcome === 'rejected') return 'rejected';
  return 'under_review';
}

export function assertPolicyCanBePublished(status: string, workflowStatus: string) {
  if (workflowStatus !== 'approved') throw new Error('The policy workflow must be approved before publication');
  if (status !== 'approved') throw new Error('Only an approved policy can be published');
}

export function assertPolicyCanBeAcknowledged(status: string) {
  if (!['published', 'active'].includes(status)) throw new Error('Only a published or active policy can be acknowledged');
}
