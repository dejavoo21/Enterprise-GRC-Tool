export type ReportingCategory =
  | 'board_reports'
  | 'executive_reports'
  | 'audit_committee'
  | 'risk_committee'
  | 'compliance_reports'
  | 'regulatory_reports'
  | 'operational_reports'
  | 'scheduled_reports';

export type ReportingTemplateKey =
  | 'board_pack'
  | 'executive_pack'
  | 'risk_committee_pack'
  | 'audit_committee_pack'
  | 'compliance_pack'
  | 'vendor_risk_pack'
  | 'asset_risk_pack'
  | 'training_pack'
  | 'cyber_risk_pack'
  | 'privacy_pack'
  | 'ai_governance_pack';

export type ReportSectionKey =
  | 'executive_summary'
  | 'enterprise_risk_posture'
  | 'risk_appetite_status'
  | 'risk_tolerance_breaches'
  | 'risk_capacity_utilization'
  | 'top_risks'
  | 'top_kris'
  | 'emerging_risks'
  | 'control_effectiveness'
  | 'audit_readiness'
  | 'vendor_exposure'
  | 'critical_assets'
  | 'training_metrics'
  | 'regulatory_status'
  | 'strategic_recommendations'
  | 'forecasted_issues'
  | 'loss_events'
  | 'near_misses'
  | 'compliance_coverage'
  | 'management_actions';

export type ReportFormat = 'pdf' | 'word' | 'excel' | 'powerpoint';
export type ReportRunStatus = 'draft' | 'generated' | 'approved' | 'rejected' | 'distributed';
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
export type DeliveryMethod = 'email' | 'download' | 'secure_link' | 'portal_access';
export type AttestationDecision = 'approved' | 'rejected' | 'commented';
export type RecipientType = 'user' | 'role' | 'committee' | 'group';
export type ReportScopeType = 'workspace' | 'department' | 'business_unit' | 'region' | 'legal_entity' | 'enterprise_rollup';

export interface ReportTemplateRecord {
  id: string;
  workspaceId: string;
  templateKey: ReportingTemplateKey;
  title: string;
  category: ReportingCategory;
  description: string;
  sections: ReportSectionKey[];
  defaultFormat: ReportFormat;
  classification: string;
  version: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedReportRecord {
  id: string;
  workspaceId: string;
  templateId: string;
  templateKey: ReportingTemplateKey;
  reportType: ReportingCategory;
  title: string;
  classification: string;
  version: string;
  authorName: string;
  format: ReportFormat;
  scopeType: ReportScopeType;
  scopeValue: string;
  status: ReportRunStatus;
  generatedByUserId?: string | null;
  generatedByName: string;
  content: {
    sections: Array<{ key: ReportSectionKey; heading: string; bullets: string[] }>;
    metrics: Array<{ label: string; value: string | number; detail?: string }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReportScheduleRecord {
  id: string;
  workspaceId: string;
  templateId: string;
  templateKey: ReportingTemplateKey;
  name: string;
  frequency: ScheduleFrequency;
  recipients: Array<{ type: RecipientType; value: string }>;
  deliveryMethods: DeliveryMethod[];
  scopeType: ReportScopeType;
  scopeValue: string;
  nextRunAt: string;
  lastRunAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDistributionRecord {
  id: string;
  workspaceId: string;
  reportId: string;
  recipientType: RecipientType;
  recipientValue: string;
  deliveryMethod: DeliveryMethod;
  sentAt?: string | null;
  viewedAt?: string | null;
  downloadedAt?: string | null;
  acknowledgedAt?: string | null;
  secureLinkId?: string | null;
  createdAt: string;
}

export interface ReportAttestationRecord {
  id: string;
  workspaceId: string;
  reportId: string;
  approverUserId?: string | null;
  approverName: string;
  decision: AttestationDecision;
  comments?: string | null;
  attestedAt: string;
}

export interface BoardDashboardData {
  enterpriseScore: number;
  riskPosture: string;
  appetiteBreaches: number;
  capacityUtilization: Array<{ label: string; utilizationPercent: number }>;
  topRisks: Array<{ title: string; score: number; status: string }>;
  topKris: Array<{ name: string; status: string; value: number }>;
  forecastedIssues: Array<{ label: string; forecastScore: number }>;
  emergingRisks: Array<{ title: string; status: string }>;
  complianceCoverage: number;
  vendorExposure: string;
  auditReadiness: number;
  boardPackStatus: string;
}

export interface ReportingCenterState {
  templates: ReportTemplateRecord[];
  generatedReports: GeneratedReportRecord[];
  schedules: ReportScheduleRecord[];
  distributions: ReportDistributionRecord[];
  attestations: ReportAttestationRecord[];
  boardDashboard: BoardDashboardData;
  recentReports: GeneratedReportRecord[];
  upcomingReports: ReportScheduleRecord[];
  summary: {
    totalTemplates: number;
    generatedThisMonth: number;
    scheduledReports: number;
    awaitingAttestation: number;
    distributedReports: number;
  };
}
