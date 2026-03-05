/**
 * TPRM Seed Script
 *
 * Seeds sample Third-Party Risk Management data for demo/testing purposes.
 * Run with: npx ts-node src/scripts/seed-tprm.ts
 */

import { pool } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const WORKSPACE_ID = 'demo-workspace';

async function seedTPRM() {
  console.log('Seeding TPRM data...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get existing vendors for linking
    const vendorsResult = await client.query(
      'SELECT id, name FROM vendors WHERE workspace_id = $1 LIMIT 5',
      [WORKSPACE_ID]
    );
    const vendors = vendorsResult.rows;

    if (vendors.length === 0) {
      console.log('No vendors found. Please seed vendors first.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`Found ${vendors.length} vendors to link TPRM data to.`);

    // Get a user for assignment
    const usersResult = await client.query('SELECT id FROM users LIMIT 1');
    const userId = usersResult.rows[0]?.id;

    // Seed Vendor Risk Assessments
    console.log('Creating vendor risk assessments...');
    const assessmentIds: string[] = [];

    for (const vendor of vendors) {
      const assessmentId = uuidv4();
      assessmentIds.push(assessmentId);

      const riskTier = ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)];
      const status = ['draft', 'in_progress', 'completed', 'pending_review'][Math.floor(Math.random() * 4)];
      const inherentScore = Math.floor(Math.random() * 40) + 40; // 40-80
      const residualScore = Math.floor(Math.random() * 30) + 20; // 20-50

      await client.query(
        `INSERT INTO vendor_risk_assessments (
          id, workspace_id, vendor_id, assessment_type, status, risk_tier,
          inherent_risk_score, residual_risk_score, due_date, assessor_id,
          findings, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          assessmentId,
          WORKSPACE_ID,
          vendor.id,
          'initial',
          status,
          riskTier,
          inherentScore,
          residualScore,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          userId,
          JSON.stringify([
            {
              id: uuidv4(),
              title: 'Missing encryption at rest',
              severity: 'high',
              status: 'open',
              description: 'Data stored without encryption',
              recommendation: 'Implement AES-256 encryption for all data at rest',
            },
          ]),
          `Initial assessment for ${vendor.name}`,
        ]
      );
    }
    console.log(`Created ${assessmentIds.length} assessments.`);

    // Seed Questionnaire Templates
    console.log('Creating questionnaire templates...');
    const templateIds: string[] = [];

    const templates = [
      { name: 'Security Assessment Questionnaire', type: 'security' },
      { name: 'Privacy Impact Assessment', type: 'privacy' },
      { name: 'SOC 2 Compliance Questionnaire', type: 'compliance' },
    ];

    for (const template of templates) {
      const templateId = uuidv4();
      templateIds.push(templateId);

      await client.query(
        `INSERT INTO vendor_questionnaires (
          id, workspace_id, name, description, questionnaire_type, is_template, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          templateId,
          WORKSPACE_ID,
          template.name,
          `Standard ${template.name.toLowerCase()} for vendor evaluation`,
          template.type,
          true,
          'draft',
        ]
      );

      // Add questions to each template
      const questions = getQuestionsForType(template.type);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `INSERT INTO vendor_questionnaire_questions (
            id, questionnaire_id, category, question_text, question_type,
            is_required, weight, risk_if_negative, display_order, guidance
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            uuidv4(),
            templateId,
            q.category,
            q.questionText,
            q.questionType,
            true,
            q.weight,
            q.riskIfNegative,
            i + 1,
            q.guidance,
          ]
        );
      }
    }
    console.log(`Created ${templateIds.length} questionnaire templates with questions.`);

    // Seed Active Questionnaires for vendors
    console.log('Creating active questionnaires...');
    for (let i = 0; i < Math.min(2, vendors.length); i++) {
      const vendor = vendors[i];
      const questionnaireId = uuidv4();

      await client.query(
        `INSERT INTO vendor_questionnaires (
          id, workspace_id, vendor_id, assessment_id, name, description,
          questionnaire_type, is_template, status, sent_date, due_date,
          completion_percentage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          questionnaireId,
          WORKSPACE_ID,
          vendor.id,
          assessmentIds[i],
          `Security Assessment - ${vendor.name}`,
          `Security assessment questionnaire for ${vendor.name}`,
          'security',
          false,
          'in_progress',
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          Math.floor(Math.random() * 60) + 20, // 20-80%
        ]
      );
    }

    // Seed Subprocessors (fourth parties)
    console.log('Creating subprocessors...');
    const subprocessors = [
      { name: 'AWS', serviceType: 'cloud_hosting', dataAccess: 'full', location: 'USA' },
      { name: 'Stripe', serviceType: 'payment_processing', dataAccess: 'limited', location: 'USA' },
      { name: 'Segment', serviceType: 'analytics', dataAccess: 'limited', location: 'USA' },
      { name: 'Cloudflare', serviceType: 'cdn_security', dataAccess: 'none', location: 'Global' },
    ];

    for (const vendor of vendors.slice(0, 2)) {
      for (const sp of subprocessors.slice(0, 2)) {
        await client.query(
          `INSERT INTO vendor_subprocessors (
            id, workspace_id, vendor_id, name, description, service_type,
            data_access, data_types, location, risk_tier, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            uuidv4(),
            WORKSPACE_ID,
            vendor.id,
            sp.name,
            `${sp.serviceType} provider`,
            sp.serviceType,
            sp.dataAccess,
            sp.dataAccess === 'full' ? ['PII', 'financial'] : sp.dataAccess === 'limited' ? ['PII'] : [],
            sp.location,
            sp.dataAccess === 'full' ? 'high' : sp.dataAccess === 'limited' ? 'medium' : 'low',
            'active',
          ]
        );
      }
    }
    console.log('Created subprocessors.');

    // Seed Contracts
    console.log('Creating contracts...');
    const contractTypes = ['msa', 'dpa', 'nda', 'sla'];

    for (const vendor of vendors) {
      const contractType = contractTypes[Math.floor(Math.random() * contractTypes.length)];
      const effectiveDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 6 months ago
      const expirationDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months from now

      await client.query(
        `INSERT INTO vendor_contracts (
          id, workspace_id, vendor_id, contract_name, contract_type, status,
          effective_date, expiration_date, renewal_type, renewal_notice_days,
          contract_value, currency, key_terms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          uuidv4(),
          WORKSPACE_ID,
          vendor.id,
          `${vendor.name} ${contractType.toUpperCase()}`,
          contractType,
          'active',
          effectiveDate.toISOString().split('T')[0],
          expirationDate.toISOString().split('T')[0],
          'auto',
          30,
          Math.floor(Math.random() * 100000) + 10000, // $10k - $110k
          'USD',
          JSON.stringify({
            slaUptime: '99.9%',
            liabilityCap: '$1,000,000',
            terminationNotice: '30 days',
          }),
        ]
      );
    }
    console.log(`Created ${vendors.length} contracts.`);

    // Seed Incidents
    console.log('Creating incidents...');
    const incidentTypes = ['security_breach', 'service_outage', 'compliance_violation', 'data_loss'];
    const severities = ['critical', 'high', 'medium', 'low'];

    for (const vendor of vendors.slice(0, 2)) {
      const incidentType = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];

      await client.query(
        `INSERT INTO vendor_incidents (
          id, workspace_id, vendor_id, incident_type, severity, status,
          title, description, impact, data_affected, occurred_at, detected_at,
          reported_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          uuidv4(),
          WORKSPACE_ID,
          vendor.id,
          incidentType,
          severity,
          'investigating',
          `${incidentType.replace('_', ' ')} at ${vendor.name}`,
          `An incident of type ${incidentType} was detected involving ${vendor.name}.`,
          'Potential data exposure and service disruption',
          incidentType === 'data_loss' || incidentType === 'security_breach',
          new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          userId,
        ]
      );
    }
    console.log('Created incidents.');

    await client.query('COMMIT');
    console.log('\n✅ TPRM seed data created successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding TPRM data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function getQuestionsForType(type: string) {
  const securityQuestions = [
    {
      category: 'Data Protection',
      questionText: 'Is all customer data encrypted at rest using AES-256 or equivalent?',
      questionType: 'yes_no',
      weight: 3,
      riskIfNegative: 'high',
      guidance: 'Verify encryption standards for databases and file storage.',
    },
    {
      category: 'Data Protection',
      questionText: 'Is all data encrypted in transit using TLS 1.2 or higher?',
      questionType: 'yes_no',
      weight: 3,
      riskIfNegative: 'high',
      guidance: 'Check SSL/TLS configuration on all endpoints.',
    },
    {
      category: 'Access Control',
      questionText: 'Is multi-factor authentication (MFA) required for all administrative access?',
      questionType: 'yes_no',
      weight: 3,
      riskIfNegative: 'high',
      guidance: 'MFA should be enforced for privileged accounts.',
    },
    {
      category: 'Access Control',
      questionText: 'Describe your access review process and frequency.',
      questionType: 'text',
      weight: 2,
      riskIfNegative: 'medium',
      guidance: 'Access reviews should occur at least quarterly.',
    },
    {
      category: 'Incident Response',
      questionText: 'Do you have a documented incident response plan?',
      questionType: 'yes_no',
      weight: 2,
      riskIfNegative: 'high',
      guidance: 'Plan should include escalation procedures and notification timelines.',
    },
    {
      category: 'Compliance',
      questionText: 'What security certifications do you maintain?',
      questionType: 'multiple_choice',
      weight: 2,
      riskIfNegative: 'medium',
      guidance: 'Common certifications: SOC 2, ISO 27001, HIPAA, PCI-DSS',
    },
  ];

  const privacyQuestions = [
    {
      category: 'Data Collection',
      questionText: 'What personal data do you collect from our customers?',
      questionType: 'text',
      weight: 3,
      riskIfNegative: 'high',
      guidance: 'List all PII categories collected.',
    },
    {
      category: 'Data Retention',
      questionText: 'What is your data retention policy for personal data?',
      questionType: 'text',
      weight: 2,
      riskIfNegative: 'medium',
      guidance: 'Retention periods should be defined and enforced.',
    },
    {
      category: 'Subject Rights',
      questionText: 'Can you fulfill data subject access requests (DSAR) within 30 days?',
      questionType: 'yes_no',
      weight: 3,
      riskIfNegative: 'high',
      guidance: 'GDPR requires response within 30 days.',
    },
    {
      category: 'Cross-border Transfer',
      questionText: 'Do you transfer data outside the EEA?',
      questionType: 'yes_no',
      weight: 2,
      riskIfNegative: 'medium',
      guidance: 'If yes, appropriate safeguards must be in place.',
    },
  ];

  const complianceQuestions = [
    {
      category: 'SOC 2',
      questionText: 'Do you have a current SOC 2 Type II report?',
      questionType: 'yes_no',
      weight: 3,
      riskIfNegative: 'high',
      guidance: 'Report should be less than 12 months old.',
    },
    {
      category: 'Change Management',
      questionText: 'Describe your change management process.',
      questionType: 'text',
      weight: 2,
      riskIfNegative: 'medium',
      guidance: 'Should include approval workflows and testing requirements.',
    },
    {
      category: 'Business Continuity',
      questionText: 'What is your Recovery Time Objective (RTO)?',
      questionType: 'text',
      weight: 2,
      riskIfNegative: 'medium',
      guidance: 'RTO should align with our business requirements.',
    },
    {
      category: 'Audit',
      questionText: 'Do you allow customer audits of your facilities?',
      questionType: 'yes_no',
      weight: 1,
      riskIfNegative: 'low',
      guidance: 'Right to audit should be included in contract.',
    },
  ];

  switch (type) {
    case 'security':
      return securityQuestions;
    case 'privacy':
      return privacyQuestions;
    case 'compliance':
      return complianceQuestions;
    default:
      return securityQuestions;
  }
}

// Run the seed
seedTPRM().catch(console.error);
