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

export async function ensureEsgSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS esg_frameworks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, code)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_environmental_metrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      trend TEXT NOT NULL,
      owner TEXT NOT NULL,
      reporting_frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_carbon_records (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      source_name TEXT NOT NULL,
      tonnes_co2e NUMERIC(12,2) NOT NULL DEFAULT 0,
      intensity NUMERIC(12,2) NOT NULL DEFAULT 0,
      reporting_year INTEGER NOT NULL,
      target_tonnes_co2e NUMERIC(12,2) NOT NULL DEFAULT 0,
      reduction_target_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_social_metrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      status TEXT NOT NULL,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_governance_metrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      trend TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_risks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      risk_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      mitigation TEXT NOT NULL,
      linked_enterprise_risk_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_kpis (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      kpi_name TEXT NOT NULL,
      category TEXT NOT NULL,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      actual_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      variance NUMERIC(12,2) NOT NULL DEFAULT 0,
      trend TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      reporting_frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_targets (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      due_date TIMESTAMPTZ NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_suppliers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_esg_rating NUMERIC(12,2) NOT NULL DEFAULT 0,
      supplier_carbon_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      human_rights_compliance TEXT NOT NULL,
      sustainability_practices TEXT NOT NULL,
      environmental_performance TEXT NOT NULL,
      assessment_status TEXT NOT NULL,
      supplier_risk_level TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_incidents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      linked_domain TEXT NOT NULL,
      summary TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_audits (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      audit_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      status TEXT NOT NULL,
      findings_count INTEGER NOT NULL DEFAULT 0,
      open_actions INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_evidence (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      evidence_name TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      linked_framework TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_compliance_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework_code TEXT NOT NULL,
      framework_name TEXT NOT NULL,
      score NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_score NUMERIC(12,2) NOT NULL DEFAULT 0,
      gap_count INTEGER NOT NULL DEFAULT 0,
      control_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      evidence_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      assessment_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      supplier_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      policy_coverage_percent NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework_code)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS esg_reports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      generated_by TEXT NOT NULL,
      summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function countForWorkspace(tableName: string, workspaceId: string) {
  const result = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${tableName} WHERE workspace_id = $1`, [workspaceId]);
  return Number(result.rows[0]?.count || 0);
}

export async function seedEsgDefaults(workspaceId: string): Promise<void> {
  if ((await countForWorkspace('esg_frameworks', workspaceId)) > 0) {
    return;
  }

  const frameworks = [
    ['GRI', 'Global Reporting Initiative', 'reporting'],
    ['SASB', 'SASB Standards', 'reporting'],
    ['ISSB', 'International Sustainability Standards Board', 'reporting'],
    ['CSRD', 'Corporate Sustainability Reporting Directive', 'reporting'],
    ['TCFD', 'Task Force on Climate-related Financial Disclosures', 'environmental'],
    ['UNGC', 'UN Global Compact', 'social'],
    ['SDG', 'UN Sustainable Development Goals', 'social'],
    ['CDP', 'Carbon Disclosure Project', 'environmental'],
    ['GHG', 'GHG Protocol', 'environmental'],
    ['IR', 'Integrated Reporting', 'governance'],
  ];
  for (const [code, name, category] of frameworks) {
    await query(
      `INSERT INTO esg_frameworks (id, workspace_id, code, name, category, status)
       VALUES ($1,$2,$3,$4,$5,'active')`,
      [generateId('esgfw'), workspaceId, code, name, category],
    );
  }

  const environmentalMetrics: Array<Partial<EnvironmentalMetricRecord>> = [
    { metricName: 'Energy Consumption', category: 'energy', unit: 'MWh', currentValue: 1480, targetValue: 1320, trend: 'down', owner: 'Environmental Manager', reportingFrequency: 'monthly', status: 'watch', recordedAt: new Date('2026-05-31').toISOString() },
    { metricName: 'Water Usage', category: 'water', unit: 'm3', currentValue: 620, targetValue: 540, trend: 'down', owner: 'Facilities Lead', reportingFrequency: 'monthly', status: 'watch', recordedAt: new Date('2026-05-31').toISOString() },
    { metricName: 'Waste Recycled', category: 'recycling', unit: '%', currentValue: 71, targetValue: 80, trend: 'up', owner: 'Sustainability Manager', reportingFrequency: 'quarterly', status: 'in_progress', recordedAt: new Date('2026-05-31').toISOString() },
    { metricName: 'Environmental Incidents', category: 'incident', unit: 'count', currentValue: 2, targetValue: 0, trend: 'flat', owner: 'HSSE Director', reportingFrequency: 'quarterly', status: 'critical', recordedAt: new Date('2026-05-31').toISOString() },
  ];
  for (const item of environmentalMetrics) {
    await createEnvironmentalMetric(workspaceId, item);
  }

  const carbonRecords: Array<Partial<CarbonRecord>> = [
    { scope: 'scope_1', sourceName: 'Fleet fuel usage', tonnesCo2e: 420, intensity: 18, reportingYear: 2026, targetTonnesCo2e: 360, reductionTargetPercent: 14, trend: 'down' },
    { scope: 'scope_2', sourceName: 'Purchased electricity', tonnesCo2e: 880, intensity: 29, reportingYear: 2026, targetTonnesCo2e: 760, reductionTargetPercent: 12, trend: 'down' },
    { scope: 'scope_3', sourceName: 'Supply chain and travel', tonnesCo2e: 1940, intensity: 61, reportingYear: 2026, targetTonnesCo2e: 1700, reductionTargetPercent: 10, trend: 'flat' },
  ];
  for (const item of carbonRecords) {
    await createCarbonRecord(workspaceId, item);
  }

  const socialMetrics: Array<Partial<SocialMetricRecord>> = [
    { metricName: 'Women in leadership', category: 'dei', currentValue: 38, targetValue: 45, unit: '%', owner: 'Chief People Officer', businessUnit: 'Enterprise', status: 'in_progress', trend: 'up' },
    { metricName: 'Annual ethics training completion', category: 'training', currentValue: 92, targetValue: 98, unit: '%', owner: 'Learning Director', businessUnit: 'Enterprise', status: 'watch', trend: 'up' },
    { metricName: 'Lost-time incident rate', category: 'health_safety', currentValue: 1.1, targetValue: 0.4, unit: 'rate', owner: 'HSSE Director', businessUnit: 'Operations', status: 'critical', trend: 'flat' },
  ];
  for (const item of socialMetrics) {
    await createSocialMetric(workspaceId, item);
  }

  const governanceMetrics: Array<Partial<GovernanceMetricRecord>> = [
    { metricName: 'Independent board seats', category: 'board', currentValue: 62, targetValue: 70, unit: '%', owner: 'Corporate Secretary', status: 'watch', trend: 'up' },
    { metricName: 'Code of conduct attestation', category: 'conduct', currentValue: 96, targetValue: 100, unit: '%', owner: 'Chief Compliance Officer', status: 'healthy', trend: 'flat' },
    { metricName: 'Whistleblower case closure SLA', category: 'whistleblowing', currentValue: 81, targetValue: 95, unit: '%', owner: 'Ethics Office', status: 'watch', trend: 'up' },
  ];
  for (const item of governanceMetrics) {
    await createGovernanceMetric(workspaceId, item);
  }

  const risks: Array<Partial<EsgRiskRecord>> = [
    { title: 'Climate transition risk', category: 'climate', severity: 'high', status: 'mitigating', owner: 'Chief Risk Officer', riskScore: 78, mitigation: 'Accelerate energy efficiency roadmap and supplier decarbonization clauses.', linkedEnterpriseRiskId: 'risk-climate-transition' },
    { title: 'Human rights oversight gap', category: 'human_rights', severity: 'high', status: 'assessed', owner: 'Supply Chain Director', riskScore: 72, mitigation: 'Extend due diligence to tier-two suppliers and refresh remediation attestations.' },
    { title: 'Ethics hotline case backlog', category: 'ethics', severity: 'medium', status: 'identified', owner: 'Chief Compliance Officer', riskScore: 59, mitigation: 'Add triage reviewers and streamline investigation workflow.' },
    { title: 'Supplier carbon disclosure weakness', category: 'supply_chain', severity: 'high', status: 'mitigating', owner: 'Vendor Risk Lead', riskScore: 74, mitigation: 'Require carbon inventory disclosure for strategic suppliers.' },
  ];
  for (const item of risks) {
    await createEsgRisk(workspaceId, item);
  }

  const kpis: Array<Partial<EsgKpiRecord>> = [
    { kpiName: 'Carbon intensity', category: 'carbon', targetValue: 52, actualValue: 58, variance: -6, trend: 'down', owner: 'Sustainability Manager', businessUnit: 'Enterprise', reportingFrequency: 'quarterly', status: 'watch' },
    { kpiName: 'Supplier ESG coverage', category: 'supplier', targetValue: 90, actualValue: 74, variance: -16, trend: 'up', owner: 'Vendor Risk Lead', businessUnit: 'Procurement', reportingFrequency: 'quarterly', status: 'watch' },
    { kpiName: 'ESG control coverage', category: 'compliance', targetValue: 88, actualValue: 81, variance: -7, trend: 'up', owner: 'GRC Manager', businessUnit: 'GRC', reportingFrequency: 'monthly', status: 'in_progress' },
  ];
  for (const item of kpis) {
    await createEsgKpi(workspaceId, item);
  }

  const targets: Array<Partial<EsgTargetRecord>> = [
    { targetName: 'Net zero pathway', category: 'net_zero', unit: '%', targetValue: 100, currentValue: 41, dueDate: new Date('2030-12-31').toISOString(), owner: 'Sustainability Manager', status: 'in_progress' },
    { targetName: 'Leadership diversity uplift', category: 'diversity', unit: '%', targetValue: 45, currentValue: 38, dueDate: new Date('2027-12-31').toISOString(), owner: 'Chief People Officer', status: 'in_progress' },
    { targetName: 'Supplier ESG assessments complete', category: 'sustainability', unit: '%', targetValue: 95, currentValue: 74, dueDate: new Date('2026-12-31').toISOString(), owner: 'Vendor Risk Lead', status: 'watch' },
  ];
  for (const item of targets) {
    await createEsgTarget(workspaceId, item);
  }

  const suppliers: Array<Partial<SupplierEsgRecord>> = [
    { supplierName: 'Northwind Logistics', supplierEsgRating: 76, supplierCarbonScore: 68, humanRightsCompliance: 'healthy', sustainabilityPractices: 'watch', environmentalPerformance: 'watch', assessmentStatus: 'in_progress', supplierRiskLevel: 'medium' },
    { supplierName: 'BluePeak Manufacturing', supplierEsgRating: 61, supplierCarbonScore: 54, humanRightsCompliance: 'watch', sustainabilityPractices: 'critical', environmentalPerformance: 'critical', assessmentStatus: 'open', supplierRiskLevel: 'high' },
    { supplierName: 'Aster Digital Services', supplierEsgRating: 84, supplierCarbonScore: 79, humanRightsCompliance: 'healthy', sustainabilityPractices: 'healthy', environmentalPerformance: 'healthy', assessmentStatus: 'complete', supplierRiskLevel: 'low' },
  ];
  for (const item of suppliers) {
    await createSupplierEsgRecord(workspaceId, item);
  }

  const incidents: Array<Partial<EsgIncidentRecord>> = [
    { title: 'Community complaint on waste disposal', incidentType: 'community', severity: 'medium', status: 'investigating', owner: 'Environmental Manager', linkedDomain: 'compliance', summary: 'Local complaint raised regarding temporary waste storage outside designated containment zone.', occurredAt: new Date('2026-05-14').toISOString() },
    { title: 'Supplier labor allegation', incidentType: 'supplier', severity: 'high', status: 'remediating', owner: 'Vendor Risk Lead', linkedDomain: 'risk', summary: 'Allegation of excessive working hours at a subcontracted production facility.', occurredAt: new Date('2026-04-25').toISOString() },
  ];
  for (const item of incidents) {
    await createEsgIncident(workspaceId, item);
  }

  const audits: Array<Partial<EsgAuditRecord>> = [
    { auditName: 'CSRD readiness review', auditType: 'esg', status: 'in_progress', findingsCount: 6, openActions: 11, owner: 'Head of Internal Audit', dueDate: new Date('2026-09-30').toISOString() },
    { auditName: 'Supplier ESG deep dive', auditType: 'supplier', status: 'planned', findingsCount: 0, openActions: 4, owner: 'Third Party Audit Lead', dueDate: new Date('2026-08-15').toISOString() },
  ];
  for (const item of audits) {
    await createEsgAudit(workspaceId, item);
  }

  const evidenceItems: Array<Partial<EsgEvidenceRecord>> = [
    { evidenceName: 'Q2 Energy Ledger', evidenceType: 'energy_record', owner: 'Facilities Lead', status: 'healthy', source: 'Utility provider', linkedFramework: 'GRI' },
    { evidenceName: 'Scope 3 Travel Analysis', evidenceType: 'carbon_report', owner: 'Sustainability Analyst', status: 'watch', source: 'Travel management data', linkedFramework: 'GHG' },
    { evidenceName: 'Supplier human rights attestation pack', evidenceType: 'supplier_assessment', owner: 'Vendor Risk Lead', status: 'watch', source: 'Supplier portal', linkedFramework: 'UNGC' },
  ];
  for (const item of evidenceItems) {
    await createEsgEvidence(workspaceId, item);
  }

  const programs: Array<Partial<EsgComplianceProgramRecord>> = [
    { frameworkCode: 'CSRD', frameworkName: 'CSRD', score: 69, targetScore: 88, gapCount: 9, controlCoveragePercent: 73, evidenceCoveragePercent: 66, assessmentCoveragePercent: 61, supplierCoveragePercent: 58, policyCoveragePercent: 75, status: 'critical' },
    { frameworkCode: 'ISSB', frameworkName: 'ISSB', score: 77, targetScore: 90, gapCount: 5, controlCoveragePercent: 81, evidenceCoveragePercent: 76, assessmentCoveragePercent: 74, supplierCoveragePercent: 70, policyCoveragePercent: 84, status: 'watch' },
    { frameworkCode: 'GRI', frameworkName: 'GRI', score: 83, targetScore: 90, gapCount: 3, controlCoveragePercent: 86, evidenceCoveragePercent: 81, assessmentCoveragePercent: 80, supplierCoveragePercent: 74, policyCoveragePercent: 87, status: 'watch' },
  ];
  for (const item of programs) {
    await upsertEsgComplianceProgram(workspaceId, item);
  }

  await createEsgReport(workspaceId, {
    reportType: 'board_esg_report',
    title: 'Board ESG Readiness Pack - Q2',
    generatedBy: 'System',
    status: 'approved',
    summary: ['Board readiness improved to 79%.', 'Supplier ESG coverage remains the largest drag on overall performance.', 'Carbon intensity is improving but still above the reduction trajectory.'],
  });
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
      input.category || 'kpi',
      input.unit || 'value',
      input.currentValue || 0,
      input.targetValue || 0,
      input.trend || 'flat',
      input.owner || 'ESG Office',
      input.reportingFrequency || 'monthly',
      input.status || 'planned',
      input.recordedAt || new Date().toISOString(),
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
      input.scope || 'scope_3',
      input.sourceName || 'New source',
      input.tonnesCo2e || 0,
      input.intensity || 0,
      input.reportingYear || new Date().getUTCFullYear(),
      input.targetTonnesCo2e || 0,
      input.reductionTargetPercent || 0,
      input.trend || 'flat',
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
      input.category || 'training',
      input.currentValue || 0,
      input.targetValue || 0,
      input.unit || '%',
      input.owner || 'ESG Office',
      input.businessUnit || 'Enterprise',
      input.status || 'planned',
      input.trend || 'flat',
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
      input.category || 'policy',
      input.currentValue || 0,
      input.targetValue || 0,
      input.unit || '%',
      input.owner || 'ESG Office',
      input.status || 'planned',
      input.trend || 'flat',
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
      input.category || 'sustainability',
      input.severity || 'medium',
      input.status || 'identified',
      input.owner || 'ESG Office',
      input.riskScore || 0,
      input.mitigation || '',
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
  const variance = (input.actualValue || 0) - (input.targetValue || 0);
  const result = await query(
    `INSERT INTO esg_kpis
     (id, workspace_id, kpi_name, category, target_value, actual_value, variance, trend, owner, business_unit, reporting_frequency, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.id || generateId('esgkpi'),
      workspaceId,
      input.kpiName,
      input.category || 'compliance',
      input.targetValue || 0,
      input.actualValue || 0,
      input.variance ?? variance,
      input.trend || 'flat',
      input.owner || 'ESG Office',
      input.businessUnit || 'Enterprise',
      input.reportingFrequency || 'quarterly',
      input.status || 'planned',
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
      input.category || 'sustainability',
      input.unit || '%',
      input.targetValue || 0,
      input.currentValue || 0,
      input.dueDate || new Date().toISOString(),
      input.owner || 'ESG Office',
      input.status || 'planned',
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
      input.supplierEsgRating || 0,
      input.supplierCarbonScore || 0,
      input.humanRightsCompliance || 'watch',
      input.sustainabilityPractices || 'watch',
      input.environmentalPerformance || 'watch',
      input.assessmentStatus || 'planned',
      input.supplierRiskLevel || 'medium',
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
      input.incidentType || 'environmental',
      input.severity || 'medium',
      input.status || 'open',
      input.owner || 'ESG Office',
      input.linkedDomain || 'activity_ledger',
      input.summary || '',
      input.occurredAt || new Date().toISOString(),
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
      input.status || 'planned',
      input.findingsCount || 0,
      input.openActions || 0,
      input.owner || 'Internal Audit',
      input.dueDate || new Date().toISOString(),
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
      input.owner || 'ESG Office',
      input.status || 'planned',
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
  await seedEsgDefaults(workspaceId);

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
