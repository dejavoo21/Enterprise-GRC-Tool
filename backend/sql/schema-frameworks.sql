-- ============================================
-- Frameworks Table
-- Central registry for all compliance frameworks
-- ============================================
CREATE TABLE IF NOT EXISTS frameworks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'security',
    description     TEXT,
    is_ai_healthcare BOOLEAN NOT NULL DEFAULT FALSE,
    is_privacy       BOOLEAN NOT NULL DEFAULT FALSE,
    is_default       BOOLEAN NOT NULL DEFAULT TRUE,
    color_hex       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_frameworks_code ON frameworks(code);
CREATE INDEX idx_frameworks_category ON frameworks(category);
CREATE INDEX idx_frameworks_is_ai_healthcare ON frameworks(is_ai_healthcare);
CREATE INDEX idx_frameworks_is_privacy ON frameworks(is_privacy);
CREATE INDEX idx_frameworks_is_default ON frameworks(is_default);

-- ============================================
-- Seed default frameworks
-- ============================================
INSERT INTO frameworks (code, name, category, description, is_ai_healthcare, is_privacy, is_default, color_hex) VALUES
    ('ISO27001', 'ISO 27001', 'security', 'Information Security Management System standard', FALSE, FALSE, TRUE, '#0891B2'),
    ('ISO27701', 'ISO 27701', 'privacy', 'Privacy Information Management System extension to ISO 27001', FALSE, TRUE, TRUE, '#7C3AED'),
    ('SOC1', 'SOC 1', 'audit', 'Service Organization Control 1 - Financial Reporting Controls', FALSE, FALSE, TRUE, '#DC2626'),
    ('SOC2', 'SOC 2', 'audit', 'Service Organization Control 2 - Trust Services Criteria', FALSE, FALSE, TRUE, '#EA580C'),
    ('NIST_800_53', 'NIST 800-53', 'security', 'Security and Privacy Controls for Information Systems', FALSE, FALSE, TRUE, '#0284C7'),
    ('NIST_CSF', 'NIST CSF', 'security', 'NIST Cybersecurity Framework', FALSE, FALSE, TRUE, '#0369A1'),
    ('CIS', 'CIS Controls', 'security', 'Center for Internet Security Critical Security Controls', FALSE, FALSE, TRUE, '#059669'),
    ('PCI_DSS', 'PCI DSS', 'security', 'Payment Card Industry Data Security Standard', FALSE, FALSE, TRUE, '#D97706'),
    ('HIPAA', 'HIPAA', 'healthcare', 'Health Insurance Portability and Accountability Act', TRUE, TRUE, TRUE, '#DC2626'),
    ('HITRUST', 'HITRUST CSF', 'healthcare', 'Health Information Trust Alliance Common Security Framework', TRUE, FALSE, TRUE, '#BE185D'),
    ('ISO42001', 'ISO 42001 (AI)', 'ai', 'Artificial Intelligence Management System standard', TRUE, FALSE, TRUE, '#7C3AED'),
    ('EU_AI_ACT', 'EU AI Act', 'ai', 'European Union Artificial Intelligence Act', TRUE, FALSE, TRUE, '#2563EB'),
    ('GDPR', 'GDPR', 'privacy', 'General Data Protection Regulation', FALSE, TRUE, TRUE, '#4F46E5'),
    ('COBIT', 'COBIT', 'governance', 'Control Objectives for Information Technologies', FALSE, FALSE, TRUE, '#6366F1'),
    ('CUSTOM', 'Custom', 'custom', 'Custom framework defined by the organization', FALSE, FALSE, FALSE, '#6B7280')
ON CONFLICT (code) DO NOTHING;
