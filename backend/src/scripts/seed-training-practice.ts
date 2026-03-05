import { query } from '../db.js';

async function seedTrainingPractice() {
  console.log('Seeding Training Practice data...');

  // Seed Pricing Models (global - no workspace_id)
  const pricingModels = [
    {
      id: 'PM-001',
      name: 'Per User License',
      billing_basis: 'per_user',
      currency: 'USD',
      unit_price: 25.00,
      min_units: 10,
      max_units: 1000,
      notes: 'Standard per-user annual license',
    },
    {
      id: 'PM-002',
      name: 'Enterprise Annual',
      billing_basis: 'per_year',
      currency: 'USD',
      unit_price: 15000.00,
      notes: 'Unlimited users, annual subscription',
    },
    {
      id: 'PM-003',
      name: 'Department Bundle',
      billing_basis: 'per_department',
      currency: 'USD',
      unit_price: 2500.00,
      min_units: 1,
      notes: 'Per department pricing with volume discounts',
    },
    {
      id: 'PM-004',
      name: 'Project Fixed Fee',
      billing_basis: 'fixed_fee',
      currency: 'USD',
      unit_price: 50000.00,
      notes: 'Fixed project delivery fee',
    },
    {
      id: 'PM-005',
      name: 'Managed Service Retainer',
      billing_basis: 'per_year',
      currency: 'GBP',
      unit_price: 120000.00,
      notes: 'Annual managed service with dedicated team',
    },
  ];

  for (const pm of pricingModels) {
    await query(
      `INSERT INTO pricing_models (id, name, billing_basis, currency, unit_price, min_units, max_units, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         billing_basis = EXCLUDED.billing_basis,
         currency = EXCLUDED.currency,
         unit_price = EXCLUDED.unit_price,
         min_units = EXCLUDED.min_units,
         max_units = EXCLUDED.max_units,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [pm.id, pm.name, pm.billing_basis, pm.currency, pm.unit_price, pm.min_units || null, pm.max_units || null, pm.notes || null]
    );
  }
  console.log(`  ✓ Seeded ${pricingModels.length} pricing models`);

  // Seed Training Engagements for demo-workspace
  const engagements = [
    {
      id: 'ENG-001',
      workspace_id: 'demo-workspace',
      title: 'Security Awareness Program 2024',
      client_name: 'Acme Financial Services',
      engagement_type: 'ongoing_program',
      status: 'in_delivery',
      pricing_model_id: 'PM-001',
      start_date: '2024-01-15',
      end_date: '2024-12-31',
      primary_contact: 'John Smith',
      proposal_url: 'https://sharepoint.company.com/proposals/acme-2024.pdf',
      sow_url: 'https://sharepoint.company.com/sows/acme-2024.pdf',
    },
    {
      id: 'ENG-002',
      workspace_id: 'demo-workspace',
      title: 'Phishing Simulation Campaign',
      client_name: 'TechStart Inc',
      engagement_type: 'one_off',
      status: 'completed',
      pricing_model_id: 'PM-004',
      start_date: '2024-02-01',
      end_date: '2024-03-15',
      primary_contact: 'Sarah Johnson',
    },
    {
      id: 'ENG-003',
      workspace_id: 'demo-workspace',
      title: 'Executive Security Training',
      client_name: 'Global Logistics Ltd',
      engagement_type: 'one_off',
      status: 'proposed',
      pricing_model_id: 'PM-004',
      start_date: '2024-04-01',
      end_date: '2024-04-30',
      primary_contact: 'Michael Chen',
      proposal_url: 'https://sharepoint.company.com/proposals/global-exec.pdf',
    },
    {
      id: 'ENG-004',
      workspace_id: 'demo-workspace',
      title: 'Managed Security Awareness',
      client_name: 'HealthCare Partners',
      engagement_type: 'managed_service',
      status: 'signed',
      pricing_model_id: 'PM-005',
      start_date: '2024-03-01',
      primary_contact: 'Emma Wilson',
      sow_url: 'https://sharepoint.company.com/sows/healthcare-managed.pdf',
    },
    {
      id: 'ENG-005',
      workspace_id: 'demo-workspace',
      title: 'Compliance Training Refresh',
      client_name: null,
      engagement_type: 'retainer',
      status: 'draft',
      pricing_model_id: 'PM-002',
      primary_contact: 'David Lee',
    },
  ];

  for (const eng of engagements) {
    await query(
      `INSERT INTO training_engagements (
        id, workspace_id, title, client_name, engagement_type, status,
        pricing_model_id, start_date, end_date, primary_contact, proposal_url, sow_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        client_name = EXCLUDED.client_name,
        engagement_type = EXCLUDED.engagement_type,
        status = EXCLUDED.status,
        pricing_model_id = EXCLUDED.pricing_model_id,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        primary_contact = EXCLUDED.primary_contact,
        proposal_url = EXCLUDED.proposal_url,
        sow_url = EXCLUDED.sow_url,
        updated_at = NOW()`,
      [
        eng.id, eng.workspace_id, eng.title, eng.client_name || null,
        eng.engagement_type, eng.status, eng.pricing_model_id || null,
        eng.start_date || null, eng.end_date || null, eng.primary_contact || null,
        eng.proposal_url || null, eng.sow_url || null,
      ]
    );
  }
  console.log(`  ✓ Seeded ${engagements.length} training engagements`);

  // Seed Awareness Content (mix of global and workspace-specific)
  const awarenessContent = [
    // Global content (workspace_id = NULL)
    {
      id: 'AWC-001',
      workspace_id: null,
      type: 'breach_report',
      title: 'Capital One Data Breach Analysis (2019)',
      summary: 'Analysis of the Capital One breach affecting 100M customers, caused by misconfigured WAF rules and SSRF vulnerability.',
      source: 'External',
      link_url: 'https://www.justice.gov/usao-wdwa/press-release/file/1198481/download',
      framework_tags: ['SOC2', 'PCI_DSS', 'NIST_800_53'],
      topic_tags: ['Cloud Security', 'SSRF', 'Configuration Management'],
    },
    {
      id: 'AWC-002',
      workspace_id: null,
      type: 'regulatory_case',
      title: 'GDPR Fine: British Airways £20M (2020)',
      summary: 'ICO fine for inadequate security measures leading to breach affecting 400,000 customers.',
      source: 'Regulator',
      link_url: 'https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2020/10/ico-fines-british-airways-20m-for-data-breach-affecting-more-than-400-000-customers/',
      framework_tags: ['GDPR', 'ISO27001'],
      topic_tags: ['Data Protection', 'Web Security', 'Regulatory Fines'],
    },
    {
      id: 'AWC-003',
      workspace_id: null,
      type: 'statistic',
      title: 'Average Cost of Data Breach 2024',
      summary: 'IBM Security reports average data breach cost reached $4.88M globally in 2024, with healthcare sector highest at $10.93M.',
      source: 'IBM Security',
      link_url: 'https://www.ibm.com/security/data-breach',
      framework_tags: ['ISO27001', 'SOC2'],
      topic_tags: ['Breach Cost', 'Statistics', 'Executive Reporting'],
    },
    {
      id: 'AWC-004',
      workspace_id: null,
      type: 'board_expectation',
      title: 'Board Cybersecurity Oversight Framework',
      summary: 'NACD guidance on board-level cybersecurity oversight responsibilities and key questions directors should ask.',
      source: 'NACD',
      link_url: 'https://www.nacdonline.org/insights/publications.cfm?ItemNumber=67298',
      framework_tags: ['ISO27001', 'NIST_CSF', 'COBIT'],
      topic_tags: ['Governance', 'Board Reporting', 'Risk Oversight'],
    },
    {
      id: 'AWC-005',
      workspace_id: null,
      type: 'training_deck',
      title: 'Social Engineering Awareness - Master Deck',
      summary: 'Comprehensive training deck covering phishing, vishing, pretexting, and tailgating with real-world examples.',
      source: 'Internal',
      link_url: 'https://sharepoint.company.com/training/social-engineering-deck.pptx',
      framework_tags: ['ISO27001', 'SOC2', 'HIPAA'],
      topic_tags: ['Phishing', 'Social Engineering', 'User Awareness'],
    },
    // Workspace-specific content
    {
      id: 'AWC-006',
      workspace_id: 'demo-workspace',
      type: 'proposal_template',
      title: 'Security Awareness Program Proposal Template',
      summary: 'Standard proposal template for ongoing security awareness programs including scope, pricing, and timeline sections.',
      source: 'Internal',
      link_url: 'https://sharepoint.company.com/templates/proposal-awareness.docx',
      framework_tags: ['ISO27001'],
      topic_tags: ['Proposal', 'Template', 'Sales'],
    },
    {
      id: 'AWC-007',
      workspace_id: 'demo-workspace',
      type: 'sow_template',
      title: 'Managed Security Training SOW Template',
      summary: 'Statement of Work template for managed security training services with SLA definitions.',
      source: 'Internal',
      link_url: 'https://sharepoint.company.com/templates/sow-managed-training.docx',
      framework_tags: ['ISO27001', 'SOC2'],
      topic_tags: ['SOW', 'Template', 'Managed Services'],
    },
    {
      id: 'AWC-008',
      workspace_id: 'demo-workspace',
      type: 'audit_finding_template',
      title: 'Training Program Audit Finding Template',
      summary: 'Template for documenting audit findings related to security awareness training gaps.',
      source: 'Internal',
      link_url: 'https://sharepoint.company.com/templates/audit-finding-training.docx',
      framework_tags: ['ISO27001', 'SOC2', 'PCI_DSS'],
      topic_tags: ['Audit', 'Template', 'Findings'],
    },
    {
      id: 'AWC-009',
      workspace_id: null,
      type: 'incident_summary',
      title: 'Okta Support System Breach (2023)',
      summary: 'Summary of the Okta support case management system breach affecting customer support cases.',
      source: 'News',
      link_url: 'https://sec.okta.com/harfiles',
      framework_tags: ['SOC2', 'ISO27001'],
      topic_tags: ['Identity', 'Supply Chain', 'Incident Response'],
    },
    {
      id: 'AWC-010',
      workspace_id: null,
      type: 'outline',
      title: 'CISO Annual Security Awareness Program Outline',
      summary: 'Recommended annual program outline including monthly themes, campaigns, and measurement KPIs.',
      source: 'Internal',
      link_url: 'https://sharepoint.company.com/templates/annual-program-outline.pdf',
      framework_tags: ['ISO27001', 'NIST_CSF'],
      topic_tags: ['Program Planning', 'KPIs', 'Annual Plan'],
    },
  ];

  for (const content of awarenessContent) {
    await query(
      `INSERT INTO awareness_content (
        id, workspace_id, type, title, summary, source, link_url, framework_tags, topic_tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        source = EXCLUDED.source,
        link_url = EXCLUDED.link_url,
        framework_tags = EXCLUDED.framework_tags,
        topic_tags = EXCLUDED.topic_tags,
        updated_at = NOW()`,
      [
        content.id, content.workspace_id, content.type, content.title,
        content.summary || null, content.source || null, content.link_url || null,
        content.framework_tags, content.topic_tags,
      ]
    );
  }
  console.log(`  ✓ Seeded ${awarenessContent.length} awareness content items`);

  console.log('Training Practice data seeding complete!');
}

seedTrainingPractice()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
