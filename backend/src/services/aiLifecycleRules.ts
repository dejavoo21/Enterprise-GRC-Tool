function transitionError(message: string): never {
  throw Object.assign(new Error(message), { code: 'INVALID_TRANSITION' });
}

export function assertAiSystemDecision(status: string): void {
  if (status !== 'under_review' && status !== 'validation') transitionError('Only AI systems under review can be approved or rejected.');
}

export function assertAssessmentTransition(current: string, next: string, decision = false): void {
  if (decision) {
    if (current !== 'under_review' && current !== 'in_review') transitionError('Only AI assessments under review can be approved or rejected.');
    return;
  }
  const allowed: Record<string, string[]> = {
    draft: ['in_progress'],
    not_started: ['in_progress'],
    in_progress: ['awaiting_information', 'under_review', 'remediation_required'],
    awaiting_information: ['in_progress'],
    remediation_required: ['in_progress', 'under_review'],
    rejected: ['in_progress'],
    approved: ['reassessment_required'],
    completed: ['reassessment_required'],
    reassessment_required: ['in_progress'],
  };
  if (!allowed[current]?.includes(next)) transitionError(`Assessment cannot move from ${current} to ${next}.`);
}

export function assertIncidentTransition(current: string, next: string): void {
  const allowed: Record<string, string[]> = { open: ['investigating', 'reported'], investigating: ['resolved', 'reported'], reported: ['investigating', 'resolved'], resolved: [] };
  if (!allowed[current]?.includes(next)) transitionError(`Incident cannot move from ${current} to ${next}.`);
}

export function assertControlTransition(current: string, next: string): void {
  const allowed: Record<string, string[]> = { planned: ['implemented', 'needs_attention'], needs_attention: ['planned', 'implemented'], implemented: ['needs_attention'] };
  if (!allowed[current]?.includes(next)) transitionError(`Control cannot move from ${current} to ${next}.`);
}
