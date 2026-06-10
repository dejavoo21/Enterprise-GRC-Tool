import { generateId, query } from '../db.js';
import type {
  AttestationDecision,
  DeliveryMethod,
  GeneratedReportRecord,
  RecipientType,
  ReportAttestationRecord,
  ReportDistributionRecord,
  ReportFormat,
  ReportRunStatus,
  ReportingCategory,
  ReportingTemplateKey,
  ReportScheduleRecord,
  ReportScopeType,
  ReportSectionKey,
  ReportTemplateRecord,
  ScheduleFrequency,
} from '../types/reportingCenter.js';

const DEFAULT_TEMPLATES: Array<{
  templateKey: ReportingTemplateKey;
  title: string;
  category: ReportingCategory;
  description: string;
  sections: ReportSectionKey[];
  defaultFormat: ReportFormat;
}> = [
  {
    templateKey: 'board_pack',
    title: 'Board Pack',
    category: 'board_reports',
    description: 'Board-ready enterprise posture and strategic risk decisions.',
    sections: ['executive_summary', 'enterprise_risk_posture', 'risk_appetite_status', 'risk_tolerance_breaches', 'risk_capacity_utilization', 'top_risks', 'top_kris', 'emerging_risks', 'control_effectiveness', 'audit_readiness', 'vendor_exposure', 'critical_assets', 'training_metrics', 'regulatory_status', 'strategic_recommendations'],
    defaultFormat: 'pdf',
  },
  {
    templateKey: 'executive_pack',
    title: 'Executive Pack',
    category: 'executive_reports',
    description: 'Executive summary of cross-program performance and movement.',
    sections: ['executive_summary', 'enterprise_risk_posture', 'top_risks', 'top_kris', 'control_effectiveness', 'training_metrics', 'regulatory_status', 'strategic_recommendations'],
    defaultFormat: 'powerpoint',
  },
  {
    templateKey: 'risk_committee_pack',
    title: 'Risk Committee Pack',
    category: 'risk_committee',
    description: 'Risk trends, forecasts, appetite breaches, and treatment movement.',
    sections: ['enterprise_risk_posture', 'risk_appetite_status', 'risk_tolerance_breaches', 'risk_capacity_utilization', 'top_risks', 'top_kris', 'forecasted_issues', 'loss_events', 'near_misses', 'strategic_recommendations'],
    defaultFormat: 'pdf',
  },
  {
    templateKey: 'audit_committee_pack',
    title: 'Audit Committee Pack',
    category: 'audit_committee',
    description: 'Audit readiness, findings, evidence health, and management action status.',
    sections: ['executive_summary', 'audit_readiness', 'control_effectiveness', 'compliance_coverage', 'management_actions', 'top_risks'],
    defaultFormat: 'pdf',
  },
  {
    templateKey: 'compliance_pack',
    title: 'Compliance Pack',
    category: 'compliance_reports',
    description: 'Framework coverage, mappings, evidence, and open gaps.',
    sections: ['compliance_coverage', 'control_effectiveness', 'audit_readiness', 'regulatory_status'],
    defaultFormat: 'excel',
  },
  {
    templateKey: 'vendor_risk_pack',
    title: 'Vendor Risk Pack',
    category: 'operational_reports',
    description: 'Third-party exposure, oversight, and review status.',
    sections: ['vendor_exposure', 'top_risks', 'regulatory_status'],
    defaultFormat: 'pdf',
  },
  {
    templateKey: 'asset_risk_pack',
    title: 'Asset Risk Pack',
    category: 'operational_reports',
    description: 'Critical assets, linked risks, and lifecycle exposure.',
    sections: ['critical_assets', 'top_risks', 'forecasted_issues'],
    defaultFormat: 'excel',
  },
  {
    templateKey: 'training_pack',
    title: 'Training Pack',
    category: 'operational_reports',
    description: 'Awareness completion, overdue assignments, and campaign activity.',
    sections: ['training_metrics', 'management_actions'],
    defaultFormat: 'powerpoint',
  },
  {
    templateKey: 'cyber_risk_pack',
    title: 'Cyber Risk Pack',
    category: 'risk_committee',
    description: 'Cyber exposure, failed logins, vulnerabilities, and vendor concentration.',
    sections: ['enterprise_risk_posture', 'risk_capacity_utilization', 'top_kris', 'critical_assets', 'vendor_exposure', 'loss_events'],
    defaultFormat: 'pdf',
  },
  {
    templateKey: 'privacy_pack',
    title: 'Privacy Pack',
    category: 'regulatory_reports',
    description: 'Privacy controls, incidents, obligations, and regulator-ready status.',
    sections: ['regulatory_status', 'compliance_coverage', 'loss_events', 'strategic_recommendations'],
    defaultFormat: 'word',
  },
  {
    templateKey: 'ai_governance_pack',
    title: 'AI Governance Pack',
    category: 'regulatory_reports',
    description: 'AI oversight, emerging risks, governance controls, and regulatory change.',
    sections: ['emerging_risks', 'risk_capacity_utilization', 'regulatory_status', 'strategic_recommendations'],
    defaultFormat: 'word',
  },
];

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function mapTemplate(row: any): ReportTemplateRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    templateKey: row.template_key,
    title: row.title,
    category: row.category,
    description: row.description,
    sections: row.sections || [],
    defaultFormat: row.default_format,
    classification: row.classification,
    version: row.version,
    authorName: row.author_name,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapGenerated(row: any): GeneratedReportRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    templateId: row.template_id,
    templateKey: row.template_key,
    reportType: row.report_type,
    title: row.title,
    classification: row.classification,
    version: row.version,
    authorName: row.author_name,
    format: row.format,
    scopeType: row.scope_type,
    scopeValue: row.scope_value,
    status: row.status,
    generatedByUserId: row.generated_by_user_id,
    generatedByName: row.generated_by_name,
    content: row.content,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapSchedule(row: any): ReportScheduleRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    templateId: row.template_id,
    templateKey: row.template_key,
    name: row.name,
    frequency: row.frequency,
    recipients: row.recipients || [],
    deliveryMethods: row.delivery_methods || [],
    scopeType: row.scope_type,
    scopeValue: row.scope_value,
    nextRunAt: toIso(row.next_run_at)!,
    lastRunAt: toIso(row.last_run_at),
    isActive: row.is_active,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapDistribution(row: any): ReportDistributionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    reportId: row.report_id,
    recipientType: row.recipient_type,
    recipientValue: row.recipient_value,
    deliveryMethod: row.delivery_method,
    sentAt: toIso(row.sent_at),
    viewedAt: toIso(row.viewed_at),
    downloadedAt: toIso(row.downloaded_at),
    acknowledgedAt: toIso(row.acknowledged_at),
    secureLinkId: row.secure_link_id,
    createdAt: toIso(row.created_at)!,
  };
}

function mapAttestation(row: any): ReportAttestationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    reportId: row.report_id,
    approverUserId: row.approver_user_id,
    approverName: row.approver_name,
    decision: row.decision,
    comments: row.comments,
    attestedAt: toIso(row.attested_at)!,
  };
}

export async function ensureReportingCenterSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS report_templates (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      template_key TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      sections JSONB NOT NULL,
      default_format TEXT NOT NULL,
      classification TEXT NOT NULL DEFAULT 'Confidential',
      version TEXT NOT NULL DEFAULT '1.0',
      author_name TEXT NOT NULL DEFAULT 'GRC Platform',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, template_key)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS generated_reports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_key TEXT NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      classification TEXT NOT NULL,
      version TEXT NOT NULL,
      author_name TEXT NOT NULL,
      format TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_value TEXT NOT NULL,
      status TEXT NOT NULL,
      generated_by_user_id TEXT,
      generated_by_name TEXT NOT NULL,
      content JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS report_schedules (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_key TEXT NOT NULL,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      recipients JSONB NOT NULL,
      delivery_methods JSONB NOT NULL,
      scope_type TEXT NOT NULL,
      scope_value TEXT NOT NULL,
      next_run_at TIMESTAMPTZ NOT NULL,
      last_run_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS report_distributions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_value TEXT NOT NULL,
      delivery_method TEXT NOT NULL,
      sent_at TIMESTAMPTZ,
      viewed_at TIMESTAMPTZ,
      downloaded_at TIMESTAMPTZ,
      acknowledged_at TIMESTAMPTZ,
      secure_link_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS report_attestations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      approver_user_id TEXT,
      approver_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      comments TEXT,
      attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_report_templates_workspace ON report_templates (workspace_id, category)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_generated_reports_workspace ON generated_reports (workspace_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_report_schedules_workspace ON report_schedules (workspace_id, next_run_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_report_distributions_workspace ON report_distributions (workspace_id, report_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_report_attestations_workspace ON report_attestations (workspace_id, report_id)`);
}

export async function seedReportingTemplates(workspaceId: string): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    await query(
      `INSERT INTO report_templates (id, workspace_id, template_key, title, category, description, sections, default_format)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (workspace_id, template_key) DO NOTHING`,
      [
        generateId('rptpl'),
        workspaceId,
        template.templateKey,
        template.title,
        template.category,
        template.description,
        JSON.stringify(template.sections),
        template.defaultFormat,
      ],
    );
  }
}

export async function listTemplates(workspaceId: string): Promise<ReportTemplateRecord[]> {
  const result = await query(`SELECT * FROM report_templates WHERE workspace_id = $1 ORDER BY category, title`, [workspaceId]);
  return result.rows.map(mapTemplate);
}

export async function updateTemplateSections(workspaceId: string, templateId: string, sections: ReportSectionKey[]): Promise<ReportTemplateRecord | null> {
  const result = await query(
    `UPDATE report_templates
     SET sections = $3::jsonb, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, templateId, JSON.stringify(sections)],
  );
  return result.rows[0] ? mapTemplate(result.rows[0]) : null;
}

export async function createGeneratedReport(input: {
  workspaceId: string;
  templateId: string;
  templateKey: ReportingTemplateKey;
  reportType: ReportingCategory;
  title: string;
  classification: string;
  version: string;
  authorName: string;
  format: ReportFormat;
  scopeType: ReportScopeType;
  scopeValue: string;
  status: ReportRunStatus;
  generatedByUserId?: string | null;
  generatedByName: string;
  content: GeneratedReportRecord['content'];
}): Promise<GeneratedReportRecord> {
  const result = await query(
    `INSERT INTO generated_reports (
      id, workspace_id, template_id, template_key, report_type, title, classification, version, author_name, format,
      scope_type, scope_value, status, generated_by_user_id, generated_by_name, content
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
    RETURNING *`,
    [
      generateId('rprun'),
      input.workspaceId,
      input.templateId,
      input.templateKey,
      input.reportType,
      input.title,
      input.classification,
      input.version,
      input.authorName,
      input.format,
      input.scopeType,
      input.scopeValue,
      input.status,
      input.generatedByUserId || null,
      input.generatedByName,
      JSON.stringify(input.content),
    ],
  );
  return mapGenerated(result.rows[0]);
}

export async function listGeneratedReports(workspaceId: string): Promise<GeneratedReportRecord[]> {
  const result = await query(`SELECT * FROM generated_reports WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
  return result.rows.map(mapGenerated);
}

export async function getGeneratedReport(workspaceId: string, reportId: string): Promise<GeneratedReportRecord | null> {
  const result = await query(`SELECT * FROM generated_reports WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, reportId]);
  return result.rows[0] ? mapGenerated(result.rows[0]) : null;
}

export async function updateGeneratedReportStatus(workspaceId: string, reportId: string, status: GeneratedReportRecord['status']): Promise<GeneratedReportRecord | null> {
  const result = await query(
    `UPDATE generated_reports SET status = $3, updated_at = NOW() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
    [workspaceId, reportId, status],
  );
  return result.rows[0] ? mapGenerated(result.rows[0]) : null;
}

export async function createSchedule(input: {
  workspaceId: string;
  templateId: string;
  templateKey: ReportingTemplateKey;
  name: string;
  frequency: ScheduleFrequency;
  recipients: Array<{ type: RecipientType; value: string }>;
  deliveryMethods: DeliveryMethod[];
  scopeType: ReportScopeType;
  scopeValue: string;
  nextRunAt: string;
}): Promise<ReportScheduleRecord> {
  const result = await query(
    `INSERT INTO report_schedules (
      id, workspace_id, template_id, template_key, name, frequency, recipients, delivery_methods, scope_type, scope_value, next_run_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
    RETURNING *`,
    [
      generateId('rpsch'),
      input.workspaceId,
      input.templateId,
      input.templateKey,
      input.name,
      input.frequency,
      JSON.stringify(input.recipients),
      JSON.stringify(input.deliveryMethods),
      input.scopeType,
      input.scopeValue,
      input.nextRunAt,
    ],
  );
  return mapSchedule(result.rows[0]);
}

export async function updateSchedule(workspaceId: string, scheduleId: string, input: Partial<ReportScheduleRecord>): Promise<ReportScheduleRecord | null> {
  const current = await query(`SELECT * FROM report_schedules WHERE workspace_id = $1 AND id = $2`, [workspaceId, scheduleId]);
  if (!current.rows[0]) return null;
  const row = current.rows[0];
  const result = await query(
    `UPDATE report_schedules
     SET name = $3, frequency = $4, recipients = $5::jsonb, delivery_methods = $6::jsonb,
         scope_type = $7, scope_value = $8, next_run_at = $9, is_active = $10, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      scheduleId,
      input.name ?? row.name,
      input.frequency ?? row.frequency,
      JSON.stringify(input.recipients ?? row.recipients),
      JSON.stringify(input.deliveryMethods ?? row.delivery_methods),
      input.scopeType ?? row.scope_type,
      input.scopeValue ?? row.scope_value,
      input.nextRunAt ?? toIso(row.next_run_at)!,
      input.isActive ?? row.is_active,
    ],
  );
  return mapSchedule(result.rows[0]);
}

export async function listSchedules(workspaceId: string): Promise<ReportScheduleRecord[]> {
  const result = await query(`SELECT * FROM report_schedules WHERE workspace_id = $1 ORDER BY next_run_at ASC`, [workspaceId]);
  return result.rows.map(mapSchedule);
}

export async function createDistribution(input: {
  workspaceId: string;
  reportId: string;
  recipientType: RecipientType;
  recipientValue: string;
  deliveryMethod: DeliveryMethod;
  sentAt?: string | null;
  viewedAt?: string | null;
  downloadedAt?: string | null;
  acknowledgedAt?: string | null;
  secureLinkId?: string | null;
}): Promise<ReportDistributionRecord> {
  const result = await query(
    `INSERT INTO report_distributions (
      id, workspace_id, report_id, recipient_type, recipient_value, delivery_method, sent_at, viewed_at, downloaded_at, acknowledged_at, secure_link_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      generateId('rpdist'),
      input.workspaceId,
      input.reportId,
      input.recipientType,
      input.recipientValue,
      input.deliveryMethod,
      input.sentAt || new Date().toISOString(),
      input.viewedAt || null,
      input.downloadedAt || null,
      input.acknowledgedAt || null,
      input.secureLinkId || null,
    ],
  );
  return mapDistribution(result.rows[0]);
}

export async function listDistributions(workspaceId: string): Promise<ReportDistributionRecord[]> {
  const result = await query(`SELECT * FROM report_distributions WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
  return result.rows.map(mapDistribution);
}

export async function createAttestation(input: {
  workspaceId: string;
  reportId: string;
  approverUserId?: string | null;
  approverName: string;
  decision: AttestationDecision;
  comments?: string | null;
}): Promise<ReportAttestationRecord> {
  const result = await query(
    `INSERT INTO report_attestations (id, workspace_id, report_id, approver_user_id, approver_name, decision, comments)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      generateId('rpatt'),
      input.workspaceId,
      input.reportId,
      input.approverUserId || null,
      input.approverName,
      input.decision,
      input.comments || null,
    ],
  );
  return mapAttestation(result.rows[0]);
}

export async function listAttestations(workspaceId: string): Promise<ReportAttestationRecord[]> {
  const result = await query(`SELECT * FROM report_attestations WHERE workspace_id = $1 ORDER BY attested_at DESC`, [workspaceId]);
  return result.rows.map(mapAttestation);
}

export function getDefaultTemplates() {
  return DEFAULT_TEMPLATES;
}
