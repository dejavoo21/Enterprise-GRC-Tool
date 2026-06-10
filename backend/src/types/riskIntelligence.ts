export type RiskToleranceStatus =
  | 'within_appetite'
  | 'within_tolerance'
  | 'outside_tolerance'
  | 'beyond_capacity';

export type RiskCapacityType =
  | 'financial'
  | 'operational'
  | 'regulatory'
  | 'technology'
  | 'vendor'
  | 'cyber'
  | 'privacy'
  | 'ai_governance';

export type KriFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type KriStatus = 'green' | 'amber' | 'red';

export type LossEventType =
  | 'security_incident'
  | 'privacy_breach'
  | 'vendor_failure'
  | 'fraud_event'
  | 'service_outage'
  | 'operational_failure';

export type NearMissType =
  | 'phishing_click'
  | 'misconfiguration_detected'
  | 'vendor_sla_near_miss'
  | 'unauthorized_access_attempt'
  | 'failed_change'
  | 'other';

export type RiskTrendDirection = 'increasing' | 'stable' | 'decreasing';

export type EmergingRiskStatus = 'monitoring' | 'watchlist' | 'escalated' | 'mitigating';

export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'underperforming';

export interface RiskToleranceProfile {
  id: string;
  workspaceId: string;
  category: string;
  appetite: number;
  threshold: number;
  tolerance: number;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskCapacityProfile {
  id: string;
  workspaceId: string;
  capacityType: RiskCapacityType;
  currentExposure: number;
  capacityLimit: number;
  utilizationPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface KriDefinition {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  category: string;
  owner: string;
  measurementUnit: string;
  frequency: KriFrequency;
  currentValue: number;
  targetValue: number;
  greenThreshold: number;
  amberThreshold: number;
  redThreshold: number;
  status: KriStatus;
  sourceModule: string;
  autoCalculated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LossEventRecord {
  id: string;
  workspaceId: string;
  eventId: string;
  eventType: LossEventType;
  eventDate: string;
  rootCause: string;
  impact: string;
  actualLoss: number;
  estimatedLoss: number;
  recoveryCost: number;
  businessImpact: string;
  lessonsLearned?: string;
  linkedRiskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NearMissRecord {
  id: string;
  workspaceId: string;
  nearMissType: NearMissType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCause: string;
  potentialImpact: string;
  mitigation: string;
  linkedRiskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskForecast {
  id: string;
  workspaceId: string;
  scopeType: 'enterprise' | 'risk' | 'category' | 'business_unit' | 'framework';
  scopeKey: string;
  scopeLabel: string;
  riskId?: string;
  currentScore: number;
  predicted30DayScore: number;
  predicted90DayScore: number;
  predicted180DayScore: number;
  forecastStatus: RiskToleranceStatus;
  trend: RiskTrendDirection;
  createdAt: string;
  updatedAt: string;
}

export interface EmergingRiskRecord {
  id: string;
  workspaceId: string;
  title: string;
  category: string;
  description: string;
  likelihood: number;
  impact: number;
  monitoringStatus: EmergingRiskStatus;
  triggerEvents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RiskTreatmentEffectiveness {
  id: string;
  workspaceId: string;
  riskId: string;
  treatmentName: string;
  owner: string;
  expectedRiskReduction: number;
  actualRiskReduction: number;
  treatmentEffectivenessPercent: number;
  status: TreatmentStatus;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskQuantificationWeightSet {
  id: string;
  workspaceId: string;
  likelihoodWeight: number;
  impactWeight: number;
  controlEffectivenessWeight: number;
  evidenceConfidenceWeight: number;
  kriWeight: number;
  auditFindingsWeight: number;
  vendorExposureWeight: number;
  assetCriticalityWeight: number;
  lossEventsWeight: number;
  nearMissEventsWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskIntelligenceRiskSummary {
  id: string;
  title: string;
  owner: string;
  category: string;
  status: string;
  inherentScore: number;
  residualScore: number;
  dynamicScore: number;
  appetiteStatus: RiskToleranceStatus;
  trend: RiskTrendDirection;
  forecast90DayScore: number;
  forecastStatus: RiskToleranceStatus;
  treatmentPlan?: string;
  dueDate?: string;
}

export interface RiskIntelligenceDashboard {
  summary: {
    totalRisks: number;
    appetiteBreaches: number;
    toleranceBreaches: number;
    capacityBreaches: number;
    criticalKris: number;
    totalLossEvents: number;
    totalNearMisses: number;
    emergingRisks: number;
  };
  topRiskDrivers: Array<{ label: string; score: number }>;
  appetiteBreaches: RiskIntelligenceRiskSummary[];
  kriStatus: KriDefinition[];
  forecasts: RiskForecast[];
  capacityUtilization: RiskCapacityProfile[];
  emergingRisks: EmergingRiskRecord[];
  lossEvents: LossEventRecord[];
  nearMisses: NearMissRecord[];
  trendingCategories: Array<{ category: string; averageScore: number; trend: RiskTrendDirection }>;
  executiveSummary: string[];
  committeeView: {
    topRisks: RiskIntelligenceRiskSummary[];
    topKris: KriDefinition[];
    highRiskVendors: Array<{ name: string; riskLevel: string; score?: number }>;
    criticalAssets: Array<{ name: string; criticality: string; riskScore?: number }>;
    auditFindings: number;
    openTreatmentPlans: number;
  };
  heatmap: {
    inherent: number[][];
    residual: number[][];
    target: number[][];
    forecast: number[][];
    appetiteBreaches: number[][];
  };
}

export interface RiskIntelligenceState {
  dashboard: RiskIntelligenceDashboard;
  toleranceProfiles: RiskToleranceProfile[];
  capacities: RiskCapacityProfile[];
  kris: KriDefinition[];
  lossEvents: LossEventRecord[];
  nearMisses: NearMissRecord[];
  forecasts: RiskForecast[];
  emergingRisks: EmergingRiskRecord[];
  treatments: RiskTreatmentEffectiveness[];
  weights: RiskQuantificationWeightSet;
  risks: RiskIntelligenceRiskSummary[];
}

export interface RiskReportPack {
  reportType:
    | 'risk_committee_report'
    | 'board_risk_report'
    | 'executive_risk_summary'
    | 'kri_report'
    | 'loss_event_report';
  generatedAt: string;
  format: 'pdf' | 'word' | 'powerpoint';
  title: string;
  sections: Array<{ heading: string; bullets: string[] }>;
}
