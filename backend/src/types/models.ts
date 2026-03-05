// ============================================
// Common Types
// ============================================

// Flexible framework code - allows any string for data-driven frameworks
export type ControlFrameworkCode = string;

// Legacy alias for backwards compatibility
export type ControlFramework = ControlFrameworkCode;

// Framework entity from the database
export interface Framework {
  id: string;
  code: ControlFrameworkCode;
  name: string;
  category: string;
  description?: string;
  isAiHealthcare: boolean;
  isPrivacy: boolean;
  isDefault: boolean;
  colorHex?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Audit Readiness Types
// ============================================

export type ReadinessStatus = 'not_started' | 'in_progress' | 'ready';

export type ReadinessArea = {
  id: string;
  workspaceId: string;
  framework: ControlFramework;
  domain: string; // e.g. "Access Control", "Asset Management"
  score: number; // 0-100 readiness %
  status: ReadinessStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReadinessItem = {
  id: string;
  workspaceId: string;
  areaId: string;
  controlId?: string;
  riskId?: string;
  question: string;
  status: ReadinessStatus;
  owner: string;
  dueDate?: string;
  evidenceId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReadinessSummary = {
  framework: ControlFramework;
  readinessPercent: number;
  totalAreas: number;
  readyAreas: number;
  openItems: number;
};

// ============================================
// Training & Awareness Types
// ============================================

export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';

export type TrainingDeliveryFormat =
  | 'internal_video'
  | 'document'
  | 'external_lms'
  | 'classroom'
  | 'other';

export type TrainingCourse = {
  id: string;
  workspaceId: string | null;  // null = global/seeded course
  title: string;
  description?: string;
  durationMinutes?: number;
  mandatory: boolean;
  deliveryFormat: TrainingDeliveryFormat;
  contentUrl?: string;
  frameworkCodes: string[];
  category?: string;
  isCustom: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed fields from assignments
  totalAssignments?: number;
  completedAssignments?: number;
  overdueAssignments?: number;
  completionRate?: number;
};

export interface CreateTrainingCourseInput {
  title: string;
  description?: string;
  durationMinutes?: number;
  mandatory?: boolean;
  deliveryFormat?: TrainingDeliveryFormat;
  contentUrl?: string;
  frameworkCodes?: string[];
  category?: string;
}

export type TrainingAssignment = {
  id: string;
  workspaceId: string;
  courseId: string;
  userId: string;
  userName: string; // denormalized for display
  status: TrainingStatus;
  assignedAt: string;
  dueAt?: string;
  completedAt?: string;
};

export type CampaignStatus = 'planned' | 'active' | 'completed';

export type AwarenessCampaign = {
  id: string;
  workspaceId: string;
  title: string;
  topic: string; // e.g. Phishing, Passwords, Social Engineering
  channel: 'email' | 'poster' | 'event' | 'phishing_sim' | 'video';
  startDate: string;
  endDate?: string;
  status: CampaignStatus;
  participants: number;
  completionRate?: number;
  clickRate?: number; // for phishing simulations
};

export type TrainingDashboard = {
  overallCompletionRate: number;
  overdueAssignments: number;
  activeCampaigns: number;
  totalCourses: number;
  totalAssignments: number;
  lastCampaignSummary?: {
    title: string;
    topic: string;
    completionRate?: number;
    clickRate?: number;
  };
};

// ============================================
// Training Practice & Engagements Types
// ============================================

export type EngagementType =
  | 'one_off'
  | 'ongoing_program'
  | 'managed_service'
  | 'retainer';

export type EngagementStatus =
  | 'draft'
  | 'proposed'
  | 'signed'
  | 'in_delivery'
  | 'completed'
  | 'archived';

export type BillingBasis = 'per_user' | 'per_department' | 'per_year' | 'fixed_fee';

export interface PricingModel {
  id: string;
  code: string;
  name: string;
  billingBasis: BillingBasis;
  currency: string;
  unitPrice: number;
  minUnits?: number;
  maxUnits?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePricingModelInput {
  code: string;
  name: string;
  billingBasis: BillingBasis;
  currency: string;
  unitPrice: number;
  minUnits?: number;
  maxUnits?: number;
  notes?: string;
}

export interface TrainingEngagement {
  id: string;
  workspaceId: string;
  title: string;
  clientName?: string;
  engagementType: EngagementType;
  status: EngagementStatus;
  pricingModelId?: string;
  estimatedUsers?: number;
  startDate?: string;
  endDate?: string;
  primaryContact?: string;
  proposalUrl?: string;
  sowUrl?: string;
  createdAt: string;
  updatedAt: string;
  frameworkCodes?: string[];
}

export interface CreateTrainingEngagementInput {
  title: string;
  clientName?: string;
  engagementType: EngagementType;
  status?: EngagementStatus;
  pricingModelId?: string;
  estimatedUsers?: number;
  startDate?: string;
  endDate?: string;
  primaryContact?: string;
  proposalUrl?: string;
  sowUrl?: string;
  frameworkCodes?: string[];
}

// ============================================
// Awareness Content Library Types
// ============================================

export type AwarenessContentType =
  | 'proposal_template'
  | 'sow_template'
  | 'breach_report'
  | 'regulatory_case'
  | 'incident_summary'
  | 'risk_assessment'
  | 'audit_finding_template'
  | 'statistic'
  | 'board_expectation'
  | 'training_deck'
  | 'outline';

export type AwarenessContentSource = 'internal' | 'external' | 'regulator' | 'news';

export interface AwarenessContent {
  id: string;
  workspaceId: string | null; // null = global content
  type: AwarenessContentType;
  title: string;
  summary?: string;
  source?: AwarenessContentSource;
  linkUrl?: string;
  createdAt: string;
  updatedAt: string;
  frameworkCodes?: string[];
}

export interface CreateAwarenessContentInput {
  type: AwarenessContentType;
  title: string;
  summary?: string;
  source?: AwarenessContentSource;
  linkUrl?: string;
  frameworkCodes?: string[];
}

// ============================================
// KPI Types
// ============================================

export type KpiCategory = 'training' | 'phishing' | 'behavior' | 'audit';
export type KpiTargetDirection = 'up' | 'down';

export interface KpiDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: KpiCategory;
  targetDirection: KpiTargetDirection;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKpiDefinitionInput {
  code: string;
  name: string;
  description?: string;
  category: KpiCategory;
  targetDirection: KpiTargetDirection;
}

export interface KpiSnapshot {
  id: string;
  workspaceId: string;
  engagementId?: string;
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  createdAt: string;
}

export interface CreateKpiSnapshotInput {
  engagementId?: string;
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
}

// ============================================
// Risk Management Types
// ============================================

export type RiskStatus = 'identified' | 'assessed' | 'treated' | 'accepted' | 'closed';

export type RiskCategory = 'information_security' | 'privacy' | 'vendor' | 'operational' | 'compliance' | 'strategic';

export type Risk = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  owner: string;
  category: RiskCategory;
  status: RiskStatus;
  inherentLikelihood: number; // 1-5
  inherentImpact: number; // 1-5
  residualLikelihood: number; // 1-5
  residualImpact: number; // 1-5
  dueDate?: string;
  treatmentPlan?: string;
  controlIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateRiskInput = {
  title: string;
  description?: string;
  owner: string;
  category: RiskCategory;
  inherentLikelihood: number;
  inherentImpact: number;
  dueDate?: string;
};

// ============================================
// Control Library Types
// ============================================

export type ControlStatus =
  | 'not_implemented'
  | 'in_progress'
  | 'implemented'
  | 'not_applicable';

export type Control = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  owner: string;
  status: ControlStatus;
  domain?: string; // e.g. "Access Control", "Data Protection"
  primaryFramework?: ControlFramework;
  createdAt: string;
  updatedAt: string;
};

export type ControlFrameworkMapping = {
  id: string;
  controlId: string;
  framework: ControlFramework;
  reference: string; // e.g. "A.9.1.1" for ISO27001, "CC6.1" for SOC2
  type?: 'TYPE_I' | 'TYPE_II' | null; // Only for SOC1/SOC2
};

export type CreateControlInput = {
  title: string;
  description?: string;
  owner: string;
  status?: ControlStatus;
  domain?: string;
  primaryFramework?: ControlFramework;
};

export type CreateControlMappingInput = {
  controlId: string;
  framework: ControlFramework;
  reference: string;
  type?: 'TYPE_I' | 'TYPE_II' | null;
};

// Enriched control with frameworks array for API responses
export type ControlWithFrameworks = Control & {
  frameworks: ControlFramework[];
};

// ============================================
// Evidence Types
// ============================================

export type EvidenceType = 'policy' | 'configuration' | 'log' | 'screenshot' | 'report' | 'other';

export type EvidenceItem = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: EvidenceType;
  locationUrl?: string;
  controlId?: string;
  riskId?: string;
  collectedBy: string;
  collectedAt: string;
  lastReviewedAt?: string;
};

export type CreateEvidenceInput = {
  name: string;
  description?: string;
  type: EvidenceType;
  locationUrl?: string;
  controlId?: string;
  riskId?: string;
  collectedBy: string;
  collectedAt?: string;
};

// ============================================
// ============================================
// Asset Management Types
// ============================================

export type AssetType =
  | "application"
  | "infrastructure"
  | "database"
  | "saas"
  | "endpoint"
  | "data_store"
  | "other";

export type AssetCriticality = "low" | "medium" | "high" | "critical";

export type AssetStatus = "active" | "planned" | "retired";

export interface Asset {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: AssetType;
  owner: string;
  businessUnit?: string;
  criticality: AssetCriticality;
  dataClassification?: string;
  status: AssetStatus;
  linkedVendorId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Vendor Management Types
// ============================================

export type VendorRiskLevel = "low" | "medium" | "high" | "critical";

export type VendorStatus = "active" | "onboarding" | "offboarded";

export interface Vendor {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  owner: string;
  riskLevel: VendorRiskLevel;
  status: VendorStatus;
  nextReviewDate?: string;
  hasDPA?: boolean;
  regions?: string[];
  dataTypesProcessed?: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Governance Document & Review Types
// ============================================

export type GovernanceDocumentType =
  | 'policy'
  | 'procedure'
  | 'standard'
  | 'guideline'
  | 'manual'
  | 'other';

export type GovernanceDocumentStatus =
  | 'draft'
  | 'approved'
  | 'in_review'
  | 'retired';

export interface GovernanceDocument {
  id: string;
  workspaceId: string;
  title: string;
  docType: GovernanceDocumentType;
  owner: string;
  status: GovernanceDocumentStatus;
  currentVersion?: string;
  locationUrl?: string;
  reviewFrequencyMonths?: number;
  nextReviewDate?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGovernanceDocumentInput {
  title: string;
  docType: GovernanceDocumentType;
  owner: string;
  status?: GovernanceDocumentStatus;
  currentVersion?: string;
  locationUrl?: string;
  reviewFrequencyMonths?: number;
  nextReviewDate?: string;
}

export type ReviewTaskStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export interface ReviewTask {
  id: string;
  workspaceId: string;
  documentId: string;
  title: string;
  description?: string;
  assignee: string;
  status: ReviewTaskStatus;
  dueAt: string;
  reminderDaysBefore: number[];
  lastReminderSentAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateReviewTaskInput {
  documentId: string;
  title: string;
  description?: string;
  assignee: string;
  dueAt: string;
  reminderDaysBefore?: number[];
}

export type DocumentReviewDecision =
  | 'no_change'
  | 'update_required'
  | 'retire';

export interface DocumentReviewLog {
  id: string;
  workspaceId: string;
  documentId: string;
  reviewTaskId: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: DocumentReviewDecision;
  comments?: string;
  newVersion?: string;
}

export interface CreateDocumentReviewLogInput {
  documentId: string;
  reviewTaskId: string;
  reviewedBy: string;
  decision: DocumentReviewDecision;
  comments?: string;
  newVersion?: string;
}

// ============================================
// Control-Governance-Training Link Types
// ============================================

export type ControlRelationType = 'supports' | 'implements' | 'references';
export type ControlTrainingRelationType = 'reinforces' | 'introduces' | 'advanced';
export type DocumentTrainingRelationType = 'enforces' | 'explains';

export interface ControlGovernanceDocumentLink {
  id: string;
  workspaceId: string;
  controlId: string;
  documentId: string;
  relationType: ControlRelationType;
  createdAt: string;
}

export interface ControlTrainingCourseLink {
  id: string;
  workspaceId: string;
  controlId: string;
  courseId: string;
  relationType: ControlTrainingRelationType;
  createdAt: string;
}

export interface GovernanceDocumentTrainingLink {
  id: string;
  workspaceId: string;
  documentId: string;
  courseId: string;
  relationType: DocumentTrainingRelationType;
  createdAt: string;
}

// ============================================
// Authentication & Authorization Types
// ============================================

export type WorkspaceRole = 'owner' | 'admin' | 'grc' | 'auditor' | 'viewer';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface WorkspaceUserMembership {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface AuthenticatedUserContext {
  user: User;
  workspaceId: string;
  role: WorkspaceRole;
}

// ============================================
// Activity Log Types
// ============================================

export type ActivityEntityType =
  | 'control'
  | 'risk'
  | 'governance_document'
  | 'training_course'
  | 'evidence'
  | 'link'
  | 'asset'
  | 'vendor'
  | 'vendor_assessment'
  | 'vendor_questionnaire'
  | 'vendor_subprocessor'
  | 'vendor_contract'
  | 'vendor_incident';

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'link'
  | 'unlink'
  | 'review'
  | 'other';

export interface ActivityLogEntry {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityActionType;
  summary: string;
  details?: any;
  createdAt: string;
}

// ============================================
// TPRM (Third-Party Risk Management) Types
// ============================================

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
  // Joined fields
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

export interface CreateVendorRiskAssessmentInput {
  vendorId: string;
  assessmentType?: VendorAssessmentType;
  riskTier?: VendorRiskTier;
  dueDate?: string;
  assessorId?: string;
  notes?: string;
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
  // Joined fields
  vendorName?: string;
  questionCount?: number;
  respondedCount?: number;
}

export interface CreateVendorQuestionnaireInput {
  vendorId?: string;
  assessmentId?: string;
  name: string;
  description?: string;
  questionnaireType?: QuestionnaireType;
  isTemplate?: boolean;
  dueDate?: string;
}

export type QuestionType = 'text' | 'yes_no' | 'multiple_choice' | 'file_upload' | 'rating';

export interface VendorQuestionnaireQuestion {
  id: string;
  questionnaireId: string;
  category: string;
  questionText: string;
  questionType: QuestionType;
  options?: string[];
  isRequired: boolean;
  weight: number;
  riskIfNegative: 'high' | 'medium' | 'low';
  displayOrder: number;
  guidance?: string;
  createdAt: string;
  // Response data (when fetched with response)
  response?: VendorQuestionnaireResponse;
}

export interface CreateVendorQuestionnaireQuestionInput {
  questionnaireId: string;
  category: string;
  questionText: string;
  questionType?: QuestionType;
  options?: string[];
  isRequired?: boolean;
  weight?: number;
  riskIfNegative?: 'high' | 'medium' | 'low';
  displayOrder?: number;
  guidance?: string;
}

export type RiskFlag = 'high' | 'medium' | 'low' | 'none';

export interface VendorQuestionnaireResponse {
  id: string;
  questionId: string;
  responseText?: string;
  responseValue?: Record<string, unknown>;
  fileUrl?: string;
  isCompliant?: boolean;
  riskFlag?: RiskFlag;
  reviewerNotes?: string;
  respondedAt?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorQuestionnaireResponseInput {
  questionId: string;
  responseText?: string;
  responseValue?: Record<string, unknown>;
  fileUrl?: string;
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
  // Joined fields
  vendorName?: string;
}

export interface CreateVendorSubprocessorInput {
  vendorId: string;
  name: string;
  description?: string;
  serviceType?: string;
  dataAccess?: SubprocessorDataAccess;
  dataTypes?: string[];
  location?: string;
  riskTier?: VendorRiskTier;
  contractEndDate?: string;
  notes?: string;
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
  // Joined fields
  vendorName?: string;
  ownerName?: string;
}

export interface CreateVendorContractInput {
  vendorId: string;
  contractName: string;
  contractType?: ContractType;
  effectiveDate?: string;
  expirationDate?: string;
  renewalType?: RenewalType;
  renewalNoticeDays?: number;
  contractValue?: number;
  currency?: string;
  keyTerms?: Record<string, unknown>;
  documentUrl?: string;
  ownerId?: string;
  notes?: string;
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
  // Joined fields
  vendorName?: string;
  reportedByName?: string;
  assignedToName?: string;
}

export interface CreateVendorIncidentInput {
  vendorId: string;
  incidentType: IncidentType;
  severity?: IncidentSeverity;
  title: string;
  description?: string;
  impact?: string;
  dataAffected?: boolean;
  dataTypesAffected?: string[];
  recordsAffected?: number;
  occurredAt?: string;
  detectedAt?: string;
  assignedTo?: string;
}

// TPRM Summary Types for Executive Dashboard
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

// ============================================
// API Response Types
// ============================================

export type ApiResponse<T> = {
  data: T | null;
  error: ApiError | null;
};

export type ApiError = {
  code: string;
  message: string;
};
