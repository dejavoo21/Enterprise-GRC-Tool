import { WorkspaceRole } from './models.js';

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
export type AccessRequestStatus = 'pending' | 'needs_info' | 'approved' | 'rejected';
export type AccessReviewStatus = 'draft' | 'in_progress' | 'completed';
export type AccessReviewDecision = 'approved' | 'revoked' | 'flagged';
export type MfaStatus = 'enabled' | 'required' | 'not_enabled';
export type StepUpPurpose =
  | 'assign_admin_role'
  | 'change_permissions'
  | 'approve_access_request'
  | 'revoke_access'
  | 'disable_mfa'
  | 'export_access_review';

export interface EnterpriseRole {
  id: EnterpriseRoleKey;
  workspaceId: string;
  name: string;
  description: string;
  status: RoleStatus;
  isDefault: boolean;
  userCount: number;
  inheritedFrom?: EnterpriseRoleKey | null;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionDefinition {
  id: string;
  module: PermissionModule;
  action: PermissionAction;
}

export interface RolePermissionRecord {
  roleId: EnterpriseRoleKey;
  workspaceId: string;
  module: PermissionModule;
  action: PermissionAction;
  allowed: boolean;
}

export interface EnterpriseUserAccessRecord {
  id: string;
  workspaceId: string;
  fullName: string;
  email: string;
  status: UserAccessStatus;
  assignedRoleId: EnterpriseRoleKey;
  assignedRoleName: string;
  mfaStatus: MfaStatus;
  lastLogin: string | null;
  accessScope: string;
  workspaceName: string;
  legacyWorkspaceRole: WorkspaceRole | null;
  suspendedReason?: string | null;
}

export interface AccessRequestRecord {
  id: string;
  workspaceId: string;
  requesterName: string;
  requesterEmail: string;
  requestedRoleId: EnterpriseRoleKey;
  requestedRoleName: string;
  businessReason: string;
  requestedWorkspace: string;
  requestDate: string;
  status: AccessRequestStatus;
  reviewer?: string | null;
  decisionNotes?: string | null;
  enforceMfaBeforeActivation: boolean;
  invitationId?: string | null;
}

export interface AccessReviewDecisionRecord {
  id: string;
  reviewId: string;
  userId: string;
  userName: string;
  roleName: string;
  reviewer: string;
  decision?: AccessReviewDecision | null;
  notes?: string | null;
}

export interface AccessReviewRecord {
  id: string;
  workspaceId: string;
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
  decisions: AccessReviewDecisionRecord[];
}

export interface SodRuleRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  severity: 'high' | 'medium';
  rules: Array<{ module: PermissionModule; action: PermissionAction }>;
  createdAt: string;
  updatedAt: string;
}

export interface SodConflictRecord {
  id: string;
  workspaceId: string;
  ruleId: string;
  roleId: EnterpriseRoleKey;
  roleName: string;
  userId?: string | null;
  userName?: string | null;
  severity: 'high' | 'medium';
  ruleTitle: string;
  description: string;
  createdAt: string;
}

export interface GovernanceAuditLogRecord {
  id: string;
  workspaceId: string;
  actorUserId?: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  outcome: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: string;
  notes?: string | null;
}

export interface StepUpChallengeRecord {
  id: string;
  workspaceId: string;
  userId: string;
  sessionId: string;
  purpose: StepUpPurpose;
  method: 'authenticator' | 'email' | 'password' | 'passkey';
  tokenId: string;
  verifiedAt: string;
  expiresAt: string;
  consumedAt?: string | null;
  createdAt: string;
}
