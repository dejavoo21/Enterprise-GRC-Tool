import type { ControlFramework } from './control';

// ============================================
// Training Engagement Types
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
  startDate?: string;
  endDate?: string;
  primaryContact?: string;
  proposalUrl?: string;
  sowUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingEngagementInput {
  title: string;
  clientName?: string;
  engagementType: EngagementType;
  status?: EngagementStatus;
  pricingModelId?: string;
  startDate?: string;
  endDate?: string;
  primaryContact?: string;
  proposalUrl?: string;
  sowUrl?: string;
}

export interface EngagementSummary {
  total: number;
  active: number;
  proposed: number;
  completedThisYear: number;
  draft: number;
}

// Display labels
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
  proposed: { bg: '#FEF3C7', text: '#92400E' },
  signed: { bg: '#DBEAFE', text: '#1E40AF' },
  in_delivery: { bg: '#D1FAE5', text: '#065F46' },
  completed: { bg: '#DCFCE7', text: '#166534' },
  archived: { bg: '#F3F4F6', text: '#6B7280' },
};

export const BILLING_BASIS_LABELS: Record<BillingBasis, string> = {
  per_user: 'Per User',
  per_department: 'Per Department',
  per_year: 'Per Year',
  fixed_fee: 'Fixed Fee',
};

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

export interface AwarenessContent {
  id: string;
  workspaceId: string | null;
  type: AwarenessContentType;
  title: string;
  summary?: string;
  source?: string;
  linkUrl?: string;
  frameworkTags: ControlFramework[];
  topicTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAwarenessContentInput {
  type: AwarenessContentType;
  title: string;
  summary?: string;
  source?: string;
  linkUrl?: string;
  frameworkTags?: ControlFramework[];
  topicTags?: string[];
}

export const AWARENESS_CONTENT_TYPE_LABELS: Record<AwarenessContentType, string> = {
  proposal_template: 'Proposal Template',
  sow_template: 'SOW Template',
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

export const AWARENESS_CONTENT_TYPE_COLORS: Record<AwarenessContentType, string> = {
  proposal_template: '#4F46E5', // indigo
  sow_template: '#7C3AED', // violet
  breach_report: '#DC2626', // red
  regulatory_case: '#EA580C', // orange
  incident_summary: '#D97706', // amber
  risk_assessment: '#CA8A04', // yellow
  audit_finding_template: '#16A34A', // green
  statistic: '#0891B2', // cyan
  board_expectation: '#2563EB', // blue
  training_deck: '#9333EA', // purple
  outline: '#6B7280', // gray
};
