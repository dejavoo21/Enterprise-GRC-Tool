-- Move AI Governance base schema ownership from application startup to deterministic migrations.
-- AI systems, models, assessments, controls, incidents, vendors, training, reports, and compliance records are not created or changed.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_inventory (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT NOT NULL,
      model_type TEXT NOT NULL,
      vendor TEXT NOT NULL,
      deployment_model TEXT NOT NULL,
      deployment_date TIMESTAMPTZ NOT NULL,
      lifecycle_status TEXT NOT NULL,
      criticality TEXT NOT NULL,
      classification TEXT NOT NULL,
      risk_rating TEXT NOT NULL,
      compliance_status TEXT NOT NULL,
      use_case TEXT NOT NULL,
      data_type TEXT NOT NULL,
      industry TEXT NOT NULL,
      jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
      cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb,
      impact TEXT NOT NULL,
      inventory_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      assurance_status TEXT NOT NULL DEFAULT 'monitoring',
      linked_risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_vendor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_incident_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

ALTER TABLE ai_inventory ADD COLUMN IF NOT EXISTS cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb
;

ALTER TABLE ai_inventory ADD COLUMN IF NOT EXISTS linked_risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb
;

ALTER TABLE ai_inventory ADD COLUMN IF NOT EXISTS linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb
;

ALTER TABLE ai_inventory ADD COLUMN IF NOT EXISTS linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb
;

ALTER TABLE ai_inventory ADD COLUMN IF NOT EXISTS linked_vendor_ids JSONB NOT NULL DEFAULT '[]'::jsonb
;

ALTER TABLE ai_inventory ADD COLUMN IF NOT EXISTS linked_incident_ids JSONB NOT NULL DEFAULT '[]'::jsonb
;

CREATE TABLE IF NOT EXISTS ai_models (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_id TEXT,
      model_name TEXT NOT NULL,
      version TEXT NOT NULL,
      owner TEXT NOT NULL,
      purpose TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      retirement_date TIMESTAMPTZ,
      lifecycle_status TEXT NOT NULL,
      model_family TEXT NOT NULL,
      accuracy NUMERIC(10,2) NOT NULL DEFAULT 0,
      precision_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      recall_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      drift_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      bias_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      robustness_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      explainability_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS ai_risk_assessments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_id TEXT,
      assessment_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      bias_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      fairness_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      transparency_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      privacy_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      security_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      hallucination_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      explainability_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      ethical_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      safety_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      regulatory_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      operational_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      vendor_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      overall_risk_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS ai_controls (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      control_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      mapped_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
      evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      automation_level TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS ai_incidents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_id TEXT,
      title TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      detected_at TIMESTAMPTZ NOT NULL,
      reported_externally BOOLEAN NOT NULL DEFAULT FALSE,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS ai_vendors (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      vendor_category TEXT NOT NULL,
      services JSONB NOT NULL DEFAULT '[]'::jsonb,
      risk_rating TEXT NOT NULL,
      compliance_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      contract_status TEXT NOT NULL,
      security_review_status TEXT NOT NULL,
      evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS ai_training_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      program_name TEXT NOT NULL,
      focus_area TEXT NOT NULL,
      completion_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      overdue_learners INTEGER NOT NULL DEFAULT 0,
      certification_status TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
;

CREATE TABLE IF NOT EXISTS ai_reports (
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

CREATE TABLE IF NOT EXISTS ai_compliance_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework_code TEXT NOT NULL,
      framework_name TEXT NOT NULL,
      score NUMERIC(10,2) NOT NULL DEFAULT 0,
      target_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      gap_count INTEGER NOT NULL DEFAULT 0,
      control_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      documentation_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      training_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework_code)
    )
;

CREATE INDEX IF NOT EXISTS idx_ai_inventory_workspace ON ai_inventory (workspace_id, classification, risk_rating, compliance_status)
;

CREATE INDEX IF NOT EXISTS idx_ai_models_workspace ON ai_models (workspace_id, validation_status, approval_status)
;

CREATE INDEX IF NOT EXISTS idx_ai_assessments_workspace ON ai_risk_assessments (workspace_id, status, overall_risk_score)
;

CREATE INDEX IF NOT EXISTS idx_ai_controls_workspace ON ai_controls (workspace_id, category, status)
;

CREATE INDEX IF NOT EXISTS idx_ai_incidents_workspace ON ai_incidents (workspace_id, severity, status, detected_at DESC)
;

CREATE INDEX IF NOT EXISTS idx_ai_vendors_workspace ON ai_vendors (workspace_id, risk_rating, contract_status)
;

COMMIT;
