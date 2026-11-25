-- LAFLO Access Governance schema ownership migration. Additive only; default role synchronization remains in application startup.

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
;

CREATE TABLE IF NOT EXISTS governance_permissions (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      UNIQUE (module, action)
    )
;

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
;

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
;

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
;

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
;

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
;

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
;

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
;

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
;

CREATE TABLE IF NOT EXISTS governance_mfa_status (
      workspace_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      required_by_policy BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, user_id)
    )
;

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
;

CREATE INDEX IF NOT EXISTS idx_governance_roles_workspace ON governance_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_role_permissions_workspace ON governance_role_permissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_user_roles_workspace ON governance_user_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_access_requests_workspace ON governance_access_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_access_reviews_workspace ON governance_access_reviews(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_access_review_items_workspace ON governance_access_review_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_sod_rules_workspace ON governance_sod_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_sod_conflicts_workspace ON governance_sod_conflicts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_audit_logs_workspace ON governance_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_mfa_status_workspace ON governance_mfa_status(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_step_up_challenges_workspace ON governance_step_up_challenges(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_review_items_review ON governance_access_review_items(review_id);
CREATE INDEX IF NOT EXISTS idx_governance_step_up_lookup ON governance_step_up_challenges(workspace_id, user_id, session_id, purpose, expires_at);
