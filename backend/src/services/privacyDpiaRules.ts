export type DpiaApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

function ruleError(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export function assertDpiaSubmission(status: DpiaApprovalStatus, linkedEvidenceIds: string[]): void {
  if (status !== 'draft' && status !== 'rejected') ruleError('INVALID_TRANSITION', 'Only draft or rejected DPIAs can be submitted.');
  if (!linkedEvidenceIds.length) ruleError('EVIDENCE_REQUIRED', 'At least one validated evidence record is required before DPIA submission.');
}

export function assertDpiaDecision(status: DpiaApprovalStatus, createdBy: string | undefined, reviewerId: string): void {
  if (status !== 'in_review') ruleError('INVALID_TRANSITION', 'Only DPIAs pending review can be approved or rejected.');
  if (createdBy && createdBy === reviewerId) ruleError('SELF_APPROVAL', 'The DPIA creator cannot approve or reject their own assessment.');
}
