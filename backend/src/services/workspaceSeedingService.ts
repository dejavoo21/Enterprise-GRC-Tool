/**
 * Workspace Seeding Service
 * Seeds initial data for new workspaces based on profile selection
 */

import { pool } from '../db.js';
import { WorkspaceSeedProfile } from '../repositories/workspacesRepo.js';

/**
 * Seed workspace with initial data based on the selected profile
 */
export async function seedWorkspaceData(
  workspaceId: string,
  seedProfile: WorkspaceSeedProfile = 'minimal'
): Promise<void> {
  switch (seedProfile) {
    case 'minimal':
      await seedMinimalData(workspaceId);
      break;
    case 'standard':
      await seedStandardData(workspaceId);
      break;
    case 'full':
      await seedFullData(workspaceId);
      break;
    default:
      await seedMinimalData(workspaceId);
  }
}

/**
 * Minimal seed - just a couple of example items
 */
async function seedMinimalData(workspaceId: string): Promise<void> {
  // Insert 1 example risk
  await pool.query(
    `INSERT INTO risks (id, workspace_id, title, description, category, inherent_likelihood, inherent_impact, status, owner, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      `RISK-${workspaceId.substring(0, 8).toUpperCase()}-001`,
      workspaceId,
      'Information Security Risk Assessment',
      'Initial risk assessment to identify and evaluate information security risks across the organization.',
      'operational',
      3,
      4,
      'identified',
      'GRC Team',
    ]
  );

  // Insert 3 core controls
  const coreControls = [
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-001`,
      title: 'Access Control Policy',
      description: 'Establish and maintain access control policies to ensure only authorized users have access to systems and data.',
      domain: 'Access Control',
      owner: 'IT Security',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-002`,
      title: 'Asset Inventory Management',
      description: 'Maintain an inventory of all information assets including hardware, software, and data.',
      domain: 'Asset Management',
      owner: 'IT Operations',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-003`,
      title: 'Incident Response Procedure',
      description: 'Establish procedures for detecting, reporting, and responding to security incidents.',
      domain: 'Incident Management',
      owner: 'Security Team',
      status: 'draft',
    },
  ];

  for (const control of coreControls) {
    await pool.query(
      `INSERT INTO controls (id, workspace_id, title, description, domain, owner, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [control.id, workspaceId, control.title, control.description, control.domain, control.owner, control.status]
    );
  }
}

/**
 * Standard seed - common controls, a policy document, and training course
 */
async function seedStandardData(workspaceId: string): Promise<void> {
  // First seed minimal data
  await seedMinimalData(workspaceId);

  // Add more controls
  const additionalControls = [
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-004`,
      title: 'Security Awareness Training',
      description: 'Provide security awareness training to all employees on a regular basis.',
      domain: 'Human Resources Security',
      owner: 'HR Department',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-005`,
      title: 'Data Classification',
      description: 'Classify information assets based on sensitivity and business value.',
      domain: 'Information Classification',
      owner: 'Data Governance',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-006`,
      title: 'Backup and Recovery',
      description: 'Implement backup procedures and test recovery processes regularly.',
      domain: 'Operations Security',
      owner: 'IT Operations',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-007`,
      title: 'Change Management',
      description: 'Control changes to information systems through a formal change management process.',
      domain: 'Operations Security',
      owner: 'IT Operations',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-008`,
      title: 'Vendor Risk Management',
      description: 'Assess and monitor risks associated with third-party vendors and service providers.',
      domain: 'Supplier Relationships',
      owner: 'Procurement',
      status: 'draft',
    },
  ];

  for (const control of additionalControls) {
    await pool.query(
      `INSERT INTO controls (id, workspace_id, title, description, domain, owner, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [control.id, workspaceId, control.title, control.description, control.domain, control.owner, control.status]
    );
  }

  // Add a governance document
  const docId = `DOC-${workspaceId.substring(0, 8).toUpperCase()}-001`;
  await pool.query(
    `INSERT INTO governance_documents (id, workspace_id, title, doc_type, owner, status, current_version, review_frequency_months, next_review_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      docId,
      workspaceId,
      'Information Security Policy',
      'policy',
      'CISO',
      'draft',
      '1.0',
      12,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    ]
  );

  // Add a training course
  const courseId = `COURSE-${workspaceId.substring(0, 8).toUpperCase()}-001`;
  await pool.query(
    `INSERT INTO training_courses (id, workspace_id, title, description, delivery_format, duration_minutes, mandatory, audience_roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      courseId,
      workspaceId,
      'Security Awareness 101',
      'Introduction to information security best practices, including password hygiene, phishing awareness, and data handling.',
      'e-learning',
      30,
      true,
      ['all'],
    ]
  );

  // Add some risks
  const additionalRisks = [
    {
      id: `RISK-${workspaceId.substring(0, 8).toUpperCase()}-002`,
      title: 'Phishing Attack Risk',
      description: 'Risk of employees falling victim to phishing attacks leading to credential compromise.',
      category: 'cybersecurity',
      inherentLikelihood: 4,
      inherentImpact: 4,
      status: 'identified',
      owner: 'Security Team',
    },
    {
      id: `RISK-${workspaceId.substring(0, 8).toUpperCase()}-003`,
      title: 'Data Breach Risk',
      description: 'Risk of unauthorized access to sensitive data resulting in data breach.',
      category: 'compliance',
      inherentLikelihood: 3,
      inherentImpact: 5,
      status: 'identified',
      owner: 'Security Team',
    },
  ];

  for (const risk of additionalRisks) {
    await pool.query(
      `INSERT INTO risks (id, workspace_id, title, description, category, inherent_likelihood, inherent_impact, status, owner, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [risk.id, workspaceId, risk.title, risk.description, risk.category, risk.inherentLikelihood, risk.inherentImpact, risk.status, risk.owner]
    );
  }
}

/**
 * Full seed - comprehensive starter set
 */
async function seedFullData(workspaceId: string): Promise<void> {
  // First seed standard data
  await seedStandardData(workspaceId);

  // Add more governance documents
  const additionalDocs = [
    {
      id: `DOC-${workspaceId.substring(0, 8).toUpperCase()}-002`,
      title: 'Acceptable Use Policy',
      docType: 'policy',
      owner: 'IT Security',
      status: 'draft',
    },
    {
      id: `DOC-${workspaceId.substring(0, 8).toUpperCase()}-003`,
      title: 'Incident Response Plan',
      docType: 'procedure',
      owner: 'Security Team',
      status: 'draft',
    },
    {
      id: `DOC-${workspaceId.substring(0, 8).toUpperCase()}-004`,
      title: 'Business Continuity Plan',
      docType: 'procedure',
      owner: 'Operations',
      status: 'draft',
    },
    {
      id: `DOC-${workspaceId.substring(0, 8).toUpperCase()}-005`,
      title: 'Data Protection Guidelines',
      docType: 'guideline',
      owner: 'Data Privacy Officer',
      status: 'draft',
    },
  ];

  for (const doc of additionalDocs) {
    await pool.query(
      `INSERT INTO governance_documents (id, workspace_id, title, doc_type, owner, status, current_version, review_frequency_months, next_review_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, '1.0', 12, $7, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [doc.id, workspaceId, doc.title, doc.docType, doc.owner, doc.status, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()]
    );
  }

  // Add more training courses
  const additionalCourses = [
    {
      id: `COURSE-${workspaceId.substring(0, 8).toUpperCase()}-002`,
      title: 'Phishing Awareness',
      description: 'Learn to identify and report phishing attempts.',
      deliveryFormat: 'e-learning',
      durationMinutes: 20,
      mandatory: true,
    },
    {
      id: `COURSE-${workspaceId.substring(0, 8).toUpperCase()}-003`,
      title: 'Data Privacy Fundamentals',
      description: 'Understanding data privacy regulations and your role in protecting personal data.',
      deliveryFormat: 'e-learning',
      durationMinutes: 45,
      mandatory: true,
    },
    {
      id: `COURSE-${workspaceId.substring(0, 8).toUpperCase()}-004`,
      title: 'Secure Software Development',
      description: 'Security best practices for developers.',
      deliveryFormat: 'e-learning',
      durationMinutes: 60,
      mandatory: false,
    },
  ];

  for (const course of additionalCourses) {
    await pool.query(
      `INSERT INTO training_courses (id, workspace_id, title, description, delivery_format, duration_minutes, mandatory, audience_roles, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [course.id, workspaceId, course.title, course.description, course.deliveryFormat, course.durationMinutes, course.mandatory, ['all']]
    );
  }

  // Add more controls
  const additionalControls = [
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-009`,
      title: 'Encryption Standards',
      description: 'Implement encryption for data at rest and in transit.',
      domain: 'Cryptography',
      owner: 'IT Security',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-010`,
      title: 'Network Security',
      description: 'Implement network security controls including firewalls and intrusion detection.',
      domain: 'Communications Security',
      owner: 'Network Team',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-011`,
      title: 'Physical Access Control',
      description: 'Control physical access to facilities and sensitive areas.',
      domain: 'Physical Security',
      owner: 'Facilities',
      status: 'draft',
    },
    {
      id: `CTRL-${workspaceId.substring(0, 8).toUpperCase()}-012`,
      title: 'Logging and Monitoring',
      description: 'Implement logging and monitoring of security events.',
      domain: 'Operations Security',
      owner: 'Security Operations',
      status: 'draft',
    },
  ];

  for (const control of additionalControls) {
    await pool.query(
      `INSERT INTO controls (id, workspace_id, title, description, domain, owner, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [control.id, workspaceId, control.title, control.description, control.domain, control.owner, control.status]
    );
  }

  // Add more risks
  const additionalRisks = [
    {
      id: `RISK-${workspaceId.substring(0, 8).toUpperCase()}-004`,
      title: 'Third-Party Vendor Risk',
      description: 'Risk of security incidents through third-party vendors with access to systems or data.',
      category: 'strategic',
      inherentLikelihood: 3,
      inherentImpact: 4,
      status: 'identified',
      owner: 'Procurement',
    },
    {
      id: `RISK-${workspaceId.substring(0, 8).toUpperCase()}-005`,
      title: 'Regulatory Non-Compliance',
      description: 'Risk of failing to comply with applicable regulations and standards.',
      category: 'compliance',
      inherentLikelihood: 2,
      inherentImpact: 5,
      status: 'identified',
      owner: 'Legal',
    },
  ];

  for (const risk of additionalRisks) {
    await pool.query(
      `INSERT INTO risks (id, workspace_id, title, description, category, inherent_likelihood, inherent_impact, status, owner, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [risk.id, workspaceId, risk.title, risk.description, risk.category, risk.inherentLikelihood, risk.inherentImpact, risk.status, risk.owner]
    );
  }
}

/**
 * Get summary of seeded data
 */
export function getSeedProfileDescription(profile: WorkspaceSeedProfile): string {
  switch (profile) {
    case 'minimal':
      return '1 risk, 3 core controls - Just the basics to get started';
    case 'standard':
      return '3 risks, 8 controls, 1 policy, 1 training - Common starting point for most organizations';
    case 'full':
      return '5 risks, 12 controls, 5 documents, 4 training courses - Comprehensive starter set';
    default:
      return 'Unknown profile';
  }
}
