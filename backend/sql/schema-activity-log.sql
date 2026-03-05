-- ============================================
-- Activity Log Schema
-- ============================================

CREATE TABLE IF NOT EXISTS activity_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  user_email     TEXT NOT NULL,
  entity_type    TEXT NOT NULL,  -- e.g. 'control','risk','governance_document','training_course','link'
  entity_id      TEXT NOT NULL,  -- generic string to handle both UUIDs and text ids
  action         TEXT NOT NULL,  -- e.g. 'create','update','link','unlink','status_change'
  summary        TEXT NOT NULL,  -- short human-readable summary
  details        JSONB,          -- optional structured diff or context
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_workspace_created_at
  ON activity_log (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON activity_log (workspace_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_user
  ON activity_log (workspace_id, user_id);
