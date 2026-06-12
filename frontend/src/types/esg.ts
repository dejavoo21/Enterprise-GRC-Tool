export type EsgTrend = 'up' | 'down' | 'flat';
export type EsgStatus = 'healthy' | 'watch' | 'critical' | 'in_progress' | 'planned' | 'complete' | 'open' | 'closed';
export type EsgSeverity = 'low' | 'medium' | 'high' | 'critical';
export type EsgReportType =
  | 'esg_report'
  | 'sustainability_report'
  | 'board_esg_report'
  | 'carbon_report'
  | 'supplier_esg_report'
  | 'csrd_report'
  | 'issb_report'
  | 'gri_report'
  | 'executive_summary';

export interface EsgFrameworkRecord {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  category: 'environmental' | 'social' | 'governance' | 'reporting' | 'custom';
  status: 'active' | 'planned';
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalMetricRecord {
  id: string;
  workspaceId: string;
  metricName: string;
  category: 'energy' | 'water' | 'waste' | 'recycling' | 'emissions' | 'renewable' | 'fuel' | 'incident' | 'objective' | 'kpi';
  unit: string;
  currentValue: number;
  targetValue: number;
  trend: EsgTrend;
  owner: string;
  reportingFrequency: 'monthly' | 'quarterly' | 'annual';
  status: EsgStatus;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CarbonRecord {
  id: string;
  workspaceId: string;
  scope: 'scope_1' | 'scope_2' | 'scope_3';
  sourceName: string;
  tonnesCo2e: number;
  intensity: number;
  reportingYear: number;
  targetTonnesCo2e: number;
  reductionTargetPercent: number;
  trend: EsgTrend;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMetricRecord {
  id: string;
  workspaceId: string;
  metricName: string;
  category: 'dei' | 'wellbeing' | 'training' | 'community' | 'human_rights' | 'labor' | 'health_safety' | 'engagement';
  currentValue: number;
  targetValue: number;
  unit: string;
  owner: string;
  businessUnit: string;
  status: EsgStatus;
  trend: EsgTrend;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceMetricRecord {
  id: string;
  workspaceId: string;
  metricName: string;
  category: 'board' | 'ethics' | 'conduct' | 'whistleblowing' | 'policy' | 'accountability' | 'compliance_culture';
  currentValue: number;
  targetValue: number;
  unit: string;
  owner: string;
  status: EsgStatus;
  trend: EsgTrend;
  createdAt: string;
  updatedAt: string;
}

export interface EsgRiskRecord {
  id: string;
  workspaceId: string;
  title: string;
  category: 'climate' | 'environmental' | 'human_rights' | 'labor' | 'reputation' | 'ethics' | 'governance' | 'supply_chain' | 'sustainability';
  severity: EsgSeverity;
  status: 'identified' | 'assessed' | 'mitigating' | 'accepted' | 'closed';
  owner: string;
  riskScore: number;
  mitigation: string;
  linkedEnterpriseRiskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EsgKpiRecord {
  id: string;
  workspaceId: string;
  kpiName: string;
  category: 'environmental' | 'social' | 'governance' | 'carbon' | 'supplier' | 'compliance';
  targetValue: number;
  actualValue: number;
  variance: number;
  trend: EsgTrend;
  owner: string;
  businessUnit: string;
  reportingFrequency: 'monthly' | 'quarterly' | 'annual';
  status: EsgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EsgTargetRecord {
  id: string;
  workspaceId: string;
  targetName: string;
  category: 'net_zero' | 'reduction' | 'diversity' | 'training' | 'governance' | 'community' | 'sustainability';
  unit: string;
  targetValue: number;
  currentValue: number;
  dueDate: string;
  owner: string;
  status: EsgStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierEsgRecord {
  id: string;
  workspaceId: string;
  supplierName: string;
  supplierEsgRating: number;
  supplierCarbonScore: number;
  humanRightsCompliance: EsgStatus;
  sustainabilityPractices: EsgStatus;
  environmentalPerformance: EsgStatus;
  assessmentStatus: EsgStatus;
  supplierRiskLevel: EsgSeverity;
  createdAt: string;
  updatedAt: string;
}

export interface EsgIncidentRecord {
  id: string;
  workspaceId: string;
  title: string;
  incidentType: 'environmental' | 'health_safety' | 'human_rights' | 'ethics' | 'supplier' | 'community' | 'whistleblower';
  severity: EsgSeverity;
  status: 'open' | 'investigating' | 'remediating' | 'closed';
  owner: string;
  linkedDomain: 'risk' | 'audit' | 'compliance' | 'activity_ledger';
  summary: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsgAuditRecord {
  id: string;
  workspaceId: string;
  auditName: string;
  auditType: 'esg' | 'sustainability' | 'environmental' | 'social' | 'supplier';
  status: 'planned' | 'in_progress' | 'complete';
  findingsCount: number;
  openActions: number;
  owner: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsgEvidenceRecord {
  id: string;
  workspaceId: string;
  evidenceName: string;
  evidenceType: 'energy_record' | 'carbon_report' | 'training_record' | 'diversity_metric' | 'supplier_assessment' | 'audit_evidence' | 'compliance_evidence' | 'certificate';
  owner: string;
  status: EsgStatus;
  source: string;
  linkedFramework: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsgComplianceProgramRecord {
  id: string;
  workspaceId: string;
  frameworkCode: string;
  frameworkName: string;
  score: number;
  targetScore: number;
  gapCount: number;
  controlCoveragePercent: number;
  evidenceCoveragePercent: number;
  assessmentCoveragePercent: number;
  supplierCoveragePercent: number;
  policyCoveragePercent: number;
  status: 'healthy' | 'watch' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface EsgReportRecord {
  id: string;
  workspaceId: string;
  reportType: EsgReportType;
  title: string;
  status: 'generated' | 'distributed' | 'approved';
  generatedBy: string;
  summary: string[];
  generatedAt: string;
}

export interface EsgSummary {
  overallScore: number;
  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  carbonFootprint: number;
  esgRiskExposure: number;
  supplierEsgRating: number;
  sustainabilityTargetProgress: number;
  complianceStatus: number;
  boardReadiness: number;
}

export interface EsgAnalytics {
  esgTrend: Array<{ month: string; score: number }>;
  carbonTrend: Array<{ month: string; tonnesCo2e: number }>;
  supplierDistribution: Array<{ label: string; value: number }>;
  sustainabilityProgress: Array<{ target: string; progress: number }>;
  riskHeatmap: Array<{ category: string; riskScore: number }>;
}

export interface EsgMaturityModel {
  level: 'Initial' | 'Developing' | 'Defined' | 'Managed' | 'Optimized';
  score: number;
  strengths: string[];
  priorities: string[];
}

export interface EsgBoardView {
  topRisks: string[];
  carbonProgress: string;
  supplierExposure: string;
  complianceStatus: string;
  targetAchievement: string;
  openFindings: number;
}

export interface EsgState {
  summary: EsgSummary;
  frameworks: EsgFrameworkRecord[];
  environmentalMetrics: EnvironmentalMetricRecord[];
  carbonRecords: CarbonRecord[];
  socialMetrics: SocialMetricRecord[];
  governanceMetrics: GovernanceMetricRecord[];
  risks: EsgRiskRecord[];
  kpis: EsgKpiRecord[];
  targets: EsgTargetRecord[];
  suppliers: SupplierEsgRecord[];
  incidents: EsgIncidentRecord[];
  audits: EsgAuditRecord[];
  evidence: EsgEvidenceRecord[];
  compliancePrograms: EsgComplianceProgramRecord[];
  reports: EsgReportRecord[];
  analytics: EsgAnalytics;
  maturity: EsgMaturityModel;
  boardView: EsgBoardView;
}
