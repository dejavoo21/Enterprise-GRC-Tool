import { generateId, pool, query } from '../db.js';
import {
  AccessRequestRecord,
  AccessReviewDecision,
  AccessReviewDecisionRecord,
  AccessReviewRecord,
  AccessReviewStatus,
  EnterpriseRole,
  EnterpriseRoleKey,
  EnterpriseUserAccessRecord,
  GovernanceAuditLogRecord,
  MfaStatus,
  PermissionAction,
  PermissionModule,
  RolePermissionRecord,
  SodConflictRecord,
  SodRuleRecord,
  StepUpChallengeRecord,
  StepUpPurpose,
  UserAccessStatus,
} from '../types/accessGovernance.js';
import { mapEnterpriseRoleToLegacyWorkspaceRole } from '../services/accessGovernanceDefaults.js';
import { updateMfaPolicy } from './authRepo.js';
import { isBuiltInPrivilegedRole } from '../services/accessRoleRules.js';

function mapRoleRow(row: any): EnterpriseRole {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    status: row.status,
    isDefault: row.is_default,
    userCount: Number(row.user_count || 0),
    inheritedFrom: row.inherited_from,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPermissionRow(row: any): RolePermissionRecord {
  return {
    workspaceId: row.workspace_id,
    roleId: row.role_id,
    module: row.module,
    action: row.action,
    allowed: row.allowed,
  };
}

function mapUserRow(row: any): EnterpriseUserAccessRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    assignedRoleId: row.assigned_role_id,
    assignedRoleName: row.assigned_role_name,
    mfaStatus: row.mfa_status,
    lastLogin: row.last_login,
    accessScope: row.access_scope,
    workspaceName: row.workspace_name,
    legacyWorkspaceRole: row.legacy_workspace_role,
    suspendedReason: row.suspended_reason,
  };
}

function mapAccessRequestRow(row: any): AccessRequestRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requestedRoleId: row.requested_role_id,
    requestedRoleName: row.requested_role_name,
    businessReason: row.business_reason,
    requestedWorkspace: row.requested_workspace,
    requestDate: row.request_date,
    status: row.status,
    reviewer: row.reviewer,
    decisionNotes: row.decision_notes,
    enforceMfaBeforeActivation: row.enforce_mfa_before_activation,
    invitationId: row.invitation_id,
  };
}

function mapReviewItemRow(row: any): AccessReviewDecisionRecord {
  return {
    id: row.id,
    reviewId: row.review_id,
    userId: row.user_id,
    userName: row.user_name,
    roleName: row.role_name,
    reviewer: row.reviewer,
    decision: row.decision,
    notes: row.notes,
  };
}

function mapReviewRow(row: any, decisions: AccessReviewDecisionRecord[]): AccessReviewRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    scopeSummary: row.scope_summary,
    selectedRoles: row.selected_roles ?? [],
    selectedModules: row.selected_modules ?? [],
    selectedUserIds: row.selected_user_ids ?? [],
    reviewers: row.reviewers ?? [],
    dueDate: row.due_date,
    status: row.status,
    completionPercent: Number(row.completion_percent || 0),
    excessivePrivilegeFlags: Number(row.excessive_privilege_flags || 0),
    evidenceExportedAt: row.evidence_exported_at,
    decisions,
  };
}

function mapSodRuleRow(row: any): SodRuleRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    rules: row.rules ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSodConflictRow(row: any): SodConflictRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ruleId: row.rule_id,
    roleId: row.role_id,
    roleName: row.role_name,
    userId: row.user_id,
    userName: row.user_name,
    severity: row.severity,
    ruleTitle: row.rule_title,
    description: row.description,
    createdAt: row.created_at,
  };
}

function mapAuditRow(row: any): GovernanceAuditLogRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    previousValue: row.previous_value,
    newValue: row.new_value,
    outcome: row.outcome,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    timestamp: row.created_at,
    notes: row.notes,
  };
}

function mapStepUpRow(row: any): StepUpChallengeRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    sessionId: row.session_id,
    purpose: row.purpose,
    method: row.method,
    tokenId: row.token_id,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

export async function listRoles(workspaceId: string): Promise<EnterpriseRole[]> {
  const result = await query(
    `SELECT gr.*, COUNT(gur.user_id) AS user_count
     FROM governance_roles gr
     LEFT JOIN governance_user_roles gur
       ON gur.workspace_id = gr.workspace_id AND gur.role_id = gr.id AND gur.status <> 'revoked'
     WHERE gr.workspace_id = $1
     GROUP BY gr.workspace_id, gr.id, gr.name, gr.description, gr.status, gr.is_default, gr.inherited_from, gr.created_at, gr.updated_at
     ORDER BY gr.is_default DESC, gr.name ASC`,
    [workspaceId],
  );
  return result.rows.map(mapRoleRow);
}

export async function getRole(workspaceId: string, roleId: string): Promise<EnterpriseRole | null> {
  const result = await query(
    `SELECT gr.*, COUNT(gur.user_id) AS user_count
     FROM governance_roles gr
     LEFT JOIN governance_user_roles gur
       ON gur.workspace_id = gr.workspace_id AND gur.role_id = gr.id AND gur.status <> 'revoked'
     WHERE gr.workspace_id = $1 AND gr.id = $2
     GROUP BY gr.workspace_id, gr.id, gr.name, gr.description, gr.status, gr.is_default, gr.inherited_from, gr.created_at, gr.updated_at`,
    [workspaceId, roleId],
  );
  return result.rows[0] ? mapRoleRow(result.rows[0]) : null;
}

export async function createRole(
  workspaceId: string,
  input: { name: string; description: string; inheritedFrom?: EnterpriseRoleKey | null },
): Promise<EnterpriseRole> {
  const roleId = `custom_${generateId('role')}` as EnterpriseRoleKey;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (input.inheritedFrom) {
      const source = await client.query(
        `SELECT id FROM governance_roles WHERE workspace_id = $1 AND id = $2 AND status = 'active'`,
        [workspaceId, input.inheritedFrom],
      );
      if (!source.rowCount) throw new Error('Inherited role was not found or is disabled.');
    }
    await client.query(
      `INSERT INTO governance_roles (id, workspace_id, name, description, status, is_default, inherited_from)
       VALUES ($1, $2, $3, $4, 'active', FALSE, $5)`,
      [roleId, workspaceId, input.name.trim(), input.description.trim(), input.inheritedFrom || null],
    );
    if (input.inheritedFrom) {
      await client.query(
        `INSERT INTO governance_role_permissions (workspace_id, role_id, module, action, allowed)
         SELECT workspace_id, $2, module, action, allowed
         FROM governance_role_permissions
         WHERE workspace_id = $1 AND role_id = $3`,
        [workspaceId, roleId, input.inheritedFrom],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const created = await getRole(workspaceId, roleId);
  if (!created) {
    throw new Error('Role creation failed');
  }
  return created;
}

export async function updateRole(
  workspaceId: string,
  roleId: string,
  patch: Partial<Pick<EnterpriseRole, 'name' | 'description' | 'status'>>,
): Promise<EnterpriseRole | null> {
  const sets: string[] = [];
  const values: any[] = [workspaceId, roleId];
  let index = 3;

  if (patch.name !== undefined) {
    sets.push(`name = $${index++}`);
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${index++}`);
    values.push(patch.description);
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${index++}`);
    values.push(patch.status);
  }
  if (!sets.length) {
    return getRole(workspaceId, roleId);
  }

  await query(
    `UPDATE governance_roles
     SET ${sets.join(', ')}, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    values,
  );

  if (patch.name) {
    await query(
      `UPDATE governance_user_roles
       SET updated_at = NOW()
       WHERE workspace_id = $1 AND role_id = $2`,
      [workspaceId, roleId],
    );
  }

  return getRole(workspaceId, roleId);
}

export async function duplicateRole(workspaceId: string, roleId: string): Promise<EnterpriseRole> {
  const source = await getRole(workspaceId, roleId);
  if (!source) {
    throw new Error('Role not found');
  }

  const clone = await createRole(workspaceId, {
    name: `${source.name} Copy`,
    description: source.description,
    inheritedFrom: source.id,
  });
  return clone;
}

export async function roleRequiresStepUp(workspaceId: string, roleId: string): Promise<boolean> {
  let currentRoleId: string | null = roleId;
  const visited = new Set<string>();
  while (currentRoleId && !visited.has(currentRoleId)) {
    if (isBuiltInPrivilegedRole(currentRoleId)) return true;
    visited.add(currentRoleId);
    const rows: Array<{ inherited_from: string | null; privileged: boolean }> = (await query<{ inherited_from: string | null; privileged: boolean }>(
      `SELECT gr.inherited_from,
              EXISTS (
                SELECT 1 FROM governance_role_permissions grp
                WHERE grp.workspace_id = gr.workspace_id AND grp.role_id = gr.id AND grp.allowed = TRUE
                  AND ((grp.module = 'Users' AND grp.action IN ('assign', 'configure', 'delete'))
                    OR (grp.module = 'Settings' AND grp.action = 'configure'))
              ) AS privileged
       FROM governance_roles gr WHERE gr.workspace_id = $1 AND gr.id = $2 AND gr.status = 'active'`,
      [workspaceId, currentRoleId],
    )).rows;
    if (!rows[0]) throw new Error('Role was not found or is disabled.');
    if (rows[0].privileged) return true;
    currentRoleId = rows[0].inherited_from;
  }
  return false;
}

export async function listRolePermissions(workspaceId: string): Promise<RolePermissionRecord[]> {
  const result = await query(
    `SELECT workspace_id, role_id, module, action, allowed
     FROM governance_role_permissions
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  return result.rows.map(mapPermissionRow);
}

export async function replaceRolePermissions(
  workspaceId: string,
  updates: RolePermissionRecord[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const update of updates) {
      await client.query(
        `INSERT INTO governance_role_permissions (workspace_id, role_id, module, action, allowed, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (workspace_id, role_id, module, action)
         DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW()`,
        [workspaceId, update.roleId, update.module, update.action, update.allowed],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listUsers(workspaceId: string): Promise<EnterpriseUserAccessRecord[]> {
  const result = await query(
    `SELECT
       u.id,
       gur.workspace_id,
       COALESCE(u.full_name, u.email) AS full_name,
       u.email,
       gur.status,
       gur.role_id AS assigned_role_id,
       gr.name AS assigned_role_name,
       CASE
         WHEN u.mfa_enabled THEN 'enabled'
         WHEN u.mfa_login_required OR u.sensitive_action_mfa_required THEN 'required'
         ELSE 'not_enabled'
       END AS mfa_status,
       u.last_login_at AS last_login,
       COALESCE(NULLIF(gur.access_scope, ''), COALESCE(w.name, 'Workspace access')) AS access_scope,
       COALESCE(w.name, gur.workspace_id) AS workspace_name,
       wum.role AS legacy_workspace_role,
       gur.suspended_reason
     FROM governance_user_roles gur
     INNER JOIN users u ON u.id = gur.user_id
     INNER JOIN governance_roles gr ON gr.workspace_id = gur.workspace_id AND gr.id = gur.role_id
     LEFT JOIN workspace_user_memberships wum ON wum.workspace_id = gur.workspace_id AND wum.user_id = gur.user_id
     LEFT JOIN workspaces w ON w.id = gur.workspace_id
     WHERE gur.workspace_id = $1
     ORDER BY COALESCE(u.full_name, u.email) ASC`,
    [workspaceId],
  );
  return result.rows.map(mapUserRow);
}

export async function getUserAccessRecord(workspaceId: string, userId: string): Promise<EnterpriseUserAccessRecord | null> {
  const users = await listUsers(workspaceId);
  return users.find((user) => user.id === userId) || null;
}

export async function assignUserRole(
  workspaceId: string,
  userId: string,
  roleId: EnterpriseRoleKey,
): Promise<EnterpriseUserAccessRecord | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = await client.query<{ inherited_from: EnterpriseRoleKey | null }>(
      `SELECT inherited_from FROM governance_roles WHERE workspace_id = $1 AND id = $2 AND status = 'active'`,
      [workspaceId, roleId],
    );
    if (!role.rows[0]) throw new Error('Role was not found or is disabled.');
    let legacyRoleSource: EnterpriseRoleKey = roleId;
    let inheritedFrom = role.rows[0].inherited_from;
    const visited = new Set<string>([roleId]);
    while (inheritedFrom && !visited.has(inheritedFrom)) {
      visited.add(inheritedFrom);
      legacyRoleSource = inheritedFrom;
      const parent = await client.query<{ inherited_from: EnterpriseRoleKey | null }>(
        `SELECT inherited_from FROM governance_roles WHERE workspace_id = $1 AND id = $2 AND status = 'active'`,
        [workspaceId, inheritedFrom],
      );
      if (!parent.rows[0]) throw new Error('Inherited role was not found or is disabled.');
      inheritedFrom = parent.rows[0].inherited_from;
    }
    const assignment = await client.query(
      `UPDATE governance_user_roles SET role_id = $3, updated_at = NOW()
       WHERE workspace_id = $1 AND user_id = $2 RETURNING user_id`,
      [workspaceId, userId, roleId],
    );
    if (!assignment.rowCount) throw new Error('Workspace user was not found.');
    const membership = await client.query(
      `UPDATE workspace_user_memberships SET role = $3
       WHERE workspace_id = $1 AND user_id = $2 RETURNING user_id`,
      [workspaceId, userId, mapEnterpriseRoleToLegacyWorkspaceRole(legacyRoleSource)],
    );
    if (!membership.rowCount) throw new Error('Workspace membership was not found.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getUserAccessRecord(workspaceId, userId);
}

export async function updateUserStatus(
  workspaceId: string,
  userId: string,
  status: UserAccessStatus,
  notes?: string | null,
): Promise<EnterpriseUserAccessRecord | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ status: UserAccessStatus; role_id: EnterpriseRoleKey }>(
      `SELECT status, role_id FROM governance_user_roles
       WHERE workspace_id = $1 AND user_id = $2 FOR UPDATE`,
      [workspaceId, userId],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const allowedTransitions: Record<UserAccessStatus, UserAccessStatus[]> = {
      active: ['suspended', 'revoked'],
      pending: ['active', 'revoked'],
      suspended: ['active', 'revoked'],
      revoked: [],
    };
    if (current.rows[0].status !== status && !allowedTransitions[current.rows[0].status].includes(status)) {
      throw new Error(`User access cannot move from ${current.rows[0].status} to ${status}.`);
    }
    await client.query(
      `UPDATE governance_user_roles
       SET status = $3, suspended_reason = $4, updated_at = NOW()
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId, status, status === 'active' ? null : notes || null],
    );

    if (status === 'active') {
      let legacyRoleSource: EnterpriseRoleKey = current.rows[0].role_id;
      let currentRoleId: EnterpriseRoleKey | null = current.rows[0].role_id;
      const visited = new Set<string>();
      while (currentRoleId && !visited.has(currentRoleId)) {
        visited.add(currentRoleId);
        legacyRoleSource = currentRoleId;
        const roleResult: { rows: Array<{ inherited_from: EnterpriseRoleKey | null }> } = await client.query<{ inherited_from: EnterpriseRoleKey | null }>(
          `SELECT inherited_from FROM governance_roles
           WHERE workspace_id = $1 AND id = $2 AND status = 'active'`,
          [workspaceId, currentRoleId],
        );
        if (!roleResult.rows[0]) throw new Error('Assigned role was not found or is disabled.');
        currentRoleId = roleResult.rows[0].inherited_from;
      }
      await client.query(
        `INSERT INTO workspace_user_memberships (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [workspaceId, userId, mapEnterpriseRoleToLegacyWorkspaceRole(legacyRoleSource)],
      );
    } else {
      await client.query(
        `DELETE FROM workspace_user_memberships WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getUserAccessRecord(workspaceId, userId);
}

export async function requireUserMfa(workspaceId: string, userId: string): Promise<EnterpriseUserAccessRecord | null> {
  await updateMfaPolicy(userId, {
    mfaLoginRequired: true,
    sensitiveActionMfaRequired: true,
  });

  await query(
    `INSERT INTO governance_mfa_status (workspace_id, user_id, status, required_by_policy, updated_at)
     VALUES ($1, $2, 'required', TRUE, NOW())
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET status = 'required', required_by_policy = TRUE, updated_at = NOW()`,
    [workspaceId, userId],
  );

  return getUserAccessRecord(workspaceId, userId);
}

export async function listAccessRequests(workspaceId: string): Promise<AccessRequestRecord[]> {
  const result = await query(
    `SELECT
       gar.*,
       gr.name AS requested_role_name
     FROM governance_access_requests gar
     LEFT JOIN governance_roles gr ON gr.workspace_id = gar.workspace_id AND gr.id = gar.requested_role_id
     WHERE gar.workspace_id = $1
     ORDER BY gar.request_date DESC`,
    [workspaceId],
  );
  return result.rows.map(mapAccessRequestRow);
}

export async function getAccessRequest(workspaceId: string, requestId: string): Promise<AccessRequestRecord | null> {
  const result = await query(
    `SELECT gar.*, gr.name AS requested_role_name
     FROM governance_access_requests gar
     LEFT JOIN governance_roles gr ON gr.workspace_id = gar.workspace_id AND gr.id = gar.requested_role_id
     WHERE gar.workspace_id = $1 AND gar.id = $2`,
    [workspaceId, requestId],
  );
  return result.rows[0] ? mapAccessRequestRow(result.rows[0]) : null;
}

export async function updateAccessRequestDecision(
  workspaceId: string,
  requestId: string,
  input: {
    status: AccessRequestRecord['status'];
    reviewer: string;
    decisionNotes?: string | null;
    requestedRoleId?: EnterpriseRoleKey;
    enforceMfaBeforeActivation?: boolean;
  },
): Promise<AccessRequestRecord | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const request = await client.query<{
      status: AccessRequestRecord['status']; requester_user_id: string | null; requester_email: string;
      requested_role_id: EnterpriseRoleKey; enforce_mfa_before_activation: boolean;
    }>(
      `SELECT status, requester_user_id, requester_email, requested_role_id, enforce_mfa_before_activation
       FROM governance_access_requests WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
      [workspaceId, requestId],
    );
    if (!request.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const allowedTransitions: Record<AccessRequestRecord['status'], AccessRequestRecord['status'][]> = {
      pending: ['approved', 'rejected', 'needs_info'],
      needs_info: ['approved', 'rejected'],
      approved: [],
      rejected: [],
    };
    if (!allowedTransitions[request.rows[0].status].includes(input.status)) {
      throw new Error(`Access request cannot move from ${request.rows[0].status} to ${input.status}.`);
    }
    if (input.status === 'approved' && request.rows[0].requester_email.toLowerCase() === input.reviewer.toLowerCase()) {
      throw new Error('Requesters cannot approve their own access request.');
    }

    const requestedRoleId = input.status === 'approved'
      ? input.requestedRoleId || request.rows[0].requested_role_id
      : request.rows[0].requested_role_id;
    const enforceMfa = input.status === 'approved'
      ? input.enforceMfaBeforeActivation ?? request.rows[0].enforce_mfa_before_activation
      : request.rows[0].enforce_mfa_before_activation;

    let approvedUserId: string | null = null;
    let legacyRoleSource: EnterpriseRoleKey | null = null;
    if (input.status === 'approved') {
      const role = await client.query<{ inherited_from: EnterpriseRoleKey | null }>(
        `SELECT inherited_from FROM governance_roles WHERE workspace_id = $1 AND id = $2 AND status = 'active'`,
        [workspaceId, requestedRoleId],
      );
      if (!role.rows[0]) throw new Error('The approved role was not found or is disabled.');
      legacyRoleSource = requestedRoleId;
      let inheritedFrom = role.rows[0].inherited_from;
      const visited = new Set<string>([requestedRoleId]);
      while (inheritedFrom && !visited.has(inheritedFrom)) {
        visited.add(inheritedFrom);
        legacyRoleSource = inheritedFrom;
        const parent: { rows: Array<{ inherited_from: EnterpriseRoleKey | null }> } = await client.query<{ inherited_from: EnterpriseRoleKey | null }>(
          `SELECT inherited_from FROM governance_roles WHERE workspace_id = $1 AND id = $2 AND status = 'active'`,
          [workspaceId, inheritedFrom],
        );
        if (!parent.rows[0]) throw new Error('The approved role inherits from a missing or disabled role.');
        inheritedFrom = parent.rows[0].inherited_from;
      }
      const user = await client.query<{ id: string }>(
        `SELECT id FROM users
         WHERE ($1::uuid IS NOT NULL AND id = $1::uuid) OR LOWER(email) = LOWER($2)
         ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END LIMIT 1 FOR SHARE`,
        [request.rows[0].requester_user_id, request.rows[0].requester_email],
      );
      if (!user.rows[0]) throw new Error('The access requester does not resolve to an existing user.');
      approvedUserId = user.rows[0].id;
    }

    await client.query(
      `UPDATE governance_access_requests
       SET status = $3, reviewer = $4, decision_notes = $5,
           requested_role_id = $6, enforce_mfa_before_activation = $7, updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, requestId, input.status, input.reviewer, input.decisionNotes?.trim() || null, requestedRoleId, enforceMfa],
    );

    if (input.status === 'approved' && approvedUserId && legacyRoleSource) {
      await client.query(
        `INSERT INTO governance_user_roles (id, workspace_id, user_id, role_id, status, access_scope, reviewer)
         VALUES ($1, $2, $3, $4, 'active', COALESCE((SELECT name FROM workspaces WHERE id = $2), 'Workspace access'), $5)
         ON CONFLICT (workspace_id, user_id) DO UPDATE
         SET role_id = EXCLUDED.role_id, status = 'active', reviewer = EXCLUDED.reviewer,
             suspended_reason = NULL, updated_at = NOW()`,
        [generateId('gur'), workspaceId, approvedUserId, requestedRoleId, input.reviewer],
      );
      await client.query(
        `INSERT INTO workspace_user_memberships (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [workspaceId, approvedUserId, mapEnterpriseRoleToLegacyWorkspaceRole(legacyRoleSource)],
      );
      if (enforceMfa) {
        await client.query(
          `UPDATE users SET mfa_login_required = TRUE, sensitive_action_mfa_required = TRUE, updated_at = NOW()
           WHERE id = $1`,
          [approvedUserId],
        );
        await client.query(
          `INSERT INTO governance_mfa_status (workspace_id, user_id, status, required_by_policy, updated_at)
           VALUES ($1, $2, 'required', TRUE, NOW())
           ON CONFLICT (workspace_id, user_id)
           DO UPDATE SET status = 'required', required_by_policy = TRUE, updated_at = NOW()`,
          [workspaceId, approvedUserId],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getAccessRequest(workspaceId, requestId);
}

export async function listAccessReviews(workspaceId: string): Promise<AccessReviewRecord[]> {
  const reviewResult = await query(
    `SELECT *
     FROM governance_access_reviews
     WHERE workspace_id = $1
     ORDER BY due_date ASC, created_at DESC`,
    [workspaceId],
  );
  const itemResult = await query(
    `SELECT *
     FROM governance_access_review_items
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspaceId],
  );
  const itemsByReview = new Map<string, AccessReviewDecisionRecord[]>();
  itemResult.rows.forEach((row) => {
    const mapped = mapReviewItemRow(row);
    const current = itemsByReview.get(mapped.reviewId) || [];
    current.push(mapped);
    itemsByReview.set(mapped.reviewId, current);
  });
  return reviewResult.rows.map((row) => mapReviewRow(row, itemsByReview.get(row.id) || []));
}

export async function createAccessReview(
  workspaceId: string,
  input: {
    name: string;
    selectedRoles: EnterpriseRoleKey[];
    selectedModules: PermissionModule[];
    selectedUserIds: string[];
    reviewers: string[];
    dueDate: string;
  },
): Promise<AccessReviewRecord> {
  const [users, roles] = await Promise.all([listUsers(workspaceId), listRoles(workspaceId)]);
  const selectedUsers = input.selectedUserIds.map((userId) => users.find((entry) => entry.id === userId));
  const availableRoleIds = new Set(roles.filter((role) => role.status === 'active').map((role) => role.id));
  const workspaceUsersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const selectedUserIdSet = new Set(input.selectedUserIds);
  const selectedReviewers = input.reviewers.map((reviewer) => workspaceUsersByEmail.get(reviewer.toLowerCase()));
  if (
    selectedUsers.some((user) => !user)
    || input.selectedRoles.some((roleId) => !availableRoleIds.has(roleId))
    || selectedReviewers.some((reviewer) => !reviewer || reviewer.status !== 'active' || selectedUserIdSet.has(reviewer.id))
  ) {
    throw Object.assign(new Error('Selected review scope is invalid'), { code: 'INVALID_REVIEW_SCOPE' });
  }
  if (!input.reviewers.length) throw Object.assign(new Error('At least one reviewer is required'), { code: 'INVALID_REVIEW_SCOPE' });
  const reviewId = generateId('review');
  const scopeSummary = `${input.selectedRoles.length} roles, ${input.selectedModules.length} modules, ${input.selectedUserIds.length} users`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO governance_access_reviews
       (id, workspace_id, name, scope_summary, selected_roles, selected_modules, selected_user_ids, reviewers, due_date, status, completion_percent, excessive_privilege_flags)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, 'in_progress', 0, 0)`,
      [
        reviewId,
        workspaceId,
        input.name,
        scopeSummary,
        JSON.stringify(input.selectedRoles),
        JSON.stringify(input.selectedModules),
        JSON.stringify(input.selectedUserIds),
        JSON.stringify(input.reviewers),
        input.dueDate,
      ],
    );
    for (const [index, user] of selectedUsers.entries()) {
      if (!user) continue;
      await client.query(
        `INSERT INTO governance_access_review_items
         (id, review_id, workspace_id, user_id, user_name, role_name, reviewer)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [generateId('review-item'), reviewId, workspaceId, user.id, user.fullName, user.assignedRoleName, input.reviewers[index % input.reviewers.length]],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const reviews = await listAccessReviews(workspaceId);
  const created = reviews.find((review) => review.id === reviewId);
  if (!created) {
    throw new Error('Failed to create access review');
  }
  return created;
}

export async function updateAccessReviewItem(
  workspaceId: string,
  reviewId: string,
  itemId: string,
  decision: AccessReviewDecision,
  notes?: string | null,
  reviewerEmail?: string,
): Promise<AccessReviewRecord | null> {
  const updatedItem = await query(
    `UPDATE governance_access_review_items
     SET decision = $4, notes = $5, updated_at = NOW()
     WHERE workspace_id = $1
       AND review_id = $2
       AND id = $3
       AND LOWER(reviewer) = LOWER($6)
       AND EXISTS (
         SELECT 1
         FROM governance_user_roles reviewer_role
         INNER JOIN users reviewer_user ON reviewer_user.id = reviewer_role.user_id
         WHERE reviewer_role.workspace_id = $1
           AND reviewer_role.status = 'active'
           AND LOWER(reviewer_user.email) = LOWER($6)
       )
       AND EXISTS (
         SELECT 1 FROM governance_access_reviews review
         WHERE review.workspace_id = $1
           AND review.id = $2
           AND review.evidence_exported_at IS NULL
       )`,
    [workspaceId, reviewId, itemId, decision, notes || null, reviewerEmail || ''],
  );
  if (!updatedItem.rowCount) return null;

  const summary = await query<{
    total: string;
    completed: string;
    flagged: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE decision IS NOT NULL) AS completed,
       COUNT(*) FILTER (WHERE decision = 'flagged') AS flagged
     FROM governance_access_review_items
     WHERE workspace_id = $1 AND review_id = $2`,
    [workspaceId, reviewId],
  );
  const row = summary.rows[0];
  const total = Number(row?.total || 0);
  const completed = Number(row?.completed || 0);
  const flagged = Number(row?.flagged || 0);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const status: AccessReviewStatus = percent === 100 ? 'completed' : 'in_progress';

  await query(
    `UPDATE governance_access_reviews
     SET completion_percent = $3,
         excessive_privilege_flags = $4,
         status = $5,
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, reviewId, percent, flagged, status],
  );

  const reviews = await listAccessReviews(workspaceId);
  return reviews.find((review) => review.id === reviewId) || null;
}

export async function markAccessReviewEvidenceExported(workspaceId: string, reviewId: string): Promise<AccessReviewRecord | null> {
  const updated = await query(
    `UPDATE governance_access_reviews
     SET evidence_exported_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2 AND status = 'completed'`,
    [workspaceId, reviewId],
  );
  if (!updated.rowCount) return null;
  const reviews = await listAccessReviews(workspaceId);
  return reviews.find((review) => review.id === reviewId) || null;
}

export async function listSodRules(workspaceId: string): Promise<SodRuleRecord[]> {
  const result = await query(
    `SELECT * FROM governance_sod_rules WHERE workspace_id = $1 ORDER BY severity DESC, title ASC`,
    [workspaceId],
  );
  return result.rows.map(mapSodRuleRow);
}

export async function createSodRule(
  workspaceId: string,
  input: Omit<SodRuleRecord, 'workspaceId' | 'createdAt' | 'updatedAt'>,
): Promise<SodRuleRecord> {
  const id = input.id || generateId('sod');
  await query(
    `INSERT INTO governance_sod_rules (id, workspace_id, title, description, severity, rules)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [id, workspaceId, input.title, input.description, input.severity, JSON.stringify(input.rules)],
  );
  const rules = await listSodRules(workspaceId);
  const created = rules.find((rule) => rule.id === id);
  if (!created) {
    throw new Error('Failed to create SoD rule');
  }
  return created;
}

export async function updateSodRule(
  workspaceId: string,
  ruleId: string,
  patch: Partial<Pick<SodRuleRecord, 'title' | 'description' | 'severity' | 'rules'>>,
): Promise<SodRuleRecord | null> {
  await query(
    `UPDATE governance_sod_rules
     SET title = COALESCE($3, title),
         description = COALESCE($4, description),
         severity = COALESCE($5, severity),
         rules = COALESCE($6::jsonb, rules),
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, ruleId, patch.title || null, patch.description || null, patch.severity || null, patch.rules ? JSON.stringify(patch.rules) : null],
  );
  const rules = await listSodRules(workspaceId);
  return rules.find((rule) => rule.id === ruleId) || null;
}

export async function recomputeSodConflicts(workspaceId: string): Promise<SodConflictRecord[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`access-governance-sod:${workspaceId}`]);
    const [roles, permissions, users, rules] = await Promise.all([
      client.query<{ id: EnterpriseRoleKey; name: string }>(
        `SELECT id, name FROM governance_roles WHERE workspace_id = $1`, [workspaceId],
      ),
      client.query<{ role_id: EnterpriseRoleKey; module: PermissionModule; action: PermissionAction; allowed: boolean }>(
        `SELECT role_id, module, action, allowed FROM governance_role_permissions WHERE workspace_id = $1`, [workspaceId],
      ),
      client.query<{ id: string; full_name: string; role_id: EnterpriseRoleKey; status: UserAccessStatus }>(
        `SELECT gur.user_id AS id, COALESCE(u.full_name, u.email) AS full_name, gur.role_id, gur.status
         FROM governance_user_roles gur INNER JOIN users u ON u.id = gur.user_id
         WHERE gur.workspace_id = $1`, [workspaceId],
      ),
      client.query<{
        id: string; title: string; description: string; severity: SodRuleRecord['severity'];
        rules: Array<{ module: PermissionModule; action: PermissionAction }>;
      }>(`SELECT id, title, description, severity, rules FROM governance_sod_rules WHERE workspace_id = $1`, [workspaceId]),
    ]);

    const permissionMap = new Map<string, Set<string>>();
    for (const permission of permissions.rows) {
      const granted = permissionMap.get(permission.role_id) || new Set<string>();
      if (permission.allowed) granted.add(`${permission.module}:${permission.action}`);
      permissionMap.set(permission.role_id, granted);
    }

    await client.query(`DELETE FROM governance_sod_conflicts WHERE workspace_id = $1`, [workspaceId]);
    for (const role of roles.rows) {
      const granted = permissionMap.get(role.id) || new Set<string>();
      const matchedRules = rules.rows.filter((rule) =>
        rule.rules.every((entry) => granted.has(`${entry.module}:${entry.action}`)),
      );
      for (const rule of matchedRules) {
        await client.query(
          `INSERT INTO governance_sod_conflicts
           (id, workspace_id, rule_id, role_id, role_name, severity, rule_title, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [generateId('sodconf'), workspaceId, rule.id, role.id, role.name, rule.severity, rule.title, rule.description],
        );
        for (const user of users.rows.filter((entry) => entry.role_id === role.id && entry.status !== 'revoked')) {
          await client.query(
            `INSERT INTO governance_sod_conflicts
             (id, workspace_id, rule_id, role_id, role_name, user_id, user_name, severity, rule_title, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [generateId('sodconf'), workspaceId, rule.id, role.id, role.name, user.id, user.full_name, rule.severity, rule.title, rule.description],
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return listSodConflicts(workspaceId);
}

export async function listSodConflicts(workspaceId: string): Promise<SodConflictRecord[]> {
  const result = await query(
    `SELECT * FROM governance_sod_conflicts WHERE workspace_id = $1 ORDER BY severity DESC, created_at DESC`,
    [workspaceId],
  );
  return result.rows.map(mapSodConflictRow);
}

export async function listGovernanceAuditLogs(workspaceId: string): Promise<GovernanceAuditLogRecord[]> {
  const result = await query(
    `SELECT * FROM governance_audit_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [workspaceId],
  );
  return result.rows.map(mapAuditRow);
}

export async function createStepUpChallenge(input: {
  workspaceId: string;
  userId: string;
  sessionId: string;
  purpose: StepUpPurpose;
  method: 'authenticator' | 'email' | 'password' | 'passkey';
  tokenId: string;
  expiresAt: string;
}): Promise<StepUpChallengeRecord> {
  const result = await query(
    `INSERT INTO governance_step_up_challenges
     (id, workspace_id, user_id, session_id, purpose, method, token_id, verified_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
     RETURNING *`,
    [generateId('stepup'), input.workspaceId, input.userId, input.sessionId, input.purpose, input.method, input.tokenId, input.expiresAt],
  );
  return mapStepUpRow(result.rows[0]);
}

export async function findValidStepUpChallenge(
  workspaceId: string,
  userId: string,
  sessionId: string,
  tokenId: string,
  purpose: StepUpPurpose,
): Promise<StepUpChallengeRecord | null> {
  const result = await query(
    `SELECT *
     FROM governance_step_up_challenges
     WHERE workspace_id = $1
       AND user_id = $2
       AND session_id = $3
       AND token_id = $4
       AND purpose = $5
       AND consumed_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId, userId, sessionId, tokenId, purpose],
  );
  return result.rows[0] ? mapStepUpRow(result.rows[0]) : null;
}

export async function consumeStepUpChallenge(challengeId: string): Promise<void> {
  await query(
    `UPDATE governance_step_up_challenges
     SET consumed_at = NOW()
     WHERE id = $1`,
    [challengeId],
  );
}

export async function getEffectiveRoleForUser(workspaceId: string, userId: string): Promise<EnterpriseRoleKey | null> {
  const result = await query<{ role_id: EnterpriseRoleKey }>(
    `SELECT role_id
     FROM governance_user_roles
     WHERE workspace_id = $1 AND user_id = $2 AND status <> 'revoked'
     LIMIT 1`,
    [workspaceId, userId],
  );
  return result.rows[0]?.role_id || null;
}

export async function hasPermission(
  workspaceId: string,
  roleId: EnterpriseRoleKey,
  moduleName: PermissionModule,
  action: PermissionAction,
): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT allowed
     FROM governance_role_permissions
     WHERE workspace_id = $1 AND role_id = $2 AND module = $3 AND action = $4
     LIMIT 1`,
    [workspaceId, roleId, moduleName, action],
  );
  return Boolean(result.rows[0]?.allowed);
}

export async function getUserSodConflicts(workspaceId: string, userId: string): Promise<SodConflictRecord[]> {
  const result = await query(
    `SELECT *
     FROM governance_sod_conflicts
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  return result.rows.map(mapSodConflictRow);
}
