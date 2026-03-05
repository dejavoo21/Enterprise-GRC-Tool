-- ============================================
-- WORKSPACES TABLE + FOREIGN KEY CONSTRAINTS
-- ============================================

-- Create workspaces table if not exists
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- SEED WORKSPACES FIRST
-- ============================================

INSERT INTO workspaces (id, name, description)
VALUES
  ('demo-workspace', 'Demo Workspace', 'Default demo tenant for testing'),
  ('olive-internal', 'Olive EHS Internal', 'Internal GRC workspace for Olive EHS'),
  ('client-a', 'Client A - ISP', 'Example ISP client workspace'),
  ('client-b', 'Client B - Fintech', 'Example fintech client workspace')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MIGRATE EXISTING DATA TO demo-workspace
-- ============================================

-- Update any records with invalid workspace_id to demo-workspace
UPDATE risks SET workspace_id = 'demo-workspace' WHERE workspace_id NOT IN ('demo-workspace', 'olive-internal', 'client-a', 'client-b') OR workspace_id IS NULL;
UPDATE controls SET workspace_id = 'demo-workspace' WHERE workspace_id NOT IN ('demo-workspace', 'olive-internal', 'client-a', 'client-b') OR workspace_id IS NULL;
UPDATE evidence SET workspace_id = 'demo-workspace' WHERE workspace_id NOT IN ('demo-workspace', 'olive-internal', 'client-a', 'client-b') OR workspace_id IS NULL;
UPDATE assets SET workspace_id = 'demo-workspace' WHERE workspace_id NOT IN ('demo-workspace', 'olive-internal', 'client-a', 'client-b') OR workspace_id IS NULL;
UPDATE vendors SET workspace_id = 'demo-workspace' WHERE workspace_id NOT IN ('demo-workspace', 'olive-internal', 'client-a', 'client-b') OR workspace_id IS NULL;

-- ============================================
-- ALTER EXISTING TABLES TO ADD WORKSPACE DEFAULTS
-- ============================================

-- Ensure workspace_id columns exist with defaults
ALTER TABLE risks
  ALTER COLUMN workspace_id SET DEFAULT 'demo-workspace';

ALTER TABLE controls
  ALTER COLUMN workspace_id SET DEFAULT 'demo-workspace';

ALTER TABLE evidence
  ALTER COLUMN workspace_id SET DEFAULT 'demo-workspace';

ALTER TABLE assets
  ALTER COLUMN workspace_id SET DEFAULT 'demo-workspace';

ALTER TABLE vendors
  ALTER COLUMN workspace_id SET DEFAULT 'demo-workspace';

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Risks FK (drop if exists first)
ALTER TABLE risks
  DROP CONSTRAINT IF EXISTS risks_workspace_fk;

ALTER TABLE risks
  ADD CONSTRAINT risks_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ON DELETE RESTRICT;

-- Controls FK
ALTER TABLE controls
  DROP CONSTRAINT IF EXISTS controls_workspace_fk;

ALTER TABLE controls
  ADD CONSTRAINT controls_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ON DELETE RESTRICT;

-- Evidence FK
ALTER TABLE evidence
  DROP CONSTRAINT IF EXISTS evidence_workspace_fk;

ALTER TABLE evidence
  ADD CONSTRAINT evidence_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ON DELETE RESTRICT;

-- Assets FK
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_workspace_fk;

ALTER TABLE assets
  ADD CONSTRAINT assets_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ON DELETE RESTRICT;

-- Vendors FK
ALTER TABLE vendors
  DROP CONSTRAINT IF EXISTS vendors_workspace_fk;

ALTER TABLE vendors
  ADD CONSTRAINT vendors_workspace_fk
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ON DELETE RESTRICT;

-- ============================================
-- VERIFY
-- ============================================

-- List all workspaces
-- SELECT * FROM workspaces;

-- Count records per workspace in each table
-- SELECT workspace_id, COUNT(*) FROM risks GROUP BY workspace_id;
-- SELECT workspace_id, COUNT(*) FROM controls GROUP BY workspace_id;
-- SELECT workspace_id, COUNT(*) FROM vendors GROUP BY workspace_id;
