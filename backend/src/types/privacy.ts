export type PrivacyTrend = 'up' | 'down' | 'flat';
export type PrivacyStatus = 'healthy' | 'watch' | 'critical' | 'planned' | 'in_progress' | 'complete' | 'open' | 'closed';
export type PrivacySeverity = 'low' | 'medium' | 'high' | 'critical';
export type PrivacyClassification =
  | 'Public'
  | 'Internal'
  | 'Confidential'
  | 'Restricted'
  | 'Highly Restricted'
  | 'Personal Data'
  | 'Sensitive Personal Data'
  | 'Special Category Data'
  | 'Regulated Data'
  | 'Protected Health Information'
  | 'Payment Card Data';
export type DsarRequestType = 'access' | 'correction' | 'deletion' | 'portability' | 'restriction' | 'objection';
export type PrivacyReportType =
  | 'gdpr_report'
  | 'popia_report'
  | 'iso27701_report'
  | 'privacy_risk_report'
  | 'dpia_report'
  | 'dsar_report'
  | 'data_governance_report'
  | 'board_privacy_pack'
  | 'executive_summary';

export interface PrivacyFrameworkRecord {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  status: 'active' | 'planned';
  createdAt: string;
  updatedAt: string;
}

export interface DataInventoryRecord {
  id: string;
  workspaceId: string;
  dataAssetId: string;
  dataAssetName: string;
  businessOwner: string;
  custodian: string;
  location: string;
  systemName: string;
  application: string;
  department: string;
  country: string;
  jurisdiction: string;
  dataCategory: string;
  sensitivityLevel: string;
  classification: PrivacyClassification;
  retentionRequirement: string;
  legalBasis: string;
  status: PrivacyStatus;
  classificationRiskScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface RopaRecord {
  id: string;
  workspaceId: string;
  processingActivity: string;
  purpose: string;
  legalBasis: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  crossBorderTransfers: string[];
  retentionPeriod: string;
  securityMeasures: string[];
  controllers: string[];
  processors: string[];
  reviewDate: string;
  status: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DpiaRecord {
  id: string;
  workspaceId: string;
  assessmentName: string;
  owner: string;
  purpose: string;
  riskRating: PrivacySeverity;
  likelihood: number;
  impact: number;
  controls: string[];
  residualRisk: number;
  approvalStatus: 'draft' | 'in_review' | 'approved' | 'rejected';
  reviewDate: string;
  evidence: string[];
  linkedRiskIds: string[];
  linkedControlIds: string[];
  linkedAssetIds: string[];
  linkedAiSystemIds: string[];
  linkedVendorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyRiskRecord {
  id: string;
  workspaceId: string;
  title: string;
  category: 'unauthorized_access' | 'data_leakage' | 'consent_violation' | 'retention_failure' | 'cross_border' | 'third_party' | 'ai_privacy' | 'regulatory' | 'data_accuracy' | 'complaint';
  severity: PrivacySeverity;
  status: 'identified' | 'assessed' | 'mitigating' | 'accepted' | 'closed';
  owner: string;
  riskScore: number;
  mitigation: string;
  linkedEnterpriseRiskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentRecord {
  id: string;
  workspaceId: string;
  consentType: string;
  purpose: string;
  dataSubject: string;
  collectionMethod: string;
  dateCollected: string;
  expirationDate?: string | null;
  withdrawalDate?: string | null;
  status: 'granted' | 'withdrawn' | 'expired' | 'renewed';
  evidence: string;
  consentHistory: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DsarRecord {
  id: string;
  workspaceId: string;
  requestId: string;
  requestType: DsarRequestType;
  dataSubject: string;
  submissionDate: string;
  dueDate: string;
  status: 'submitted' | 'in_progress' | 'completed' | 'overdue' | 'rejected';
  owner: string;
  evidence: string[];
  completionDate?: string | null;
  slaCompliant: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyBreachRecord {
  id: string;
  workspaceId: string;
  breachType: string;
  discoveryDate: string;
  affectedRecords: number;
  affectedIndividuals: number;
  rootCause: string;
  riskLevel: PrivacySeverity;
  regulatorNotificationStatus: 'required' | 'sent' | 'not_required';
  customerNotificationStatus: 'required' | 'sent' | 'not_required';
  remediation: string;
  status: 'open' | 'investigating' | 'remediating' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface RetentionRecord {
  id: string;
  workspaceId: string;
  assetName: string;
  retentionPeriod: string;
  legalHold: boolean;
  deletionSchedule: string;
  archiveStatus: PrivacyStatus;
  disposalStatus: PrivacyStatus;
  reviewDate: string;
  violationStatus: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DataTransferRecord {
  id: string;
  workspaceId: string;
  transferName: string;
  transferType: 'cross_border' | 'international';
  transferMechanism: string;
  jurisdiction: string;
  sccInPlace: boolean;
  bcrInPlace: boolean;
  transferRiskRating: PrivacySeverity;
  reviewDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThirdPartyPrivacyRecord {
  id: string;
  workspaceId: string;
  vendorName: string;
  role: 'processor' | 'subprocessor' | 'controller';
  privacyAssessmentStatus: PrivacyStatus;
  dataTransferRisk: PrivacySeverity;
  dpaStatus: PrivacyStatus;
  complianceRating: number;
  privacyIncidentCount: number;
  contractClauses: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyControlRecord {
  id: string;
  workspaceId: string;
  controlName: string;
  category: 'governance' | 'consent' | 'retention' | 'security' | 'transparency' | 'data_subject_rights' | 'transfer' | 'monitoring';
  mappedFrameworks: string[];
  status: PrivacyStatus;
  evidenceCoveragePercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataGovernanceRecord {
  id: string;
  workspaceId: string;
  dataDomain: string;
  dataOwner: string;
  dataSteward: string;
  dataCustodian: string;
  dataQualityScore: number;
  lifecycleStage: string;
  glossaryTerm: string;
  status: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DataLineageRecord {
  id: string;
  workspaceId: string;
  lineageName: string;
  source: string;
  transformation: string;
  processing: string;
  storage: string;
  sharing: string;
  retention: string;
  disposal: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataQualityRecord {
  id: string;
  workspaceId: string;
  datasetName: string;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  validity: number;
  uniqueness: number;
  qualityScore: number;
  remediationAction: string;
  status: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DataDiscoveryRecord {
  id: string;
  workspaceId: string;
  repositoryName: string;
  repositoryType: 'application' | 'database' | 'cloud_service' | 'file_repository';
  piiLocations: string[];
  sensitiveDataLocations: string[];
  dataFlowMapping: string[];
  owner: string;
  status: PrivacyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyComplianceProgramRecord {
  id: string;
  workspaceId: string;
  frameworkCode: string;
  frameworkName: string;
  score: number;
  targetScore: number;
  gapCount: number;
  evidenceCoveragePercent: number;
  riskExposureScore: number;
  controlCoveragePercent: number;
  readinessPercent: number;
  status: 'healthy' | 'watch' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyAuditRecord {
  id: string;
  workspaceId: string;
  auditName: string;
  auditType: 'privacy' | 'dpia_review' | 'regulatory' | 'consent' | 'retention' | 'third_party';
  status: 'planned' | 'in_progress' | 'complete';
  findingsCount: number;
  recommendationsCount: number;
  owner: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyReportRecord {
  id: string;
  workspaceId: string;
  reportType: PrivacyReportType;
  title: string;
  status: 'generated' | 'distributed' | 'approved';
  generatedBy: string;
  summary: string[];
  generatedAt: string;
}

export interface PrivacySummary {
  complianceScore: number;
  openPrivacyRisks: number;
  piiAssets: number;
  sensitiveDataAssets: number;
  dsarRequests: number;
  openDpias: number;
  dataBreaches: number;
  thirdPartyProcessors: number;
  consentCoverage: number;
  retentionCompliance: number;
  privacyAuditStatus: number;
}

export interface PrivacyAnalytics {
  privacyTrend: Array<{ month: string; score: number }>;
  consentTrend: Array<{ month: string; value: number }>;
  dsarTrend: Array<{ month: string; value: number }>;
  retentionTrend: Array<{ month: string; value: number }>;
  thirdPartyTrend: Array<{ label: string; value: number }>;
  classificationDistribution: Array<{ label: string; value: number }>;
  riskHeatmap: Array<{ category: string; riskScore: number }>;
}

export interface PrivacyExecutiveView {
  privacyScore: number;
  openPrivacyRisks: number;
  privacyIncidents: number;
  dsarPerformance: string;
  thirdPartyExposure: string;
  complianceStatus: string;
  dataTransferRisk: string;
  retentionCompliance: string;
}

export interface PrivacyState {
  summary: PrivacySummary;
  frameworks: PrivacyFrameworkRecord[];
  dataInventory: DataInventoryRecord[];
  ropaRecords: RopaRecord[];
  dpias: DpiaRecord[];
  risks: PrivacyRiskRecord[];
  consents: ConsentRecord[];
  dsars: DsarRecord[];
  breaches: PrivacyBreachRecord[];
  retentionRecords: RetentionRecord[];
  transfers: DataTransferRecord[];
  thirdParties: ThirdPartyPrivacyRecord[];
  controls: PrivacyControlRecord[];
  governanceRecords: DataGovernanceRecord[];
  lineages: DataLineageRecord[];
  qualityRecords: DataQualityRecord[];
  discoveryRecords: DataDiscoveryRecord[];
  compliancePrograms: PrivacyComplianceProgramRecord[];
  audits: PrivacyAuditRecord[];
  reports: PrivacyReportRecord[];
  analytics: PrivacyAnalytics;
  executiveView: PrivacyExecutiveView;
}
