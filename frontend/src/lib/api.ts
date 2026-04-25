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

const DEFAULT_API_ORIGIN = 'https://amiable-acceptance-production.up.railway.app';

// Use backend URL in production, relative path for Vite proxy in development
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');
const API_BASE = `${BACKEND_URL}/api/v1`;

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
// Activity Log API Helpers
// ============================================

import type {
  ActivityLogEntry,
  ActivityLogFilters,
} from '../types/activity';

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

export async function fetchWorkspacesForUser(): Promise<Workspace[]> {
  const result = await apiCall<{ data: Workspace[]; error: null }>(
    `${API_BASE}/workspaces`,
    { skipWorkspace: true }
  );
  return result.data;
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

