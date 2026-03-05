-- ============================================
-- Training & Awareness Practice Schema
-- Phase 12: Billable Training Practice Layer
-- ============================================

-- Enable pgcrypto for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Pricing Models Table (Global - no workspace_id)
-- ============================================
CREATE TABLE IF NOT EXISTS pricing_models (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    billing_basis TEXT NOT NULL CHECK (billing_basis IN ('per_user', 'per_department', 'per_year', 'fixed_fee')),
    currency TEXT NOT NULL DEFAULT 'USD',
    unit_price DECIMAL(12, 2) NOT NULL,
    min_units INTEGER,
    max_units INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_models_code ON pricing_models(code);
CREATE INDEX IF NOT EXISTS idx_pricing_models_billing_basis ON pricing_models(billing_basis);

-- ============================================
-- Training Engagements Table
-- ============================================
CREATE TABLE IF NOT EXISTS training_engagements (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    client_name TEXT,
    engagement_type TEXT NOT NULL CHECK (engagement_type IN ('one_off', 'ongoing_program', 'managed_service', 'retainer')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'proposed', 'signed', 'in_delivery', 'completed', 'archived')) DEFAULT 'draft',
    pricing_model_id TEXT REFERENCES pricing_models(id) ON DELETE SET NULL,
    estimated_users INTEGER,
    start_date DATE,
    end_date DATE,
    primary_contact TEXT,
    proposal_url TEXT,
    sow_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_engagements_workspace_id ON training_engagements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_training_engagements_status ON training_engagements(status);
CREATE INDEX IF NOT EXISTS idx_training_engagements_type ON training_engagements(engagement_type);
CREATE INDEX IF NOT EXISTS idx_training_engagements_pricing_model ON training_engagements(pricing_model_id);

-- ============================================
-- Training Engagement Frameworks (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS training_engagement_frameworks (
    id TEXT PRIMARY KEY,
    engagement_id TEXT NOT NULL REFERENCES training_engagements(id) ON DELETE CASCADE,
    framework_code TEXT NOT NULL REFERENCES frameworks(code) ON DELETE RESTRICT,
    UNIQUE (engagement_id, framework_code)
);

CREATE INDEX IF NOT EXISTS idx_training_engagement_frameworks_engagement_id ON training_engagement_frameworks(engagement_id);
CREATE INDEX IF NOT EXISTS idx_training_engagement_frameworks_framework_code ON training_engagement_frameworks(framework_code);

-- ============================================
-- KPI Definitions Table (Global)
-- ============================================
CREATE TABLE IF NOT EXISTS kpi_definitions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('training', 'phishing', 'behavior', 'audit')),
    target_direction TEXT NOT NULL CHECK (target_direction IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_definitions_code ON kpi_definitions(code);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_category ON kpi_definitions(category);

-- ============================================
-- KPI Snapshots Table
-- ============================================
CREATE TABLE IF NOT EXISTS kpi_snapshots (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    engagement_id TEXT REFERENCES training_engagements(id) ON DELETE CASCADE,
    kpi_id TEXT NOT NULL REFERENCES kpi_definitions(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    value DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_workspace_id ON kpi_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_engagement_id ON kpi_snapshots(engagement_id);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_kpi_id ON kpi_snapshots(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_period ON kpi_snapshots(period_start, period_end);

-- ============================================
-- Awareness Content Table
-- ============================================
CREATE TABLE IF NOT EXISTS awareness_content (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = global content
    type TEXT NOT NULL CHECK (type IN (
        'proposal_template',
        'sow_template',
        'breach_report',
        'regulatory_case',
        'incident_summary',
        'risk_assessment',
        'audit_finding_template',
        'statistic',
        'board_expectation',
        'training_deck',
        'outline'
    )),
    title TEXT NOT NULL,
    summary TEXT,
    source TEXT CHECK (source IS NULL OR source IN ('internal', 'external', 'regulator', 'news')),
    link_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_awareness_content_workspace_id ON awareness_content(workspace_id);
CREATE INDEX IF NOT EXISTS idx_awareness_content_type ON awareness_content(type);
CREATE INDEX IF NOT EXISTS idx_awareness_content_source ON awareness_content(source);

-- ============================================
-- Awareness Content Frameworks (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS awareness_content_frameworks (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL REFERENCES awareness_content(id) ON DELETE CASCADE,
    framework_code TEXT NOT NULL REFERENCES frameworks(code) ON DELETE RESTRICT,
    UNIQUE (content_id, framework_code)
);

CREATE INDEX IF NOT EXISTS idx_awareness_content_frameworks_content_id ON awareness_content_frameworks(content_id);
CREATE INDEX IF NOT EXISTS idx_awareness_content_frameworks_framework_code ON awareness_content_frameworks(framework_code);
