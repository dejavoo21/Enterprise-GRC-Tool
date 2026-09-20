-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Risks Table
-- ============================================
CREATE TABLE IF NOT EXISTS risks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-001',
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('information_security', 'privacy', 'vendor', 'operational', 'compliance', 'strategic')),
    status TEXT NOT NULL CHECK (status IN ('identified', 'assessed', 'treated', 'accepted', 'closed')),
    inherent_likelihood INTEGER NOT NULL CHECK (inherent_likelihood >= 1 AND inherent_likelihood <= 5),
    inherent_impact INTEGER NOT NULL CHECK (inherent_impact >= 1 AND inherent_impact <= 5),
    residual_likelihood INTEGER NOT NULL CHECK (residual_likelihood >= 1 AND residual_likelihood <= 5),
    residual_impact INTEGER NOT NULL CHECK (residual_impact >= 1 AND residual_impact <= 5),
    cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    due_date TIMESTAMPTZ,
    treatment_plan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risks_workspace_id ON risks(workspace_id);
CREATE INDEX idx_risks_status ON risks(status);
CREATE INDEX idx_risks_category ON risks(category);
CREATE INDEX idx_risks_owner ON risks(owner);

-- ============================================
-- Controls Table
-- ============================================
CREATE TABLE IF NOT EXISTS controls (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'ws-001',
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_implemented', 'in_progress', 'implemented', 'not_applicable')),
    domain TEXT,
    primary_framework TEXT CHECK (primary_framework IN ('ISO27001', 'ISO27701', 'SOC1', 'SOC2', 'NIST_800_53', 'NIST_CSF', 'CIS', 'PCI_DSS', 'HIPAA', 'HITRUST', 'ISO42001', 'EU_AI_ACT', 'GDPR', 'NIS2', 'DORA', 'COBIT', 'CUSTOM')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_controls_workspace_id ON controls(workspace_id);
CREATE INDEX idx_controls_status ON controls(status);
CREATE INDEX idx_controls_primary_framework ON controls(primary_framework);
CREATE INDEX idx_controls_domain ON controls(domain);

-- ============================================
-- Control Mappings Table
-- ============================================
CREATE TABLE IF NOT EXISTS control_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    framework TEXT NOT NULL CHECK (framework IN ('ISO27001', 'ISO27701', 'SOC1', 'SOC2', 'NIST_800_53', 'NIST_CSF', 'CIS', 'PCI_DSS', 'HIPAA', 'HITRUST', 'ISO42001', 'EU_AI_ACT', 'GDPR', 'NIS2', 'DORA', 'COBIT', 'CUSTOM')),
    reference TEXT NOT NULL,
    type TEXT CHECK (type IN ('TYPE_I', 'TYPE_II')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_control_mappings_control_id ON control_mappings(control_id);
CREATE INDEX idx_control_mappings_framework ON control_mappings(framework);

-- Assessment-specific control applicability. Library controls are never deleted by scoping.
CREATE TABLE IF NOT EXISTS framework_assessment_scopes (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, framework_code TEXT NOT NULL, framework_name TEXT NOT NULL,
    framework_version TEXT, name TEXT NOT NULL, description TEXT, organisation_unit TEXT,
    period_start DATE, period_end DATE, approval_status TEXT NOT NULL DEFAULT 'draft'
      CHECK (approval_status IN ('draft','pending_review','approved','rejected','expired')),
    approved_by TEXT, approved_at TIMESTAMPTZ, review_date DATE, created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS framework_scope_controls (
    scope_id TEXT NOT NULL REFERENCES framework_assessment_scopes(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE RESTRICT, control_title TEXT NOT NULL,
    framework_reference TEXT, inclusion_status TEXT NOT NULL DEFAULT 'included'
      CHECK (inclusion_status IN ('included','excluded','not_applicable','inherited','deferred','out_of_scope')),
    exclusion_reason TEXT, justification TEXT, evidence_reference TEXT, review_date DATE,
    created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scope_id, control_id)
);
CREATE INDEX IF NOT EXISTS idx_framework_scopes_workspace ON framework_assessment_scopes(workspace_id, framework_code);
CREATE INDEX IF NOT EXISTS idx_framework_scope_controls_status ON framework_scope_controls(scope_id, inclusion_status);

-- ============================================
-- Evidence Table
-- ============================================
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL DEFAULT 'ws-001',
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('policy', 'configuration', 'log', 'screenshot', 'report', 'other')),
    location_url TEXT,
    control_id TEXT REFERENCES controls(id) ON DELETE SET NULL,
    risk_id TEXT REFERENCES risks(id) ON DELETE SET NULL,
    collected_by TEXT NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_workspace_id ON evidence(workspace_id);
CREATE INDEX idx_evidence_control_id ON evidence(control_id);
CREATE INDEX idx_evidence_risk_id ON evidence(risk_id);
CREATE INDEX idx_evidence_type ON evidence(type);

-- Create relationship table for risks and controls (many-to-many)
CREATE TABLE IF NOT EXISTS risk_control_links (
    risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, control_id)
);

CREATE INDEX idx_risk_control_links_risk_id ON risk_control_links(risk_id);
CREATE INDEX idx_risk_control_links_control_id ON risk_control_links(control_id);
