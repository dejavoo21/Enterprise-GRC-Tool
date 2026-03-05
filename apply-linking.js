const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/grc_suite'
});

async function apply() {
  console.log('Applying control-governance-training linking tables...');

  // Create tables only - skip the seed data that has FK constraints
  await pool.query(`
    -- Control ↔ Governance Document links
    CREATE TABLE IF NOT EXISTS control_governance_documents (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      control_id    TEXT NOT NULL,
      document_id   UUID NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'supports',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, control_id, document_id)
    );

    CREATE INDEX IF NOT EXISTS idx_control_gov_docs_workspace ON control_governance_documents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_control_gov_docs_control ON control_governance_documents(control_id);
    CREATE INDEX IF NOT EXISTS idx_control_gov_docs_document ON control_governance_documents(document_id);

    -- Control ↔ Training Course links
    CREATE TABLE IF NOT EXISTS control_training_courses (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      control_id    TEXT NOT NULL,
      course_id     TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'reinforces',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, control_id, course_id)
    );

    CREATE INDEX IF NOT EXISTS idx_control_training_workspace ON control_training_courses(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_control_training_control ON control_training_courses(control_id);
    CREATE INDEX IF NOT EXISTS idx_control_training_course ON control_training_courses(course_id);

    -- Governance Document ↔ Training Course links
    CREATE TABLE IF NOT EXISTS governance_document_training_courses (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      document_id   UUID NOT NULL,
      course_id     TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'enforces',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, document_id, course_id)
    );

    CREATE INDEX IF NOT EXISTS idx_gov_doc_training_workspace ON governance_document_training_courses(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_gov_doc_training_document ON governance_document_training_courses(document_id);
    CREATE INDEX IF NOT EXISTS idx_gov_doc_training_course ON governance_document_training_courses(course_id);
  `);

  console.log('✓ Linking tables created');
  await pool.end();
}

apply().catch(console.error);
