/**
 * API helper that automatically includes authentication and workspace ID in requests
 */

export interface FetchOptions extends RequestInit {
  skipWorkspace?: boolean;
  skipAuth?: boolean;
}

// Storage keys (must match AuthContext)
const AUTH_TOKEN_KEY = 'authToken';
const WORKSPACE_ID_KEY = 'workspaceId';

let currentWorkspaceIdOverride: string | null = null;

export function setCurrentWorkspaceId(workspaceId: string | null) {
  currentWorkspaceIdOverride = workspaceId;
}

/**
 * Get the current auth token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Get the current workspace ID from localStorage/auth state
 */
function getCurrentWorkspaceId(): string | null {
  return localStorage.getItem(WORKSPACE_ID_KEY) || currentWorkspaceIdOverride;
}

export async function apiCall<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipWorkspace = false, skipAuth = false, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers || {});

  // Add Authorization header unless explicitly skipped
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Add workspace header unless explicitly skipped
  if (!skipWorkspace) {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      throw new Error('No workspace selected for request');
    }
    headers.set('X-Workspace-Id', workspaceId);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Handle authentication errors
    if (response.status === 401) {
      // Clear auth state on unauthorized
      localStorage.removeItem(AUTH_TOKEN_KEY);
      // Optionally redirect to login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    throw new Error(
      errorData.error?.message || `HTTP Error: ${response.status}`
    );
  }

  return response.json();
}

// ============================================
// Board Report API Helpers
// ============================================

import type {
  BoardReportData,
  BoardReportAudience,
  BoardReportNarrativeResponse,
} from '../types/boardReport';
import type {
  AnnualAuditPlanItem,
  AuditEngagementRecord,
  AuditEvidenceRequestRecord,
  AuditFindingRecord,
  AuditManagementState,
  AuditRecommendationRecord,
  AuditWorkpaperRecord,
  CorrectiveActionRecord,
} from '../types/auditManagement';
import type {
  AttestationDecision,
  DeliveryMethod,
  GeneratedReportRecord,
  RecipientType,
  ReportFormat,
  ReportingCenterState,
  ReportScopeType,
  ReportScheduleRecord,
  ReportSectionKey,
  ReportTemplateRecord,
  ScheduleFrequency,
} from '../types/reportingCenter';

const DEFAULT_API_ORIGIN = 'https://enterprise-grc-tool-backend.up.railway.app';

// Use backend URL in production, relative path for Vite proxy in development
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');
const API_BASE = `${BACKEND_URL}/api/v1`;

// ============================================
// Audit Management API Helpers
// ============================================

export async function fetchAuditManagementState(): Promise<AuditManagementState> {
  const result = await apiCall<{ data: AuditManagementState; error: null }>(
    `${API_BASE}/audit-readiness/state`
  );
  return result.data;
}

export async function createAuditPlanItem(payload: Partial<AnnualAuditPlanItem>): Promise<AnnualAuditPlanItem> {
  const result = await apiCall<{ data: AnnualAuditPlanItem; error: null }>(
    `${API_BASE}/audit-readiness/annual-plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAuditEngagement(payload: Partial<AuditEngagementRecord>): Promise<AuditEngagementRecord> {
  const result = await apiCall<{ data: AuditEngagementRecord; error: null }>(
    `${API_BASE}/audit-readiness/engagements`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAuditWorkpaper(payload: Partial<AuditWorkpaperRecord>): Promise<AuditWorkpaperRecord> {
  const result = await apiCall<{ data: AuditWorkpaperRecord; error: null }>(
    `${API_BASE}/audit-readiness/workpapers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAuditFinding(payload: Partial<AuditFindingRecord>): Promise<AuditFindingRecord> {
  const result = await apiCall<{ data: AuditFindingRecord; error: null }>(
    `${API_BASE}/audit-readiness/findings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAuditRecommendation(payload: Partial<AuditRecommendationRecord>): Promise<AuditRecommendationRecord> {
  const result = await apiCall<{ data: AuditRecommendationRecord; error: null }>(
    `${API_BASE}/audit-readiness/recommendations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAuditCorrectiveAction(payload: Partial<CorrectiveActionRecord>): Promise<CorrectiveActionRecord> {
  const result = await apiCall<{ data: CorrectiveActionRecord; error: null }>(
    `${API_BASE}/audit-readiness/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAuditEvidenceRequest(payload: Partial<AuditEvidenceRequestRecord>): Promise<AuditEvidenceRequestRecord> {
  const result = await apiCall<{ data: AuditEvidenceRequestRecord; error: null }>(
    `${API_BASE}/audit-readiness/evidence-requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function fetchBoardReportOverview(): Promise<BoardReportData> {
  const result = await apiCall<{ data: BoardReportData; error: null }>(
    `${API_BASE}/reports/board/overview`
  );
  return result.data;
}

export async function generateBoardReportNarrative(
  audience: BoardReportAudience = 'board'
): Promise<BoardReportNarrativeResponse> {
  const result = await apiCall<{ data: BoardReportNarrativeResponse; error: null }>(
    `${API_BASE}/ai/board-report/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audience }),
    }
  );
  return result.data;
}

// ============================================
// Board Report Export API Helpers
// ============================================

export async function downloadBoardReportMarkdown(
  audience: BoardReportAudience = 'board'
): Promise<string> {
  const result = await apiCall<{ data: { markdown: string; generatedAt: string }; error: null }>(
    `${API_BASE}/reports/board/export/markdown`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audience }),
    }
  );
  return result.data.markdown;
}

export async function downloadBoardReportHtml(
  audience: BoardReportAudience = 'board'
): Promise<string> {
  const result = await apiCall<{ data: { html: string; generatedAt: string }; error: null }>(
    `${API_BASE}/reports/board/export/html`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audience }),
    }
  );
  return result.data.html;
}

export async function downloadBoardReportPdf(
  audience: BoardReportAudience = 'board'
): Promise<Blob> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) {
    throw new Error('No workspace selected for request');
  }

  // For PDF, we call fetch directly because we receive a binary Blob
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Workspace-Id': workspaceId,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/reports/board/export/pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ audience }),
  });

  if (!response.ok) {
    throw new Error('Failed to download PDF');
  }

  return await response.blob();
}

// ============================================
// Reporting Center API Helpers
// ============================================

export async function fetchReportingCenterState(): Promise<ReportingCenterState> {
  const result = await apiCall<{ data: ReportingCenterState; error: null }>(
    `${API_BASE}/reporting-center/state`
  );
  return result.data;
}

export async function updateReportingTemplate(
  templateId: string,
  sections: ReportSectionKey[]
): Promise<ReportTemplateRecord> {
  const result = await apiCall<{ data: ReportTemplateRecord; error: null }>(
    `${API_BASE}/reporting-center/templates/${templateId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections }),
    }
  );
  return result.data;
}

export async function generateExecutiveReport(payload: {
  templateId: string;
  scopeType: ReportScopeType;
  scopeValue: string;
  format?: ReportFormat;
}): Promise<GeneratedReportRecord> {
  const result = await apiCall<{ data: GeneratedReportRecord; error: null }>(
    `${API_BASE}/reporting-center/reports/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createReportSchedule(payload: {
  templateId: string;
  name: string;
  frequency: ScheduleFrequency;
  recipients: Array<{ type: RecipientType; value: string }>;
  deliveryMethods: DeliveryMethod[];
  scopeType: ReportScopeType;
  scopeValue: string;
  nextRunAt: string;
}): Promise<ReportScheduleRecord> {
  const result = await apiCall<{ data: ReportScheduleRecord; error: null }>(
    `${API_BASE}/reporting-center/schedules`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateReportSchedule(
  scheduleId: string,
  updates: Partial<ReportScheduleRecord>
): Promise<ReportScheduleRecord> {
  const result = await apiCall<{ data: ReportScheduleRecord; error: null }>(
    `${API_BASE}/reporting-center/schedules/${scheduleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }
  );
  return result.data;
}

export async function distributeExecutiveReport(
  reportId: string,
  payload: {
    recipientType: RecipientType;
    recipientValue: string;
    deliveryMethod: DeliveryMethod;
  }
) {
  const result = await apiCall<{ data: any; error: null }>(
    `${API_BASE}/reporting-center/reports/${reportId}/distribute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function attestExecutiveReport(
  reportId: string,
  payload: { decision: AttestationDecision; comments?: string }
) {
  const result = await apiCall<{ data: any; error: null }>(
    `${API_BASE}/reporting-center/reports/${reportId}/attest`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

// ============================================
// Activity Log API Helpers
// ============================================

import type {
  ActivityLogEntry,
  ActivityLogFilters,
} from '../types/activity';
import type {
  ActivityLedgerEntry,
  ActivityLedgerExportResponse,
  ActivityLedgerFilters,
  ActivityLedgerListResponse,
} from '../types/activityLedger';
import {
  exportLocalActivity,
  getLocalActivity,
  getLocalActivityForTarget,
  getLocalActivityForUser,
  listLocalActivity,
  mergeActivityEntries,
} from './localActivityLedger';

export async function fetchActivityLog(
  filters: ActivityLogFilters = {}
): Promise<ActivityLogEntry[]> {
  const params = new URLSearchParams();

  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.before) params.set('before', filters.before);
  if (filters.limit) params.set('limit', String(filters.limit));

  const queryString = params.toString();
  const url = `${API_BASE}/activity${queryString ? `?${queryString}` : ''}`;

  const result = await apiCall<{ data: ActivityLogEntry[]; error: null }>(url);
  return result.data;
}

export async function fetchActivityLogEntry(
  entryId: string
): Promise<ActivityLogEntry | null> {
  const result = await apiCall<{ data: ActivityLogEntry | null; error: null }>(
    `${API_BASE}/activity/${entryId}`
  );
  return result.data;
}

// ============================================
// Workspace API Helpers
// ============================================

import type {
  Workspace,
  WorkspaceMember,
  WorkspaceInvitation,
  SeedProfile,
  CreateWorkspacePayload,
  CreateInvitationPayload,
  WorkspaceRole,
} from '../types/workspace';
import type {
  RegulatoryChangeLogEntry,
  RegulatoryImpactAssessment,
  RegulatoryObligation,
  RegulatoryRequirement,
  RegulatoryTask,
  RegulatoryWorkspaceState,
} from '../types/regulatory';
import type {
  BcmReportRecord,
  BcmReportType,
  BiaProcessRecord,
  BusinessContinuityState,
  CriticalServiceRecord,
  CrisisEventRecord,
  DependencyMappingRecord,
  OperationalResilienceScenarioRecord,
  RecoveryExerciseRecord,
  RecoveryPlanRecord,
} from '../types/resilience';
import type {
  EmergingRiskRecord,
  KriDefinition,
  LossEventRecord,
  NearMissRecord,
  RiskCapacityProfile,
  RiskIntelligenceState,
  RiskQuantificationWeightSet,
  RiskReportPack,
  RiskToleranceProfile,
  RiskTreatmentEffectiveness,
} from '../types/riskIntelligence';
import type {
  AiComplianceProgramRecord,
  AiControlRecord,
  AiGovernanceState,
  AiIncidentRecord,
  AiModelRecord,
  AiReportRecord,
  AiReportType,
  AiRiskAssessmentRecord,
  AiSystemRecord,
  AiTrainingProgramRecord,
  AiVendorRecord,
} from '../types/aiGovernance';
import type {
  CarbonRecord,
  EnvironmentalMetricRecord,
  EsgIncidentRecord,
  EsgKpiRecord,
  EsgReportRecord,
  EsgReportType,
  EsgRiskRecord,
  EsgState,
  EsgTargetRecord,
  GovernanceMetricRecord,
  SocialMetricRecord,
  SupplierEsgRecord,
} from '../types/esg';
import type {
  ConsentRecord,
  DataDiscoveryRecord,
  DataGovernanceRecord,
  DataInventoryRecord,
  DataTransferRecord,
  DpiaRecord,
  DsarRecord,
  PrivacyAuditRecord,
  PrivacyBreachRecord,
  PrivacyReportRecord,
  PrivacyReportType,
  PrivacyRiskRecord,
  PrivacyState,
  RetentionRecord,
  RopaRecord,
  ThirdPartyPrivacyRecord,
} from '../types/privacy';
import type {
  EnterpriseEntity360,
  EnterpriseEntityNode,
  EnterpriseOpsState,
} from '../types/enterpriseOps';

export async function fetchWorkspacesForUser(): Promise<Workspace[]> {
  const result = await apiCall<{ data: Workspace[]; error: null }>(
    `${API_BASE}/workspaces`,
    { skipWorkspace: true }
  );
  return result.data;
}

export async function fetchActivityLedger(
  filters: ActivityLedgerFilters = {}
): Promise<ActivityLedgerListResponse> {
  const params = new URLSearchParams();

  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.category) params.set('category', filters.category);
  if (filters.action) params.set('action', filters.action);
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.framework) params.set('framework', filters.framework);
  if (filters.limit) params.set('limit', String(filters.limit));

  const queryString = params.toString();
  const url = `${API_BASE}/activity-ledger${queryString ? `?${queryString}` : ''}`;
  try {
    const result = await apiCall<{ data: ActivityLedgerListResponse; error: null }>(url);
    const local = listLocalActivity(filters);
    return {
      entries: mergeActivityEntries(result.data.entries, local.entries).slice(0, filters.limit ?? Number.MAX_SAFE_INTEGER),
      summary: {
        totalEvents: result.data.summary.totalEvents + local.summary.totalEvents,
        criticalEvents: result.data.summary.criticalEvents + local.summary.criticalEvents,
        failedOrBlockedEvents: result.data.summary.failedOrBlockedEvents + local.summary.failedOrBlockedEvents,
        authSecurityEvents: result.data.summary.authSecurityEvents + local.summary.authSecurityEvents,
        changesThisWeek: result.data.summary.changesThisWeek + local.summary.changesThisWeek,
      },
    };
  } catch {
    return listLocalActivity(filters);
  }
}

export async function fetchActivityLedgerEntry(entryId: string): Promise<ActivityLedgerEntry | null> {
  try {
    const result = await apiCall<{ data: ActivityLedgerEntry | null; error: null }>(
      `${API_BASE}/activity-ledger/${entryId}`
    );
    return result.data ?? getLocalActivity(entryId);
  } catch {
    return getLocalActivity(entryId);
  }
}

export async function fetchActivityLedgerForTarget(targetType: string, targetId: string): Promise<ActivityLedgerEntry[]> {
  try {
    const result = await apiCall<{ data: ActivityLedgerEntry[]; error: null }>(
      `${API_BASE}/activity-ledger/target/${targetType}/${targetId}`
    );
    return mergeActivityEntries(result.data, getLocalActivityForTarget(targetType, targetId));
  } catch {
    return getLocalActivityForTarget(targetType, targetId);
  }
}

export async function fetchActivityLedgerForUser(userId: string): Promise<ActivityLedgerEntry[]> {
  try {
    const result = await apiCall<{ data: ActivityLedgerEntry[]; error: null }>(
      `${API_BASE}/activity-ledger/user/${userId}`
    );
    return mergeActivityEntries(result.data, getLocalActivityForUser(userId));
  } catch {
    return getLocalActivityForUser(userId);
  }
}

export async function exportActivityLedger(
  filters: ActivityLedgerFilters = {}
): Promise<ActivityLedgerExportResponse> {
  try {
    const result = await apiCall<{ data: ActivityLedgerExportResponse; error: null }>(
      `${API_BASE}/activity-ledger/export`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      }
    );
    const local = exportLocalActivity(filters);
    return {
      exportedAt: result.data.exportedAt,
      count: result.data.count + local.count,
      entries: mergeActivityEntries(result.data.entries, local.entries),
    };
  } catch {
    return exportLocalActivity(filters);
  }
}

export async function fetchSeedProfiles(): Promise<SeedProfile[]> {
  const result = await apiCall<{ data: SeedProfile[]; error: null }>(
    `${API_BASE}/workspaces/seed-profiles`,
    { skipWorkspace: true }
  );
  return result.data;
}

export async function createWorkspace(
  payload: CreateWorkspacePayload
): Promise<{ workspace: Workspace; role: WorkspaceRole }> {
  const result = await apiCall<{ data: { workspace: Workspace; role: WorkspaceRole }; error: null }>(
    `${API_BASE}/workspaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      skipWorkspace: true,
    }
  );
  return result.data;
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  payload: Partial<Pick<Workspace, 'displayName' | 'industry' | 'region' | 'status'>>
): Promise<Workspace> {
  const result = await apiCall<{ data: Workspace; error: null }>(
    `${API_BASE}/workspaces/${workspaceId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function archiveWorkspace(workspaceId: string): Promise<void> {
  await apiCall<{ data: { success: boolean }; error: null }>(
    `${API_BASE}/workspaces/${workspaceId}/archive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const result = await apiCall<{ data: WorkspaceMember[]; error: null }>(
    `${API_BASE}/workspaces/${workspaceId}/members`
  );
  return result.data;
}

export async function fetchWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  const result = await apiCall<{ data: WorkspaceInvitation[]; error: null }>(
    `${API_BASE}/workspaces/${workspaceId}/invitations`
  );
  return result.data;
}

export async function createWorkspaceInvitation(
  workspaceId: string,
  payload: CreateInvitationPayload
): Promise<WorkspaceInvitation> {
  const result = await apiCall<{ data: WorkspaceInvitation; error: null }>(
    `${API_BASE}/workspaces/${workspaceId}/invitations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function deleteWorkspaceInvitation(
  workspaceId: string,
  invitationId: string
): Promise<void> {
  await apiCall<{ data: { success: boolean }; error: null }>(
    `${API_BASE}/workspaces/${workspaceId}/invitations/${invitationId}`,
    { method: 'DELETE' }
  );
}

// ============================================
// Regulatory Change Management API Helpers
// ============================================

export async function fetchRegulatoryWorkspaceState(): Promise<RegulatoryWorkspaceState> {
  const result = await apiCall<{ data: RegulatoryWorkspaceState; error: null }>(
    `${API_BASE}/regulatory/state`
  );
  return result.data;
}

export async function createRegulatoryRequirement(payload: Partial<RegulatoryRequirement>): Promise<RegulatoryRequirement> {
  const result = await apiCall<{ data: RegulatoryRequirement; error: null }>(
    `${API_BASE}/regulatory/requirements`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateRegulatoryRequirement(id: string, payload: Partial<RegulatoryRequirement>): Promise<RegulatoryRequirement> {
  const result = await apiCall<{ data: RegulatoryRequirement; error: null }>(
    `${API_BASE}/regulatory/requirements/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createRegulatoryObligation(payload: Partial<RegulatoryObligation>): Promise<RegulatoryObligation> {
  const result = await apiCall<{ data: RegulatoryObligation; error: null }>(
    `${API_BASE}/regulatory/obligations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateRegulatoryObligation(id: string, payload: Partial<RegulatoryObligation>): Promise<RegulatoryObligation> {
  const result = await apiCall<{ data: RegulatoryObligation; error: null }>(
    `${API_BASE}/regulatory/obligations/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createRegulatoryChange(payload: Partial<RegulatoryChangeLogEntry>): Promise<RegulatoryChangeLogEntry> {
  const result = await apiCall<{ data: RegulatoryChangeLogEntry; error: null }>(
    `${API_BASE}/regulatory/changes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateRegulatoryChange(id: string, payload: Partial<RegulatoryChangeLogEntry>): Promise<RegulatoryChangeLogEntry> {
  const result = await apiCall<{ data: RegulatoryChangeLogEntry; error: null }>(
    `${API_BASE}/regulatory/changes/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function runRegulatoryImpactAssessment(changeId: string): Promise<RegulatoryImpactAssessment> {
  const result = await apiCall<{ data: RegulatoryImpactAssessment; error: null }>(
    `${API_BASE}/regulatory/changes/${changeId}/impact-assessment`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return result.data;
}

export async function createRegulatoryTask(payload: Partial<RegulatoryTask>): Promise<RegulatoryTask> {
  const result = await apiCall<{ data: RegulatoryTask; error: null }>(
    `${API_BASE}/regulatory/tasks`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

// ============================================
// Business Continuity / Operational Resilience API Helpers
// ============================================

export async function fetchBusinessContinuityState(): Promise<BusinessContinuityState> {
  const result = await apiCall<{ data: BusinessContinuityState; error: null }>(
    `${API_BASE}/business-continuity/state`
  );
  return result.data;
}

export async function createBcmBiaProcess(payload: Partial<BiaProcessRecord>): Promise<BiaProcessRecord> {
  const result = await apiCall<{ data: BiaProcessRecord; error: null }>(
    `${API_BASE}/business-continuity/bia-processes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateBcmBiaProcess(id: string, payload: Partial<BiaProcessRecord>): Promise<BiaProcessRecord> {
  const result = await apiCall<{ data: BiaProcessRecord; error: null }>(
    `${API_BASE}/business-continuity/bia-processes/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createBcmCriticalService(payload: Partial<CriticalServiceRecord>): Promise<CriticalServiceRecord> {
  const result = await apiCall<{ data: CriticalServiceRecord; error: null }>(
    `${API_BASE}/business-continuity/critical-services`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createBcmRecoveryPlan(payload: Partial<RecoveryPlanRecord>): Promise<RecoveryPlanRecord> {
  const result = await apiCall<{ data: RecoveryPlanRecord; error: null }>(
    `${API_BASE}/business-continuity/recovery-plans`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateBcmRecoveryPlan(id: string, payload: Partial<RecoveryPlanRecord>): Promise<RecoveryPlanRecord> {
  const result = await apiCall<{ data: RecoveryPlanRecord; error: null }>(
    `${API_BASE}/business-continuity/recovery-plans/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function approveBcmRecoveryPlan(id: string, stepUpToken?: string): Promise<RecoveryPlanRecord> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (stepUpToken) {
    headers['X-Step-Up-Token'] = stepUpToken;
  }
  const result = await apiCall<{ data: RecoveryPlanRecord; error: null }>(
    `${API_BASE}/business-continuity/recovery-plans/${id}/approve`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(stepUpToken ? { stepUpToken } : {}),
    }
  );
  return result.data;
}

export async function createBcmExercise(payload: Partial<RecoveryExerciseRecord>): Promise<RecoveryExerciseRecord> {
  const result = await apiCall<{ data: RecoveryExerciseRecord; error: null }>(
    `${API_BASE}/business-continuity/exercises`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createBcmCrisisEvent(payload: Partial<CrisisEventRecord>): Promise<CrisisEventRecord> {
  const result = await apiCall<{ data: CrisisEventRecord; error: null }>(
    `${API_BASE}/business-continuity/crisis-events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createBcmDependency(payload: Partial<DependencyMappingRecord>): Promise<DependencyMappingRecord> {
  const result = await apiCall<{ data: DependencyMappingRecord; error: null }>(
    `${API_BASE}/business-continuity/dependencies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createBcmResilienceScenario(payload: Partial<OperationalResilienceScenarioRecord>): Promise<OperationalResilienceScenarioRecord> {
  const result = await apiCall<{ data: OperationalResilienceScenarioRecord; error: null }>(
    `${API_BASE}/business-continuity/resilience-scenarios`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function generateBcmReport(reportType: BcmReportType): Promise<BcmReportRecord> {
  const result = await apiCall<{ data: BcmReportRecord; error: null }>(
    `${API_BASE}/business-continuity/reports/${reportType}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return result.data;
}

// ============================================
// ESG Management API Helpers
// ============================================

export async function fetchEsgState(): Promise<EsgState> {
  const result = await apiCall<{ data: EsgState; error: null }>(
    `${API_BASE}/esg/state`
  );
  return result.data;
}

export async function createEnvironmentalMetricRecord(payload: Partial<EnvironmentalMetricRecord>): Promise<EnvironmentalMetricRecord> {
  const result = await apiCall<{ data: EnvironmentalMetricRecord; error: null }>(
    `${API_BASE}/esg/environmental-metrics`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createCarbonRecordEntry(payload: Partial<CarbonRecord>): Promise<CarbonRecord> {
  const result = await apiCall<{ data: CarbonRecord; error: null }>(
    `${API_BASE}/esg/carbon-records`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createSocialMetricRecord(payload: Partial<SocialMetricRecord>): Promise<SocialMetricRecord> {
  const result = await apiCall<{ data: SocialMetricRecord; error: null }>(
    `${API_BASE}/esg/social-metrics`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createGovernanceMetricRecord(payload: Partial<GovernanceMetricRecord>): Promise<GovernanceMetricRecord> {
  const result = await apiCall<{ data: GovernanceMetricRecord; error: null }>(
    `${API_BASE}/esg/governance-metrics`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createEsgRiskRecord(payload: Partial<EsgRiskRecord>): Promise<EsgRiskRecord> {
  const result = await apiCall<{ data: EsgRiskRecord; error: null }>(
    `${API_BASE}/esg/risks`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createEsgKpiRecord(payload: Partial<EsgKpiRecord>): Promise<EsgKpiRecord> {
  const result = await apiCall<{ data: EsgKpiRecord; error: null }>(
    `${API_BASE}/esg/kpis`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createEsgTargetRecord(payload: Partial<EsgTargetRecord>): Promise<EsgTargetRecord> {
  const result = await apiCall<{ data: EsgTargetRecord; error: null }>(
    `${API_BASE}/esg/targets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createSupplierEsgReview(payload: Partial<SupplierEsgRecord>): Promise<SupplierEsgRecord> {
  const result = await apiCall<{ data: SupplierEsgRecord; error: null }>(
    `${API_BASE}/esg/suppliers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createEsgIncidentRecord(payload: Partial<EsgIncidentRecord>): Promise<EsgIncidentRecord> {
  const result = await apiCall<{ data: EsgIncidentRecord; error: null }>(
    `${API_BASE}/esg/incidents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function generateEsgReport(reportType: EsgReportType): Promise<EsgReportRecord> {
  const result = await apiCall<{ data: EsgReportRecord; error: null }>(
    `${API_BASE}/esg/reports/${reportType}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return result.data;
}

// ============================================
// Privacy & Data Governance API Helpers
// ============================================

export async function fetchPrivacyState(): Promise<PrivacyState> {
  const result = await apiCall<{ data: PrivacyState; error: null }>(
    `${API_BASE}/privacy/state`
  );
  return result.data;
}

export async function createDataInventoryEntry(payload: Partial<DataInventoryRecord>): Promise<DataInventoryRecord> {
  const result = await apiCall<{ data: DataInventoryRecord; error: null }>(
    `${API_BASE}/privacy/data-inventory`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createRopaEntry(payload: Partial<RopaRecord>): Promise<RopaRecord> {
  const result = await apiCall<{ data: RopaRecord; error: null }>(
    `${API_BASE}/privacy/ropa`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createDpiaEntry(payload: Partial<DpiaRecord>): Promise<DpiaRecord> {
  const result = await apiCall<{ data: DpiaRecord; error: null }>(
    `${API_BASE}/privacy/dpias`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createPrivacyRiskEntry(payload: Partial<PrivacyRiskRecord>): Promise<PrivacyRiskRecord> {
  const result = await apiCall<{ data: PrivacyRiskRecord; error: null }>(
    `${API_BASE}/privacy/risks`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createConsentEntry(payload: Partial<ConsentRecord>): Promise<ConsentRecord> {
  const result = await apiCall<{ data: ConsentRecord; error: null }>(
    `${API_BASE}/privacy/consents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createDsarEntry(payload: Partial<DsarRecord>): Promise<DsarRecord> {
  const result = await apiCall<{ data: DsarRecord; error: null }>(
    `${API_BASE}/privacy/dsars`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createPrivacyBreachEntry(payload: Partial<PrivacyBreachRecord>): Promise<PrivacyBreachRecord> {
  const result = await apiCall<{ data: PrivacyBreachRecord; error: null }>(
    `${API_BASE}/privacy/breaches`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createRetentionEntry(payload: Partial<RetentionRecord>): Promise<RetentionRecord> {
  const result = await apiCall<{ data: RetentionRecord; error: null }>(
    `${API_BASE}/privacy/retention`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createTransferEntry(payload: Partial<DataTransferRecord>): Promise<DataTransferRecord> {
  const result = await apiCall<{ data: DataTransferRecord; error: null }>(
    `${API_BASE}/privacy/transfers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createThirdPartyPrivacyEntry(payload: Partial<ThirdPartyPrivacyRecord>): Promise<ThirdPartyPrivacyRecord> {
  const result = await apiCall<{ data: ThirdPartyPrivacyRecord; error: null }>(
    `${API_BASE}/privacy/third-parties`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createDataGovernanceEntry(payload: Partial<DataGovernanceRecord>): Promise<DataGovernanceRecord> {
  const result = await apiCall<{ data: DataGovernanceRecord; error: null }>(
    `${API_BASE}/privacy/governance`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createDataDiscoveryEntry(payload: Partial<DataDiscoveryRecord>): Promise<DataDiscoveryRecord> {
  const result = await apiCall<{ data: DataDiscoveryRecord; error: null }>(
    `${API_BASE}/privacy/discovery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createPrivacyAuditEntry(payload: Partial<PrivacyAuditRecord>): Promise<PrivacyAuditRecord> {
  const result = await apiCall<{ data: PrivacyAuditRecord; error: null }>(
    `${API_BASE}/privacy/audits`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function generatePrivacyReport(reportType: PrivacyReportType): Promise<PrivacyReportRecord> {
  const result = await apiCall<{ data: PrivacyReportRecord; error: null }>(
    `${API_BASE}/privacy/reports/${reportType}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return result.data;
}

// ============================================
// Enterprise Operating System API Helpers
// ============================================

export async function fetchEnterpriseOpsState(): Promise<EnterpriseOpsState> {
  const result = await apiCall<{ data: EnterpriseOpsState; error: null }>(
    `${API_BASE}/enterprise-ops/state`
  );
  return result.data;
}

export async function searchEnterpriseOpsEntities(query: string): Promise<EnterpriseEntityNode[]> {
  const result = await apiCall<{ data: EnterpriseEntityNode[]; error: null }>(
    `${API_BASE}/enterprise-ops/search?q=${encodeURIComponent(query)}`
  );
  return result.data;
}

export async function fetchEnterpriseEntity360(entityType: string, entityId: string): Promise<EnterpriseEntity360> {
  const result = await apiCall<{ data: EnterpriseEntity360; error: null }>(
    `${API_BASE}/enterprise-ops/entity/${entityType}/${entityId}`
  );
  return result.data;
}

// ============================================
// AI Governance / Model Risk Management API Helpers
// ============================================

export async function fetchAiGovernanceState(): Promise<AiGovernanceState> {
  const result = await apiCall<{ data: AiGovernanceState; error: null }>(
    `${API_BASE}/ai-governance/state`
  );
  return result.data;
}

export async function createAiInventoryRecord(payload: Partial<AiSystemRecord>): Promise<AiSystemRecord> {
  const result = await apiCall<{ data: AiSystemRecord; error: null }>(
    `${API_BASE}/ai-governance/inventory`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateAiInventoryRecord(id: string, payload: Partial<AiSystemRecord>): Promise<AiSystemRecord> {
  const result = await apiCall<{ data: AiSystemRecord; error: null }>(
    `${API_BASE}/ai-governance/inventory/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAiModelRecord(payload: Partial<AiModelRecord>): Promise<AiModelRecord> {
  const result = await apiCall<{ data: AiModelRecord; error: null }>(
    `${API_BASE}/ai-governance/models`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateAiModelRecord(id: string, payload: Partial<AiModelRecord>): Promise<AiModelRecord> {
  const result = await apiCall<{ data: AiModelRecord; error: null }>(
    `${API_BASE}/ai-governance/models/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAiAssessmentRecord(payload: Partial<AiRiskAssessmentRecord>): Promise<AiRiskAssessmentRecord> {
  const result = await apiCall<{ data: AiRiskAssessmentRecord; error: null }>(
    `${API_BASE}/ai-governance/assessments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAiControlRecord(payload: Partial<AiControlRecord>): Promise<AiControlRecord> {
  const result = await apiCall<{ data: AiControlRecord; error: null }>(
    `${API_BASE}/ai-governance/controls`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAiIncidentRecord(payload: Partial<AiIncidentRecord>): Promise<AiIncidentRecord> {
  const result = await apiCall<{ data: AiIncidentRecord; error: null }>(
    `${API_BASE}/ai-governance/incidents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAiVendorRecord(payload: Partial<AiVendorRecord>): Promise<AiVendorRecord> {
  const result = await apiCall<{ data: AiVendorRecord; error: null }>(
    `${API_BASE}/ai-governance/vendors`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createAiTrainingProgramRecord(payload: Partial<AiTrainingProgramRecord>): Promise<AiTrainingProgramRecord> {
  const result = await apiCall<{ data: AiTrainingProgramRecord; error: null }>(
    `${API_BASE}/ai-governance/training-programs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateAiComplianceProgramRecord(payload: Partial<AiComplianceProgramRecord>): Promise<AiComplianceProgramRecord> {
  const result = await apiCall<{ data: AiComplianceProgramRecord; error: null }>(
    `${API_BASE}/ai-governance/compliance-programs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function generateAiGovernanceReport(reportType: AiReportType): Promise<AiReportRecord> {
  const result = await apiCall<{ data: AiReportRecord; error: null }>(
    `${API_BASE}/ai-governance/reports/${reportType}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return result.data;
}

// ============================================
// Risk Intelligence API Helpers
// ============================================

export async function fetchRiskIntelligenceState(): Promise<RiskIntelligenceState> {
  const result = await apiCall<{ data: RiskIntelligenceState; error: null }>(
    `${API_BASE}/risk-intelligence/state`
  );
  return result.data;
}

export async function updateRiskToleranceProfile(
  category: string,
  payload: Pick<RiskToleranceProfile, 'appetite' | 'tolerance' | 'capacity'>
): Promise<RiskToleranceProfile> {
  const result = await apiCall<{ data: RiskToleranceProfile; error: null }>(
    `${API_BASE}/risk-intelligence/tolerance/${category}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateRiskCapacityProfile(
  capacityType: string,
  payload: Pick<RiskCapacityProfile, 'currentExposure' | 'capacityLimit' | 'utilizationPercent'>
): Promise<RiskCapacityProfile> {
  const result = await apiCall<{ data: RiskCapacityProfile; error: null }>(
    `${API_BASE}/risk-intelligence/capacity/${capacityType}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createRiskKri(payload: Partial<KriDefinition>): Promise<KriDefinition> {
  const result = await apiCall<{ data: KriDefinition; error: null }>(
    `${API_BASE}/risk-intelligence/kris`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateRiskKri(id: string, payload: Partial<KriDefinition>): Promise<KriDefinition> {
  const result = await apiCall<{ data: KriDefinition; error: null }>(
    `${API_BASE}/risk-intelligence/kris/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function updateRiskQuantificationWeights(payload: Partial<RiskQuantificationWeightSet>): Promise<RiskQuantificationWeightSet> {
  const result = await apiCall<{ data: RiskQuantificationWeightSet; error: null }>(
    `${API_BASE}/risk-intelligence/weights`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createLossEvent(payload: Partial<LossEventRecord>): Promise<LossEventRecord> {
  const result = await apiCall<{ data: LossEventRecord; error: null }>(
    `${API_BASE}/risk-intelligence/loss-events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createNearMiss(payload: Partial<NearMissRecord>): Promise<NearMissRecord> {
  const result = await apiCall<{ data: NearMissRecord; error: null }>(
    `${API_BASE}/risk-intelligence/near-misses`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createEmergingRisk(payload: Partial<EmergingRiskRecord>): Promise<EmergingRiskRecord> {
  const result = await apiCall<{ data: EmergingRiskRecord; error: null }>(
    `${API_BASE}/risk-intelligence/emerging-risks`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function createRiskTreatment(payload: Partial<RiskTreatmentEffectiveness>): Promise<RiskTreatmentEffectiveness> {
  const result = await apiCall<{ data: RiskTreatmentEffectiveness; error: null }>(
    `${API_BASE}/risk-intelligence/treatments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function generateRiskReport(
  reportType: RiskReportPack['reportType'],
  format: RiskReportPack['format']
): Promise<RiskReportPack> {
  const result = await apiCall<{ data: RiskReportPack; error: null }>(
    `${API_BASE}/risk-intelligence/reports/${reportType}?format=${format}`
  );
  return result.data;
}

// ============================================
// TPRM (Third-Party Risk Management) API Helpers
// ============================================

import type {
  TPRMSummary,
  VendorRiskAssessment,
  VendorQuestionnaire,
  VendorSubprocessor,
  VendorContract,
  VendorIncident,
} from '../types/tprm';

export async function fetchTPRMSummary(): Promise<TPRMSummary> {
  const result = await apiCall<{ data: TPRMSummary; error: null }>(
    `${API_BASE}/tprm/summary`
  );
  return result.data;
}

export async function fetchVendorAssessments(
  filter?: { vendorId?: string; status?: string; riskTier?: string }
): Promise<VendorRiskAssessment[]> {
  const params = new URLSearchParams();
  if (filter?.vendorId) params.set('vendorId', filter.vendorId);
  if (filter?.status) params.set('status', filter.status);
  if (filter?.riskTier) params.set('riskTier', filter.riskTier);

  const queryString = params.toString();
  const url = `${API_BASE}/tprm/assessments${queryString ? `?${queryString}` : ''}`;

  const result = await apiCall<{ data: VendorRiskAssessment[]; error: null }>(url);
  return result.data;
}

export async function fetchVendorQuestionnaires(
  filter?: { vendorId?: string; isTemplate?: boolean; status?: string }
): Promise<VendorQuestionnaire[]> {
  const params = new URLSearchParams();
  if (filter?.vendorId) params.set('vendorId', filter.vendorId);
  if (filter?.isTemplate !== undefined) params.set('isTemplate', String(filter.isTemplate));
  if (filter?.status) params.set('status', filter.status);

  const queryString = params.toString();
  const url = `${API_BASE}/tprm/questionnaires${queryString ? `?${queryString}` : ''}`;

  const result = await apiCall<{ data: VendorQuestionnaire[]; error: null }>(url);
  return result.data;
}

export async function fetchVendorSubprocessors(
  filter?: { vendorId?: string; riskTier?: string; status?: string }
): Promise<VendorSubprocessor[]> {
  const params = new URLSearchParams();
  if (filter?.vendorId) params.set('vendorId', filter.vendorId);
  if (filter?.riskTier) params.set('riskTier', filter.riskTier);
  if (filter?.status) params.set('status', filter.status);

  const queryString = params.toString();
  const url = `${API_BASE}/tprm/subprocessors${queryString ? `?${queryString}` : ''}`;

  const result = await apiCall<{ data: VendorSubprocessor[]; error: null }>(url);
  return result.data;
}

export async function fetchVendorContracts(
  filter?: { vendorId?: string; status?: string; contractType?: string }
): Promise<VendorContract[]> {
  const params = new URLSearchParams();
  if (filter?.vendorId) params.set('vendorId', filter.vendorId);
  if (filter?.status) params.set('status', filter.status);
  if (filter?.contractType) params.set('contractType', filter.contractType);

  const queryString = params.toString();
  const url = `${API_BASE}/tprm/contracts${queryString ? `?${queryString}` : ''}`;

  const result = await apiCall<{ data: VendorContract[]; error: null }>(url);
  return result.data;
}

export async function fetchVendorIncidents(
  filter?: { vendorId?: string; severity?: string; status?: string }
): Promise<VendorIncident[]> {
  const params = new URLSearchParams();
  if (filter?.vendorId) params.set('vendorId', filter.vendorId);
  if (filter?.severity) params.set('severity', filter.severity);
  if (filter?.status) params.set('status', filter.status);

  const queryString = params.toString();
  const url = `${API_BASE}/tprm/incidents${queryString ? `?${queryString}` : ''}`;

  const result = await apiCall<{ data: VendorIncident[]; error: null }>(url);
  return result.data;
}

