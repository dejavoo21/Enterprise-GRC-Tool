ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual_reference',
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS attachment_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE evidence
SET attachment_status = 'external_reference'
WHERE location_url IS NOT NULL AND attachment_status = 'none';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_source_type_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_source_type_check
      CHECK (source_type IN ('manual_reference', 'automated_collection', 'external_system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachment_status_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_attachment_status_check
      CHECK (attachment_status IN ('none', 'external_reference', 'stored'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  actor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_events_workspace_evidence
  ON evidence_lifecycle_events(workspace_id, evidence_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_usage_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  linked_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  UNIQUE (workspace_id, evidence_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_evidence_usage_workspace_evidence
  ON evidence_usage_links(workspace_id, evidence_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS control_effectiveness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  assessment_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  rating TEXT NOT NULL DEFAULT 'not_tested',
  design_rating TEXT NOT NULL DEFAULT 'not_tested',
  operating_rating TEXT NOT NULL DEFAULT 'not_tested',
  test_method TEXT NOT NULL,
  summary TEXT,
  period_start DATE,
  period_end DATE,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  submitted_by UUID,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, assessment_ref)
);
CREATE INDEX IF NOT EXISTS idx_control_effectiveness_workspace_control
  ON control_effectiveness_assessments(workspace_id, control_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_effectiveness_status_check') THEN
    ALTER TABLE control_effectiveness_assessments ADD CONSTRAINT control_effectiveness_status_check
      CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'control_effectiveness_rating_check') THEN
    ALTER TABLE control_effectiveness_assessments ADD CONSTRAINT control_effectiveness_rating_check
      CHECK (
        rating IN ('not_tested', 'effective', 'partially_effective', 'ineffective') AND
        design_rating IN ('not_tested', 'effective', 'partially_effective', 'ineffective') AND
        operating_rating IN ('not_tested', 'effective', 'partially_effective', 'ineffective')
      );
  END IF;
END $$;
