-- ============================================
-- Governance Document & Review Schema
-- ============================================

-- Enable pgcrypto for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Governance Documents Table
-- ============================================
CREATE TABLE IF NOT EXISTS governance_documents (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    doc_type TEXT NOT NULL CHECK (doc_type IN (
        'policy',
        'standard',
        'procedure',
        'guideline',
        'framework_document',
        'risk_document',
        'control_document',
        'evidence_document',
        'audit_document',
        'training_material',
        'incident_document',
        'vendor_document',
        'compliance_register',
        'management_review_document',
        'custom'
    )),
    owner TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'draft',
        'under_review',
        'approved',
        'published',
        'active',
        'expired',
        'superseded',
        'archived',
        'retired',
        'rejected',
        'pending_attestation'
    )) DEFAULT 'draft',
    classification TEXT CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
    current_version TEXT,
    location_url TEXT,
    review_frequency_months INTEGER,
    next_review_date DATE,
    last_reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    effective_date DATE,
    expiry_date DATE,
    archived_at TIMESTAMPTZ,
    superseded_by_id TEXT REFERENCES governance_documents(id) ON DELETE SET NULL,
    attestation_required BOOLEAN NOT NULL DEFAULT FALSE,
    file_name TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS classification TEXT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS superseded_by_id TEXT REFERENCES governance_documents(id) ON DELETE SET NULL;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS attestation_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE governance_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE governance_documents DROP CONSTRAINT IF EXISTS governance_documents_doc_type_check;
ALTER TABLE governance_documents DROP CONSTRAINT IF EXISTS governance_documents_status_check;
ALTER TABLE governance_documents DROP CONSTRAINT IF EXISTS governance_documents_classification_check;

ALTER TABLE governance_documents
    ADD CONSTRAINT governance_documents_doc_type_check CHECK (doc_type IN (
        'policy',
        'standard',
        'procedure',
        'guideline',
        'framework_document',
        'risk_document',
        'control_document',
        'evidence_document',
        'audit_document',
        'training_material',
        'incident_document',
        'vendor_document',
        'compliance_register',
        'management_review_document',
        'custom'
    ));

ALTER TABLE governance_documents
    ADD CONSTRAINT governance_documents_status_check CHECK (status IN (
        'draft',
        'under_review',
        'approved',
        'published',
        'active',
        'expired',
        'superseded',
        'archived',
        'retired',
        'rejected',
        'pending_attestation'
    ));

ALTER TABLE governance_documents
    ADD CONSTRAINT governance_documents_classification_check CHECK (
        classification IS NULL
        OR classification IN ('public', 'internal', 'confidential', 'restricted')
    );

CREATE INDEX idx_governance_documents_workspace_id ON governance_documents(workspace_id);
CREATE INDEX idx_governance_documents_doc_type ON governance_documents(doc_type);
CREATE INDEX idx_governance_documents_status ON governance_documents(status);
CREATE INDEX idx_governance_documents_next_review_date ON governance_documents(next_review_date);
CREATE INDEX idx_governance_documents_owner ON governance_documents(owner);
CREATE INDEX idx_governance_documents_classification ON governance_documents(classification);
CREATE INDEX idx_governance_documents_effective_date ON governance_documents(effective_date);
CREATE INDEX idx_governance_documents_expiry_date ON governance_documents(expiry_date);

-- ============================================
-- Review Tasks Table
-- ============================================
CREATE TABLE IF NOT EXISTS review_tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assignee TEXT NOT NULL,
    assignee_email TEXT,
    status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'completed', 'overdue', 'cancelled')) DEFAULT 'open',
    due_at DATE NOT NULL,
    reminder_days_before INTEGER[] NOT NULL DEFAULT '{30, 7, 1}',
    last_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE review_tasks
ADD COLUMN IF NOT EXISTS assignee_email TEXT;

CREATE INDEX idx_review_tasks_workspace_id ON review_tasks(workspace_id);
CREATE INDEX idx_review_tasks_document_id ON review_tasks(document_id);
CREATE INDEX idx_review_tasks_assignee ON review_tasks(assignee);
CREATE INDEX idx_review_tasks_assignee_email ON review_tasks(assignee_email);
CREATE INDEX idx_review_tasks_status ON review_tasks(status);
CREATE INDEX idx_review_tasks_due_at ON review_tasks(due_at);

-- ============================================
-- Document Review Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS document_review_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
    review_task_id TEXT NOT NULL REFERENCES review_tasks(id) ON DELETE CASCADE,
    reviewed_by TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decision TEXT NOT NULL CHECK (decision IN ('no_change', 'update_required', 'retire')),
    comments TEXT,
    new_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_review_logs_workspace_id ON document_review_logs(workspace_id);
CREATE INDEX idx_document_review_logs_document_id ON document_review_logs(document_id);
CREATE INDEX idx_document_review_logs_review_task_id ON document_review_logs(review_task_id);
CREATE INDEX idx_document_review_logs_reviewed_by ON document_review_logs(reviewed_by);

-- ============================================
-- Governance Document Frameworks (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS governance_document_frameworks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES governance_documents(id) ON DELETE CASCADE,
    framework_code TEXT NOT NULL REFERENCES frameworks(code) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, framework_code)
);

CREATE INDEX idx_governance_document_frameworks_document_id ON governance_document_frameworks(document_id);
CREATE INDEX idx_governance_document_frameworks_framework_code ON governance_document_frameworks(framework_code);
