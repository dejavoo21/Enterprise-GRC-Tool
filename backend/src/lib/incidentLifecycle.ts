import type { IncidentStatus, VulnerabilityStatus } from '../types/incidentManagement.js';

const incidentTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['triaged', 'cancelled'],
  triaged: ['investigating', 'cancelled'],
  investigating: ['contained', 'remediating', 'cancelled'],
  contained: ['remediating', 'resolved'],
  remediating: ['resolved'],
  resolved: ['closed', 'investigating'],
  closed: [],
  cancelled: [],
};

const vulnerabilityTransitions: Record<VulnerabilityStatus, VulnerabilityStatus[]> = {
  identified: ['triaged', 'false_positive'],
  triaged: ['remediation_planned', 'accepted', 'false_positive'],
  remediation_planned: ['in_progress', 'accepted'],
  in_progress: ['mitigated', 'accepted'],
  mitigated: ['closed', 'in_progress'],
  accepted: ['closed', 'in_progress'],
  closed: [],
  false_positive: [],
};

export const incidentStatuses = Object.keys(incidentTransitions) as IncidentStatus[];
export const vulnerabilityStatuses = Object.keys(vulnerabilityTransitions) as VulnerabilityStatus[];

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus) {
  return incidentTransitions[from]?.includes(to) || false;
}

export function canTransitionVulnerability(from: VulnerabilityStatus, to: VulnerabilityStatus) {
  return vulnerabilityTransitions[from]?.includes(to) || false;
}

export function nextIncidentStatuses(status: IncidentStatus) { return incidentTransitions[status] || []; }
export function nextVulnerabilityStatuses(status: VulnerabilityStatus) { return vulnerabilityTransitions[status] || []; }
