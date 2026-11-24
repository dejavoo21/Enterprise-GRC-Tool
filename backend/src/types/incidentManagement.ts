export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'triaged' | 'investigating' | 'contained' | 'remediating' | 'resolved' | 'closed' | 'cancelled';
export type VulnerabilityStatus = 'identified' | 'triaged' | 'remediation_planned' | 'in_progress' | 'mitigated' | 'accepted' | 'closed' | 'false_positive';

export interface SecurityIncident {
  id: string; workspaceId: string; incidentRef: string; title: string; description: string;
  incidentType: string; severity: CaseSeverity; status: IncidentStatus; source: string; owner: string;
  detectedAt: string; targetResolutionAt: string | null; resolvedAt: string | null; resolutionSummary: string | null;
  linkedRiskIds: string[]; linkedAssetIds: string[]; linkedControlIds: string[]; linkedEvidenceIds: string[];
  createdBy: string; updatedBy: string; createdAt: string; updatedAt: string;
}

export interface SecurityVulnerability {
  id: string; workspaceId: string; vulnerabilityRef: string; title: string; description: string;
  externalReference: string | null; severity: CaseSeverity; cvssScore: number | null; status: VulnerabilityStatus;
  source: string; owner: string; discoveredAt: string; dueAt: string | null; remediatedAt: string | null;
  remediationSummary: string | null; linkedIncidentIds: string[]; linkedRiskIds: string[]; linkedAssetIds: string[];
  linkedControlIds: string[]; linkedEvidenceIds: string[]; createdBy: string; updatedBy: string; createdAt: string; updatedAt: string;
}

export interface SecurityCaseEvent {
  id: string; workspaceId: string; entityType: 'incident' | 'vulnerability'; entityId: string; action: string;
  actorId: string; previousStatus: string | null; newStatus: string | null; notes: string | null; createdAt: string;
}
