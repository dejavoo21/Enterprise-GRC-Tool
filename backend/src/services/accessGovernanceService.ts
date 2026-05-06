import {
  AccessReviewDecision,
  EnterpriseRoleKey,
  PermissionAction,
  PermissionModule,
  RolePermissionRecord,
  StepUpPurpose,
} from '../types/accessGovernance.js';
import * as repo from '../repositories/accessGovernanceRepo.js';
import { defaultPermissionMatrix, GOVERNANCE_PERMISSION_ACTIONS, GOVERNANCE_PERMISSION_MODULES } from './accessGovernanceDefaults.js';

export async function getAccessGovernanceState(workspaceId: string) {
  const [roles, permissions, users, accessRequests, accessReviews, sodConflicts, auditTrail] = await Promise.all([
    repo.listRoles(workspaceId),
    repo.listRolePermissions(workspaceId),
    repo.listUsers(workspaceId),
    repo.listAccessRequests(workspaceId),
    repo.listAccessReviews(workspaceId),
    repo.listSodConflicts(workspaceId),
    repo.listGovernanceAuditLogs(workspaceId),
  ]);

  return {
    roles,
    permissionMatrix: toPermissionMatrix(permissions),
    users,
    accessRequests,
    accessReviews,
    sodConflicts,
    auditTrail,
  };
}

export function toPermissionMatrix(records: RolePermissionRecord[]) {
  const matrix: Record<string, Record<string, Record<string, boolean>>> = {};

  for (const record of records) {
    matrix[record.roleId] ||= {};
    matrix[record.roleId][record.module] ||= {};
    matrix[record.roleId][record.module][record.action] = record.allowed;
  }

  for (const roleId of Object.keys(matrix)) {
    for (const moduleName of GOVERNANCE_PERMISSION_MODULES) {
      matrix[roleId][moduleName] ||= {} as Record<string, boolean>;
      for (const action of GOVERNANCE_PERMISSION_ACTIONS) {
        if (typeof matrix[roleId][moduleName][action] !== 'boolean') {
          matrix[roleId][moduleName][action] = false;
        }
      }
    }
  }

  return matrix;
}

export function flattenPermissionMatrix(
  workspaceId: string,
  matrix: Record<EnterpriseRoleKey, Record<PermissionModule, Record<PermissionAction, boolean>>>,
): RolePermissionRecord[] {
  const rows: RolePermissionRecord[] = [];
  for (const [roleId, moduleMatrix] of Object.entries(matrix)) {
    for (const [moduleName, actionSet] of Object.entries(moduleMatrix)) {
      for (const [action, allowed] of Object.entries(actionSet)) {
        rows.push({
          workspaceId,
          roleId: roleId as EnterpriseRoleKey,
          module: moduleName as PermissionModule,
          action: action as PermissionAction,
          allowed: Boolean(allowed),
        });
      }
    }
  }
  return rows;
}

export function buildAccessReviewEvidence(review: Awaited<ReturnType<typeof repo.listAccessReviews>>[number]) {
  return [
    `Access Review: ${review.name}`,
    `Status: ${review.status}`,
    `Scope: ${review.scopeSummary}`,
    `Due Date: ${review.dueDate}`,
    `Reviewers: ${review.reviewers.join(', ')}`,
    '',
    ...review.decisions.map(
      (decision) =>
        `${decision.userName} | ${decision.roleName} | ${decision.reviewer} | ${decision.decision || 'pending'} | ${decision.notes || 'No notes'}`,
    ),
  ].join('\n');
}

export function actionToPurpose(action: string): StepUpPurpose | null {
  switch (action) {
    case 'assign_admin_role':
      return 'assign_admin_role';
    case 'change_permissions':
      return 'change_permissions';
    case 'approve_access_request':
      return 'approve_access_request';
    case 'revoke_access':
      return 'revoke_access';
    case 'disable_mfa':
      return 'disable_mfa';
    case 'export_access_review':
      return 'export_access_review';
    default:
      return null;
  }
}

export function shouldRequireStepUpForRole(roleId: EnterpriseRoleKey) {
  return roleId === 'super_admin' || roleId === 'tenant_admin';
}

export function isApprovalDecision(decision: AccessReviewDecision) {
  return decision === 'approved';
}

export { defaultPermissionMatrix };
