import { query } from '../db.js';
import { defaultPermissionMatrix, getDefaultRoles, getDefaultSodRules, GOVERNANCE_PERMISSION_ACTIONS, GOVERNANCE_PERMISSION_MODULES, mapLegacyWorkspaceRoleToEnterpriseRole } from './accessGovernanceDefaults.js';

export async function syncAccessGovernanceDefaults(): Promise<void> {
  await seedGovernancePermissions();
  await seedGovernanceRolesAndPermissions();
  await seedGovernanceSodRules();
  await syncGovernanceUserRoles();
  await syncGovernanceMfaStatuses();
}

async function seedGovernancePermissions() {
  for (const moduleName of GOVERNANCE_PERMISSION_MODULES) {
    for (const action of GOVERNANCE_PERMISSION_ACTIONS) {
      await query(
        `INSERT INTO governance_permissions (id, module, action)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [`${moduleName}:${action}`, moduleName, action],
      );
    }
  }
}

async function seedGovernanceRolesAndPermissions() {
  const workspaceRows = await query<{ workspace_id: string }>(
    `SELECT DISTINCT workspace_id FROM workspace_user_memberships`,
  );
  const permissionMatrix = defaultPermissionMatrix();

  for (const workspaceRow of workspaceRows.rows) {
    const workspaceId = workspaceRow.workspace_id;
    for (const role of getDefaultRoles()) {
      await query(
        `INSERT INTO governance_roles (id, workspace_id, name, description, status, is_default, inherited_from)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (workspace_id, id) DO NOTHING`,
        [role.id, workspaceId, role.name, role.description, role.status, role.isDefault, role.inheritedFrom],
      );
    }

    for (const [roleId, moduleMatrix] of Object.entries(permissionMatrix)) {
      for (const [moduleName, actionSet] of Object.entries(moduleMatrix)) {
        for (const [action, allowed] of Object.entries(actionSet)) {
          await query(
            `INSERT INTO governance_role_permissions (workspace_id, role_id, module, action, allowed)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (workspace_id, role_id, module, action) DO NOTHING`,
            [workspaceId, roleId, moduleName, action, allowed],
          );
        }
      }
    }
  }
}

async function seedGovernanceSodRules() {
  const workspaceRows = await query<{ workspace_id: string }>(
    `SELECT DISTINCT workspace_id FROM workspace_user_memberships`,
  );
  for (const workspaceRow of workspaceRows.rows) {
    for (const rule of getDefaultSodRules()) {
      await query(
        `INSERT INTO governance_sod_rules (id, workspace_id, title, description, severity, rules)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [rule.id, workspaceRow.workspace_id, rule.title, rule.description, rule.severity, JSON.stringify(rule.rules)],
      );
    }
  }
}

async function syncGovernanceUserRoles() {
  await query(`
    INSERT INTO governance_user_roles (id, workspace_id, user_id, role_id, status, access_scope, reviewer)
    SELECT
      CONCAT('gur-', wum.workspace_id, '-', wum.user_id::text),
      wum.workspace_id,
      wum.user_id,
      CASE
        WHEN wum.role = 'owner' THEN 'super_admin'
        WHEN wum.role = 'admin' THEN 'tenant_admin'
        WHEN wum.role = 'grc' THEN 'grc_manager'
        WHEN wum.role = 'auditor' THEN 'auditor'
        ELSE 'read_only_executive'
      END,
      CASE WHEN u.is_active THEN 'active' ELSE 'suspended' END,
      COALESCE(w.name, 'Workspace access'),
      'Bootstrap'
    FROM workspace_user_memberships wum
    INNER JOIN users u ON u.id = wum.user_id
    LEFT JOIN workspaces w ON w.id = wum.workspace_id
    ON CONFLICT (workspace_id, user_id) DO NOTHING
  `);

  const rows = await query<{
    workspace_id: string;
    user_id: string;
    role: string;
  }>(`SELECT workspace_id, user_id, role FROM workspace_user_memberships`);

  for (const row of rows.rows) {
    await query(
      `UPDATE governance_user_roles
       SET role_id = COALESCE(role_id, $3),
           updated_at = NOW()
       WHERE workspace_id = $1 AND user_id = $2`,
      [row.workspace_id, row.user_id, mapLegacyWorkspaceRoleToEnterpriseRole(row.role as any)],
    );
  }
}

async function syncGovernanceMfaStatuses() {
  await query(`
    INSERT INTO governance_mfa_status (workspace_id, user_id, status, required_by_policy, updated_at)
    SELECT
      wum.workspace_id,
      u.id,
      CASE
        WHEN u.mfa_enabled THEN 'enabled'
        WHEN u.mfa_login_required OR u.sensitive_action_mfa_required THEN 'required'
        ELSE 'not_enabled'
      END,
      COALESCE(u.mfa_login_required, FALSE) OR COALESCE(u.sensitive_action_mfa_required, FALSE),
      NOW()
    FROM workspace_user_memberships wum
    INNER JOIN users u ON u.id = wum.user_id
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      required_by_policy = EXCLUDED.required_by_policy,
      updated_at = NOW()
  `);
}
