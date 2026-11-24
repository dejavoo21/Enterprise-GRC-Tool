export type AssuranceReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export function assertAssuranceSubmission(status: AssuranceReviewStatus, evidenceIds: string[]): void {
  if (status !== 'draft' && status !== 'rejected') throw Object.assign(new Error('Only draft or rejected assessments can be submitted.'), { code: 'INVALID_TRANSITION' });
  if (evidenceIds.length === 0) throw Object.assign(new Error('Control effectiveness review requires at least one evidence reference.'), { code: 'EVIDENCE_REQUIRED' });
}

export function assertAssuranceDecision(status: AssuranceReviewStatus, createdBy: string, actorId: string): void {
  if (status !== 'pending_review') throw Object.assign(new Error('Only assessments pending review can be decided.'), { code: 'INVALID_TRANSITION' });
  if (createdBy === actorId) throw Object.assign(new Error('Assessment creators cannot approve or reject their own assessment.'), { code: 'SELF_APPROVAL' });
}
