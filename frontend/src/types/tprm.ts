// TPRM (Third-Party Risk Management) Types

export type VendorAssessmentType = 'initial' | 'periodic' | 'triggered';
export type VendorAssessmentStatus = 'draft' | 'in_progress' | 'pending_review' | 'completed' | 'expired';
export type VendorRiskTier = 'critical' | 'high' | 'medium' | 'low';

export interface VendorRiskAssessment {
  id: string;
  workspaceId: string;
  vendorId: string;
  assessmentType: VendorAssessmentType;
  status: VendorAssessmentStatus;
  riskTier?: VendorRiskTier;
  inherentRiskScore?: number;
  residualRiskScore?: number;
  dueDate?: string;
  completedDate?: string;
  nextReviewDate?: string;
  assessorId?: string;
  reviewerId?: string;
  findings: VendorAssessmentFinding[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
  assessorName?: string;
  reviewerName?: string;
}

export interface VendorAssessmentFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'remediated' | 'accepted';
  description?: string;
  recommendation?: string;
  dueDate?: string;
}

export type QuestionnaireType = 'security' | 'privacy' | 'compliance' | 'financial' | 'operational';
export type QuestionnaireStatus = 'draft' | 'sent' | 'in_progress' | 'submitted' | 'reviewed';

export interface VendorQuestionnaire {
  id: string;
  workspaceId: string;
  vendorId?: string;
  assessmentId?: string;
  name: string;
  description?: string;
  questionnaireType: QuestionnaireType;
  isTemplate: boolean;
  status: QuestionnaireStatus;
  sentDate?: string;
  dueDate?: string;
  submittedDate?: string;
  reviewedDate?: string;
  completionPercentage: number;
  riskScore?: number;
  createdBy?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
  questionCount?: number;
  respondedCount?: number;
}

export type SubprocessorDataAccess = 'none' | 'limited' | 'full';
export type SubprocessorStatus = 'active' | 'inactive' | 'pending_review';

export interface VendorSubprocessor {
  id: string;
  workspaceId: string;
  vendorId: string;
  name: string;
  description?: string;
  serviceType?: string;
  dataAccess: SubprocessorDataAccess;
  dataTypes: string[];
  location?: string;
  riskTier: VendorRiskTier;
  status: SubprocessorStatus;
  contractEndDate?: string;
  lastReviewed?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
}

export type ContractType = 'msa' | 'dpa' | 'nda' | 'sla' | 'sow' | 'amendment';
export type ContractStatus = 'draft' | 'pending_review' | 'active' | 'expired' | 'terminated';
export type RenewalType = 'auto' | 'manual' | 'none';

export interface VendorContract {
  id: string;
  workspaceId: string;
  vendorId: string;
  contractName: string;
  contractType: ContractType;
  status: ContractStatus;
  effectiveDate?: string;
  expirationDate?: string;
  renewalType: RenewalType;
  renewalNoticeDays: number;
  contractValue?: number;
  currency: string;
  keyTerms: Record<string, unknown>;
  documentUrl?: string;
  ownerId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
  ownerName?: string;
}

export type IncidentType = 'security_breach' | 'service_outage' | 'compliance_violation' | 'data_loss';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

export interface VendorIncident {
  id: string;
  workspaceId: string;
  vendorId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  impact?: string;
  dataAffected: boolean;
  dataTypesAffected: string[];
  recordsAffected?: number;
  occurredAt?: string;
  detectedAt?: string;
  reportedAt: string;
  resolvedAt?: string;
  rootCause?: string;
  remediation?: string;
  lessonsLearned?: string;
  reportedBy?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
  reportedByName?: string;
  assignedToName?: string;
}

// TPRM Summary for Executive Dashboard
export interface TPRMSummary {
  totalVendors: number;
  vendorsByRiskTier: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  assessmentsDue: number;
  overdueAssessments: number;
  openIncidents: number;
  criticalIncidents: number;
  contractsExpiringSoon: number;
  pendingQuestionnaires: number;
  averageRiskScore: number;
}
