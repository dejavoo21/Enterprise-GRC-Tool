import { query } from '../db.js';

async function seedGovernanceData() {
  console.log('Seeding Governance Documents and Review Tasks...');

  // Seed Governance Documents
  const documents = [
    {
      id: 'GD-001',
      workspace_id: 'demo-workspace',
      title: 'Information Security Policy',
      doc_type: 'policy',
      owner: 'Alice Johnson',
      status: 'approved',
      current_version: '3.0',
      location_url: 'https://sharepoint.company.com/policies/info-security-policy.pdf',
      review_frequency_months: 12,
      next_review_date: '2025-03-15',
      last_reviewed_at: '2024-03-15',
    },
    {
      id: 'GD-002',
      workspace_id: 'demo-workspace',
      title: 'Data Classification Standard',
      doc_type: 'standard',
      owner: 'Bob Smith',
      status: 'approved',
      current_version: '2.1',
      location_url: 'https://sharepoint.company.com/standards/data-classification.pdf',
      review_frequency_months: 12,
      next_review_date: '2025-02-01',
      last_reviewed_at: '2024-02-01',
    },
    {
      id: 'GD-003',
      workspace_id: 'demo-workspace',
      title: 'Incident Response Procedure',
      doc_type: 'procedure',
      owner: 'Carol Davis',
      status: 'approved',
      current_version: '1.5',
      location_url: 'https://sharepoint.company.com/procedures/incident-response.pdf',
      review_frequency_months: 6,
      next_review_date: '2025-06-01',
      last_reviewed_at: '2024-12-01',
    },
    {
      id: 'GD-004',
      workspace_id: 'demo-workspace',
      title: 'Access Control Policy',
      doc_type: 'policy',
      owner: 'David Lee',
      status: 'in_review',
      current_version: '2.0',
      location_url: 'https://sharepoint.company.com/policies/access-control.pdf',
      review_frequency_months: 12,
      next_review_date: '2025-01-30',
      last_reviewed_at: '2024-01-30',
    },
    {
      id: 'GD-005',
      workspace_id: 'demo-workspace',
      title: 'Acceptable Use Policy',
      doc_type: 'policy',
      owner: 'Eve Martinez',
      status: 'approved',
      current_version: '4.0',
      location_url: 'https://sharepoint.company.com/policies/acceptable-use.pdf',
      review_frequency_months: 12,
      next_review_date: '2025-07-01',
      last_reviewed_at: '2024-07-01',
    },
    {
      id: 'GD-006',
      workspace_id: 'demo-workspace',
      title: 'Password Management Guideline',
      doc_type: 'guideline',
      owner: 'Frank Wilson',
      status: 'draft',
      current_version: '1.0',
      location_url: null,
      review_frequency_months: 12,
      next_review_date: '2026-01-01',
      last_reviewed_at: null,
    },
    {
      id: 'GD-007',
      workspace_id: 'demo-workspace',
      title: 'Privacy Policy',
      doc_type: 'policy',
      owner: 'Grace Brown',
      status: 'approved',
      current_version: '2.5',
      location_url: 'https://sharepoint.company.com/policies/privacy-policy.pdf',
      review_frequency_months: 12,
      next_review_date: '2025-04-15',
      last_reviewed_at: '2024-04-15',
    },
    {
      id: 'GD-008',
      workspace_id: 'demo-workspace',
      title: 'Business Continuity Manual',
      doc_type: 'manual',
      owner: 'Henry Taylor',
      status: 'approved',
      current_version: '1.2',
      location_url: 'https://sharepoint.company.com/manuals/bc-manual.pdf',
      review_frequency_months: 24,
      next_review_date: '2026-06-01',
      last_reviewed_at: '2024-06-01',
    },
    {
      id: 'GD-009',
      workspace_id: 'demo-workspace',
      title: 'Change Management Procedure',
      doc_type: 'procedure',
      owner: 'Ivy Clark',
      status: 'approved',
      current_version: '3.1',
      location_url: 'https://sharepoint.company.com/procedures/change-management.pdf',
      review_frequency_months: 6,
      next_review_date: '2025-05-01',
      last_reviewed_at: '2024-11-01',
    },
    {
      id: 'GD-010',
      workspace_id: 'demo-workspace',
      title: 'Vendor Management Policy',
      doc_type: 'policy',
      owner: 'Jack Anderson',
      status: 'retired',
      current_version: '1.0',
      location_url: 'https://sharepoint.company.com/archive/vendor-mgmt-v1.pdf',
      review_frequency_months: null,
      next_review_date: null,
      last_reviewed_at: '2023-01-15',
    },
  ];

  for (const doc of documents) {
    await query(
      `INSERT INTO governance_documents (
        id, workspace_id, title, doc_type, owner, status, current_version,
        location_url, review_frequency_months, next_review_date, last_reviewed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        doc_type = EXCLUDED.doc_type,
        owner = EXCLUDED.owner,
        status = EXCLUDED.status,
        current_version = EXCLUDED.current_version,
        location_url = EXCLUDED.location_url,
        review_frequency_months = EXCLUDED.review_frequency_months,
        next_review_date = EXCLUDED.next_review_date,
        last_reviewed_at = EXCLUDED.last_reviewed_at,
        updated_at = NOW()`,
      [
        doc.id,
        doc.workspace_id,
        doc.title,
        doc.doc_type,
        doc.owner,
        doc.status,
        doc.current_version || null,
        doc.location_url || null,
        doc.review_frequency_months || null,
        doc.next_review_date || null,
        doc.last_reviewed_at || null,
      ]
    );
  }
  console.log(`  ✓ Seeded ${documents.length} governance documents`);

  // Seed Review Tasks
  const tasks = [
    {
      id: 'RT-001',
      workspace_id: 'demo-workspace',
      document_id: 'GD-001',
      title: 'Annual Review: Information Security Policy',
      description: 'Conduct annual review of the Information Security Policy to ensure alignment with current threats and business needs.',
      assignee: 'Alice Johnson',
      status: 'open',
      due_at: '2025-03-15',
      reminder_days_before: [30, 7, 1],
    },
    {
      id: 'RT-002',
      workspace_id: 'demo-workspace',
      document_id: 'GD-002',
      title: 'Annual Review: Data Classification Standard',
      description: 'Review and update data classification levels and handling procedures.',
      assignee: 'Bob Smith',
      status: 'in_progress',
      due_at: '2025-02-01',
      reminder_days_before: [30, 7, 1],
    },
    {
      id: 'RT-003',
      workspace_id: 'demo-workspace',
      document_id: 'GD-004',
      title: 'Annual Review: Access Control Policy',
      description: 'Review access control requirements and update based on recent audit findings.',
      assignee: 'David Lee',
      status: 'overdue',
      due_at: '2025-01-30',
      reminder_days_before: [30, 7, 1],
    },
    {
      id: 'RT-004',
      workspace_id: 'demo-workspace',
      document_id: 'GD-003',
      title: 'Semi-Annual Review: Incident Response Procedure',
      description: 'Review and update incident response procedures based on lessons learned.',
      assignee: 'Carol Davis',
      status: 'open',
      due_at: '2025-06-01',
      reminder_days_before: [30, 14, 7, 1],
    },
    {
      id: 'RT-005',
      workspace_id: 'demo-workspace',
      document_id: 'GD-007',
      title: 'Annual Review: Privacy Policy',
      description: 'Review privacy policy for compliance with GDPR and CCPA requirements.',
      assignee: 'Grace Brown',
      status: 'open',
      due_at: '2025-04-15',
      reminder_days_before: [30, 7, 1],
    },
    {
      id: 'RT-006',
      workspace_id: 'demo-workspace',
      document_id: 'GD-009',
      title: 'Semi-Annual Review: Change Management Procedure',
      description: 'Review change management process for efficiency and compliance.',
      assignee: 'Ivy Clark',
      status: 'open',
      due_at: '2025-05-01',
      reminder_days_before: [14, 7, 1],
    },
    {
      id: 'RT-007',
      workspace_id: 'demo-workspace',
      document_id: 'GD-005',
      title: 'Completed: Acceptable Use Policy Review',
      description: 'Annual review completed with minor updates.',
      assignee: 'Eve Martinez',
      status: 'completed',
      due_at: '2024-07-01',
      completed_at: '2024-06-28',
      reminder_days_before: [30, 7, 1],
    },
    {
      id: 'RT-008',
      workspace_id: 'demo-workspace',
      document_id: 'GD-008',
      title: 'Biennial Review: Business Continuity Manual',
      description: 'Comprehensive review of BCP manual and testing procedures.',
      assignee: 'Henry Taylor',
      status: 'open',
      due_at: '2026-06-01',
      reminder_days_before: [60, 30, 14, 7, 1],
    },
  ];

  for (const task of tasks) {
    await query(
      `INSERT INTO review_tasks (
        id, workspace_id, document_id, title, description, assignee, status,
        due_at, reminder_days_before, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        assignee = EXCLUDED.assignee,
        status = EXCLUDED.status,
        due_at = EXCLUDED.due_at,
        reminder_days_before = EXCLUDED.reminder_days_before,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW()`,
      [
        task.id,
        task.workspace_id,
        task.document_id,
        task.title,
        task.description || null,
        task.assignee,
        task.status,
        task.due_at,
        task.reminder_days_before,
        (task as any).completed_at || null,
      ]
    );
  }
  console.log(`  ✓ Seeded ${tasks.length} review tasks`);

  // Seed Document Review Logs (for completed tasks)
  const reviewLogs = [
    {
      id: 'DRL-001',
      workspace_id: 'demo-workspace',
      document_id: 'GD-005',
      review_task_id: 'RT-007',
      reviewed_by: 'Eve Martinez',
      reviewed_at: '2024-06-28T14:30:00Z',
      decision: 'no_change',
      comments: 'Policy reviewed and found to be current. No changes required.',
    },
    {
      id: 'DRL-002',
      workspace_id: 'demo-workspace',
      document_id: 'GD-001',
      review_task_id: null,
      reviewed_by: 'Alice Johnson',
      reviewed_at: '2024-03-15T10:00:00Z',
      decision: 'update_required',
      comments: 'Updated to version 3.0 with new cloud security requirements.',
      new_version: '3.0',
    },
    {
      id: 'DRL-003',
      workspace_id: 'demo-workspace',
      document_id: 'GD-010',
      review_task_id: null,
      reviewed_by: 'Jack Anderson',
      reviewed_at: '2023-01-15T09:00:00Z',
      decision: 'retire',
      comments: 'Superseded by new Third-Party Risk Management Policy.',
    },
  ];

  for (const log of reviewLogs) {
    // Skip logs that reference tasks - the FK constraint may fail if task doesn't exist
    if (log.review_task_id) {
      await query(
        `INSERT INTO document_review_logs (
          id, workspace_id, document_id, review_task_id, reviewed_by, reviewed_at,
          decision, comments, new_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          decision = EXCLUDED.decision,
          comments = EXCLUDED.comments,
          new_version = EXCLUDED.new_version`,
        [
          log.id,
          log.workspace_id,
          log.document_id,
          log.review_task_id,
          log.reviewed_by,
          log.reviewed_at,
          log.decision,
          log.comments || null,
          log.new_version || null,
        ]
      );
    }
  }
  console.log(`  ✓ Seeded document review logs`);

  console.log('Governance data seeding complete!');
}

seedGovernanceData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
