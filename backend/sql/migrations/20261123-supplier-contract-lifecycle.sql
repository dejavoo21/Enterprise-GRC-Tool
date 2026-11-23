-- Additive Supplier and Contract Management lifecycle foundation.
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS supplier_ref TEXT,
  ADD COLUMN IF NOT EXISTS business_service TEXT,
  ADD COLUMN IF NOT EXISTS criticality TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS information_access TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS business_locations TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS due_diligence_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_status_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_status_check
  CHECK (status IN ('onboarding','pending_approval','active','suspended','offboarded','archived')) NOT VALID;
ALTER TABLE vendors VALIDATE CONSTRAINT vendors_status_check;

UPDATE vendors SET supplier_ref = 'SUP-' || upper(substr(replace(id::text, '-', ''), 1, 8)) WHERE supplier_ref IS NULL;
ALTER TABLE vendors ALTER COLUMN supplier_ref SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_workspace_supplier_ref ON vendors(workspace_id, supplier_ref);
CREATE INDEX IF NOT EXISTS idx_vendors_workspace_lifecycle ON vendors(workspace_id, status, archived_at, next_review_date);

ALTER TABLE vendor_risk_assessments
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS submitted_by UUID,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_decision TEXT,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS evidence_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS remediation_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS configuration JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_workspace_review ON vendor_risk_assessments(workspace_id, status, next_review_date);

ALTER TABLE vendor_contracts
  ADD COLUMN IF NOT EXISTS contract_ref TEXT,
  ADD COLUMN IF NOT EXISTS contract_owner TEXT,
  ADD COLUMN IF NOT EXISTS renewal_date DATE,
  ADD COLUMN IF NOT EXISTS notice_date DATE,
  ADD COLUMN IF NOT EXISTS related_business_service TEXT,
  ADD COLUMN IF NOT EXISTS security_obligations TEXT,
  ADD COLUMN IF NOT EXISTS data_protection_obligations TEXT,
  ADD COLUMN IF NOT EXISTS sla_requirements TEXT,
  ADD COLUMN IF NOT EXISTS audit_rights TEXT,
  ADD COLUMN IF NOT EXISTS termination_provisions TEXT,
  ADD COLUMN IF NOT EXISTS exit_requirements TEXT,
  ADD COLUMN IF NOT EXISTS renewal_decision TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
UPDATE vendor_contracts SET contract_ref = 'CTR-' || upper(substr(replace(id::text, '-', ''), 1, 8)) WHERE contract_ref IS NULL;
ALTER TABLE vendor_contracts ALTER COLUMN contract_ref SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_contracts_workspace_ref ON vendor_contracts(workspace_id, contract_ref);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_workspace_renewal ON vendor_contracts(workspace_id, status, expiration_date, notice_date);

CREATE TABLE IF NOT EXISTS supplier_lifecycle_history (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_history_workspace_supplier ON supplier_lifecycle_history(workspace_id, supplier_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS supplier_contract_lifecycle_history (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_history_workspace_contract ON supplier_contract_lifecycle_history(workspace_id, contract_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS supplier_assessment_review_history (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES vendor_risk_assessments(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  decision TEXT,
  reason TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_assessment_history ON supplier_assessment_review_history(workspace_id, assessment_id, changed_at DESC);
