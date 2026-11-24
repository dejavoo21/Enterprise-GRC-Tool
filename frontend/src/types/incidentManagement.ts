export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'triaged' | 'investigating' | 'contained' | 'remediating' | 'resolved' | 'closed' | 'cancelled';
export type VulnerabilityStatus = 'identified' | 'triaged' | 'remediation_planned' | 'in_progress' | 'mitigated' | 'accepted' | 'closed' | 'false_positive';

export interface SecurityIncident {
  id: string; incidentRef: string; title: string; description: string; incidentType: string; severity: CaseSeverity;
  status: IncidentStatus; source: string; owner: string; detectedAt: string; targetResolutionAt: string | null;
  resolvedAt: string | null; resolutionSummary: string | null; linkedRiskIds: string[]; linkedAssetIds: string[];
  linkedControlIds: string[]; linkedEvidenceIds: string[]; createdAt: string; updatedAt: string;
}

export interface SecurityVulnerability {
  id: string; vulnerabilityRef: string; title: string; description: string; externalReference: string | null;
  severity: CaseSeverity; cvssScore: number | null; status: VulnerabilityStatus; source: string; owner: string;
  discoveredAt: string; dueAt: string | null; remediatedAt: string | null; remediationSummary: string | null;
  linkedIncidentIds: string[]; linkedRiskIds: string[]; linkedAssetIds: string[]; linkedControlIds: string[];
  linkedEvidenceIds: string[]; createdAt: string; updatedAt: string;
}

export interface SecurityCaseEvent {
  id: string; action: string; actorId: string; previousStatus: string | null; newStatus: string | null;
  notes: string | null; createdAt: string;
}

export interface IncidentManagementState {
  incidents: SecurityIncident[];
  vulnerabilities: SecurityVulnerability[];
  summary: { openIncidents: number; criticalIncidents: number; openVulnerabilities: number; overdueVulnerabilities: number };
}
