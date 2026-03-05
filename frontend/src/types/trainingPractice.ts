// ============================================
// Training Practice Types
// Phase 12: Billable Training Practice Layer
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

export interface TrainingEngagementSummary {
  total: number;
  active: number;
  proposed: number;
  completedThisYear: number;
  draft: number;
  totalEstimatedUsers: number;
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

export interface KpiSummary {
  kpiId: string;
  kpiCode: string;
  kpiName: string;
  category: string;
  targetDirection: 'up' | 'down';
  latestValue: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  isImproving?: boolean;
}

// ============================================
// Awareness Content Types
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
  workspaceId: string | null;
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
// AI Types
// ============================================

export interface AIProposalResponse {
  proposal: string;
  generatedAt: string;
}

export interface AIQAResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources?: string[];
  generatedAt: string;
}

// ============================================
// Display Helpers
// ============================================

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  one_off: 'One-Off',
  ongoing_program: 'Ongoing Program',
  managed_service: 'Managed Service',
  retainer: 'Retainer',
};

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  signed: 'Signed',
  in_delivery: 'In Delivery',
  completed: 'Completed',
  archived: 'Archived',
};

export const ENGAGEMENT_STATUS_COLORS: Record<EngagementStatus, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  proposed: { bg: '#FEF3C7', text: '#D97706' },
  signed: { bg: '#DBEAFE', text: '#2563EB' },
  in_delivery: { bg: '#D1FAE5', text: '#059669' },
  completed: { bg: '#E0E7FF', text: '#4F46E5' },
  archived: { bg: '#F3F4F6', text: '#9CA3AF' },
};

export const BILLING_BASIS_LABELS: Record<BillingBasis, string> = {
  per_user: 'Per User',
  per_department: 'Per Department',
  per_year: 'Per Year',
  fixed_fee: 'Fixed Fee',
};

export const CONTENT_TYPE_LABELS: Record<AwarenessContentType, string> = {
  proposal_template: 'Proposal Template',
  sow_template: 'SoW Template',
  breach_report: 'Breach Report',
  regulatory_case: 'Regulatory Case',
  incident_summary: 'Incident Summary',
  risk_assessment: 'Risk Assessment',
  audit_finding_template: 'Audit Finding Template',
  statistic: 'Statistic',
  board_expectation: 'Board Expectation',
  training_deck: 'Training Deck',
  outline: 'Outline',
};

export const SOURCE_LABELS: Record<AwarenessContentSource, string> = {
  internal: 'Internal',
  external: 'External',
  regulator: 'Regulator',
  news: 'News',
};

export const KPI_CATEGORY_LABELS: Record<KpiCategory, string> = {
  training: 'Training',
  phishing: 'Phishing',
  behavior: 'Behavior',
  audit: 'Audit',
};
