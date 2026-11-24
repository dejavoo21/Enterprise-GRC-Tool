CREATE TABLE IF NOT EXISTS enterprise_relationships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  provenance TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by_user_id TEXT,
  archived_by_name TEXT,
  archived_at TIMESTAMPTZ,
  CONSTRAINT enterprise_relationship_direction CHECK (
    source_entity_id <> target_entity_id OR source_entity_type <> target_entity_type
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS enterprise_relationships_active_unique_idx
  ON enterprise_relationships (workspace_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, relationship_type)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS enterprise_relationships_source_idx
  ON enterprise_relationships (workspace_id, source_entity_type, source_entity_id, status);
CREATE INDEX IF NOT EXISTS enterprise_relationships_target_idx
  ON enterprise_relationships (workspace_id, target_entity_type, target_entity_id, status);
CREATE INDEX IF NOT EXISTS enterprise_relationships_type_idx
  ON enterprise_relationships (workspace_id, relationship_type, status);

CREATE TABLE IF NOT EXISTS enterprise_relationship_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  relationship_id TEXT NOT NULL REFERENCES enterprise_relationships(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'archived')),
  actor_user_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS enterprise_relationship_events_history_idx
  ON enterprise_relationship_events (workspace_id, relationship_id, created_at DESC);
