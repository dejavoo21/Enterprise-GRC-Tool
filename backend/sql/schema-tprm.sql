-- =====================================================
-- TPRM (Third-Party Risk Management) Schema
-- =====================================================

-- Vendor Risk Assessments
CREATE TABLE IF NOT EXISTS vendor_risk_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL DEFAULT 'initial', -- initial, periodic, triggered
  status          TEXT NOT NULL DEFAULT 'draft',   -- draft, in_progress, pending_review, completed, expired
  risk_tier       TEXT,                            -- critical, high, medium, low
  inherent_risk_score   INTEGER,                   -- 0-100
  residual_risk_score   INTEGER,                   -- 0-100
  due_date        DATE,
  completed_date  DATE,
  next_review_date DATE,
  assessor_id     UUID REFERENCES users(id),
  reviewer_id     UUID REFERENCES users(id),
  findings        JSONB DEFAULT '[]'::jsonb,       -- Array of finding objects
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vra_workspace ON vendor_risk_assessments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vra_vendor ON vendor_risk_assessments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vra_status ON vendor_risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_vra_risk_tier ON vendor_risk_assessments(risk_tier);
CREATE INDEX IF NOT EXISTS idx_vra_due_date ON vendor_risk_assessments(due_date);

-- Vendor Questionnaires (templates and instances)
CREATE TABLE IF NOT EXISTS vendor_questionnaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id       UUID REFERENCES vendors(id) ON DELETE CASCADE, -- NULL for templates
  assessment_id   UUID REFERENCES vendor_risk_assessments(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  questionnaire_type TEXT NOT NULL DEFAULT 'security', -- security, privacy, compliance, financial, operational
  is_template     BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'draft',       -- draft, sent, in_progress, submitted, reviewed
  sent_date       DATE,
  due_date        DATE,
  submitted_date  DATE,
  reviewed_date   DATE,
  completion_percentage INTEGER DEFAULT 0,
  risk_score      INTEGER,                             -- Calculated from responses
  created_by      UUID REFERENCES users(id),
  reviewed_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vq_workspace ON vendor_questionnaires(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vq_vendor ON vendor_questionnaires(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vq_template ON vendor_questionnaires(is_template);
CREATE INDEX IF NOT EXISTS idx_vq_status ON vendor_questionnaires(status);

-- Vendor Questionnaire Questions
CREATE TABLE IF NOT EXISTS vendor_questionnaire_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id  UUID NOT NULL REFERENCES vendor_questionnaires(id) ON DELETE CASCADE,
  category          TEXT NOT NULL,                     -- e.g., "Data Protection", "Access Control"
  question_text     TEXT NOT NULL,
  question_type     TEXT NOT NULL DEFAULT 'text',      -- text, yes_no, multiple_choice, file_upload, rating
  options           JSONB,                             -- For multiple choice questions
  is_required       BOOLEAN NOT NULL DEFAULT true,
  weight            INTEGER DEFAULT 1,                 -- For risk scoring
  risk_if_negative  TEXT DEFAULT 'medium',             -- high, medium, low - risk level if answer is negative
  display_order     INTEGER NOT NULL DEFAULT 0,
  guidance          TEXT,                              -- Help text for respondent
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vqq_questionnaire ON vendor_questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_vqq_category ON vendor_questionnaire_questions(category);

-- Vendor Questionnaire Responses
CREATE TABLE IF NOT EXISTS vendor_questionnaire_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES vendor_questionnaire_questions(id) ON DELETE CASCADE,
  response_text   TEXT,
  response_value  JSONB,                               -- For structured responses
  file_url        TEXT,                                -- For file upload questions
  is_compliant    BOOLEAN,                             -- Reviewer assessment
  risk_flag       TEXT,                                -- high, medium, low, none
  reviewer_notes  TEXT,
  responded_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vqr_question ON vendor_questionnaire_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_vqr_risk_flag ON vendor_questionnaire_responses(risk_flag);

-- Vendor Subprocessors (fourth parties)
CREATE TABLE IF NOT EXISTS vendor_subprocessors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  service_type    TEXT,                                -- cloud_hosting, payment_processing, analytics, etc.
  data_access     TEXT NOT NULL DEFAULT 'none',        -- none, limited, full
  data_types      TEXT[],                              -- PII, financial, health, etc.
  location        TEXT,                                -- Country/region
  risk_tier       TEXT DEFAULT 'medium',               -- critical, high, medium, low
  status          TEXT NOT NULL DEFAULT 'active',      -- active, inactive, pending_review
  contract_end_date DATE,
  last_reviewed   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_workspace ON vendor_subprocessors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vs_vendor ON vendor_subprocessors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vs_risk_tier ON vendor_subprocessors(risk_tier);
CREATE INDEX IF NOT EXISTS idx_vs_status ON vendor_subprocessors(status);

-- Vendor Contracts
CREATE TABLE IF NOT EXISTS vendor_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  contract_name   TEXT NOT NULL,
  contract_type   TEXT NOT NULL DEFAULT 'msa',         -- msa, dpa, nda, sla, sow, amendment
  status          TEXT NOT NULL DEFAULT 'draft',       -- draft, pending_review, active, expired, terminated
  effective_date  DATE,
  expiration_date DATE,
  renewal_type    TEXT DEFAULT 'manual',               -- auto, manual, none
  renewal_notice_days INTEGER DEFAULT 30,
  contract_value  DECIMAL(15,2),
  currency        TEXT DEFAULT 'USD',
  key_terms       JSONB DEFAULT '{}'::jsonb,           -- SLA terms, liability caps, etc.
  document_url    TEXT,
  owner_id        UUID REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_workspace ON vendor_contracts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vc_vendor ON vendor_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vc_status ON vendor_contracts(status);
CREATE INDEX IF NOT EXISTS idx_vc_expiration ON vendor_contracts(expiration_date);

-- Vendor Incidents
CREATE TABLE IF NOT EXISTS vendor_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  incident_type   TEXT NOT NULL,                       -- security_breach, service_outage, compliance_violation, data_loss
  severity        TEXT NOT NULL DEFAULT 'medium',      -- critical, high, medium, low
  status          TEXT NOT NULL DEFAULT 'open',        -- open, investigating, mitigating, resolved, closed
  title           TEXT NOT NULL,
  description     TEXT,
  impact          TEXT,                                -- Description of business impact
  data_affected   BOOLEAN DEFAULT false,
  data_types_affected TEXT[],
  records_affected INTEGER,
  occurred_at     TIMESTAMPTZ,
  detected_at     TIMESTAMPTZ,
  reported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  root_cause      TEXT,
  remediation     TEXT,
  lessons_learned TEXT,
  reported_by     UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vi_workspace ON vendor_incidents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vi_vendor ON vendor_incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vi_severity ON vendor_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_vi_status ON vendor_incidents(status);
CREATE INDEX IF NOT EXISTS idx_vi_occurred ON vendor_incidents(occurred_at);

-- Update timestamp trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers for updated_at
DROP TRIGGER IF EXISTS update_vendor_risk_assessments_updated_at ON vendor_risk_assessments;
CREATE TRIGGER update_vendor_risk_assessments_updated_at
    BEFORE UPDATE ON vendor_risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_questionnaires_updated_at ON vendor_questionnaires;
CREATE TRIGGER update_vendor_questionnaires_updated_at
    BEFORE UPDATE ON vendor_questionnaires
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_questionnaire_responses_updated_at ON vendor_questionnaire_responses;
CREATE TRIGGER update_vendor_questionnaire_responses_updated_at
    BEFORE UPDATE ON vendor_questionnaire_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_subprocessors_updated_at ON vendor_subprocessors;
CREATE TRIGGER update_vendor_subprocessors_updated_at
    BEFORE UPDATE ON vendor_subprocessors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_contracts_updated_at ON vendor_contracts;
CREATE TRIGGER update_vendor_contracts_updated_at
    BEFORE UPDATE ON vendor_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_incidents_updated_at ON vendor_incidents;
CREATE TRIGGER update_vendor_incidents_updated_at
    BEFORE UPDATE ON vendor_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
