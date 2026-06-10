export type AiSystemLifecycleStatus = 'intake' | 'pilot' | 'validation' | 'production' | 'monitoring' | 'retired';
export type AiCriticality = 'low' | 'medium' | 'high' | 'critical';
export type AiComplianceStatus = 'compliant' | 'monitoring' | 'gap' | 'non_compliant';
export type AiAssessmentStatus = 'draft' | 'in_review' | 'approved' | 'overdue';
export type AiApprovalStatus = 'pending' | 'approved' | 'restricted' | 'retired';
export type AiValidationStatus = 'pending' | 'validated' | 'conditional' | 'failed';
export type AiIncidentStatus = 'open' | 'investigating' | 'resolved' | 'reported';
export type AiIncidentType =
  | 'bias_event'
  | 'model_failure'
  | 'hallucination'
  | 'unauthorized_usage'
  | 'prompt_injection'
  | 'data_leakage'
  | 'privacy_violation'
  | 'security_incident'
  | 'compliance_violation';
export type AiControlCategory =
  | 'governance'
  | 'risk'
  | 'data'
  | 'privacy'
  | 'security'
  | 'transparency'
  | 'human_oversight'
  | 'monitoring'
  | 'accountability';
export type AiVendorCategory = 'llm_provider' | 'cloud_ai' | 'ai_platform' | 'third_party_model' | 'implementation_partner';
export type AiTrainingStatus = 'planned' | 'active' | 'completed';
export type AiReportType =
  | 'ai_governance_report'
  | 'ai_risk_report'
  | 'model_risk_report'
  | 'eu_ai_act_report'
  | 'iso42001_report'
  | 'executive_ai_dashboard'
  | 'board_ai_risk_pack';
export type AiClassification =
  | 'minimal_risk'
  | 'limited_risk'
  | 'high_risk'
  | 'prohibited'
  | 'general_purpose_ai'
  | 'foundation_model'
  | 'generative_ai';

export interface AiSystemRecord {
  id: string;
  workspaceId: string;
  systemName: string;
  owner: string;
  businessUnit: string;
  purpose: string;
  description: string;
  modelType: string;
  vendor: string;
  deploymentModel: 'internal' | 'external';
  deploymentDate: string;
  lifecycleStatus: AiSystemLifecycleStatus;
  criticality: AiCriticality;
  classification: AiClassification;
  riskRating: AiCriticality;
  complianceStatus: AiComplianceStatus;
  useCase: string;
  dataType: string;
  industry: string;
  jurisdictions: string[];
  impact: 'low' | 'medium' | 'high' | 'severe';
  inventoryCoveragePercent: number;
  assuranceStatus: 'assured' | 'monitoring' | 'attention_required';
  createdAt: string;
  updatedAt: string;
}

export interface AiModelRecord {
  id: string;
  workspaceId: string;
  systemId: string | null;
  modelName: string;
  version: string;
  owner: string;
  purpose: string;
  validationStatus: AiValidationStatus;
  approvalStatus: AiApprovalStatus;
  retirementDate: string | null;
  lifecycleStatus: AiSystemLifecycleStatus;
  modelFamily: string;
  accuracy: number;
  precision: number;
  recall: number;
  drift: number;
  biasScore: number;
  robustnessScore: number;
  explainabilityScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiRiskAssessmentRecord {
  id: string;
  workspaceId: string;
  systemId: string | null;
  assessmentName: string;
  owner: string;
  status: AiAssessmentStatus;
  biasRisk: number;
  fairnessRisk: number;
  transparencyRisk: number;
  privacyRisk: number;
  securityRisk: number;
  hallucinationRisk: number;
  explainabilityRisk: number;
  ethicalRisk: number;
  safetyRisk: number;
  regulatoryRisk: number;
  operationalRisk: number;
  vendorRisk: number;
  overallRiskScore: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiControlRecord {
  id: string;
  workspaceId: string;
  controlName: string;
  category: AiControlCategory;
  description: string;
  owner: string;
  status: 'implemented' | 'planned' | 'needs_attention';
  mappedFrameworks: string[];
  evidenceCoveragePercent: number;
  automationLevel: 'manual' | 'hybrid' | 'automated';
  createdAt: string;
  updatedAt: string;
}

export interface AiIncidentRecord {
  id: string;
  workspaceId: string;
  systemId: string | null;
  title: string;
  incidentType: AiIncidentType;
  severity: AiCriticality;
  status: AiIncidentStatus;
  owner: string;
  detectedAt: string;
  reportedExternally: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiVendorRecord {
  id: string;
  workspaceId: string;
  vendorName: string;
  vendorCategory: AiVendorCategory;
  services: string[];
  riskRating: AiCriticality;
  complianceScore: number;
  contractStatus: 'active' | 'review' | 'renewal_due';
  securityReviewStatus: 'complete' | 'in_progress' | 'overdue';
  evidenceCoveragePercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiTrainingProgramRecord {
  id: string;
  workspaceId: string;
  programName: string;
  focusArea: string;
  completionRate: number;
  overdueLearners: number;
  certificationStatus: 'healthy' | 'attention' | 'critical';
  status: AiTrainingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiReportRecord {
  id: string;
  workspaceId: string;
  reportType: AiReportType;
  title: string;
  status: 'generated' | 'distributed' | 'approved';
  generatedBy: string;
  summary: string[];
  generatedAt: string;
}

export interface AiComplianceProgramRecord {
  id: string;
  workspaceId: string;
  frameworkCode: 'ISO42001' | 'EU_AI_ACT' | 'NIST_AI_RMF' | 'OECD_AI' | 'RESPONSIBLE_AI';
  frameworkName: string;
  score: number;
  targetScore: number;
  gapCount: number;
  controlCoveragePercent: number;
  evidenceCoveragePercent: number;
  documentationCoveragePercent: number;
  trainingCoveragePercent: number;
  status: 'healthy' | 'watch' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface AiGovernanceSummary {
  aiSystems: number;
  highRiskAi: number;
  aiVendors: number;
  aiAssessments: number;
  aiIncidents: number;
  aiComplianceScore: number;
  aiRiskScore: number;
  aiControlsCoverage: number;
  aiInventoryCoverage: number;
  aiAssuranceStatus: number;
  modelRiskScore: number;
  responsibleAiScore: number;
  aiMaturityScore: number;
}

export interface AiGovernanceState {
  summary: AiGovernanceSummary;
  inventory: AiSystemRecord[];
  models: AiModelRecord[];
  assessments: AiRiskAssessmentRecord[];
  controls: AiControlRecord[];
  incidents: AiIncidentRecord[];
  vendors: AiVendorRecord[];
  trainingPrograms: AiTrainingProgramRecord[];
  reports: AiReportRecord[];
  compliancePrograms: AiComplianceProgramRecord[];
  assuranceHighlights: Array<{ label: string; value: number; detail: string }>;
  modelRiskTrend: Array<{ month: string; score: number }>;
}
