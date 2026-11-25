import { generateId, query } from '../db.js';
import type {
  CarbonRecord,
  EnvironmentalMetricRecord,
  EsgAuditRecord,
  EsgBoardView,
  EsgComplianceProgramRecord,
  EsgEvidenceRecord,
  EsgFrameworkRecord,
  EsgIncidentRecord,
  EsgKpiRecord,
  EsgMaturityModel,
  EsgReportRecord,
  EsgReportType,
  EsgRiskRecord,
  EsgState,
  EsgSummary,
  EsgTargetRecord,
  GovernanceMetricRecord,
  SocialMetricRecord,
  SupplierEsgRecord,
} from '../types/esg.js';

type Row = Record<string, unknown>;

function toIso(value: unknown) {
  return new Date(String(value)).toISOString();
}

function num(value: unknown) {
  return Number(value || 0);
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function mapFramework(row: Row): EsgFrameworkRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    code: String(row.code),
    name: String(row.name),
    category: row.category as EsgFrameworkRecord['category'],
    status: row.status as EsgFrameworkRecord['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapEnvironmentalMetric(row: Row): EnvironmentalMetricRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    metricName: String(row.metric_name),
    category: row.category as EnvironmentalMetricRecord['category'],
    unit: String(row.unit),
    currentValue: num(row.current_value),
    targetValue: num(row.target_value),
    trend: row.trend as EnvironmentalMetricRecord['trend'],
    owner: String(row.owner),
    reportingFrequency: row.reporting_frequency as EnvironmentalMetricRecord['reportingFrequency'],
    status: row.status as EnvironmentalMetricRecord['status'],
    recordedAt: toIso(row.recorded_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapCarbonRecord(row: Row): CarbonRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    scope: row.scope as CarbonRecord['scope'],
    sourceName: String(row.source_name),
    tonnesCo2e: num(row.tonnes_co2e),
    intensity: num(row.intensity),
    reportingYear: Number(row.reporting_year),
    targetTonnesCo2e: num(row.target_tonnes_co2e),
    reductionTargetPercent: num(row.reduction_target_percent),
    trend: row.trend as CarbonRecord['trend'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapSocialMetric(row: Row): SocialMetricRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    metricName: String(row.metric_name),
    category: row.category as SocialMetricRecord['category'],
    currentValue: num(row.current_value),
    targetValue: num(row.target_value),
    unit: String(row.unit),
    owner: String(row.owner),
    businessUnit: String(row.business_unit),
    status: row.status as SocialMetricRecord['status'],
    trend: row.trend as SocialMetricRecord['trend'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapGovernanceMetric(row: Row): GovernanceMetricRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    metricName: String(row.metric_name),
    category: row.category as GovernanceMetricRecord['category'],
    currentValue: num(row.current_value),
    targetValue: num(row.target_value),
    unit: String(row.unit),
    owner: String(row.owner),
    status: row.status as GovernanceMetricRecord['status'],
    trend: row.trend as GovernanceMetricRecord['trend'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapRisk(row: Row): EsgRiskRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    category: row.category as EsgRiskRecord['category'],
    severity: row.severity as EsgRiskRecord['severity'],
    status: row.status as EsgRiskRecord['status'],
    owner: String(row.owner),
    riskScore: num(row.risk_score),
    mitigation: String(row.mitigation),
    linkedEnterpriseRiskId: row.linked_enterprise_risk_id ? String(row.linked_enterprise_risk_id) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapKpi(row: Row): EsgKpiRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    kpiName: String(row.kpi_name),
    category: row.category as EsgKpiRecord['category'],
    targetValue: num(row.target_value),
    actualValue: num(row.actual_value),
    variance: num(row.variance),
    trend: row.trend as EsgKpiRecord['trend'],
    owner: String(row.owner),
    businessUnit: String(row.business_unit),
    reportingFrequency: row.reporting_frequency as EsgKpiRecord['reportingFrequency'],
    status: row.status as EsgKpiRecord['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapTarget(row: Row): EsgTargetRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    targetName: String(row.target_name),
    category: row.category as EsgTargetRecord['category'],
    unit: String(row.unit),
    targetValue: num(row.target_value),
    currentValue: num(row.current_value),
    dueDate: toIso(row.due_date),
    owner: String(row.owner),
    status: row.status as EsgTargetRecord['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapSupplier(row: Row): SupplierEsgRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    supplierName: String(row.supplier_name),
    supplierEsgRating: num(row.supplier_esg_rating),
    supplierCarbonScore: num(row.supplier_carbon_score),
    humanRightsCompliance: row.human_rights_compliance as SupplierEsgRecord['humanRightsCompliance'],
    sustainabilityPractices: row.sustainability_practices as SupplierEsgRecord['sustainabilityPractices'],
    environmentalPerformance: row.environmental_performance as SupplierEsgRecord['environmentalPerformance'],
    assessmentStatus: row.assessment_status as SupplierEsgRecord['assessmentStatus'],
    supplierRiskLevel: row.supplier_risk_level as SupplierEsgRecord['supplierRiskLevel'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapIncident(row: Row): EsgIncidentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    incidentType: row.incident_type as EsgIncidentRecord['incidentType'],
    severity: row.severity as EsgIncidentRecord['severity'],
    status: row.status as EsgIncidentRecord['status'],
    owner: String(row.owner),
    linkedDomain: row.linked_domain as EsgIncidentRecord['linkedDomain'],
    summary: String(row.summary),
    occurredAt: toIso(row.occurred_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapAudit(row: Row): EsgAuditRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    auditName: String(row.audit_name),
    auditType: row.audit_type as EsgAuditRecord['auditType'],
    status: row.status as EsgAuditRecord['status'],
    findingsCount: Number(row.findings_count || 0),
    openActions: Number(row.open_actions || 0),
    owner: String(row.owner),
    dueDate: toIso(row.due_date),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapEvidence(row: Row): EsgEvidenceRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    evidenceName: String(row.evidence_name),
    evidenceType: row.evidence_type as EsgEvidenceRecord['evidenceType'],
    owner: String(row.owner),
    status: row.status as EsgEvidenceRecord['status'],
    source: String(row.source),
    linkedFramework: String(row.linked_framework),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapCompliance(row: Row): EsgComplianceProgramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    frameworkCode: String(row.framework_code),
    frameworkName: String(row.framework_name),
    score: num(row.score),
    targetScore: num(row.target_score),
    gapCount: Number(row.gap_count || 0),
    controlCoveragePercent: num(row.control_coverage_percent),
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    assessmentCoveragePercent: num(row.assessment_coverage_percent),
    supplierCoveragePercent: num(row.supplier_coverage_percent),
    policyCoveragePercent: num(row.policy_coverage_percent),
    status: row.status as EsgComplianceProgramRecord['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapReport(row: Row): EsgReportRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    reportType: row.report_type as EsgReportType,
    title: String(row.title),
    status: row.status as EsgReportRecord['status'],
    generatedBy: String(row.generated_by),
    summary: asStringArray(row.summary),
    generatedAt: toIso(row.generated_at),
  };
}

export async function listEsgFrameworks(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_frameworks WHERE workspace_id = $1 ORDER BY name`, [workspaceId]);
  return result.rows.map((row) => mapFramework(row as Row));
}

export async function listEnvironmentalMetrics(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_environmental_metrics WHERE workspace_id = $1 ORDER BY recorded_at DESC, metric_name`, [workspaceId]);
  return result.rows.map((row) => mapEnvironmentalMetric(row as Row));
}

export async function createEnvironmentalMetric(workspaceId: string, input: Partial<EnvironmentalMetricRecord>) {
  const result = await query(
    `INSERT INTO esg_environmental_metrics
     (id, workspace_id, metric_name, category, unit, current_value, target_value, trend, owner, reporting_frequency, status, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.id || generateId('esgenv'),
      workspaceId,
      input.metricName,
      input.category,
      input.unit,
      input.currentValue,
      input.targetValue,
      input.trend,
      input.owner,
      input.reportingFrequency,
      input.status,
      input.recordedAt,
    ],
  );
  return mapEnvironmentalMetric(result.rows[0] as Row);
}

export async function listCarbonRecords(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_carbon_records WHERE workspace_id = $1 ORDER BY reporting_year DESC, scope, source_name`, [workspaceId]);
  return result.rows.map((row) => mapCarbonRecord(row as Row));
}

export async function createCarbonRecord(workspaceId: string, input: Partial<CarbonRecord>) {
  const result = await query(
    `INSERT INTO esg_carbon_records
     (id, workspace_id, scope, source_name, tonnes_co2e, intensity, reporting_year, target_tonnes_co2e, reduction_target_percent, trend)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.id || generateId('esgcarb'),
      workspaceId,
      input.scope,
      input.sourceName,
      input.tonnesCo2e,
      input.intensity,
      input.reportingYear,
      input.targetTonnesCo2e,
      input.reductionTargetPercent,
      input.trend,
    ],
  );
  return mapCarbonRecord(result.rows[0] as Row);
}

export async function listSocialMetrics(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_social_metrics WHERE workspace_id = $1 ORDER BY metric_name`, [workspaceId]);
  return result.rows.map((row) => mapSocialMetric(row as Row));
}

export async function createSocialMetric(workspaceId: string, input: Partial<SocialMetricRecord>) {
  const result = await query(
    `INSERT INTO esg_social_metrics
     (id, workspace_id, metric_name, category, current_value, target_value, unit, owner, business_unit, status, trend)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      input.id || generateId('esgsoc'),
      workspaceId,
      input.metricName,
      input.category,
      input.currentValue,
      input.targetValue,
      input.unit,
      input.owner,
      input.businessUnit,
      input.status,
      input.trend,
    ],
  );
  return mapSocialMetric(result.rows[0] as Row);
}

export async function listGovernanceMetrics(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_governance_metrics WHERE workspace_id = $1 ORDER BY metric_name`, [workspaceId]);
  return result.rows.map((row) => mapGovernanceMetric(row as Row));
}

export async function createGovernanceMetric(workspaceId: string, input: Partial<GovernanceMetricRecord>) {
  const result = await query(
    `INSERT INTO esg_governance_metrics
     (id, workspace_id, metric_name, category, current_value, target_value, unit, owner, status, trend)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.id || generateId('esggov'),
      workspaceId,
      input.metricName,
      input.category,
      input.currentValue,
      input.targetValue,
      input.unit,
      input.owner,
      input.status,
      input.trend,
    ],
  );
  return mapGovernanceMetric(result.rows[0] as Row);
}

export async function listEsgRisks(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_risks WHERE workspace_id = $1 ORDER BY risk_score DESC, title`, [workspaceId]);
  return result.rows.map((row) => mapRisk(row as Row));
}

export async function createEsgRisk(workspaceId: string, input: Partial<EsgRiskRecord>) {
  const result = await query(
    `INSERT INTO esg_risks
     (id, workspace_id, title, category, severity, status, owner, risk_score, mitigation, linked_enterprise_risk_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.id || generateId('esgrisk'),
      workspaceId,
      input.title,
      input.category,
      input.severity,
      input.status,
      input.owner,
      input.riskScore,
      input.mitigation,
      input.linkedEnterpriseRiskId || null,
    ],
  );
  return mapRisk(result.rows[0] as Row);
}

export async function listEsgKpis(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_kpis WHERE workspace_id = $1 ORDER BY category, kpi_name`, [workspaceId]);
  return result.rows.map((row) => mapKpi(row as Row));
}

export async function createEsgKpi(workspaceId: string, input: Partial<EsgKpiRecord>) {
  const variance = Number(input.actualValue) - Number(input.targetValue);
  const result = await query(
    `INSERT INTO esg_kpis
     (id, workspace_id, kpi_name, category, target_value, actual_value, variance, trend, owner, business_unit, reporting_frequency, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.id || generateId('esgkpi'),
      workspaceId,
      input.kpiName,
      input.category,
      input.targetValue,
      input.actualValue,
      input.variance ?? variance,
      input.trend,
      input.owner,
      input.businessUnit,
      input.reportingFrequency,
      input.status,
    ],
  );
  return mapKpi(result.rows[0] as Row);
}

export async function listEsgTargets(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_targets WHERE workspace_id = $1 ORDER BY due_date, target_name`, [workspaceId]);
  return result.rows.map((row) => mapTarget(row as Row));
}

export async function createEsgTarget(workspaceId: string, input: Partial<EsgTargetRecord>) {
  const result = await query(
    `INSERT INTO esg_targets
     (id, workspace_id, target_name, category, unit, target_value, current_value, due_date, owner, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.id || generateId('esgtgt'),
      workspaceId,
      input.targetName,
      input.category,
      input.unit,
      input.targetValue,
      input.currentValue,
      input.dueDate,
      input.owner,
      input.status,
    ],
  );
  return mapTarget(result.rows[0] as Row);
}

export async function listSupplierEsgRecords(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_suppliers WHERE workspace_id = $1 ORDER BY supplier_esg_rating DESC, supplier_name`, [workspaceId]);
  return result.rows.map((row) => mapSupplier(row as Row));
}

export async function createSupplierEsgRecord(workspaceId: string, input: Partial<SupplierEsgRecord>) {
  const result = await query(
    `INSERT INTO esg_suppliers
     (id, workspace_id, supplier_name, supplier_esg_rating, supplier_carbon_score, human_rights_compliance, sustainability_practices, environmental_performance, assessment_status, supplier_risk_level)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.id || generateId('esgsup'),
      workspaceId,
      input.supplierName,
      input.supplierEsgRating,
      input.supplierCarbonScore,
      input.humanRightsCompliance,
      input.sustainabilityPractices,
      input.environmentalPerformance,
      input.assessmentStatus,
      input.supplierRiskLevel,
    ],
  );
  return mapSupplier(result.rows[0] as Row);
}

export async function listEsgIncidents(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_incidents WHERE workspace_id = $1 ORDER BY occurred_at DESC, title`, [workspaceId]);
  return result.rows.map((row) => mapIncident(row as Row));
}

export async function createEsgIncident(workspaceId: string, input: Partial<EsgIncidentRecord>) {
  const result = await query(
    `INSERT INTO esg_incidents
     (id, workspace_id, title, incident_type, severity, status, owner, linked_domain, summary, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      input.id || generateId('esginc'),
      workspaceId,
      input.title,
      input.incidentType,
      input.severity,
      input.status,
      input.owner,
      input.linkedDomain,
      input.summary,
      input.occurredAt,
    ],
  );
  return mapIncident(result.rows[0] as Row);
}

export async function listEsgAudits(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_audits WHERE workspace_id = $1 ORDER BY due_date, audit_name`, [workspaceId]);
  return result.rows.map((row) => mapAudit(row as Row));
}

export async function createEsgAudit(workspaceId: string, input: Partial<EsgAuditRecord>) {
  const result = await query(
    `INSERT INTO esg_audits
     (id, workspace_id, audit_name, audit_type, status, findings_count, open_actions, owner, due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.id || generateId('esgaud'),
      workspaceId,
      input.auditName,
      input.auditType || 'esg',
      input.status,
      input.findingsCount || 0,
      input.openActions || 0,
      input.owner || 'Internal Audit',
      input.dueDate,
    ],
  );
  return mapAudit(result.rows[0] as Row);
}

export async function listEsgEvidence(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_evidence WHERE workspace_id = $1 ORDER BY evidence_name`, [workspaceId]);
  return result.rows.map((row) => mapEvidence(row as Row));
}

export async function createEsgEvidence(workspaceId: string, input: Partial<EsgEvidenceRecord>) {
  const result = await query(
    `INSERT INTO esg_evidence
     (id, workspace_id, evidence_name, evidence_type, owner, status, source, linked_framework)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      input.id || generateId('esgevd'),
      workspaceId,
      input.evidenceName,
      input.evidenceType || 'compliance_evidence',
      input.owner,
      input.status,
      input.source || 'Manual upload',
      input.linkedFramework || 'GRI',
    ],
  );
  return mapEvidence(result.rows[0] as Row);
}

export async function listEsgCompliancePrograms(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_compliance_programs WHERE workspace_id = $1 ORDER BY framework_name`, [workspaceId]);
  return result.rows.map((row) => mapCompliance(row as Row));
}

export async function upsertEsgComplianceProgram(workspaceId: string, input: Partial<EsgComplianceProgramRecord>) {
  const result = await query(
    `INSERT INTO esg_compliance_programs
     (id, workspace_id, framework_code, framework_name, score, target_score, gap_count, control_coverage_percent, evidence_coverage_percent, assessment_coverage_percent, supplier_coverage_percent, policy_coverage_percent, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (workspace_id, framework_code)
     DO UPDATE SET framework_name = EXCLUDED.framework_name,
                   score = EXCLUDED.score,
                   target_score = EXCLUDED.target_score,
                   gap_count = EXCLUDED.gap_count,
                   control_coverage_percent = EXCLUDED.control_coverage_percent,
                   evidence_coverage_percent = EXCLUDED.evidence_coverage_percent,
                   assessment_coverage_percent = EXCLUDED.assessment_coverage_percent,
                   supplier_coverage_percent = EXCLUDED.supplier_coverage_percent,
                   policy_coverage_percent = EXCLUDED.policy_coverage_percent,
                   status = EXCLUDED.status,
                   updated_at = NOW()
     RETURNING *`,
    [
      input.id || generateId('esgcmp'),
      workspaceId,
      input.frameworkCode,
      input.frameworkName,
      input.score || 0,
      input.targetScore || 0,
      input.gapCount || 0,
      input.controlCoveragePercent || 0,
      input.evidenceCoveragePercent || 0,
      input.assessmentCoveragePercent || 0,
      input.supplierCoveragePercent || 0,
      input.policyCoveragePercent || 0,
      input.status || 'watch',
    ],
  );
  return mapCompliance(result.rows[0] as Row);
}

export async function listEsgReports(workspaceId: string) {
  const result = await query(`SELECT * FROM esg_reports WHERE workspace_id = $1 ORDER BY generated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapReport(row as Row));
}

export async function createEsgReport(workspaceId: string, input: Partial<EsgReportRecord>) {
  const result = await query(
    `INSERT INTO esg_reports (id, workspace_id, report_type, title, status, generated_by, summary, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [
      input.id || generateId('esgrpt'),
      workspaceId,
      input.reportType,
      input.title,
      input.status || 'generated',
      input.generatedBy || 'System',
      JSON.stringify(input.summary || []),
      input.generatedAt || new Date().toISOString(),
    ],
  );
  return mapReport(result.rows[0] as Row);
}

function buildSummary(
  environmentalMetrics: EnvironmentalMetricRecord[],
  carbonRecords: CarbonRecord[],
  socialMetrics: SocialMetricRecord[],
  governanceMetrics: GovernanceMetricRecord[],
  risks: EsgRiskRecord[],
  targets: EsgTargetRecord[],
  suppliers: SupplierEsgRecord[],
  compliancePrograms: EsgComplianceProgramRecord[],
): EsgSummary {
  const environmentalScore = clamp(100 - avg(environmentalMetrics.map((metric) => {
    const variance = metric.targetValue === 0 ? metric.currentValue : ((metric.currentValue - metric.targetValue) / Math.max(metric.targetValue, 1)) * 100;
    return Math.max(0, variance);
  })));
  const socialScore = clamp(avg(socialMetrics.map((metric) => (metric.currentValue / Math.max(metric.targetValue, 1)) * 100)));
  const governanceScore = clamp(avg(governanceMetrics.map((metric) => (metric.currentValue / Math.max(metric.targetValue, 1)) * 100)));
  const carbonFootprint = Math.round(carbonRecords.reduce((sum, record) => sum + record.tonnesCo2e, 0));
  const esgRiskExposure = clamp(avg(risks.map((risk) => risk.riskScore)));
  const supplierEsgRating = clamp(avg(suppliers.map((supplier) => supplier.supplierEsgRating)));
  const sustainabilityTargetProgress = clamp(avg(targets.map((target) => (target.currentValue / Math.max(target.targetValue, 1)) * 100)));
  const complianceStatus = clamp(avg(compliancePrograms.map((program) => program.score)));
  const boardReadiness = clamp(avg([complianceStatus, 100 - esgRiskExposure, supplierEsgRating, sustainabilityTargetProgress]));
  const overallScore = clamp(avg([environmentalScore, socialScore, governanceScore, complianceStatus]));

  return {
    overallScore,
    environmentalScore,
    socialScore,
    governanceScore,
    carbonFootprint,
    esgRiskExposure,
    supplierEsgRating,
    sustainabilityTargetProgress,
    complianceStatus,
    boardReadiness,
  };
}

function buildMaturity(summary: EsgSummary): EsgMaturityModel {
  const score = summary.overallScore;
  const level =
    score >= 86 ? 'Optimized' :
    score >= 76 ? 'Managed' :
    score >= 61 ? 'Defined' :
    score >= 41 ? 'Developing' :
    'Initial';

  return {
    level,
    score,
    strengths: [
      `Governance score at ${summary.governanceScore}%`,
      `Supplier ESG average at ${summary.supplierEsgRating}%`,
      `Board readiness tracking at ${summary.boardReadiness}%`,
    ],
    priorities: [
      'Lift CSRD and ISSB evidence coverage.',
      'Reduce Scope 3 emissions and supplier disclosure gaps.',
      'Close open social and ethics incident remediation actions.',
    ],
  };
}

function buildBoardView(summary: EsgSummary, risks: EsgRiskRecord[], audits: EsgAuditRecord[]): EsgBoardView {
  return {
    topRisks: risks.slice(0, 3).map((risk) => `${risk.title} (${risk.riskScore})`),
    carbonProgress: `${summary.carbonFootprint} tCO2e total, reduction program ${summary.sustainabilityTargetProgress}% complete`,
    supplierExposure: `${risks.filter((risk) => risk.category === 'supply_chain').length} supply-chain risks, supplier ESG ${summary.supplierEsgRating}%`,
    complianceStatus: `${summary.complianceStatus}% average ESG framework readiness`,
    targetAchievement: `${summary.sustainabilityTargetProgress}% target progress across active commitments`,
    openFindings: audits.reduce((sum, audit) => sum + audit.findingsCount, 0),
  };
}

export async function getEsgState(workspaceId: string): Promise<EsgState> {

  const [
    frameworks,
    environmentalMetrics,
    carbonRecords,
    socialMetrics,
    governanceMetrics,
    risks,
    kpis,
    targets,
    suppliers,
    incidents,
    audits,
    evidence,
    compliancePrograms,
    reports,
  ] = await Promise.all([
    listEsgFrameworks(workspaceId),
    listEnvironmentalMetrics(workspaceId),
    listCarbonRecords(workspaceId),
    listSocialMetrics(workspaceId),
    listGovernanceMetrics(workspaceId),
    listEsgRisks(workspaceId),
    listEsgKpis(workspaceId),
    listEsgTargets(workspaceId),
    listSupplierEsgRecords(workspaceId),
    listEsgIncidents(workspaceId),
    listEsgAudits(workspaceId),
    listEsgEvidence(workspaceId),
    listEsgCompliancePrograms(workspaceId),
    listEsgReports(workspaceId),
  ]);

  const summary = buildSummary(environmentalMetrics, carbonRecords, socialMetrics, governanceMetrics, risks, targets, suppliers, compliancePrograms);

  return {
    summary,
    frameworks,
    environmentalMetrics,
    carbonRecords,
    socialMetrics,
    governanceMetrics,
    risks,
    kpis,
    targets,
    suppliers,
    incidents,
    audits,
    evidence,
    compliancePrograms,
    reports,
    analytics: {
      esgTrend: [
        { month: 'Jan', score: 64 },
        { month: 'Feb', score: 66 },
        { month: 'Mar', score: 69 },
        { month: 'Apr', score: 71 },
        { month: 'May', score: 73 },
        { month: 'Jun', score: summary.overallScore },
      ],
      carbonTrend: [
        { month: 'Jan', tonnesCo2e: 3480 },
        { month: 'Feb', tonnesCo2e: 3402 },
        { month: 'Mar', tonnesCo2e: 3370 },
        { month: 'Apr', tonnesCo2e: 3325 },
        { month: 'May', tonnesCo2e: 3280 },
        { month: 'Jun', tonnesCo2e: summary.carbonFootprint },
      ],
      supplierDistribution: [
        { label: 'High', value: suppliers.filter((item) => item.supplierRiskLevel === 'high' || item.supplierRiskLevel === 'critical').length },
        { label: 'Medium', value: suppliers.filter((item) => item.supplierRiskLevel === 'medium').length },
        { label: 'Low', value: suppliers.filter((item) => item.supplierRiskLevel === 'low').length },
      ],
      sustainabilityProgress: targets.map((target) => ({
        target: target.targetName,
        progress: clamp((target.currentValue / Math.max(target.targetValue, 1)) * 100),
      })),
      riskHeatmap: risks.map((risk) => ({ category: risk.category.replace(/_/g, ' '), riskScore: risk.riskScore })),
    },
    maturity: buildMaturity(summary),
    boardView: buildBoardView(summary, risks, audits),
  };
}
