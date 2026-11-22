CREATE TABLE IF NOT EXISTS organisation_groups (
 id TEXT PRIMARY KEY,governing_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,group_ref TEXT NOT NULL,name TEXT NOT NULL,
 operating_model TEXT NOT NULL CHECK(operating_model IN('Single Organisation','Organisation Group','Managed Service Provider')),
 parent_organisation TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Draft',created_by TEXT NOT NULL,approved_by TEXT,approved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(governing_workspace_id,group_ref)
);
CREATE TABLE IF NOT EXISTS organisation_group_members (
 id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES organisation_groups(id) ON DELETE CASCADE,governing_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 member_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,member_organisation TEXT NOT NULL,relationship_type TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending',allowed_modules JSONB NOT NULL DEFAULT '[]'::jsonb,effective_date DATE,review_date DATE,created_by TEXT NOT NULL,approved_by TEXT,approved_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(group_id,member_workspace_id)
);
CREATE TABLE IF NOT EXISTS managed_client_engagements (
 id TEXT PRIMARY KEY,provider_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,engagement_ref TEXT NOT NULL,client_organisation TEXT NOT NULL,
 client_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,service_type TEXT NOT NULL,engagement_owner TEXT NOT NULL,assigned_consultants JSONB NOT NULL DEFAULT '[]'::jsonb,
 start_date DATE NOT NULL,end_date DATE,status TEXT NOT NULL DEFAULT 'Draft',approved_access_scope JSONB NOT NULL DEFAULT '[]'::jsonb,deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
 review_date DATE,linked_report_ids JSONB NOT NULL DEFAULT '[]'::jsonb,created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(provider_workspace_id,engagement_ref)
);
CREATE TABLE IF NOT EXISTS workspace_delegations (
 id TEXT PRIMARY KEY,granting_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,receiving_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 delegated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,permissions JSONB NOT NULL DEFAULT '[]'::jsonb,effective_date DATE NOT NULL,expiry_date DATE,
 status TEXT NOT NULL DEFAULT 'Pending',requested_by UUID NOT NULL REFERENCES users(id),approved_by UUID REFERENCES users(id),approved_at TIMESTAMPTZ,revoked_by UUID REFERENCES users(id),revoked_at TIMESTAMPTZ,reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(granting_workspace_id<>receiving_workspace_id)
);
CREATE TABLE IF NOT EXISTS group_shared_controls (
 id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES organisation_groups(id) ON DELETE CASCADE,governing_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 control_reference TEXT NOT NULL,controlling_workspace_id TEXT NOT NULL REFERENCES workspaces(id),title TEXT NOT NULL,applicable_scope TEXT NOT NULL,control_owner TEXT NOT NULL,
 participating_workspaces JSONB NOT NULL DEFAULT '[]'::jsonb,local_implementation_required BOOLEAN NOT NULL DEFAULT TRUE,evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
 review_status TEXT NOT NULL DEFAULT 'Draft',created_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(group_id,control_reference)
);
CREATE TABLE IF NOT EXISTS group_governance_events (
 id TEXT PRIMARY KEY,governing_workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,
 action TEXT NOT NULL,actor_id UUID NOT NULL REFERENCES users(id),previous_status TEXT,new_status TEXT,notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_members_allowlist ON organisation_group_members(governing_workspace_id,status,member_workspace_id);
CREATE INDEX IF NOT EXISTS idx_delegations_user_scope ON workspace_delegations(delegated_user_id,granting_workspace_id,status,expiry_date);
CREATE INDEX IF NOT EXISTS idx_engagements_provider ON managed_client_engagements(provider_workspace_id,status,review_date);
