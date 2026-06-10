CREATE TABLE IF NOT EXISTS regulatory_requirements (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  regulation_name TEXT NOT NULL,
  clause TEXT,
  article TEXT,
  section TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  regulator TEXT NOT NULL,
  category TEXT NOT NULL,
  effective_date TIMESTAMPTZ,
  review_date TIMESTAMPTZ,
  status TEXT NOT NULL,
  owner TEXT NOT NULL,
  business_unit TEXT NOT NULL,
  compliance_rating INTEGER NOT NULL DEFAULT 50,
  risk_rating INTEGER NOT NULL DEFAULT 50,
  linked_controls TEXT[] NOT NULL DEFAULT '{}',
  linked_policies TEXT[] NOT NULL DEFAULT '{}',
  linked_risks TEXT[] NOT NULL DEFAULT '{}',
  linked_evidence TEXT[] NOT NULL DEFAULT '{}',
  framework_codes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regulatory_obligations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  obligation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL,
  review_frequency TEXT NOT NULL,
  compliance_evidence TEXT[] NOT NULL DEFAULT '{}',
  linked_controls TEXT[] NOT NULL DEFAULT '{}',
  linked_policies TEXT[] NOT NULL DEFAULT '{}',
  linked_risks TEXT[] NOT NULL DEFAULT '{}',
  source_requirement_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regulatory_change_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  requirement_id TEXT,
  regulation_name TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  impact_assessment TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  approval_status TEXT NOT NULL,
  severity TEXT NOT NULL,
  change_date TIMESTAMPTZ NOT NULL,
  affected_controls TEXT[] NOT NULL DEFAULT '{}',
  affected_policies TEXT[] NOT NULL DEFAULT '{}',
  affected_risks TEXT[] NOT NULL DEFAULT '{}',
  affected_vendors TEXT[] NOT NULL DEFAULT '{}',
  affected_assets TEXT[] NOT NULL DEFAULT '{}',
  affected_ai_systems TEXT[] NOT NULL DEFAULT '{}',
  required_actions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regulatory_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  change_log_id TEXT,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL,
  escalation TEXT,
  workflow_stage TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regulatory_jurisdictions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  state TEXT,
  industry TEXT,
  regulator TEXT NOT NULL,
  applicability TEXT NOT NULL,
  compliance_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regulatory_mappings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  regulation_name TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  control_id TEXT,
  evidence_id TEXT,
  risk_id TEXT,
  framework_code TEXT
);

CREATE TABLE IF NOT EXISTS regulatory_impact_assessments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  change_log_id TEXT NOT NULL,
  impact_score INTEGER NOT NULL,
  severity TEXT NOT NULL,
  priority TEXT NOT NULL,
  affected_controls TEXT[] NOT NULL DEFAULT '{}',
  affected_policies TEXT[] NOT NULL DEFAULT '{}',
  affected_risks TEXT[] NOT NULL DEFAULT '{}',
  affected_vendors TEXT[] NOT NULL DEFAULT '{}',
  affected_assets TEXT[] NOT NULL DEFAULT '{}',
  affected_processes TEXT[] NOT NULL DEFAULT '{}',
  affected_ai_systems TEXT[] NOT NULL DEFAULT '{}',
  required_actions TEXT[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
