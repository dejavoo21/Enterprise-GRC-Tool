CREATE TABLE IF NOT EXISTS governance_document_acknowledgements (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
  document_version TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledgement_statement TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, document_id, document_version, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_acknowledgements_document
  ON governance_document_acknowledgements (workspace_id, document_id, acknowledged_at DESC);
