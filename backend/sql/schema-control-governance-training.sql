-- ============================================
-- Control-Governance-Training Linking Tables
-- Phase 13: Cross-entity mapping layer
-- ============================================

-- Control ↔ Governance Document links
CREATE TABLE IF NOT EXISTS control_governance_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  control_id    TEXT NOT NULL,
  document_id   UUID NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'supports', -- 'supports','implements','references'
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
  course_id     UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'reinforces', -- 'reinforces','introduces','advanced'
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
  document_id   UUID NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'enforces', -- 'enforces','explains'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, document_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_gov_doc_training_workspace ON governance_document_training_courses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gov_doc_training_document ON governance_document_training_courses(document_id);
CREATE INDEX IF NOT EXISTS idx_gov_doc_training_course ON governance_document_training_courses(course_id);

-- ============================================
-- Seed Data: Example Links
-- ============================================

-- Insert sample links if governance documents and training courses exist
-- These will only succeed if the referenced records exist

-- Link Access Control policy to CTR-001 (Access Control)
INSERT INTO control_governance_documents (workspace_id, control_id, document_id, relation_type)
SELECT 'ws-001', 'CTR-001', id, 'implements'
FROM governance_documents
WHERE workspace_id = 'ws-001' AND title LIKE '%Access Control%'
ON CONFLICT DO NOTHING;

-- Link Security Awareness training to CTR-001
INSERT INTO control_training_courses (workspace_id, control_id, course_id, relation_type)
SELECT 'ws-001', 'CTR-001', id, 'reinforces'
FROM training_courses
WHERE title LIKE '%Security Awareness%' AND (workspace_id = 'ws-001' OR workspace_id IS NULL)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Link Information Security Policy to CTR-002 (Data Classification)
INSERT INTO control_governance_documents (workspace_id, control_id, document_id, relation_type)
SELECT 'ws-001', 'CTR-002', id, 'supports'
FROM governance_documents
WHERE workspace_id = 'ws-001' AND title LIKE '%Information Security%'
ON CONFLICT DO NOTHING;

-- Link Data Protection training to CTR-002
INSERT INTO control_training_courses (workspace_id, control_id, course_id, relation_type)
SELECT 'ws-001', 'CTR-002', id, 'introduces'
FROM training_courses
WHERE title LIKE '%Data Protection%' AND (workspace_id = 'ws-001' OR workspace_id IS NULL)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Link Incident Response policy to CTR-003
INSERT INTO control_governance_documents (workspace_id, control_id, document_id, relation_type)
SELECT 'ws-001', 'CTR-003', id, 'implements'
FROM governance_documents
WHERE workspace_id = 'ws-001' AND title LIKE '%Incident%'
ON CONFLICT DO NOTHING;

-- Link Incident Response training to CTR-003
INSERT INTO control_training_courses (workspace_id, control_id, course_id, relation_type)
SELECT 'ws-001', 'CTR-003', id, 'reinforces'
FROM training_courses
WHERE title LIKE '%Incident Response%' AND (workspace_id = 'ws-001' OR workspace_id IS NULL)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Link policy documents to their related training courses
INSERT INTO governance_document_training_courses (workspace_id, document_id, course_id, relation_type)
SELECT 'ws-001', gd.id, tc.id, 'enforces'
FROM governance_documents gd
CROSS JOIN training_courses tc
WHERE gd.workspace_id = 'ws-001'
  AND gd.title LIKE '%Security%'
  AND tc.title LIKE '%Security Awareness%'
  AND (tc.workspace_id = 'ws-001' OR tc.workspace_id IS NULL)
LIMIT 1
ON CONFLICT DO NOTHING;
