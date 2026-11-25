-- LAFLO ESG schema ownership migration. Additive only; no seed or business records.

CREATE TABLE IF NOT EXISTS esg_frameworks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, code)
    )
;

CREATE TABLE IF NOT EXISTS esg_environmental_metrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      trend TEXT NOT NULL,
      owner TEXT NOT NULL,
      reporting_frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_carbon_records (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      source_name TEXT NOT NULL,
      tonnes_co2e NUMERIC(12,2) NOT NULL DEFAULT 0,
      intensity NUMERIC(12,2) NOT NULL DEFAULT 0,
      reporting_year INTEGER NOT NULL,
      target_tonnes_co2e NUMERIC(12,2) NOT NULL DEFAULT 0,
      reduction_target_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_social_metrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      status TEXT NOT NULL,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_governance_metrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_risks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      risk_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      mitigation TEXT NOT NULL,
      linked_enterprise_risk_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_kpis (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      kpi_name TEXT NOT NULL,
      category TEXT NOT NULL,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      actual_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      variance NUMERIC(12,2) NOT NULL DEFAULT 0,
      trend TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      reporting_frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_targets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      due_date TIMESTAMPTZ NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_suppliers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_esg_rating NUMERIC(12,2) NOT NULL DEFAULT 0,
      supplier_carbon_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      human_rights_compliance TEXT NOT NULL,
      sustainability_practices TEXT NOT NULL,
      environmental_performance TEXT NOT NULL,
      assessment_status TEXT NOT NULL,
      supplier_risk_level TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_incidents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      linked_domain TEXT NOT NULL,
      summary TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_audits (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      audit_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      status TEXT NOT NULL,
      findings_count INTEGER NOT NULL DEFAULT 0,
      open_actions INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_evidence (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      evidence_name TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      linked_framework TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS esg_compliance_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework_code TEXT NOT NULL,
      framework_name TEXT NOT NULL,
      score NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      gap_count INTEGER NOT NULL DEFAULT 0,
      control_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      evidence_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      assessment_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      supplier_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      policy_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework_code)
    )
;

CREATE TABLE IF NOT EXISTS esg_reports (
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

CREATE INDEX IF NOT EXISTS idx_esg_frameworks_workspace ON esg_frameworks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_environmental_metrics_workspace ON esg_environmental_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_carbon_records_workspace ON esg_carbon_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_social_metrics_workspace ON esg_social_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_governance_metrics_workspace ON esg_governance_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_risks_workspace ON esg_risks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_kpis_workspace ON esg_kpis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_targets_workspace ON esg_targets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_suppliers_workspace ON esg_suppliers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_incidents_workspace ON esg_incidents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_audits_workspace ON esg_audits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_evidence_workspace ON esg_evidence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_compliance_programs_workspace ON esg_compliance_programs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_esg_reports_workspace ON esg_reports(workspace_id);
