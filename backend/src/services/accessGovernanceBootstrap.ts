import { query } from '../db.js';
import { defaultPermissionMatrix, getDefaultRoles, getDefaultSodRules, GOVERNANCE_PERMISSION_ACTIONS, GOVERNANCE_PERMISSION_MODULES, mapLegacyWorkspaceRoleToEnterpriseRole } from './accessGovernanceDefaults.js';

export async function ensureAccessGovernanceSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS governance_roles (
      id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      inherited_from TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_permissions (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      UNIQUE (module, action)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_role_permissions (
      workspace_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      allowed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, role_id, module, action),
      FOREIGN KEY (workspace_id, role_id) REFERENCES governance_roles(workspace_id, id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_user_roles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      access_scope TEXT NOT NULL DEFAULT '',
      reviewer TEXT,
      suspended_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, user_id),
      FOREIGN KEY (workspace_id, role_id) REFERENCES governance_roles(workspace_id, id) ON DELETE RESTRICT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_access_requests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      requested_role_id TEXT NOT NULL,
      business_reason TEXT NOT NULL,
      requested_workspace TEXT NOT NULL,
      request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      decision_notes TEXT,
      enforce_mfa_before_activation BOOLEAN NOT NULL DEFAULT TRUE,
      invitation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_access_reviews (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      scope_summary TEXT NOT NULL,
      selected_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
      selected_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      selected_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      reviewers JSONB NOT NULL DEFAULT '[]'::jsonb,
      due_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      completion_percent INTEGER NOT NULL DEFAULT 0,
      excessive_privilege_flags INTEGER NOT NULL DEFAULT 0,
      evidence_exported_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_access_review_items (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES governance_access_reviews(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      role_name TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      decision TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_sod_rules (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      rules JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, title)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_sod_conflicts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      user_id UUID,
      user_name TEXT,
      severity TEXT NOT NULL,
      rule_title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_audit_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      actor_user_id UUID,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      previous_value TEXT,
      new_value TEXT,
      outcome TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_mfa_status (
      workspace_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      required_by_policy BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS governance_step_up_challenges (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      method TEXT NOT NULL,
      token_id TEXT NOT NULL UNIQUE,
      verified_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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
