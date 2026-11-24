import { apiCall } from './api';
import type { IncidentManagementState, IncidentStatus, SecurityCaseEvent, SecurityIncident, SecurityVulnerability, VulnerabilityStatus } from '../types/incidentManagement';

type ApiEnvelope<T> = { data: T; error: null };

export async function getIncidentManagementState() {
  return (await apiCall<ApiEnvelope<IncidentManagementState>>('/api/v1/incidents/state')).data;
}

export async function createSecurityIncident(input: Record<string, unknown>) {
  return (await apiCall<ApiEnvelope<SecurityIncident>>('/api/v1/incidents/incidents', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function createSecurityVulnerability(input: Record<string, unknown>) {
  return (await apiCall<ApiEnvelope<SecurityVulnerability>>('/api/v1/incidents/vulnerabilities', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function transitionSecurityCase(kind: 'incident' | 'vulnerability', id: string, status: IncidentStatus | VulnerabilityStatus, notes: string) {
  const path = kind === 'incident' ? 'incidents' : 'vulnerabilities';
  return (await apiCall<ApiEnvelope<SecurityIncident | SecurityVulnerability>>(`/api/v1/incidents/${path}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) })).data;
}

export async function getSecurityCaseHistory(kind: 'incident' | 'vulnerability', id: string) {
  return (await apiCall<ApiEnvelope<SecurityCaseEvent[]>>(`/api/v1/incidents/${kind}/${id}/history`)).data;
}
