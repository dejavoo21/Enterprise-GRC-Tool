export type EnterpriseRoleKey =
  | 'super_admin'
  | 'tenant_admin'
  | 'grc_manager'
  | 'risk_owner'
  | 'control_owner'
  | 'auditor'
  | 'evidence_contributor'
  | 'vendor_manager'
  | 'read_only_executive'
  | `custom_${string}`;

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'export'
  | 'assign'
  | 'configure';

export type PermissionModule =
  | 'Dashboard'
  | 'AI'
  | 'Risks'
  | 'Controls'
  | 'Evidence'
  | 'Audits'
  | 'Resilience'
  | 'Regulatory'
  | 'Vendors'
  | 'Policies'
  | 'Training'
  | 'Reports'
  | 'Users'
  | 'Settings';

export type RoleStatus = 'active' | 'disabled';
export type UserAccessStatus = 'active' | 'pending' | 'suspended' | 'revoked';
export type MfaStatus = 'enabled' | 'required' | 'not_enabled';
export type AccessRequestStatus = 'pending' | 'needs_info' | 'approved' | 'rejected';
export type AccessReviewStatus = 'draft' | 'in_progress' | 'completed';
export type AccessReviewDecision = 'approved' | 'revoked' | 'flagged';

export type PermissionSet = Record<PermissionAction, boolean>;
export type RolePermissionMatrix = Record<PermissionModule, PermissionSet>;

export interface EnterpriseRole {
  id: EnterpriseRoleKey;
  name: string;
  description: string;
  status: RoleStatus;
  isDefault: boolean;
  userCount: number;
  inheritedFrom?: EnterpriseRoleKey | null;
}

export interface RbacUser {
  id: string;
  fullName: string;
  email: string;
  status: UserAccessStatus;
  assignedRoleId: EnterpriseRoleKey;
  assignedRoleName: string;
  mfaStatus: MfaStatus;
  lastLogin: string | null;
  accessScope: string;
  workspaceName: string;
  suspendedReason?: string;
  reviewer?: string;
}

export interface AccessRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requestedRoleId: EnterpriseRoleKey;
  requestedRoleName: string;
  businessReason: string;
  requestedWorkspace: string;
  requestDate: string;
  status: AccessRequestStatus;
  reviewer?: string;
  decisionNotes?: string;
  enforceMfaBeforeActivation: boolean;
}

export interface SodConflictRule {
  id: string;
  title: string;
  description: string;
  modules: PermissionModule[];
  actions: Array<{ module: PermissionModule; action: PermissionAction }>;
}

export interface SodConflictRecord {
  id: string;
  roleId: EnterpriseRoleKey;
  roleName: string;
  userId?: string;
  userName?: string;
  severity: 'high' | 'medium';
  ruleTitle: string;
  description: string;
}

export interface AccessReviewReviewerDecision {
  id?: string;
  userId: string;
  userName: string;
  roleName: string;
  reviewer: string;
  decision?: AccessReviewDecision;
  notes?: string;
}

export interface AccessReviewCampaign {
  id: string;
  name: string;
  scopeSummary: string;
  selectedRoles: EnterpriseRoleKey[];
  selectedModules: PermissionModule[];
  selectedUserIds: string[];
  reviewers: string[];
  dueDate: string;
  status: AccessReviewStatus;
  completionPercent: number;
  excessivePrivilegeFlags: number;
  evidenceExportedAt?: string | null;
  decisions: AccessReviewReviewerDecision[];
}

export interface AccessGovernanceAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action:
    | 'user_invited'
    | 'role_assigned'
    | 'permission_changed'
    | 'access_approved'
    | 'access_rejected'
    | 'mfa_required'
    | 'user_suspended'
    | 'access_revoked'
    | 'access_review_launched'
    | 'access_review_completed'
    | 'sod_conflict_detected'
    | 'role_disabled'
    | 'role_created'
    | 'role_duplicated'
    | 'request_more_info'
    | 'review_evidence_exported';
  targetUser?: string;
  previousValue?: string;
  newValue?: string;
  outcome: string;
  ipDevice?: string;
  notes?: string;
}

export interface AccessGovernanceState {
  roles: EnterpriseRole[];
  permissionMatrix: Record<EnterpriseRoleKey, RolePermissionMatrix>;
  users: RbacUser[];
  accessRequests: AccessRequest[];
  accessReviews: AccessReviewCampaign[];
  sodConflicts: SodConflictRecord[];
  auditTrail: AccessGovernanceAuditEntry[];
}
