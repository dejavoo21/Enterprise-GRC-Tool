-- ============================================
-- Training Courses Schema
-- Phase 12b: Custom Training Modules
-- ============================================

-- Training delivery format types
-- internal_video: hosted video content
-- document: PDF/document based training
-- external_lms: link to external LMS
-- classroom: in-person training
-- other: other delivery methods

-- Training courses table
CREATE TABLE IF NOT EXISTS training_courses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = global/seeded course
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_format TEXT DEFAULT 'document',  -- internal_video, document, external_lms, classroom, other
  content_url TEXT,
  category TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Training course to framework mapping (many-to-many)
CREATE TABLE IF NOT EXISTS training_course_frameworks (
  course_id TEXT NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  framework_code TEXT NOT NULL,
  PRIMARY KEY (course_id, framework_code)
);

-- Training assignments table
CREATE TABLE IF NOT EXISTS training_assignments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',  -- not_started, in_progress, completed, overdue
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Awareness campaigns table
CREATE TABLE IF NOT EXISTS awareness_campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,  -- e.g., Phishing, Passwords, Social Engineering
  channel TEXT NOT NULL,  -- email, poster, event, phishing_sim, video
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',  -- planned, active, completed
  participants INTEGER NOT NULL DEFAULT 0,
  completion_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),  -- for phishing simulations
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_training_courses_workspace ON training_courses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_training_courses_active ON training_courses(is_active);
CREATE INDEX IF NOT EXISTS idx_training_course_frameworks_course ON training_course_frameworks(course_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_workspace ON training_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_course ON training_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_status ON training_assignments(status);
CREATE INDEX IF NOT EXISTS idx_awareness_campaigns_workspace ON awareness_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_awareness_campaigns_status ON awareness_campaigns(status);

-- ============================================
-- Seed global training courses
-- ============================================

INSERT INTO training_courses (id, workspace_id, title, description, duration_minutes, mandatory, delivery_format, category, is_custom, is_active) VALUES
  ('TC-001', NULL, 'Security Awareness Fundamentals', 'Core security awareness training covering phishing, passwords, and social engineering.', 45, TRUE, 'internal_video', 'Security Awareness', FALSE, TRUE),
  ('TC-002', NULL, 'Data Protection & Privacy', 'Understanding data classification, handling PII, and GDPR compliance.', 60, TRUE, 'internal_video', 'Privacy', FALSE, TRUE),
  ('TC-003', NULL, 'Secure Coding Practices', 'Best practices for writing secure code and avoiding common vulnerabilities.', 90, FALSE, 'document', 'Development', FALSE, TRUE),
  ('TC-004', NULL, 'Incident Response Training', 'How to identify, report, and respond to security incidents.', 30, TRUE, 'internal_video', 'Security Operations', FALSE, TRUE),
  ('TC-005', NULL, 'PCI DSS Compliance Essentials', 'Understanding PCI DSS requirements for handling payment card data.', 75, FALSE, 'external_lms', 'Compliance', FALSE, TRUE),
  ('TC-006', NULL, 'Physical Security Awareness', 'Protecting physical assets, clean desk policy, and visitor management.', 20, FALSE, 'document', 'Security Awareness', FALSE, TRUE),
  ('TC-007', NULL, 'HIPAA Privacy and Security', 'Understanding HIPAA requirements for protecting health information.', 60, FALSE, 'internal_video', 'Healthcare', FALSE, TRUE),
  ('TC-008', NULL, 'Remote Work Security', 'Best practices for securing home office and remote work environments.', 25, TRUE, 'internal_video', 'Security Awareness', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Framework mappings for global courses
INSERT INTO training_course_frameworks (course_id, framework_code) VALUES
  ('TC-001', 'ISO27001'),
  ('TC-001', 'SOC2'),
  ('TC-001', 'NIST_CSF'),
  ('TC-002', 'ISO27001'),
  ('TC-002', 'ISO27701'),
  ('TC-002', 'GDPR'),
  ('TC-003', 'SOC2'),
  ('TC-003', 'PCI_DSS'),
  ('TC-004', 'ISO27001'),
  ('TC-004', 'NIST_CSF'),
  ('TC-004', 'SOC2'),
  ('TC-005', 'PCI_DSS'),
  ('TC-006', 'ISO27001'),
  ('TC-006', 'SOC2'),
  ('TC-007', 'HIPAA'),
  ('TC-008', 'ISO27001'),
  ('TC-008', 'SOC2'),
  ('TC-008', 'NIST_CSF')
ON CONFLICT (course_id, framework_code) DO NOTHING;

-- Sample assignments for default workspace
INSERT INTO training_assignments (id, workspace_id, course_id, user_id, user_name, status, assigned_at, due_at, completed_at) VALUES
  ('TA-001', 'default', 'TC-001', 'user-001', 'John Smith', 'completed', '2024-01-15 10:00:00', '2024-02-15 10:00:00', '2024-02-01 14:30:00'),
  ('TA-002', 'default', 'TC-001', 'user-002', 'Sarah Johnson', 'completed', '2024-01-15 10:00:00', '2024-02-15 10:00:00', '2024-02-10 09:15:00'),
  ('TA-003', 'default', 'TC-001', 'user-003', 'Michael Brown', 'overdue', '2024-01-15 10:00:00', '2024-02-15 10:00:00', NULL),
  ('TA-004', 'default', 'TC-002', 'user-001', 'John Smith', 'in_progress', '2024-02-01 10:00:00', '2024-03-01 10:00:00', NULL),
  ('TA-005', 'default', 'TC-002', 'user-002', 'Sarah Johnson', 'completed', '2024-02-01 10:00:00', '2024-03-01 10:00:00', '2024-02-20 16:45:00'),
  ('TA-006', 'default', 'TC-004', 'user-001', 'John Smith', 'completed', '2024-01-20 10:00:00', '2024-02-20 10:00:00', '2024-02-15 11:00:00'),
  ('TA-007', 'default', 'TC-004', 'user-003', 'Michael Brown', 'not_started', '2024-02-15 10:00:00', '2024-03-15 10:00:00', NULL)
ON CONFLICT (id) DO NOTHING;

-- Sample awareness campaigns for default workspace
INSERT INTO awareness_campaigns (id, workspace_id, title, topic, channel, start_date, end_date, status, participants, completion_rate, click_rate) VALUES
  ('AC-001', 'default', 'Q1 Phishing Simulation', 'Phishing', 'phishing_sim', '2024-01-15', '2024-01-31', 'completed', 150, 85.0, 12.5),
  ('AC-002', 'default', 'Password Security Month', 'Passwords', 'email', '2024-02-01', '2024-02-29', 'completed', 200, 78.0, NULL),
  ('AC-003', 'default', 'Q2 Phishing Simulation', 'Phishing', 'phishing_sim', '2024-04-01', '2024-04-15', 'active', 175, NULL, NULL),
  ('AC-004', 'default', 'Data Privacy Week', 'Data Protection', 'event', '2024-05-01', '2024-05-07', 'planned', 0, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
