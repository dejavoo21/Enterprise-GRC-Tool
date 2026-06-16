/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from './api';
import type {
  AccessGovernanceAuditEntry,
  AccessGovernanceState,
  AccessRequestStatus,
  AccessReviewDecision,
  EnterpriseRole,
  EnterpriseRoleKey,
  PermissionAction,
  PermissionModule,
  PermissionSet,
  RolePermissionMatrix,
  SodConflictRule,
  UserAccessStatus,
} from '../types/rbac';

type GovernanceApiState = Omit<AccessGovernanceState, 'auditTrail'> & {
  auditTrail: any[];
};

const DEFAULT_API_ORIGIN = 'https://enterprise-grc-tool-backend.up.railway.app';
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');

export const PERMISSION_MODULES: PermissionModule[] = [
  'Dashboard',
  'AI',
  'Risks',
  'Controls',
  'Evidence',
  'Audits',
  'Vendors',
  'Policies',
  'Training',
  'Reports',
  'Users',
  'Settings',
];

export const PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'approve',
  'delete',
  'export',
  'assign',
  'configure',
];

export const STEP_UP_ACTIONS = {
  ASSIGN_ADMIN_ROLE: 'assign_admin_role',
  CHANGE_PERMISSIONS: 'change_permissions',
  APPROVE_ACCESS_REQUEST: 'approve_access_request',
  REVOKE_ACCESS: 'revoke_access',
  DISABLE_MFA: 'disable_mfa',
  EXPORT_ACCESS_REVIEW: 'export_access_review',
} as const;

export const ROLE_LABELS: Record<EnterpriseRoleKey, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  grc_manager: 'GRC Manager',
  risk_owner: 'Risk Owner',
  control_owner: 'Control Owner',
  auditor: 'Auditor',
  evidence_contributor: 'Evidence Contributor',
  vendor_manager: 'Vendor Manager',
  read_only_executive: 'Read-only Executive',
} as Record<EnterpriseRoleKey, string>;

const SOD_RULES: SodConflictRule[] = [
  {
    id: 'risk-create-approve',
    title: 'Risk Author and Approver Conflict',
    description: 'A user should not both create and approve the same risk.',
    modules: ['Risks'],
    actions: [
      { module: 'Risks', action: 'create' },
      { module: 'Risks', action: 'approve' },
    ],
  },
  {
    id: 'evidence-upload-approve',
    title: 'Evidence Upload and Approval Conflict',
    description: 'A user should not both upload and approve evidence.',
    modules: ['Evidence'],
    actions: [
      { module: 'Evidence', action: 'create' },
      { module: 'Evidence', action: 'approve' },
    ],
  },
  {
    id: 'vendor-create-approve',
    title: 'Vendor Assessment and Approval Conflict',
    description: 'A user should not both create vendor assessments and approve vendor risk.',
    modules: ['Vendors', 'Audits'],
    actions: [
      { module: 'Vendors', action: 'create' },
      { module: 'Vendors', action: 'approve' },
    ],
  },
  {
    id: 'controls-configure-audit-approve',
    title: 'Control Configuration and Audit Evidence Approval Conflict',
    description: 'A user should not configure controls and approve audit evidence.',
    modules: ['Controls', 'Audits'],
    actions: [
      { module: 'Controls', action: 'configure' },
      { module: 'Audits', action: 'approve' },
    ],
  },
];

function emptyPermissionSet(): PermissionSet {
  return {
    view: false,
    create: false,
    edit: false,
    approve: false,
    delete: false,
    export: false,
    assign: false,
    configure: false,
  };
}

function normalizePermissionMatrix(input: Record<string, Record<string, Record<string, boolean>>>): Record<EnterpriseRoleKey, RolePermissionMatrix> {
  const normalized = {} as Record<EnterpriseRoleKey, RolePermissionMatrix>;

  Object.entries(input || {}).forEach(([roleId, moduleMatrix]) => {
    normalized[roleId as EnterpriseRoleKey] = {} as RolePermissionMatrix;
    PERMISSION_MODULES.forEach((moduleName) => {
      normalized[roleId as EnterpriseRoleKey][moduleName] = {
        ...emptyPermissionSet(),
        ...(moduleMatrix?.[moduleName] || {}),
      };
    });
  });

  return normalized;
}

function mapAuditEntry(entry: any): AccessGovernanceAuditEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp || entry.createdAt,
    actor: entry.actorName || entry.actor,
    action: entry.action,
    targetUser: entry.targetName || entry.targetUser,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    outcome: entry.outcome,
    ipDevice: entry.ipAddress || entry.ipDevice,
    notes: entry.notes,
  } as AccessGovernanceAuditEntry;
}

function createEmptyState(): AccessGovernanceState {
  return {
    roles: [],
    permissionMatrix: {} as Record<EnterpriseRoleKey, RolePermissionMatrix>,
    users: [],
    accessRequests: [],
    accessReviews: [],
    sodConflicts: [],
    auditTrail: [],
  };
}

export function useAccessGovernanceStore() {
  const [state, setState] = useState<AccessGovernanceState>(createEmptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<Record<EnterpriseRoleKey, RolePermissionMatrix>>({} as Record<EnterpriseRoleKey, RolePermissionMatrix>);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall<{ data: GovernanceApiState; error: null }>(`${API_BASE}/api/v1/admin/state`);
      const nextState: AccessGovernanceState = {
        roles: result.data.roles,
        permissionMatrix: normalizePermissionMatrix(result.data.permissionMatrix as any),
        users: result.data.users,
        accessRequests: result.data.accessRequests,
        accessReviews: result.data.accessReviews,
        sodConflicts: result.data.sodConflicts,
        auditTrail: (result.data.auditTrail || []).map(mapAuditEntry),
      };
      setState(nextState);
      setPermissionDraft(normalizePermissionMatrix(result.data.permissionMatrix as any));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load access governance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const actions = useMemo(() => ({
    togglePermission(roleId: EnterpriseRoleKey, moduleName: PermissionModule, action: PermissionAction) {
      setPermissionDraft((current) => ({
        ...current,
        [roleId]: {
          ...(current[roleId] || ({} as RolePermissionMatrix)),
          [moduleName]: {
            ...emptyPermissionSet(),
            ...(current[roleId]?.[moduleName] || {}),
            [action]: !current[roleId]?.[moduleName]?.[action],
          },
        },
      }));
    },

    async savePermissionMatrix(stepUpToken?: string) {
      await apiCall(`${API_BASE}/api/v1/admin/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
        },
        body: JSON.stringify({ permissionMatrix: permissionDraft }),
      });
      await refresh();
    },

    async resetPermissionMatrix(stepUpToken?: string) {
      await apiCall(`${API_BASE}/api/v1/admin/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
        },
        body: JSON.stringify({ resetToDefault: true }),
      });
      await refresh();
    },

    async createRole(name: string, description: string, inheritedFrom?: EnterpriseRoleKey) {
      await apiCall(`${API_BASE}/api/v1/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, inheritedFrom: inheritedFrom || null }),
      });
      await refresh();
    },

    async updateRole(roleId: EnterpriseRoleKey, patch: Partial<Pick<EnterpriseRole, 'name' | 'description' | 'status'>>) {
      await apiCall(`${API_BASE}/api/v1/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await refresh();
    },

    async duplicateRole(roleId: EnterpriseRoleKey) {
      await apiCall(`${API_BASE}/api/v1/admin/roles/${roleId}/duplicate`, { method: 'POST' });
      await refresh();
    },

    async disableRole(roleId: EnterpriseRoleKey) {
      await apiCall(`${API_BASE}/api/v1/admin/roles/${roleId}/disable`, { method: 'POST' });
      await refresh();
    },

    async assignUserRole(userId: string, roleId: EnterpriseRoleKey, _actor = 'Security Office', stepUpToken?: string) {
      await apiCall(`${API_BASE}/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
        },
        body: JSON.stringify({ roleId }),
      });
      await refresh();
    },

    async setUserStatus(userId: string, status: UserAccessStatus, _actor = 'Security Office', notes?: string, stepUpToken?: string) {
      const isRevoke = status === 'revoked';
      if (isRevoke) {
        await apiCall(`${API_BASE}/api/v1/admin/users/${userId}/access`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
          },
          body: JSON.stringify({ notes }),
        });
      } else {
        await apiCall(`${API_BASE}/api/v1/admin/users/${userId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
          },
          body: JSON.stringify({ status, notes }),
        });
      }
      await refresh();
    },

    async requireMfa(userId: string) {
      await apiCall(`${API_BASE}/api/v1/admin/users/${userId}/require-mfa`, {
        method: 'POST',
      });
      await refresh();
    },

    async updateAccessRequest(
      requestId: string,
      nextStatus: AccessRequestStatus,
      _actor = 'Security Office',
      decisionNotes?: string,
      assignedRoleId?: EnterpriseRoleKey,
      stepUpToken?: string,
    ) {
      const actionPath =
        nextStatus === 'approved'
          ? 'approve'
          : nextStatus === 'rejected'
            ? 'reject'
            : 'request-info';

      await apiCall(`${API_BASE}/api/v1/admin/access-requests/${requestId}/${actionPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
        },
        body: JSON.stringify({
          decisionNotes,
          assignedRoleId,
          enforceMfaBeforeActivation: true,
        }),
      });
      await refresh();
    },

    async launchAccessReview(input: {
      name: string;
      selectedRoles: EnterpriseRoleKey[];
      selectedModules: PermissionModule[];
      selectedUserIds: string[];
      reviewers: string[];
      dueDate: string;
    }) {
      await apiCall(`${API_BASE}/api/v1/admin/access-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await refresh();
    },

    async recordAccessReviewDecision(reviewId: string, userId: string, decision: AccessReviewDecision, notes: string) {
      const review = state.accessReviews.find((item) => item.id === reviewId);
      const item = review?.decisions.find((entry) => entry.userId === userId);
      if (!item?.id) return;
      await apiCall(`${API_BASE}/api/v1/admin/access-reviews/${reviewId}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      });
      await refresh();
    },

    async exportAccessReviewEvidence(reviewId: string, stepUpToken?: string): Promise<string> {
      const result = await apiCall<{ data: { content: string }; error: null }>(`${API_BASE}/api/v1/admin/access-reviews/${reviewId}/export-evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {}),
        },
      });
      await refresh();
      return result.data.content;
    },

    async resetAll() {
      await refresh();
    },
  }), [permissionDraft, refresh, state.accessReviews]);

  return {
    state: {
      ...state,
      permissionMatrix: permissionDraft,
    },
    actions,
    constants: { PERMISSION_MODULES, PERMISSION_ACTIONS, SOD_RULES, STEP_UP_ACTIONS, ROLE_LABELS },
    loading,
    error,
  };
}
