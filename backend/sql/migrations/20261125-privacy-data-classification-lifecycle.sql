ALTER TABLE privacy_data_inventory
  ADD COLUMN IF NOT EXISTS classification_scope TEXT,
  ADD COLUMN IF NOT EXISTS classification_rationale TEXT,
  ADD COLUMN IF NOT EXISTS linked_policy_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS classification_updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS privacy_data_classification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  inventory_id TEXT NOT NULL REFERENCES privacy_data_inventory(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'revised')),
  actor_id UUID NOT NULL REFERENCES users(id),
  previous_classification TEXT,
  new_classification TEXT NOT NULL,
  rationale TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_data_classification_events
  ON privacy_data_classification_events(workspace_id, inventory_id, created_at DESC);
