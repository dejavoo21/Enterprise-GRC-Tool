export const RECORD_CLASSIFICATIONS = ['Public', 'Internal', 'Confidential', 'Restricted'] as const;
export const DISPOSAL_STATUSES = ['Proposed', 'Eligibility Review', 'Approval', 'Scheduled', 'Execution Pending', 'Verified Completed', 'Rejected', 'Deferred', 'Cancelled', 'Blocked by Hold'] as const;

export type RetentionInput = { triggerDate?: string | null; durationMonths?: number | null; reviewDate?: string | null; archivedAt?: string | null; activeHoldCount?: number; now?: Date };

export function calculateRetention(input: RetentionInput) {
  const now = input.now ?? new Date();
  if (input.activeHoldCount && input.activeHoldCount > 0) return { status: 'On Hold', eligibilityDate: null };
  if (!input.triggerDate || !input.durationMonths || input.durationMonths < 1) return { status: 'Retention Unavailable', eligibilityDate: null };
  const trigger = new Date(input.triggerDate);
  if (Number.isNaN(trigger.getTime())) return { status: 'Retention Unavailable', eligibilityDate: null };
  const eligibility = new Date(trigger);
  eligibility.setUTCMonth(eligibility.getUTCMonth() + input.durationMonths);
  if (input.archivedAt) return { status: 'Eligible for Archival', eligibilityDate: eligibility.toISOString().slice(0, 10) };
  if (eligibility <= now) return { status: 'Disposal Review Required', eligibilityDate: eligibility.toISOString().slice(0, 10) };
  if (input.reviewDate) {
    const review = new Date(input.reviewDate);
    if (!Number.isNaN(review.getTime()) && review <= now) return { status: 'Review Due', eligibilityDate: eligibility.toISOString().slice(0, 10) };
  }
  return { status: 'Active', eligibilityDate: eligibility.toISOString().slice(0, 10) };
}

export function validateRetentionRule(input: { name?: string; recordType?: string; triggerEvent?: string; durationMonths?: number; classification?: string }) {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('Rule name is required.');
  if (!['governance_document', 'evidence', 'risk', 'supplier', 'audit_finding', 'privacy_data', 'security_incident', 'security_vulnerability', 'ai_system'].includes(input.recordType ?? '')) errors.push('A supported record type is required.');
  if (!['created_at', 'updated_at', 'effective_date', 'collected_at', 'detected_at', 'discovered_at'].includes(input.triggerEvent ?? '')) errors.push('A supported trigger event is required.');
  if (!Number.isInteger(input.durationMonths) || (input.durationMonths ?? 0) < 1) errors.push('Retention duration must be a positive whole number of months.');
  if (input.classification && !RECORD_CLASSIFICATIONS.includes(input.classification as typeof RECORD_CLASSIFICATIONS[number])) errors.push('Unsupported classification.');
  return errors;
}

export function validateDisposalTransition(current: string, next: string, activeHoldCount = 0) {
  if (activeHoldCount > 0 && !['Blocked by Hold', 'Cancelled', 'Deferred'].includes(next)) return 'Active legal holds block disposal progression.';
  const transitions: Record<string, string[]> = {
    Proposed: ['Eligibility Review', 'Rejected', 'Cancelled'],
    'Eligibility Review': ['Approval', 'Deferred', 'Rejected', 'Blocked by Hold'],
    Approval: ['Scheduled', 'Deferred', 'Rejected', 'Blocked by Hold'],
    Scheduled: ['Execution Pending', 'Cancelled', 'Blocked by Hold'],
    'Execution Pending': ['Verified Completed', 'Deferred', 'Blocked by Hold'],
    'Blocked by Hold': ['Eligibility Review', 'Cancelled'],
    Deferred: ['Eligibility Review', 'Cancelled'],
  };
  return transitions[current]?.includes(next) ? null : `Cannot move disposal request from ${current} to ${next}.`;
}

export function validateArchiveTransition(current: string, next: string) {
  const transitions: Record<string, string[]> = { Proposed: ['Eligibility Review','Rejected','Cancelled'], 'Eligibility Review': ['Approval','Deferred','Rejected'], Approval: ['Scheduled','Deferred','Rejected'], Scheduled: ['Execution Pending','Cancelled'], 'Execution Pending': ['Deferred'], Deferred: ['Eligibility Review','Cancelled'] };
  return transitions[current]?.includes(next) ? null : `Cannot move archive request from ${current} to ${next}.`;
}

export function validateHoldTransition(current:string,next:string){const transitions:Record<string,string[]>={'Pending Approval':['Active','Rejected'],Active:['Released']};return transitions[current]?.includes(next)?null:`Cannot move legal hold from ${current} to ${next}.`;}
