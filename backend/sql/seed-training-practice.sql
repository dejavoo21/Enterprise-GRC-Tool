-- ============================================
-- Seed Data for Training Practice Tables
-- Phase 12: Billable Training Practice Layer
-- ============================================

-- Pricing Models (global, not workspace-specific)
INSERT INTO pricing_models (id, code, name, billing_basis, currency, unit_price, min_units, max_units, notes) VALUES
  ('pm-001', 'BASIC-PER-USER', 'Basic Per User', 'per_user', 'GBP', 15.00, 50, 500, 'Standard per-user pricing for small to medium engagements'),
  ('pm-002', 'ENTERPRISE-PER-USER', 'Enterprise Per User', 'per_user', 'GBP', 12.00, 500, NULL, 'Volume discount for large enterprises'),
  ('pm-003', 'DEPT-STANDARD', 'Department Standard', 'per_department', 'GBP', 2500.00, 1, 20, 'Fixed price per department regardless of user count'),
  ('pm-004', 'ANNUAL-SME', 'Annual SME Package', 'per_year', 'GBP', 15000.00, NULL, NULL, 'Annual package for SMEs - includes quarterly refreshers'),
  ('pm-005', 'ANNUAL-ENTERPRISE', 'Annual Enterprise Package', 'per_year', 'GBP', 45000.00, NULL, NULL, 'Comprehensive annual program with monthly content updates'),
  ('pm-006', 'FIXED-EXECUTIVE', 'Executive Training Fixed', 'fixed_fee', 'GBP', 5000.00, NULL, NULL, 'Fixed fee for board/executive awareness sessions'),
  ('pm-007', 'FIXED-WORKSHOP', 'Workshop Fixed Fee', 'fixed_fee', 'GBP', 3500.00, NULL, NULL, 'Half-day interactive workshop')
ON CONFLICT (id) DO NOTHING;

-- KPI Definitions (global)
INSERT INTO kpi_definitions (id, code, name, description, category, target_direction) VALUES
  ('kpi-001', 'PHISH_CLICK_RATE', 'Phishing Click Rate', 'Percentage of users who click on simulated phishing links', 'phishing', 'down'),
  ('kpi-002', 'PHISH_REPORT_RATE', 'Phishing Report Rate', 'Percentage of users who report simulated phishing emails', 'phishing', 'up'),
  ('kpi-003', 'TRAINING_COMPLETION', 'Training Completion Rate', 'Percentage of assigned users who complete training modules', 'training', 'up'),
  ('kpi-004', 'TRAINING_PASS_RATE', 'Training Pass Rate', 'Percentage of users passing training assessments', 'training', 'up'),
  ('kpi-005', 'TIME_TO_COMPLETE', 'Average Time to Complete', 'Average days from assignment to completion', 'training', 'down'),
  ('kpi-006', 'POLICY_ACK_RATE', 'Policy Acknowledgment Rate', 'Percentage of users acknowledging security policies', 'behavior', 'up'),
  ('kpi-007', 'PASSWORD_COMPLIANCE', 'Password Policy Compliance', 'Percentage of users meeting password requirements', 'behavior', 'up'),
  ('kpi-008', 'MFA_ADOPTION', 'MFA Adoption Rate', 'Percentage of users with MFA enabled', 'behavior', 'up'),
  ('kpi-009', 'INCIDENT_REPORTS', 'Security Incident Reports', 'Number of security incidents reported by users', 'behavior', 'up'),
  ('kpi-010', 'AUDIT_FINDINGS', 'Training-Related Audit Findings', 'Number of audit findings related to security awareness', 'audit', 'down'),
  ('kpi-011', 'COMPLIANCE_SCORE', 'Training Compliance Score', 'Overall compliance score for training requirements', 'audit', 'up')
ON CONFLICT (id) DO NOTHING;

-- Sample Training Engagements for default workspace
INSERT INTO training_engagements (id, workspace_id, title, client_name, engagement_type, status, pricing_model_id, estimated_users, start_date, end_date, primary_contact, proposal_url, sow_url) VALUES
  ('eng-001', 'default', 'Acme Corp Annual Security Awareness', 'Acme Corporation', 'ongoing_program', 'in_delivery', 'pm-005', 1500, '2024-01-01', '2024-12-31', 'John Smith', NULL, NULL),
  ('eng-002', 'default', 'TechStart Phishing Simulation', 'TechStart Ltd', 'one_off', 'completed', 'pm-002', 250, '2024-02-01', '2024-03-31', 'Sarah Johnson', NULL, NULL),
  ('eng-003', 'default', 'Global Finance Board Training', 'Global Finance PLC', 'one_off', 'signed', 'pm-006', 12, '2024-06-01', '2024-06-15', 'Michael Brown', NULL, NULL),
  ('eng-004', 'default', 'HealthPlus HIPAA Training', 'HealthPlus Inc', 'managed_service', 'proposed', 'pm-001', 500, '2024-07-01', NULL, 'Emily Davis', NULL, NULL),
  ('eng-005', 'default', 'RetailMax Security Workshop', 'RetailMax Group', 'one_off', 'draft', 'pm-007', 50, NULL, NULL, 'David Wilson', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Engagement-Framework Relationships
INSERT INTO training_engagement_frameworks (engagement_id, framework_code) VALUES
  ('eng-001', 'ISO27001'),
  ('eng-001', 'SOC2'),
  ('eng-001', 'NIST_CSF'),
  ('eng-002', 'ISO27001'),
  ('eng-003', 'SOC2'),
  ('eng-003', 'PCI_DSS'),
  ('eng-004', 'HIPAA'),
  ('eng-004', 'ISO27001'),
  ('eng-005', 'PCI_DSS')
ON CONFLICT (engagement_id, framework_code) DO NOTHING;

-- Sample KPI Snapshots
INSERT INTO kpi_snapshots (id, workspace_id, engagement_id, kpi_id, period_start, period_end, value) VALUES
  -- Acme Corp engagement KPIs
  ('snap-001', 'default', 'eng-001', 'kpi-001', '2024-01-01', '2024-03-31', 18.5),
  ('snap-002', 'default', 'eng-001', 'kpi-001', '2024-04-01', '2024-06-30', 12.3),
  ('snap-003', 'default', 'eng-001', 'kpi-002', '2024-01-01', '2024-03-31', 35.0),
  ('snap-004', 'default', 'eng-001', 'kpi-002', '2024-04-01', '2024-06-30', 52.0),
  ('snap-005', 'default', 'eng-001', 'kpi-003', '2024-01-01', '2024-03-31', 78.0),
  ('snap-006', 'default', 'eng-001', 'kpi-003', '2024-04-01', '2024-06-30', 92.0),
  -- TechStart engagement KPIs
  ('snap-007', 'default', 'eng-002', 'kpi-001', '2024-02-01', '2024-02-28', 25.0),
  ('snap-008', 'default', 'eng-002', 'kpi-001', '2024-03-01', '2024-03-31', 8.5),
  ('snap-009', 'default', 'eng-002', 'kpi-002', '2024-02-01', '2024-02-28', 20.0),
  ('snap-010', 'default', 'eng-002', 'kpi-002', '2024-03-01', '2024-03-31', 65.0),
  -- Workspace-wide KPIs (no specific engagement)
  ('snap-011', 'default', NULL, 'kpi-006', '2024-01-01', '2024-06-30', 85.0),
  ('snap-012', 'default', NULL, 'kpi-007', '2024-01-01', '2024-06-30', 72.0),
  ('snap-013', 'default', NULL, 'kpi-008', '2024-01-01', '2024-06-30', 68.0),
  ('snap-014', 'default', NULL, 'kpi-011', '2024-01-01', '2024-06-30', 88.5)
ON CONFLICT (id) DO NOTHING;

-- Sample Awareness Content (global and workspace-specific)
INSERT INTO awareness_content (id, workspace_id, type, title, summary, source, link_url) VALUES
  -- Global content (workspace_id = NULL)
  ('awc-001', NULL, 'breach_report', 'MOVEit Transfer Breach Analysis', 'Analysis of the 2023 MOVEit Transfer vulnerability exploitation affecting thousands of organizations worldwide.', 'news', 'https://example.com/moveit-breach'),
  ('awc-002', NULL, 'breach_report', 'Okta Support System Breach', 'Details of the October 2023 breach affecting Okta customer support case management system.', 'news', 'https://example.com/okta-breach'),
  ('awc-003', NULL, 'regulatory_case', 'ICO Fine: British Airways Data Breach', 'ICO imposed £20m fine for 2018 data breach affecting 400,000 customers.', 'regulator', 'https://example.com/ico-ba'),
  ('awc-004', NULL, 'regulatory_case', 'SEC Charges SolarWinds CISO', 'SEC charged SolarWinds and its CISO for fraud and internal control failures.', 'regulator', 'https://example.com/sec-solarwinds'),
  ('awc-005', NULL, 'statistic', '2024 Phishing Trends Report', '91% of cyberattacks begin with a phishing email. Average cost of a successful attack: £3.5M.', 'external', NULL),
  ('awc-006', NULL, 'statistic', 'Insider Threat Statistics 2024', '34% of data breaches involve internal actors. Average time to detect: 287 days.', 'external', NULL),
  ('awc-007', NULL, 'board_expectation', 'NCSC Board Toolkit Summary', 'Key expectations for boards on cyber security governance from UK NCSC.', 'regulator', 'https://example.com/ncsc-board'),
  ('awc-008', NULL, 'training_deck', 'Phishing Awareness Fundamentals', 'Core training deck covering email security, social engineering, and reporting procedures.', 'internal', NULL),
  ('awc-009', NULL, 'training_deck', 'Secure Remote Working', 'Training materials for remote work security including VPN usage, home network security.', 'internal', NULL),
  ('awc-010', NULL, 'proposal_template', 'Standard Awareness Program Proposal', 'Template for proposing comprehensive security awareness programs.', 'internal', NULL),
  ('awc-011', NULL, 'sow_template', 'Managed Service SOW Template', 'Statement of Work template for managed security awareness services.', 'internal', NULL),
  -- Workspace-specific content
  ('awc-012', 'default', 'incident_summary', 'Q1 2024 Internal Phishing Results', 'Summary of quarterly phishing simulation results and trend analysis.', 'internal', NULL),
  ('awc-013', 'default', 'risk_assessment', 'User Awareness Gap Analysis', 'Assessment of current awareness levels and training needs across departments.', 'internal', NULL),
  ('awc-014', 'default', 'outline', 'Executive Security Briefing Outline', 'Outline for board-level security awareness presentations.', 'internal', NULL)
ON CONFLICT (id) DO NOTHING;

-- Awareness Content Framework Relationships
INSERT INTO awareness_content_frameworks (content_id, framework_code) VALUES
  ('awc-001', 'ISO27001'),
  ('awc-001', 'SOC2'),
  ('awc-002', 'ISO27001'),
  ('awc-002', 'SOC2'),
  ('awc-003', 'GDPR'),
  ('awc-003', 'ISO27001'),
  ('awc-004', 'SOC2'),
  ('awc-004', 'SEC'),
  ('awc-005', 'ISO27001'),
  ('awc-005', 'NIST_CSF'),
  ('awc-006', 'ISO27001'),
  ('awc-007', 'ISO27001'),
  ('awc-007', 'NIST_CSF'),
  ('awc-008', 'ISO27001'),
  ('awc-008', 'SOC2'),
  ('awc-009', 'ISO27001'),
  ('awc-010', 'ISO27001'),
  ('awc-011', 'ISO27001'),
  ('awc-012', 'ISO27001'),
  ('awc-013', 'ISO27001'),
  ('awc-013', 'NIST_CSF'),
  ('awc-014', 'ISO27001')
ON CONFLICT (content_id, framework_code) DO NOTHING;
