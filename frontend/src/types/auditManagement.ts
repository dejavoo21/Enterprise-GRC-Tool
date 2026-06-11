export type AuditType =
  | 'internal_audit'
  | 'external_audit'
  | 'supplier_audit'
  | 'certification_audit'
  | 'sox_audit'
  | 'iso_audit'
  | 'regulatory_audit'
  | 'operational_audit'
  | 'it_audit'
  | 'cybersecurity_audit'
  | 'ai_audit';

export type AuditStatus =
  | 'planned'
  | 'scoping'
  | 'fieldwork'
  | 'reporting'
  | 'follow_up'
  | 'completed'
  | 'cancelled';

export type AuditPriority = 'low' | 'medium' | 'high' | 'critical';
export type AuditFindingStatus = 'open' | 'in_progress' | 'ready_for_validation' | 'closed' | 'overdue';
export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AuditTestResult = 'pass' | 'fail' | 'exception' | 'observation';
export type AuditUniverseEntityType =
  | 'business_unit'
  | 'application'
  | 'process'
  | 'asset'
  | 'supplier'
  | 'ai_system'
  | 'control'
  | 'location'
  | 'department'
  | 'risk_domain';

export interface AnnualAuditPlanItem {
  id: string;
  workspaceId: string;
  auditId: string;
  auditName: string;
  auditType: AuditType;
  department: string;
  framework: string;
  auditor: string;
  startDate: string;
  endDate: string;
  status: AuditStatus;
  priority: AuditPriority;
  riskRating: number;
  budget: number;
  hours: number;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEngagementRecord {
  id: string;
  workspaceId: string;
  planItemId: string;
  auditName: string;
  auditType: AuditType;
  objectives: string[];
  scope: string[];
  outOfScope: string[];
  auditCriteria: string[];
  auditFramework: string;
  riskAreas: string[];
  testingStrategy: string;
  samplingApproach: string;
  leadAuditor: string;
  status: AuditStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditUniverseEntity {
  id: string;
  workspaceId: string;
  entityType: AuditUniverseEntityType;
  name: string;
  owner: string;
  department: string;
  framework: string;
  criticality: AuditPriority;
  readinessScore: number;
  linkedReference: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditWorkpaperRecord {
  id: string;
  workspaceId: string;
  engagementId: string;
  title: string;
  testingProcedures: string[];
  samplingNotes: string;
  evidenceCollection: string[];
  notes: string;
  observations: string[];
  attachments: string[];
  reviewerSignoff: string | null;
  versionTag: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditTestRecord {
  id: string;
  workspaceId: string;
  engagementId: string;
  controlTested: string;
  controlOwner: string;
  testingResult: AuditTestResult;
  evidence: string[];
  reviewer: string;
  reviewDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditFindingRecord {
  id: string;
  workspaceId: string;
  engagementId: string;
  findingId: string;
  title: string;
  description: string;
  rootCause: string;
  riskLevel: AuditRiskLevel;
  businessImpact: string;
  owner: string;
  targetDate: string;
  status: AuditFindingStatus;
  validationStatus: string;
  closureDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecommendationRecord {
  id: string;
  workspaceId: string;
  findingRecordId: string;
  recommendation: string;
  owner: string;
  priority: AuditPriority;
  dueDate: string;
  status: AuditFindingStatus;
  completionPercent: number;
  evidenceOfClosure: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CorrectiveActionRecord {
  id: string;
  workspaceId: string;
  findingRecordId: string;
  actionTitle: string;
  owner: string;
  deadline: string;
  dependencies: string[];
  progressPercent: number;
  verification: string;
  closureStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpAuditRecord {
  id: string;
  workspaceId: string;
  findingRecordId: string;
  followUpType: 'finding_validation' | 'remediation_verification' | 'retesting' | 'effectiveness_review' | 'closure_confirmation';
  scheduledDate: string;
  owner: string;
  status: AuditStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvidenceRequestRecord {
  id: string;
  workspaceId: string;
  engagementId: string;
  requestTitle: string;
  owner: string;
  dueDate: string;
  status: 'requested' | 'submitted' | 'approved' | 'expired';
  evidenceReuseCount: number;
  linkedEvidence: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditCalendarEvent {
  id: string;
  workspaceId: string;
  title: string;
  eventType: 'annual' | 'monthly' | 'weekly' | 'milestone' | 'deadline' | 'review';
  eventDate: string;
  relatedAuditId: string | null;
  owner: string;
}

export interface AuditFrameworkReadiness {
  framework: string;
  readinessPercent: number;
  openFindings: number;
  evidenceReadiness: number;
}

export interface AuditAnalyticsSummary {
  findingsByDepartment: Array<{ department: string; count: number }>;
  findingsByFramework: Array<{ framework: string; count: number }>;
  repeatFindings: number;
  topRiskAreas: string[];
  controlFailureTrends: Array<{ label: string; value: number }>;
  auditEffectiveness: number;
  auditorProductivity: number;
}

export interface ThreeLinesView {
  firstLineOpenActions: number;
  secondLineOversightReviews: number;
  thirdLineAudits: number;
}

export interface AuditorWorkbenchSummary {
  assignedAudits: number;
  openWorkpapers: number;
  pendingReviews: number;
  evidenceRequests: number;
  findingsInDraft: number;
}

export interface AuditReportingSummary {
  availableReports: string[];
  boardPackStatus: string;
  certificationStatus: string;
}

export interface AuditCommandCenterSummary {
  annualAuditPlan: number;
  auditsInProgress: number;
  upcomingAudits: number;
  completedAudits: number;
  openFindings: number;
  overdueFindings: number;
  auditReadiness: number;
  controlCoverage: number;
  evidenceReadiness: number;
}

export interface AuditManagementState {
  summary: AuditCommandCenterSummary;
  annualPlan: AnnualAuditPlanItem[];
  engagements: AuditEngagementRecord[];
  auditUniverse: AuditUniverseEntity[];
  workpapers: AuditWorkpaperRecord[];
  tests: AuditTestRecord[];
  findings: AuditFindingRecord[];
  recommendations: AuditRecommendationRecord[];
  correctiveActions: CorrectiveActionRecord[];
  followUpAudits: FollowUpAuditRecord[];
  evidenceRequests: AuditEvidenceRequestRecord[];
  calendar: AuditCalendarEvent[];
  frameworkReadiness: AuditFrameworkReadiness[];
  analytics: AuditAnalyticsSummary;
  threeLines: ThreeLinesView;
  workbench: AuditorWorkbenchSummary;
  reporting: AuditReportingSummary;
}
