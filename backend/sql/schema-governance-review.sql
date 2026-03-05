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
    doc_type TEXT NOT NULL CHECK (doc_type IN ('policy', 'procedure', 'standard', 'guideline', 'manual', 'other')),
    owner TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'in_review', 'retired')) DEFAULT 'draft',
    current_version TEXT,
    location_url TEXT,
    review_frequency_months INTEGER,
    next_review_date DATE,
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_governance_documents_workspace_id ON governance_documents(workspace_id);
CREATE INDEX idx_governance_documents_doc_type ON governance_documents(doc_type);
CREATE INDEX idx_governance_documents_status ON governance_documents(status);
CREATE INDEX idx_governance_documents_next_review_date ON governance_documents(next_review_date);
CREATE INDEX idx_governance_documents_owner ON governance_documents(owner);

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
    status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'completed', 'overdue', 'cancelled')) DEFAULT 'open',
    due_at DATE NOT NULL,
    reminder_days_before INTEGER[] NOT NULL DEFAULT '{30, 7, 1}',
    last_reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_review_tasks_workspace_id ON review_tasks(workspace_id);
CREATE INDEX idx_review_tasks_document_id ON review_tasks(document_id);
CREATE INDEX idx_review_tasks_assignee ON review_tasks(assignee);
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
