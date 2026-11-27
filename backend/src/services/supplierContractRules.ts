export const SUPPLIER_STATUSES = ['onboarding', 'pending_approval', 'active', 'suspended', 'offboarded', 'archived'] as const;
export type SupplierStatus = typeof SUPPLIER_STATUSES[number];

export const ASSESSMENT_STATUSES = ['draft', 'not_started', 'in_progress', 'pending_review', 'submitted', 'under_review', 'completed', 'approved', 'approved_with_conditions', 'rejected', 'expired'] as const;
export type SupplierAssessmentStatus = typeof ASSESSMENT_STATUSES[number];

export const CONTRACT_STATUSES = ['draft', 'pending_review', 'under_review', 'approved', 'active', 'renewal_due', 'expired', 'terminated', 'archived'] as const;
export type SupplierContractStatus = typeof CONTRACT_STATUSES[number];

export const QUESTIONNAIRE_STATUSES = ['draft', 'sent', 'in_progress', 'submitted', 'reviewed'] as const;
export type SupplierQuestionnaireStatus = typeof QUESTIONNAIRE_STATUSES[number];

export const SUPPLIER_INCIDENT_STATUSES = ['open', 'investigating', 'mitigating', 'resolved', 'closed'] as const;
export type SupplierIncidentStatus = typeof SUPPLIER_INCIDENT_STATUSES[number];

const supplierTransitions: Record<SupplierStatus, readonly SupplierStatus[]> = {
  onboarding: ['pending_approval', 'archived'],
  pending_approval: ['active', 'onboarding', 'archived'],
  active: ['suspended', 'offboarded'],
  suspended: ['active', 'offboarded'],
  offboarded: ['archived'],
  archived: [],
};

const assessmentTransitions: Record<SupplierAssessmentStatus, readonly SupplierAssessmentStatus[]> = {
  draft: ['in_progress'],
  not_started: ['in_progress'],
  in_progress: ['submitted'],
  pending_review: ['under_review'],
  submitted: ['under_review'],
  under_review: ['approved', 'approved_with_conditions', 'rejected'],
  completed: ['expired'],
  approved: ['expired'],
  approved_with_conditions: ['expired'],
  rejected: ['in_progress'],
  expired: ['in_progress'],
};

const contractTransitions: Record<SupplierContractStatus, readonly SupplierContractStatus[]> = {
  draft: ['under_review', 'archived'],
  pending_review: ['approved', 'draft', 'terminated'],
  under_review: ['approved', 'draft', 'terminated'],
  approved: ['active', 'terminated'],
  active: ['renewal_due', 'expired', 'terminated'],
  renewal_due: ['under_review', 'expired', 'terminated'],
  expired: ['under_review', 'terminated', 'archived'],
  terminated: ['archived'],
  archived: [],
};

const questionnaireTransitions: Record<SupplierQuestionnaireStatus, readonly SupplierQuestionnaireStatus[]> = {
  draft: ['sent'],
  sent: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['reviewed', 'in_progress'],
  reviewed: [],
};

const incidentTransitions: Record<SupplierIncidentStatus, readonly SupplierIncidentStatus[]> = {
  open: ['investigating'],
  investigating: ['mitigating'],
  mitigating: ['resolved'],
  resolved: ['closed', 'investigating'],
  closed: [],
};

export class SupplierLifecycleError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

function assertTransition<T extends string>(current: T, next: T, transitions: Record<T, readonly T[]>, label: string) {
  if (current === next) return;
  if (!transitions[current]?.includes(next)) {
    throw new SupplierLifecycleError('INVALID_STATUS_TRANSITION', `${label} cannot transition from ${current} to ${next}.`);
  }
}

export function assertSupplierTransition(current: SupplierStatus, next: SupplierStatus) {
  assertTransition(current, next, supplierTransitions, 'Supplier');
}

export function assertAssessmentTransition(current: SupplierAssessmentStatus, next: SupplierAssessmentStatus) {
  assertTransition(current, next, assessmentTransitions, 'Assessment');
}

export function assertContractTransition(current: SupplierContractStatus, next: SupplierContractStatus) {
  assertTransition(current, next, contractTransitions, 'Contract');
}

export function assertQuestionnaireTransition(current: SupplierQuestionnaireStatus, next: SupplierQuestionnaireStatus) {
  assertTransition(current, next, questionnaireTransitions, 'Questionnaire');
}

export function assertQuestionnaireResponseAllowed(status: SupplierQuestionnaireStatus, isTemplate: boolean) {
  if (isTemplate) throw new SupplierLifecycleError('TEMPLATE_RESPONSE_PROHIBITED', 'Template questionnaires cannot record supplier responses.');
  if (!['sent', 'in_progress'].includes(status)) {
    throw new SupplierLifecycleError('QUESTIONNAIRE_NOT_OPEN', 'Responses can only be recorded while a questionnaire is sent or in progress.');
  }
}

export function assertSupplierIncidentTransition(current: SupplierIncidentStatus, next: SupplierIncidentStatus) {
  assertTransition(current, next, incidentTransitions, 'Supplier incident');
}

export function assertSupplierIncidentResolution(next: SupplierIncidentStatus, rootCause?: string | null, remediation?: string | null) {
  if (next === 'resolved' && (!rootCause?.trim() || !remediation?.trim())) {
    throw new SupplierLifecycleError('RESOLUTION_EVIDENCE_REQUIRED', 'Root cause and remediation are required before resolving a supplier incident.');
  }
}

export function assertIndependentDecision(createdBy: string | null | undefined, reviewerId: string, decision: string) {
  if (['approved', 'approved_with_conditions', 'rejected'].includes(decision) && createdBy && createdBy === reviewerId) {
    throw new SupplierLifecycleError('SELF_APPROVAL_PROHIBITED', 'The record creator cannot make the independent approval decision.');
  }
}

export function calculateContractDates(expirationDate?: string | null, noticeDays = 0, now = new Date()) {
  if (!expirationDate) return { daysToExpiry: null, noticeDate: null, renewalState: 'not_scheduled' as const };
  const expiry = new Date(`${expirationDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(expiry.getTime())) throw new SupplierLifecycleError('INVALID_DATE', 'Contract expiry date is invalid.');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  const noticeDate = new Date(expiry.getTime() - Math.max(0, noticeDays) * 86_400_000).toISOString().slice(0, 10);
  return {
    daysToExpiry,
    noticeDate,
    renewalState: daysToExpiry < 0 ? 'overdue' as const : today.toISOString().slice(0, 10) >= noticeDate ? 'action_required' as const : 'scheduled' as const,
  };
}

export function assertSupplierCanOffboard(openContracts: number, openActions: number) {
  if (openContracts > 0 || openActions > 0) {
    throw new SupplierLifecycleError('OFFBOARDING_BLOCKED', `Supplier has ${openContracts} active contracts and ${openActions} open actions.`);
  }
}
