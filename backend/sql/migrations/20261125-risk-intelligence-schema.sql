-- Additive schema ownership migration. Intelligence defaults and business records are not created or changed.
ALTER TABLE risks
      ADD COLUMN IF NOT EXISTS cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS business_unit TEXT,
      ADD COLUMN IF NOT EXISTS framework_codes TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS target_likelihood INTEGER,
      ADD COLUMN IF NOT EXISTS target_impact INTEGER,
      ADD COLUMN IF NOT EXISTS treatment_status TEXT,
      ADD COLUMN IF NOT EXISTS treatment_due_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS treatment_strategy TEXT,
      ADD COLUMN IF NOT EXISTS treatment_owner TEXT,
      ADD COLUMN IF NOT EXISTS treatment_progress INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS treatment_action_summary TEXT,
      ADD COLUMN IF NOT EXISTS acceptance_rationale TEXT,
      ADD COLUMN IF NOT EXISTS accepted_by TEXT,
      ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'not_reviewed',
      ADD COLUMN IF NOT EXISTS review_notes TEXT,
      ADD COLUMN IF NOT EXISTS review_owner TEXT,
      ADD COLUMN IF NOT EXISTS reassessment_required BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_dynamic_score NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_forecast_score_30 NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_forecast_score_90 NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_forecast_score_180 NUMERIC(8,2),
      ADD COLUMN IF NOT EXISTS last_score_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS readiness_areas (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework TEXT NOT NULL,
      domain TEXT NOT NULL,
      score NUMERIC(8,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework, domain)
    );

CREATE TABLE IF NOT EXISTS readiness_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      area_id TEXT NOT NULL REFERENCES readiness_areas(id) ON DELETE CASCADE,
      control_id TEXT,
      risk_id TEXT,
      question TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date DATE,
      evidence_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_tolerance_profiles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      category TEXT NOT NULL,
      appetite NUMERIC(8,2) NOT NULL,
      threshold NUMERIC(8,2) NOT NULL,
      tolerance NUMERIC(8,2) NOT NULL,
      capacity NUMERIC(8,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, category)
    );

CREATE TABLE IF NOT EXISTS risk_capacity_profiles (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      capacity_type TEXT NOT NULL,
      current_exposure NUMERIC(8,2) NOT NULL DEFAULT 0,
      capacity_limit NUMERIC(8,2) NOT NULL,
      utilization_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, capacity_type)
    );

CREATE TABLE IF NOT EXISTS risk_kri_definitions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      owner TEXT NOT NULL,
      measurement_unit TEXT NOT NULL,
      frequency TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      green_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
      amber_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
      red_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'green',
      source_module TEXT NOT NULL,
      auto_calculated BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_loss_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TIMESTAMPTZ NOT NULL,
      root_cause TEXT NOT NULL,
      impact TEXT NOT NULL,
      actual_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
      estimated_loss NUMERIC(12,2) NOT NULL DEFAULT 0,
      recovery_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      business_impact TEXT NOT NULL,
      lessons_learned TEXT,
      linked_risk_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_near_misses (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      near_miss_type TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      potential_impact TEXT NOT NULL,
      mitigation TEXT NOT NULL,
      linked_risk_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_quantification_weights (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL UNIQUE,
      likelihood_weight NUMERIC(8,4) NOT NULL,
      impact_weight NUMERIC(8,4) NOT NULL,
      control_effectiveness_weight NUMERIC(8,4) NOT NULL,
      evidence_confidence_weight NUMERIC(8,4) NOT NULL,
      kri_weight NUMERIC(8,4) NOT NULL,
      audit_findings_weight NUMERIC(8,4) NOT NULL,
      vendor_exposure_weight NUMERIC(8,4) NOT NULL,
      asset_criticality_weight NUMERIC(8,4) NOT NULL,
      loss_events_weight NUMERIC(8,4) NOT NULL,
      near_miss_events_weight NUMERIC(8,4) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_forecasts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      scope_label TEXT NOT NULL,
      risk_id TEXT,
      current_score NUMERIC(8,2) NOT NULL,
      predicted_30_day_score NUMERIC(8,2) NOT NULL,
      predicted_90_day_score NUMERIC(8,2) NOT NULL,
      predicted_180_day_score NUMERIC(8,2) NOT NULL,
      forecast_status TEXT NOT NULL,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, scope_type, scope_key)
    );

CREATE TABLE IF NOT EXISTS emerging_risks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      likelihood INTEGER NOT NULL,
      impact INTEGER NOT NULL,
      monitoring_status TEXT NOT NULL,
      trigger_events TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_treatment_effectiveness (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      risk_id TEXT NOT NULL,
      treatment_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      expected_risk_reduction NUMERIC(8,2) NOT NULL DEFAULT 0,
      actual_risk_reduction NUMERIC(8,2) NOT NULL DEFAULT 0,
      treatment_effectiveness_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      due_date TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS risk_score_snapshots (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      risk_id TEXT,
      category TEXT,
      business_unit TEXT,
      framework_code TEXT,
      score_type TEXT NOT NULL,
      score NUMERIC(8,2) NOT NULL,
      appetite_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_risk_tolerance_workspace ON risk_tolerance_profiles (workspace_id, category);

CREATE INDEX IF NOT EXISTS idx_readiness_areas_workspace ON readiness_areas (workspace_id, framework, status);

CREATE INDEX IF NOT EXISTS idx_readiness_items_workspace ON readiness_items (workspace_id, area_id, status);

CREATE INDEX IF NOT EXISTS idx_risk_capacity_workspace ON risk_capacity_profiles (workspace_id, capacity_type);

CREATE INDEX IF NOT EXISTS idx_risk_kri_workspace ON risk_kri_definitions (workspace_id, category);

CREATE INDEX IF NOT EXISTS idx_loss_events_workspace ON risk_loss_events (workspace_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_near_miss_workspace ON risk_near_misses (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_forecasts_workspace ON risk_forecasts (workspace_id, scope_type, scope_key);

CREATE INDEX IF NOT EXISTS idx_emerging_risks_workspace ON emerging_risks (workspace_id, category);

CREATE INDEX IF NOT EXISTS idx_risk_treatments_workspace ON risk_treatment_effectiveness (workspace_id, risk_id);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_workspace ON risk_score_snapshots (workspace_id, created_at DESC);