-- Move Business Continuity Management base schema ownership from application startup to deterministic migrations.
-- BIA, service, plan, exercise, crisis, dependency, scenario, mapping, and report records are not created or changed.

BEGIN;

CREATE TABLE IF NOT EXISTS bcm_bia_processes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      process_name TEXT NOT NULL,
      process_owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      criticality TEXT NOT NULL,
      bia_process_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      impact_rating TEXT NOT NULL,
      recovery_priority TEXT NOT NULL,
      products_services JSONB NOT NULL DEFAULT '[]'::jsonb,
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_vendors JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_applications JSONB NOT NULL DEFAULT '[]'::jsonb,
      rto_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      rpo_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      maximum_tolerable_downtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      maximum_data_loss_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_recovery_time_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_data_recovery_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      linked_risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_vendor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_finding_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_critical_services (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      criticality TEXT NOT NULL,
      supporting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_vendors JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_applications JSONB NOT NULL DEFAULT '[]'::jsonb,
      recovery_plan_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      impact_tolerance_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      recovery_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      dora_relevant BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_recovery_plans (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      title TEXT NOT NULL,
      objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      owners JSONB NOT NULL DEFAULT '[]'::jsonb,
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
      recovery_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
      recovery_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_vendors JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_applications JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_rto_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_rto_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      target_rpo_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_rpo_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      maximum_tolerable_downtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      recovery_readiness_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      last_reviewed_at TIMESTAMPTZ,
      last_tested_at TIMESTAMPTZ,
      next_review_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      created_by TEXT,
      approved_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_exercises (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      title TEXT NOT NULL,
      exercise_date TIMESTAMPTZ NOT NULL,
      participants JSONB NOT NULL DEFAULT '[]'::jsonb,
      scenario TEXT NOT NULL,
      result_summary TEXT NOT NULL,
      findings JSONB NOT NULL DEFAULT '[]'::jsonb,
      lessons_learned JSONB NOT NULL DEFAULT '[]'::jsonb,
      corrective_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      performance_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      linked_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_crisis_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      event_title TEXT NOT NULL,
      severity TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'monitoring',
      communications JSONB NOT NULL DEFAULT '[]'::jsonb,
      stakeholders JSONB NOT NULL DEFAULT '[]'::jsonb,
      actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      escalations JSONB NOT NULL DEFAULT '[]'::jsonb,
      lessons_learned JSONB NOT NULL DEFAULT '[]'::jsonb,
      opened_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_dependencies (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      dependency_kind TEXT NOT NULL,
      criticality TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_resilience_scenarios (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      critical_service_id TEXT,
      disruption_scenario TEXT NOT NULL,
      impact_tolerance_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      operational_capacity_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      recovery_capability_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      resilience_rating NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      dora_scenario BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS bcm_compliance_mappings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework_code TEXT NOT NULL,
      framework_name TEXT NOT NULL,
      mapped_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      mapped_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      mapped_recovery_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      mapped_finding_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework_code)
    )
;

CREATE TABLE IF NOT EXISTS bcm_reports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      generated_by TEXT NOT NULL,
      summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE INDEX IF NOT EXISTS idx_bcm_bia_workspace ON bcm_bia_processes (workspace_id, criticality, status)
;

CREATE INDEX IF NOT EXISTS idx_bcm_services_workspace ON bcm_critical_services (workspace_id, criticality, status)
;

CREATE INDEX IF NOT EXISTS idx_bcm_plans_workspace ON bcm_recovery_plans (workspace_id, status, next_review_at)
;

CREATE INDEX IF NOT EXISTS idx_bcm_exercises_workspace ON bcm_exercises (workspace_id, exercise_date DESC)
;

CREATE INDEX IF NOT EXISTS idx_bcm_crisis_workspace ON bcm_crisis_events (workspace_id, severity, status)
;

CREATE INDEX IF NOT EXISTS idx_bcm_dependencies_workspace ON bcm_dependencies (workspace_id, source_type, target_type)
;

CREATE INDEX IF NOT EXISTS idx_bcm_scenarios_workspace ON bcm_resilience_scenarios (workspace_id, status)
;

COMMIT;
