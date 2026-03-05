// ============================================
// Board Report Types
// Phase 14: Executive Overview / Board Pack
// ============================================

export interface BoardFrameworkSummary {
  frameworkCode: string;
  frameworkName: string;
  totalControls: number;
  implemented: number;
  inProgress: number;
  notImplemented: number;
  notApplicable: number;
  controlsWithEvidence: number;
  controlsWithPolicy: number;
  controlsWithTraining: number;
}

export interface BoardRiskSummary {
  totalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  openRisks: number;
  closedRisks: number;
  topRisks: {
    id: string;
    title: string;
    severityScore: number;
    status: string;
    linkedControlsCount: number;
  }[];
}

export interface BoardPolicySummary {
  totalDocuments: number;
  approved: number;
  inReview: number;
  overdueReviews: number;
  dueNext30Days: number;
}

export interface BoardTrainingSummary {
  overallCompletionRate: number;
  overdueAssignments: number;
  activeCampaigns: number;
  lastPhishClickRate?: number;
}

export interface BoardAiPrivacySummary {
  aiHealthcareSummary?: {
    frameworks: string[];
    overallScore?: number | null;
  };
  dataProtectionSummary?: {
    frameworks: string[];
    overallScore?: number | null;
  };
}

export interface BoardReportData {
  workspaceId: string;
  workspaceName?: string;
  generatedAt: string;
  frameworks: BoardFrameworkSummary[];
  riskSummary: BoardRiskSummary;
  policySummary: BoardPolicySummary;
  trainingSummary: BoardTrainingSummary;
  aiPrivacySummary: BoardAiPrivacySummary;
}

export type BoardReportAudience = 'board' | 'audit_committee' | 'regulator';

export interface BoardReportNarrativeResponse {
  narrative: string;
  generatedAt: string;
  audience: BoardReportAudience;
}

// UI Labels
export const AUDIENCE_LABELS: Record<BoardReportAudience, string> = {
  board: 'Board of Directors',
  audit_committee: 'Audit Committee',
  regulator: 'Regulatory Submission',
};

export const AUDIENCE_OPTIONS: { value: BoardReportAudience; label: string }[] = [
  { value: 'board', label: 'Board of Directors' },
  { value: 'audit_committee', label: 'Audit Committee' },
  { value: 'regulator', label: 'Regulatory Submission' },
];
