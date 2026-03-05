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

export interface BoardReportDebugInfo {
  provider: string;
  model: string;
  prompt: {
    system: string;
    user: string;
  };
  options?: {
    maxTokens?: number;
    temperature?: number;
  };
}

export interface BoardReportNarrativeResponse {
  narrative: string;
  generatedAt: string;
  audience: BoardReportAudience;
  debug?: BoardReportDebugInfo;
}
