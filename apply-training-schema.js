/**
 * Apply training schema without seed data that causes FK errors
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/grc_suite'
});

async function applySchema() {
  console.log('Applying training schema...');

  // Create tables without seed data
  await pool.query(`
    -- Training courses table
    CREATE TABLE IF NOT EXISTS training_courses (
      id TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER,
      mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_format TEXT DEFAULT 'document',
      content_url TEXT,
      category TEXT,
      is_custom BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Training course to framework mapping
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
      status TEXT NOT NULL DEFAULT 'not_started',
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
      topic TEXT NOT NULL,
      channel TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'planned',
      participants INTEGER NOT NULL DEFAULT 0,
      completion_rate DECIMAL(5,2),
      click_rate DECIMAL(5,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('  ✓ Tables created');

  // Create indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_training_courses_workspace ON training_courses(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_training_courses_active ON training_courses(is_active);
    CREATE INDEX IF NOT EXISTS idx_training_course_frameworks_course ON training_course_frameworks(course_id);
    CREATE INDEX IF NOT EXISTS idx_training_assignments_workspace ON training_assignments(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_training_assignments_course ON training_assignments(course_id);
    CREATE INDEX IF NOT EXISTS idx_training_assignments_status ON training_assignments(status);
    CREATE INDEX IF NOT EXISTS idx_awareness_campaigns_workspace ON awareness_campaigns(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_awareness_campaigns_status ON awareness_campaigns(status);
  `);
  console.log('  ✓ Indexes created');

  // Seed global training courses (no workspace_id - these are global)
  await pool.query(`
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
  `);
  console.log('  ✓ Global training courses seeded');

  // Seed framework mappings for courses
  await pool.query(`
    INSERT INTO training_course_frameworks (course_id, framework_code) VALUES
      ('TC-001', 'ISO27001'),
      ('TC-001', 'SOC2'),
      ('TC-001', 'NIST_CSF'),
      ('TC-002', 'ISO27001'),
      ('TC-002', 'ISO27701'),
      ('TC-002', 'GDPR'),
      ('TC-003', 'ISO27001'),
      ('TC-003', 'PCI_DSS'),
      ('TC-004', 'ISO27001'),
      ('TC-004', 'NIST_CSF'),
      ('TC-005', 'PCI_DSS'),
      ('TC-006', 'ISO27001'),
      ('TC-007', 'HIPAA'),
      ('TC-007', 'HITRUST'),
      ('TC-008', 'ISO27001'),
      ('TC-008', 'NIST_CSF')
    ON CONFLICT DO NOTHING;
  `);
  console.log('  ✓ Framework mappings seeded');

  await pool.end();
  console.log('\nTraining schema applied successfully!');
}

applySchema().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
