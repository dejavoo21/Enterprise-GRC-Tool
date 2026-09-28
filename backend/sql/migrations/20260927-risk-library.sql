CREATE TABLE IF NOT EXISTS risk_library_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  library_risk_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  scenario_type TEXT NOT NULL DEFAULT 'event_based' CHECK (scenario_type IN ('event_based','asset_based')),
  risk_source TEXT,
  threat_event TEXT,
  vulnerability TEXT,
  predisposing_condition TEXT,
  suggested_owner TEXT,
  suggested_cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_consequences JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_inherent_likelihood INTEGER,
  suggested_inherent_impact INTEGER,
  likelihood_rationale TEXT,
  impact_rationale TEXT,
  suggested_controls JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  treatment_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  monitoring_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, library_risk_id)
);
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS scenario_type TEXT NOT NULL DEFAULT 'event_based';
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS risk_source TEXT;
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS threat_event TEXT;
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS vulnerability TEXT;
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS predisposing_condition TEXT;
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS likelihood_rationale TEXT;
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS impact_rationale TEXT;
ALTER TABLE risk_library_templates ADD COLUMN IF NOT EXISTS monitoring_indicators JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_risk_library_workspace_status ON risk_library_templates (workspace_id, status, updated_at DESC);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS library_risk_id TEXT;
CREATE INDEX IF NOT EXISTS idx_risks_workspace_library_source ON risks (workspace_id, library_risk_id) WHERE library_risk_id IS NOT NULL;
