export type BcmCriticality = 'low' | 'medium' | 'high' | 'critical';
export type BcmImpactRating = 'minor' | 'moderate' | 'major' | 'severe';
export type BcmRecoveryPriority = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
export type BcmEntityStatus = 'draft' | 'active' | 'in_review' | 'approved' | 'degraded' | 'retired' | 'completed' | 'planned';
export type RecoveryPlanType =
  | 'technology_recovery'
  | 'cyber_recovery'
  | 'vendor_failure'
  | 'facility_loss'
  | 'data_recovery'
  | 'pandemic_response'
  | 'crisis_response'
  | 'supply_chain_disruption';
export type RecoveryExerciseType =
  | 'tabletop'
  | 'simulation'
  | 'technical_recovery_test'
  | 'cyber_exercise'
  | 'vendor_exercise'
  | 'operational_exercise';
export type CrisisSeverity = 'medium' | 'high' | 'critical';
export type CrisisStatus = 'monitoring' | 'declared' | 'contained' | 'resolved' | 'closed';
export type DependencyKind =
  | 'process_application'
  | 'application_asset'
  | 'asset_vendor'
  | 'vendor_location'
  | 'location_plan'
  | 'service_plan'
  | 'process_plan';
export type BcmReportType =
  | 'business_continuity_report'
  | 'recovery_readiness_report'
  | 'dora_report'
  | 'operational_resilience_report'
  | 'executive_bcm_summary'
  | 'board_bcm_pack';

export interface BiaProcessRecord {
  id: string;
  workspaceId: string;
  processName: string;
  processOwner: string;
  businessUnit: string;
  criticality: BcmCriticality;
  impactRating: BcmImpactRating;
  recoveryPriority: BcmRecoveryPriority;
  productsServices: string[];
  dependencies: string[];
  supportingAssets: string[];
  supportingVendors: string[];
  supportingApplications: string[];
  rtoHours: number;
  rpoHours: number;
  maximumTolerableDowntimeHours: number;
  maximumDataLossHours: number;
  currentRecoveryTimeHours: number;
  currentDataRecoveryHours: number;
  status: BcmEntityStatus;
  linkedRiskIds: string[];
  linkedControlIds: string[];
  linkedEvidenceIds: string[];
  linkedVendorIds: string[];
  linkedAssetIds: string[];
  linkedFindingIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CriticalServiceRecord {
  id: string;
  workspaceId: string;
  serviceName: string;
  owner: string;
  businessUnit: string;
  criticality: BcmCriticality;
  supportingAssets: string[];
  supportingVendors: string[];
  supportingApplications: string[];
  recoveryPlanId?: string | null;
  status: BcmEntityStatus;
  impactToleranceHours: number;
  recoveryCoveragePercent: number;
  doraRelevant: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryPlanRecord {
  id: string;
  workspaceId: string;
  planType: RecoveryPlanType;
  title: string;
  objectives: string[];
  steps: string[];
  owners: string[];
  dependencies: string[];
  recoverySites: string[];
  recoveryTeams: string[];
  supportingAssets: string[];
  supportingVendors: string[];
  supportingApplications: string[];
  targetRtoHours: number;
  currentRtoHours: number;
  targetRpoHours: number;
  currentRpoHours: number;
  maximumTolerableDowntimeHours: number;
  recoveryReadinessPercent: number;
  status: BcmEntityStatus;
  lastReviewedAt?: string | null;
  lastTestedAt?: string | null;
  nextReviewAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryExerciseRecord {
  id: string;
  workspaceId: string;
  exerciseType: RecoveryExerciseType;
  title: string;
  exerciseDate: string;
  participants: string[];
  scenario: string;
  resultSummary: string;
  findings: string[];
  lessonsLearned: string[];
  correctiveActions: string[];
  performanceScore: number;
  status: BcmEntityStatus;
  linkedPlanIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CrisisEventRecord {
  id: string;
  workspaceId: string;
  eventTitle: string;
  severity: CrisisSeverity;
  owner: string;
  status: CrisisStatus;
  communications: string[];
  stakeholders: string[];
  actions: string[];
  escalations: string[];
  lessonsLearned: string[];
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DependencyMappingRecord {
  id: string;
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  targetType: string;
  targetId: string;
  targetName: string;
  dependencyKind: DependencyKind;
  criticality: BcmCriticality;
  status: BcmEntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalResilienceScenarioRecord {
  id: string;
  workspaceId: string;
  title: string;
  criticalServiceId?: string | null;
  disruptionScenario: string;
  impactToleranceHours: number;
  operationalCapacityPercent: number;
  recoveryCapabilityPercent: number;
  resilienceRating: number;
  status: BcmEntityStatus;
  doraScenario: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BcmComplianceMappingRecord {
  id: string;
  workspaceId: string;
  frameworkCode: string;
  frameworkName: string;
  mappedControlIds: string[];
  mappedEvidenceIds: string[];
  mappedRecoveryPlanIds: string[];
  mappedFindingIds: string[];
  coveragePercent: number;
  status: BcmEntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BcmReportRecord {
  id: string;
  workspaceId: string;
  reportType: BcmReportType;
  title: string;
  status: 'generated' | 'approved' | 'distributed';
  generatedBy: string;
  summary: string[];
  generatedAt: string;
}

export interface BusinessContinuitySummary {
  criticalProcesses: number;
  recoveryPlans: number;
  recoveryExercises: number;
  recoveryReadiness: number;
  openRisks: number;
  criticalDependencies: number;
  thirdPartyDependencies: number;
  testingStatus: number;
  resilienceScore: number;
  recoveryCoverage: number;
}

export interface BusinessContinuityState {
  summary: BusinessContinuitySummary;
  biaProcesses: BiaProcessRecord[];
  criticalServices: CriticalServiceRecord[];
  recoveryPlans: RecoveryPlanRecord[];
  exercises: RecoveryExerciseRecord[];
  crisisEvents: CrisisEventRecord[];
  dependencies: DependencyMappingRecord[];
  resilienceScenarios: OperationalResilienceScenarioRecord[];
  complianceMappings: BcmComplianceMappingRecord[];
  reports: BcmReportRecord[];
}
