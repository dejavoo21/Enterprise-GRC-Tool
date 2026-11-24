import type { AiApprovalStatus, AiValidationStatus } from '../types/aiGovernance.js';

function ruleError(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export function assertModelSubmission(status: AiApprovalStatus, validationStatus: AiValidationStatus): void {
  if (status !== 'pending' && status !== 'rejected') ruleError('INVALID_TRANSITION', 'Only pending or rejected models can be submitted.');
  if (validationStatus !== 'validated' && validationStatus !== 'conditional') ruleError('VALIDATION_REQUIRED', 'Model validation must be validated or conditional before review.');
}

export function assertIndependentModelDecision(status: AiApprovalStatus, createdBy: string | undefined, reviewerId: string): void {
  if (status !== 'in_review') ruleError('INVALID_TRANSITION', 'Only models under review can be decided.');
  if (!createdBy) ruleError('CREATOR_UNKNOWN', 'Independent approval requires recorded creator provenance.');
  if (createdBy === reviewerId) ruleError('SELF_APPROVAL', 'The model creator cannot approve or reject their own model.');
}
