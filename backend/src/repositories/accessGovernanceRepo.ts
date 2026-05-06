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
  const roleId = (`custom_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` || `custom_${Date.now()}`) as EnterpriseRoleKey;
  await query(
    `INSERT INTO governance_roles (id, workspace_id, name, description, status, is_default, inherited_from)
     VALUES ($1, $2, $3, $4, 'active', FALSE, $5)`,
    [roleId, workspaceId, input.name, input.description, input.inheritedFrom || null],
  );

  if (input.inheritedFrom) {
    await query(
      `INSERT INTO governance_role_permissions (workspace_id, role_id, module, action, allowed)
       SELECT workspace_id, $2, module, action, allowed
       FROM governance_role_permissions
       WHERE workspace_id = $1 AND role_id = $3`,
      [workspaceId, roleId, input.inheritedFrom],
    );
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
       COALESCE(NULLIF(gur.access_scope, ''), COALESCE(w.name, w.slug, 'Workspace access')) AS access_scope,
       COALESCE(w.name, w.slug, gur.workspace_id) AS workspace_name,
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
  await query(
    `UPDATE governance_user_roles
     SET role_id = $3, updated_at = NOW()
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId, roleId],
  );

  await query(
    `UPDATE workspace_user_memberships
     SET role = $3
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId, mapEnterpriseRoleToLegacyWorkspaceRole(roleId)],
  );

  return getUserAccessRecord(workspaceId, userId);
}

export async function updateUserStatus(
  workspaceId: string,
  userId: string,
  status: UserAccessStatus,
  notes?: string | null,
): Promise<EnterpriseUserAccessRecord | null> {
  await query(
    `UPDATE governance_user_roles
     SET status = $3, suspended_reason = $4, updated_at = NOW()
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId, status, notes || null],
  );

  if (status === 'revoked') {
    await query(
      `DELETE FROM workspace_user_memberships
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    );
  } else {
    await query(
      `UPDATE users
       SET is_active = $2, updated_at = NOW()
       WHERE id = $1`,
      [userId, status !== 'suspended'],
    );
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
  await query(
    `UPDATE governance_access_requests
     SET status = $3,
         reviewer = $4,
         decision_notes = $5,
         requested_role_id = COALESCE($6, requested_role_id),
         enforce_mfa_before_activation = COALESCE($7, enforce_mfa_before_activation),
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [
      workspaceId,
      requestId,
      input.status,
      input.reviewer,
      input.decisionNotes || null,
      input.requestedRoleId || null,
      input.enforceMfaBeforeActivation ?? null,
    ],
  );

  const updated = await getAccessRequest(workspaceId, requestId);
  if (updated && updated.status === 'approved') {
    const matchingUser = await query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [updated.requesterEmail],
    );
    if (matchingUser.rows[0]) {
      await assignUserRole(workspaceId, matchingUser.rows[0].id, updated.requestedRoleId);
      await query(
        `UPDATE governance_user_roles
         SET status = 'active', updated_at = NOW()
         WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, matchingUser.rows[0].id],
      );
      if (updated.enforceMfaBeforeActivation) {
        await requireUserMfa(workspaceId, matchingUser.rows[0].id);
      }
    }
  }
  return updated;
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
  const users = await listUsers(workspaceId);
  const reviewId = generateId('review');
  const scopeSummary = `${input.selectedRoles.length} roles, ${input.selectedModules.length} modules, ${input.selectedUserIds.length} users`;

  await query(
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

  for (const userId of input.selectedUserIds) {
    const user = users.find((entry) => entry.id === userId);
    if (!user) continue;
    await query(
      `INSERT INTO governance_access_review_items
       (id, review_id, workspace_id, user_id, user_name, role_name, reviewer)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        generateId('review-item'),
        reviewId,
        workspaceId,
        user.id,
        user.fullName,
        user.assignedRoleName,
        input.reviewers[0] || 'Security Office',
      ],
    );
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
): Promise<AccessReviewRecord | null> {
  await query(
    `UPDATE governance_access_review_items
     SET decision = $4, notes = $5, updated_at = NOW()
     WHERE workspace_id = $1 AND review_id = $2 AND id = $3`,
    [workspaceId, reviewId, itemId, decision, notes || null],
  );

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
  await query(
    `UPDATE governance_access_reviews
     SET evidence_exported_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, reviewId],
  );
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
  const roles = await listRoles(workspaceId);
  const rolePermissions = await listRolePermissions(workspaceId);
  const users = await listUsers(workspaceId);
  const rules = await listSodRules(workspaceId);

  await query(`DELETE FROM governance_sod_conflicts WHERE workspace_id = $1`, [workspaceId]);

  const permissionMap = new Map<string, Set<string>>();
  rolePermissions.forEach((permission) => {
    const key = `${permission.roleId}`;
    const current = permissionMap.get(key) || new Set<string>();
    if (permission.allowed) {
      current.add(`${permission.module}:${permission.action}`);
    }
    permissionMap.set(key, current);
  });

  const conflicts: SodConflictRecord[] = [];
  for (const role of roles) {
    const granted = permissionMap.get(role.id) || new Set<string>();
    const matchedRules = rules.filter((rule) =>
      rule.rules.every((entry) => granted.has(`${entry.module}:${entry.action}`)),
    );

    for (const rule of matchedRules) {
      const roleConflictId = generateId('sodconf');
      await query(
        `INSERT INTO governance_sod_conflicts
         (id, workspace_id, rule_id, role_id, role_name, severity, rule_title, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [roleConflictId, workspaceId, rule.id, role.id, role.name, rule.severity, rule.title, rule.description],
      );
      conflicts.push({
        id: roleConflictId,
        workspaceId,
        ruleId: rule.id,
        roleId: role.id,
        roleName: role.name,
        severity: rule.severity,
        ruleTitle: rule.title,
        description: rule.description,
        createdAt: new Date().toISOString(),
      });

      for (const user of users.filter((entry) => entry.assignedRoleId === role.id && entry.status !== 'revoked')) {
        const userConflictId = generateId('sodconf');
        await query(
          `INSERT INTO governance_sod_conflicts
           (id, workspace_id, rule_id, role_id, role_name, user_id, user_name, severity, rule_title, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [userConflictId, workspaceId, rule.id, role.id, role.name, user.id, user.fullName, rule.severity, rule.title, rule.description],
        );
      }
    }
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
