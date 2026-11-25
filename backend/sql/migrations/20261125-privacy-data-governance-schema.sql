-- Move Privacy and Data Governance base schema ownership from application startup to deterministic migrations.
-- Privacy, governance, lineage, quality, audit, and report records are not created or changed.

BEGIN;

CREATE TABLE IF NOT EXISTS privacy_frameworks (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS privacy_data_inventory (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data_asset_id TEXT NOT NULL, data_asset_name TEXT NOT NULL, business_owner TEXT NOT NULL,
    custodian TEXT NOT NULL, location TEXT NOT NULL, system_name TEXT NOT NULL, application TEXT NOT NULL, department TEXT NOT NULL,
    country TEXT NOT NULL, jurisdiction TEXT NOT NULL, data_category TEXT NOT NULL, sensitivity_level TEXT NOT NULL, classification TEXT NOT NULL,
    retention_requirement TEXT NOT NULL, legal_basis TEXT NOT NULL, status TEXT NOT NULL, classification_risk_score NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_ropa (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, processing_activity TEXT NOT NULL, purpose TEXT NOT NULL, legal_basis TEXT NOT NULL,
    data_categories JSONB NOT NULL DEFAULT '[]'::jsonb, data_subjects JSONB NOT NULL DEFAULT '[]'::jsonb, recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    cross_border_transfers JSONB NOT NULL DEFAULT '[]'::jsonb, retention_period TEXT NOT NULL, security_measures JSONB NOT NULL DEFAULT '[]'::jsonb,
    controllers JSONB NOT NULL DEFAULT '[]'::jsonb, processors JSONB NOT NULL DEFAULT '[]'::jsonb, review_date TIMESTAMPTZ NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_dpias (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, assessment_name TEXT NOT NULL, owner TEXT NOT NULL, purpose TEXT NOT NULL,
    risk_rating TEXT NOT NULL, likelihood NUMERIC(10,2) NOT NULL DEFAULT 0, impact NUMERIC(10,2) NOT NULL DEFAULT 0, controls JSONB NOT NULL DEFAULT '[]'::jsonb,
    residual_risk NUMERIC(10,2) NOT NULL DEFAULT 0, approval_status TEXT NOT NULL, review_date TIMESTAMPTZ NOT NULL, evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    linked_risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    linked_ai_system_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_vendor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_risks (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL,
    status TEXT NOT NULL, owner TEXT NOT NULL, risk_score NUMERIC(10,2) NOT NULL DEFAULT 0, mitigation TEXT NOT NULL, linked_enterprise_risk_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_consents (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, consent_type TEXT NOT NULL, purpose TEXT NOT NULL, data_subject TEXT NOT NULL,
    collection_method TEXT NOT NULL, date_collected TIMESTAMPTZ NOT NULL, expiration_date TIMESTAMPTZ, withdrawal_date TIMESTAMPTZ,
    status TEXT NOT NULL, evidence TEXT NOT NULL, consent_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_dsars (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, request_type TEXT NOT NULL, data_subject TEXT NOT NULL,
    submission_date TIMESTAMPTZ NOT NULL, due_date TIMESTAMPTZ NOT NULL, status TEXT NOT NULL, owner TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    completion_date TIMESTAMPTZ, sla_compliant BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_breaches (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, breach_type TEXT NOT NULL, discovery_date TIMESTAMPTZ NOT NULL, affected_records INTEGER NOT NULL DEFAULT 0,
    affected_individuals INTEGER NOT NULL DEFAULT 0, root_cause TEXT NOT NULL, risk_level TEXT NOT NULL, regulator_notification_status TEXT NOT NULL,
    customer_notification_status TEXT NOT NULL, remediation TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_retention (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_name TEXT NOT NULL, retention_period TEXT NOT NULL, legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    deletion_schedule TEXT NOT NULL, archive_status TEXT NOT NULL, disposal_status TEXT NOT NULL, review_date TIMESTAMPTZ NOT NULL, violation_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_transfers (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, transfer_name TEXT NOT NULL, transfer_type TEXT NOT NULL, transfer_mechanism TEXT NOT NULL,
    jurisdiction TEXT NOT NULL, scc_in_place BOOLEAN NOT NULL DEFAULT FALSE, bcr_in_place BOOLEAN NOT NULL DEFAULT FALSE, transfer_risk_rating TEXT NOT NULL,
    review_date TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_third_parties (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, vendor_name TEXT NOT NULL, role TEXT NOT NULL, privacy_assessment_status TEXT NOT NULL,
    data_transfer_risk TEXT NOT NULL, dpa_status TEXT NOT NULL, compliance_rating NUMERIC(10,2) NOT NULL DEFAULT 0, privacy_incident_count INTEGER NOT NULL DEFAULT 0,
    contract_clauses JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_controls (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, control_name TEXT NOT NULL, category TEXT NOT NULL, mapped_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL, evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_governance_center (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data_domain TEXT NOT NULL, data_owner TEXT NOT NULL, data_steward TEXT NOT NULL, data_custodian TEXT NOT NULL,
    data_quality_score NUMERIC(10,2) NOT NULL DEFAULT 0, lifecycle_stage TEXT NOT NULL, glossary_term TEXT NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_lineage (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, lineage_name TEXT NOT NULL, source TEXT NOT NULL, transformation TEXT NOT NULL,
    processing TEXT NOT NULL, storage TEXT NOT NULL, sharing TEXT NOT NULL, retention TEXT NOT NULL, disposal TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_quality_records (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, dataset_name TEXT NOT NULL, completeness NUMERIC(10,2) NOT NULL DEFAULT 0, accuracy NUMERIC(10,2) NOT NULL DEFAULT 0,
    consistency NUMERIC(10,2) NOT NULL DEFAULT 0, timeliness NUMERIC(10,2) NOT NULL DEFAULT 0, validity NUMERIC(10,2) NOT NULL DEFAULT 0, uniqueness NUMERIC(10,2) NOT NULL DEFAULT 0,
    quality_score NUMERIC(10,2) NOT NULL DEFAULT 0, remediation_action TEXT NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_discovery_records (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, repository_name TEXT NOT NULL, repository_type TEXT NOT NULL,
    pii_locations JSONB NOT NULL DEFAULT '[]'::jsonb, sensitive_data_locations JSONB NOT NULL DEFAULT '[]'::jsonb, data_flow_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    owner TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_compliance_programs (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, framework_code TEXT NOT NULL, framework_name TEXT NOT NULL, score NUMERIC(10,2) NOT NULL DEFAULT 0,
    target_score NUMERIC(10,2) NOT NULL DEFAULT 0, gap_count INTEGER NOT NULL DEFAULT 0, evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    risk_exposure_score NUMERIC(10,2) NOT NULL DEFAULT 0, control_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0, readiness_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (workspace_id, framework_code)
);

CREATE TABLE IF NOT EXISTS privacy_audits (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, audit_name TEXT NOT NULL, audit_type TEXT NOT NULL, status TEXT NOT NULL,
    findings_count INTEGER NOT NULL DEFAULT 0, recommendations_count INTEGER NOT NULL DEFAULT 0, owner TEXT NOT NULL, due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS privacy_reports (
id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, report_type TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'generated',
    generated_by TEXT NOT NULL, summary JSONB NOT NULL DEFAULT '[]'::jsonb, generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
