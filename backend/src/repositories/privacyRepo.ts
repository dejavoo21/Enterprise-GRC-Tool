import { generateId, query } from '../db.js';
import type {
  ConsentRecord,
  DataDiscoveryRecord,
  DataGovernanceRecord,
  DataInventoryRecord,
  DataLineageRecord,
  DataQualityRecord,
  DataTransferRecord,
  DpiaRecord,
  DsarRecord,
  PrivacyAuditRecord,
  PrivacyBreachRecord,
  PrivacyClassification,
  PrivacyComplianceProgramRecord,
  PrivacyControlRecord,
  PrivacyExecutiveView,
  PrivacyFrameworkRecord,
  PrivacyReportRecord,
  PrivacyReportType,
  PrivacyRiskRecord,
  PrivacyState,
  PrivacyStatus,
  PrivacySummary,
  RetentionRecord,
  RopaRecord,
  ThirdPartyPrivacyRecord,
} from '../types/privacy.js';

type Row = Record<string, unknown>;

const toIso = (value: unknown) => new Date(String(value)).toISOString();
const num = (value: unknown) => Number(value || 0);
const avg = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const asArray = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item)) : []);

function mapFramework(row: Row): PrivacyFrameworkRecord {
  return { id: String(row.id), workspaceId: String(row.workspace_id), code: String(row.code), name: String(row.name), status: row.status as PrivacyFrameworkRecord['status'], createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at) };
}
function mapInventory(row: Row): DataInventoryRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    dataAssetId: String(row.data_asset_id),
    dataAssetName: String(row.data_asset_name),
    businessOwner: String(row.business_owner),
    custodian: String(row.custodian),
    location: String(row.location),
    systemName: String(row.system_name),
    application: String(row.application),
    department: String(row.department),
    country: String(row.country),
    jurisdiction: String(row.jurisdiction),
    dataCategory: String(row.data_category),
    sensitivityLevel: String(row.sensitivity_level),
    classification: row.classification as PrivacyClassification,
    retentionRequirement: String(row.retention_requirement),
    legalBasis: String(row.legal_basis),
    status: row.status as PrivacyStatus,
    classificationRiskScore: num(row.classification_risk_score),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapRopa(row: Row): RopaRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    processingActivity: String(row.processing_activity),
    purpose: String(row.purpose),
    legalBasis: String(row.legal_basis),
    dataCategories: asArray(row.data_categories),
    dataSubjects: asArray(row.data_subjects),
    recipients: asArray(row.recipients),
    crossBorderTransfers: asArray(row.cross_border_transfers),
    retentionPeriod: String(row.retention_period),
    securityMeasures: asArray(row.security_measures),
    controllers: asArray(row.controllers),
    processors: asArray(row.processors),
    reviewDate: toIso(row.review_date),
    status: row.status as PrivacyStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapDpia(row: Row): DpiaRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    assessmentName: String(row.assessment_name),
    owner: String(row.owner),
    purpose: String(row.purpose),
    riskRating: row.risk_rating as DpiaRecord['riskRating'],
    likelihood: num(row.likelihood),
    impact: num(row.impact),
    controls: asArray(row.controls),
    residualRisk: num(row.residual_risk),
    approvalStatus: row.approval_status as DpiaRecord['approvalStatus'],
    reviewDate: toIso(row.review_date),
    evidence: asArray(row.evidence),
    linkedRiskIds: asArray(row.linked_risk_ids),
    linkedControlIds: asArray(row.linked_control_ids),
    linkedAssetIds: asArray(row.linked_asset_ids),
    linkedAiSystemIds: asArray(row.linked_ai_system_ids),
    linkedVendorIds: asArray(row.linked_vendor_ids),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapRisk(row: Row): PrivacyRiskRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    category: row.category as PrivacyRiskRecord['category'],
    severity: row.severity as PrivacyRiskRecord['severity'],
    status: row.status as PrivacyRiskRecord['status'],
    owner: String(row.owner),
    riskScore: num(row.risk_score),
    mitigation: String(row.mitigation),
    linkedEnterpriseRiskId: row.linked_enterprise_risk_id ? String(row.linked_enterprise_risk_id) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapConsent(row: Row): ConsentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    consentType: String(row.consent_type),
    purpose: String(row.purpose),
    dataSubject: String(row.data_subject),
    collectionMethod: String(row.collection_method),
    dateCollected: toIso(row.date_collected),
    expirationDate: row.expiration_date ? toIso(row.expiration_date) : null,
    withdrawalDate: row.withdrawal_date ? toIso(row.withdrawal_date) : null,
    status: row.status as ConsentRecord['status'],
    evidence: String(row.evidence),
    consentHistory: asArray(row.consent_history),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapDsar(row: Row): DsarRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    requestId: String(row.request_id),
    requestType: row.request_type as DsarRecord['requestType'],
    dataSubject: String(row.data_subject),
    submissionDate: toIso(row.submission_date),
    dueDate: toIso(row.due_date),
    status: row.status as DsarRecord['status'],
    owner: String(row.owner),
    evidence: asArray(row.evidence),
    completionDate: row.completion_date ? toIso(row.completion_date) : null,
    slaCompliant: Boolean(row.sla_compliant),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapBreach(row: Row): PrivacyBreachRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    breachType: String(row.breach_type),
    discoveryDate: toIso(row.discovery_date),
    affectedRecords: Number(row.affected_records || 0),
    affectedIndividuals: Number(row.affected_individuals || 0),
    rootCause: String(row.root_cause),
    riskLevel: row.risk_level as PrivacyBreachRecord['riskLevel'],
    regulatorNotificationStatus: row.regulator_notification_status as PrivacyBreachRecord['regulatorNotificationStatus'],
    customerNotificationStatus: row.customer_notification_status as PrivacyBreachRecord['customerNotificationStatus'],
    remediation: String(row.remediation),
    status: row.status as PrivacyBreachRecord['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapRetention(row: Row): RetentionRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    assetName: String(row.asset_name),
    retentionPeriod: String(row.retention_period),
    legalHold: Boolean(row.legal_hold),
    deletionSchedule: String(row.deletion_schedule),
    archiveStatus: row.archive_status as PrivacyStatus,
    disposalStatus: row.disposal_status as PrivacyStatus,
    reviewDate: toIso(row.review_date),
    violationStatus: row.violation_status as PrivacyStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapTransfer(row: Row): DataTransferRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    transferName: String(row.transfer_name),
    transferType: row.transfer_type as DataTransferRecord['transferType'],
    transferMechanism: String(row.transfer_mechanism),
    jurisdiction: String(row.jurisdiction),
    sccInPlace: Boolean(row.scc_in_place),
    bcrInPlace: Boolean(row.bcr_in_place),
    transferRiskRating: row.transfer_risk_rating as DataTransferRecord['transferRiskRating'],
    reviewDate: toIso(row.review_date),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapThirdParty(row: Row): ThirdPartyPrivacyRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    vendorName: String(row.vendor_name),
    role: row.role as ThirdPartyPrivacyRecord['role'],
    privacyAssessmentStatus: row.privacy_assessment_status as PrivacyStatus,
    dataTransferRisk: row.data_transfer_risk as ThirdPartyPrivacyRecord['dataTransferRisk'],
    dpaStatus: row.dpa_status as PrivacyStatus,
    complianceRating: num(row.compliance_rating),
    privacyIncidentCount: Number(row.privacy_incident_count || 0),
    contractClauses: asArray(row.contract_clauses),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapControl(row: Row): PrivacyControlRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    controlName: String(row.control_name),
    category: row.category as PrivacyControlRecord['category'],
    mappedFrameworks: asArray(row.mapped_frameworks),
    status: row.status as PrivacyStatus,
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapGovernance(row: Row): DataGovernanceRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    dataDomain: String(row.data_domain),
    dataOwner: String(row.data_owner),
    dataSteward: String(row.data_steward),
    dataCustodian: String(row.data_custodian),
    dataQualityScore: num(row.data_quality_score),
    lifecycleStage: String(row.lifecycle_stage),
    glossaryTerm: String(row.glossary_term),
    status: row.status as PrivacyStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapLineage(row: Row): DataLineageRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    lineageName: String(row.lineage_name),
    source: String(row.source),
    transformation: String(row.transformation),
    processing: String(row.processing),
    storage: String(row.storage),
    sharing: String(row.sharing),
    retention: String(row.retention),
    disposal: String(row.disposal),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapQuality(row: Row): DataQualityRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    datasetName: String(row.dataset_name),
    completeness: num(row.completeness),
    accuracy: num(row.accuracy),
    consistency: num(row.consistency),
    timeliness: num(row.timeliness),
    validity: num(row.validity),
    uniqueness: num(row.uniqueness),
    qualityScore: num(row.quality_score),
    remediationAction: String(row.remediation_action),
    status: row.status as PrivacyStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapDiscovery(row: Row): DataDiscoveryRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    repositoryName: String(row.repository_name),
    repositoryType: row.repository_type as DataDiscoveryRecord['repositoryType'],
    piiLocations: asArray(row.pii_locations),
    sensitiveDataLocations: asArray(row.sensitive_data_locations),
    dataFlowMapping: asArray(row.data_flow_mapping),
    owner: String(row.owner),
    status: row.status as PrivacyStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapCompliance(row: Row): PrivacyComplianceProgramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    frameworkCode: String(row.framework_code),
    frameworkName: String(row.framework_name),
    score: num(row.score),
    targetScore: num(row.target_score),
    gapCount: Number(row.gap_count || 0),
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    riskExposureScore: num(row.risk_exposure_score),
    controlCoveragePercent: num(row.control_coverage_percent),
    readinessPercent: num(row.readiness_percent),
    status: row.status as PrivacyComplianceProgramRecord['status'],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapAudit(row: Row): PrivacyAuditRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    auditName: String(row.audit_name),
    auditType: row.audit_type as PrivacyAuditRecord['auditType'],
    status: row.status as PrivacyAuditRecord['status'],
    findingsCount: Number(row.findings_count || 0),
    recommendationsCount: Number(row.recommendations_count || 0),
    owner: String(row.owner),
    dueDate: toIso(row.due_date),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
function mapReport(row: Row): PrivacyReportRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    reportType: row.report_type as PrivacyReportType,
    title: String(row.title),
    status: row.status as PrivacyReportRecord['status'],
    generatedBy: String(row.generated_by),
    summary: asArray(row.summary),
    generatedAt: toIso(row.generated_at),
  };
}

async function createTable(name: string, sql: string) {
  await query(`CREATE TABLE IF NOT EXISTS ${name} (${sql})`);
}

export async function ensurePrivacySchema(): Promise<void> {
  await createTable('privacy_frameworks', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (workspace_id, code)
  `);
  await createTable('privacy_data_inventory', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data_asset_id TEXT NOT NULL, data_asset_name TEXT NOT NULL, business_owner TEXT NOT NULL,
    custodian TEXT NOT NULL, location TEXT NOT NULL, system_name TEXT NOT NULL, application TEXT NOT NULL, department TEXT NOT NULL,
    country TEXT NOT NULL, jurisdiction TEXT NOT NULL, data_category TEXT NOT NULL, sensitivity_level TEXT NOT NULL, classification TEXT NOT NULL,
    retention_requirement TEXT NOT NULL, legal_basis TEXT NOT NULL, status TEXT NOT NULL, classification_risk_score NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_ropa', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, processing_activity TEXT NOT NULL, purpose TEXT NOT NULL, legal_basis TEXT NOT NULL,
    data_categories JSONB NOT NULL DEFAULT '[]'::jsonb, data_subjects JSONB NOT NULL DEFAULT '[]'::jsonb, recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
    cross_border_transfers JSONB NOT NULL DEFAULT '[]'::jsonb, retention_period TEXT NOT NULL, security_measures JSONB NOT NULL DEFAULT '[]'::jsonb,
    controllers JSONB NOT NULL DEFAULT '[]'::jsonb, processors JSONB NOT NULL DEFAULT '[]'::jsonb, review_date TIMESTAMPTZ NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_dpias', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, assessment_name TEXT NOT NULL, owner TEXT NOT NULL, purpose TEXT NOT NULL,
    risk_rating TEXT NOT NULL, likelihood NUMERIC(10,2) NOT NULL DEFAULT 0, impact NUMERIC(10,2) NOT NULL DEFAULT 0, controls JSONB NOT NULL DEFAULT '[]'::jsonb,
    residual_risk NUMERIC(10,2) NOT NULL DEFAULT 0, approval_status TEXT NOT NULL, review_date TIMESTAMPTZ NOT NULL, evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    linked_risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    linked_ai_system_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_vendor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_risks', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL,
    status TEXT NOT NULL, owner TEXT NOT NULL, risk_score NUMERIC(10,2) NOT NULL DEFAULT 0, mitigation TEXT NOT NULL, linked_enterprise_risk_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_consents', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, consent_type TEXT NOT NULL, purpose TEXT NOT NULL, data_subject TEXT NOT NULL,
    collection_method TEXT NOT NULL, date_collected TIMESTAMPTZ NOT NULL, expiration_date TIMESTAMPTZ, withdrawal_date TIMESTAMPTZ,
    status TEXT NOT NULL, evidence TEXT NOT NULL, consent_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_dsars', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, request_id TEXT NOT NULL, request_type TEXT NOT NULL, data_subject TEXT NOT NULL,
    submission_date TIMESTAMPTZ NOT NULL, due_date TIMESTAMPTZ NOT NULL, status TEXT NOT NULL, owner TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    completion_date TIMESTAMPTZ, sla_compliant BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_breaches', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, breach_type TEXT NOT NULL, discovery_date TIMESTAMPTZ NOT NULL, affected_records INTEGER NOT NULL DEFAULT 0,
    affected_individuals INTEGER NOT NULL DEFAULT 0, root_cause TEXT NOT NULL, risk_level TEXT NOT NULL, regulator_notification_status TEXT NOT NULL,
    customer_notification_status TEXT NOT NULL, remediation TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_retention', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, asset_name TEXT NOT NULL, retention_period TEXT NOT NULL, legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    deletion_schedule TEXT NOT NULL, archive_status TEXT NOT NULL, disposal_status TEXT NOT NULL, review_date TIMESTAMPTZ NOT NULL, violation_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_transfers', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, transfer_name TEXT NOT NULL, transfer_type TEXT NOT NULL, transfer_mechanism TEXT NOT NULL,
    jurisdiction TEXT NOT NULL, scc_in_place BOOLEAN NOT NULL DEFAULT FALSE, bcr_in_place BOOLEAN NOT NULL DEFAULT FALSE, transfer_risk_rating TEXT NOT NULL,
    review_date TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_third_parties', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, vendor_name TEXT NOT NULL, role TEXT NOT NULL, privacy_assessment_status TEXT NOT NULL,
    data_transfer_risk TEXT NOT NULL, dpa_status TEXT NOT NULL, compliance_rating NUMERIC(10,2) NOT NULL DEFAULT 0, privacy_incident_count INTEGER NOT NULL DEFAULT 0,
    contract_clauses JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_controls', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, control_name TEXT NOT NULL, category TEXT NOT NULL, mapped_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL, evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('data_governance_center', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data_domain TEXT NOT NULL, data_owner TEXT NOT NULL, data_steward TEXT NOT NULL, data_custodian TEXT NOT NULL,
    data_quality_score NUMERIC(10,2) NOT NULL DEFAULT 0, lifecycle_stage TEXT NOT NULL, glossary_term TEXT NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('data_lineage', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, lineage_name TEXT NOT NULL, source TEXT NOT NULL, transformation TEXT NOT NULL,
    processing TEXT NOT NULL, storage TEXT NOT NULL, sharing TEXT NOT NULL, retention TEXT NOT NULL, disposal TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('data_quality_records', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, dataset_name TEXT NOT NULL, completeness NUMERIC(10,2) NOT NULL DEFAULT 0, accuracy NUMERIC(10,2) NOT NULL DEFAULT 0,
    consistency NUMERIC(10,2) NOT NULL DEFAULT 0, timeliness NUMERIC(10,2) NOT NULL DEFAULT 0, validity NUMERIC(10,2) NOT NULL DEFAULT 0, uniqueness NUMERIC(10,2) NOT NULL DEFAULT 0,
    quality_score NUMERIC(10,2) NOT NULL DEFAULT 0, remediation_action TEXT NOT NULL, status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('data_discovery_records', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, repository_name TEXT NOT NULL, repository_type TEXT NOT NULL,
    pii_locations JSONB NOT NULL DEFAULT '[]'::jsonb, sensitive_data_locations JSONB NOT NULL DEFAULT '[]'::jsonb, data_flow_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    owner TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_compliance_programs', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, framework_code TEXT NOT NULL, framework_name TEXT NOT NULL, score NUMERIC(10,2) NOT NULL DEFAULT 0,
    target_score NUMERIC(10,2) NOT NULL DEFAULT 0, gap_count INTEGER NOT NULL DEFAULT 0, evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    risk_exposure_score NUMERIC(10,2) NOT NULL DEFAULT 0, control_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0, readiness_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (workspace_id, framework_code)
  `);
  await createTable('privacy_audits', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, audit_name TEXT NOT NULL, audit_type TEXT NOT NULL, status TEXT NOT NULL,
    findings_count INTEGER NOT NULL DEFAULT 0, recommendations_count INTEGER NOT NULL DEFAULT 0, owner TEXT NOT NULL, due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await createTable('privacy_reports', `
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, report_type TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'generated',
    generated_by TEXT NOT NULL, summary JSONB NOT NULL DEFAULT '[]'::jsonb, generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
}

async function list<T>(table: string, workspaceId: string, mapper: (row: Row) => T, orderBy: string) {
  const result = await query(`SELECT * FROM ${table} WHERE workspace_id = $1 ORDER BY ${orderBy}`, [workspaceId]);
  return result.rows.map((row) => mapper(row as Row));
}

async function count(table: string, workspaceId: string) {
  const result = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
  return Number(result.rows[0]?.count || 0);
}

function calculateClassificationRiskScore(classification: PrivacyClassification) {
  switch (classification) {
    case 'Highly Restricted':
    case 'Special Category Data':
    case 'Protected Health Information':
      return 92;
    case 'Sensitive Personal Data':
    case 'Payment Card Data':
      return 84;
    case 'Personal Data':
    case 'Regulated Data':
    case 'Restricted':
      return 74;
    case 'Confidential':
      return 58;
    case 'Internal':
      return 32;
    default:
      return 10;
  }
}

export async function seedPrivacyDefaults(workspaceId: string): Promise<void> {
  if ((await count('privacy_frameworks', workspaceId)) > 0) return;

  const frameworks = [
    ['GDPR', 'General Data Protection Regulation'],
    ['POPIA', 'Protection of Personal Information Act'],
    ['CCPA', 'California Consumer Privacy Act / CPRA'],
    ['ISO27701', 'ISO 27701'],
    ['NIST_PF', 'NIST Privacy Framework'],
    ['LGPD', 'Lei Geral de Protecao de Dados'],
    ['PIPEDA', 'PIPEDA'],
    ['HIPAA', 'HIPAA Privacy Rule'],
  ];
  for (const [code, name] of frameworks) {
    await query(`INSERT INTO privacy_frameworks (id, workspace_id, code, name, status) VALUES ($1,$2,$3,$4,'active')`, [generateId('pfw'), workspaceId, code, name]);
  }

  const inventory: Array<Partial<DataInventoryRecord>> = [
    { dataAssetId: 'DA-1001', dataAssetName: 'Customer Master', businessOwner: 'Chief Revenue Officer', custodian: 'CRM Platform Owner', location: 'EU-West Cloud', systemName: 'CRM', application: 'Salesforce', department: 'Revenue', country: 'Ireland', jurisdiction: 'EU', dataCategory: 'Customer PII', sensitivityLevel: 'High', classification: 'Personal Data', retentionRequirement: '7 years', legalBasis: 'Contract', status: 'healthy' },
    { dataAssetId: 'DA-1002', dataAssetName: 'Employee HR Records', businessOwner: 'Chief People Officer', custodian: 'HRIS Manager', location: 'UK Data Center', systemName: 'HRIS', application: 'Workday', department: 'People', country: 'United Kingdom', jurisdiction: 'UK', dataCategory: 'Employment Data', sensitivityLevel: 'Very High', classification: 'Sensitive Personal Data', retentionRequirement: '6 years post-employment', legalBasis: 'Legal obligation', status: 'watch' },
    { dataAssetId: 'DA-1003', dataAssetName: 'Claims Medical Archive', businessOwner: 'Head of Claims', custodian: 'Health Data Lead', location: 'US-East Cloud', systemName: 'Claims Platform', application: 'MedArchive', department: 'Claims', country: 'United States', jurisdiction: 'US', dataCategory: 'Health Data', sensitivityLevel: 'Critical', classification: 'Protected Health Information', retentionRequirement: '10 years', legalBasis: 'Healthcare operations', status: 'critical' },
  ];
  for (const item of inventory) await createDataInventoryRecord(workspaceId, item);

  const ropaEntries: Array<Partial<RopaRecord>> = [
    { processingActivity: 'Customer onboarding and account servicing', purpose: 'Deliver contracted services', legalBasis: 'Contract', dataCategories: ['Identity', 'Contact', 'Financial'], dataSubjects: ['Customers'], recipients: ['Payment processor', 'CRM provider'], crossBorderTransfers: ['EU to US'], retentionPeriod: '7 years', securityMeasures: ['Encryption', 'MFA', 'DLP'], controllers: ['Enterprise GRC Tool Tenant'], processors: ['Salesforce', 'Stripe'], reviewDate: new Date('2026-12-31').toISOString(), status: 'healthy' },
    { processingActivity: 'Employee lifecycle administration', purpose: 'HR administration', legalBasis: 'Legal obligation', dataCategories: ['Employment', 'Payroll', 'Benefits'], dataSubjects: ['Employees'], recipients: ['Payroll provider'], crossBorderTransfers: ['UK to EU'], retentionPeriod: '6 years post-employment', securityMeasures: ['RBAC', 'Segregation of duties'], controllers: ['Enterprise GRC Tool Tenant'], processors: ['Workday'], reviewDate: new Date('2026-11-30').toISOString(), status: 'watch' },
  ];
  for (const item of ropaEntries) await createRopaRecord(workspaceId, item);

  const dpias: Array<Partial<DpiaRecord>> = [
    { assessmentName: 'AI claims triage DPIA', owner: 'Data Protection Officer', purpose: 'Assess privacy impact of automated triage workflows', riskRating: 'high', likelihood: 4, impact: 5, controls: ['Pseudonymization', 'Human oversight'], residualRisk: 68, approvalStatus: 'in_review', reviewDate: new Date('2026-09-30').toISOString(), evidence: ['Model card', 'Design review'], linkedRiskIds: ['pr-risk-ai-privacy'], linkedControlIds: ['pc-001'], linkedAssetIds: ['DA-1003'], linkedAiSystemIds: ['aisys-claims'], linkedVendorIds: ['vendor-ml-host'] },
    { assessmentName: 'Cross-border marketing analytics DPIA', owner: 'Privacy Manager', purpose: 'Review international analytics transfers and profiling', riskRating: 'medium', likelihood: 3, impact: 4, controls: ['SCCs', 'Consent controls'], residualRisk: 52, approvalStatus: 'approved', reviewDate: new Date('2026-10-15').toISOString(), evidence: ['Transfer assessment'], linkedRiskIds: ['pr-risk-transfer'], linkedControlIds: ['pc-002'], linkedAssetIds: ['DA-1001'], linkedAiSystemIds: [], linkedVendorIds: ['vendor-analytics'] },
  ];
  for (const item of dpias) await createDpiaRecord(workspaceId, item);

  const risks: Array<Partial<PrivacyRiskRecord>> = [
    { title: 'Unauthorized access to PHI archive', category: 'unauthorized_access', severity: 'critical', status: 'mitigating', owner: 'Chief Privacy Officer', riskScore: 88, mitigation: 'Privileged access hardening and quarterly access recertification.', linkedEnterpriseRiskId: 'risk-phi-access' },
    { title: 'Consent capture inconsistency', category: 'consent_violation', severity: 'high', status: 'assessed', owner: 'Privacy Manager', riskScore: 72, mitigation: 'Consolidate consent collection patterns and evidence audit trail.' },
    { title: 'Cross-border transfer review lag', category: 'cross_border', severity: 'high', status: 'identified', owner: 'DPO', riskScore: 69, mitigation: 'Refresh SCC catalog and transfer impact review cadence.' },
  ];
  for (const item of risks) await createPrivacyRiskRecord(workspaceId, item);

  const consents: Array<Partial<ConsentRecord>> = [
    { consentType: 'Marketing communications', purpose: 'Email updates', dataSubject: 'Jane Doe', collectionMethod: 'Web form', dateCollected: new Date('2026-01-12').toISOString(), expirationDate: new Date('2027-01-12').toISOString(), status: 'granted', evidence: 'Captured in CMP', consentHistory: ['Granted 2026-01-12'] },
    { consentType: 'Profiling consent', purpose: 'Personalized offers', dataSubject: 'Alex Smith', collectionMethod: 'Mobile app', dateCollected: new Date('2025-10-02').toISOString(), withdrawalDate: new Date('2026-03-04').toISOString(), status: 'withdrawn', evidence: 'CMP withdrawal audit', consentHistory: ['Granted 2025-10-02', 'Withdrawn 2026-03-04'] },
  ];
  for (const item of consents) await createConsentRecord(workspaceId, item);

  const dsars: Array<Partial<DsarRecord>> = [
    { requestId: 'DSAR-2026-001', requestType: 'access', dataSubject: 'Jane Doe', submissionDate: new Date('2026-05-02').toISOString(), dueDate: new Date('2026-05-28').toISOString(), status: 'completed', owner: 'Privacy Analyst', evidence: ['Export package', 'Identity verification'], completionDate: new Date('2026-05-18').toISOString(), slaCompliant: true },
    { requestId: 'DSAR-2026-007', requestType: 'deletion', dataSubject: 'Chris Nolan', submissionDate: new Date('2026-06-03').toISOString(), dueDate: new Date('2026-07-01').toISOString(), status: 'in_progress', owner: 'Privacy Analyst', evidence: ['Ticket reference'], slaCompliant: true },
  ];
  for (const item of dsars) await createDsarRecord(workspaceId, item);

  const breaches: Array<Partial<PrivacyBreachRecord>> = [
    { breachType: 'Misrouted sensitive attachment', discoveryDate: new Date('2026-04-11').toISOString(), affectedRecords: 214, affectedIndividuals: 214, rootCause: 'Email handling error', riskLevel: 'high', regulatorNotificationStatus: 'sent', customerNotificationStatus: 'sent', remediation: 'Secure mail controls and handling retraining', status: 'closed' },
    { breachType: 'Third-party exposure investigation', discoveryDate: new Date('2026-05-30').toISOString(), affectedRecords: 0, affectedIndividuals: 0, rootCause: 'Vendor access review gap', riskLevel: 'medium', regulatorNotificationStatus: 'not_required', customerNotificationStatus: 'not_required', remediation: 'Contract and subprocessor review', status: 'investigating' },
  ];
  for (const item of breaches) await createPrivacyBreachRecord(workspaceId, item);

  const retention: Array<Partial<RetentionRecord>> = [
    { assetName: 'Customer Master', retentionPeriod: '7 years', legalHold: false, deletionSchedule: '2027-12-31', archiveStatus: 'healthy', disposalStatus: 'planned', reviewDate: new Date('2026-12-31').toISOString(), violationStatus: 'healthy' },
    { assetName: 'Legacy Support Logs', retentionPeriod: '24 months', legalHold: true, deletionSchedule: 'On hold', archiveStatus: 'watch', disposalStatus: 'watch', reviewDate: new Date('2026-09-30').toISOString(), violationStatus: 'watch' },
  ];
  for (const item of retention) await createRetentionRecord(workspaceId, item);

  const transfers: Array<Partial<DataTransferRecord>> = [
    { transferName: 'EU customer support analytics', transferType: 'cross_border', transferMechanism: 'SCCs', jurisdiction: 'EU to US', sccInPlace: true, bcrInPlace: false, transferRiskRating: 'medium', reviewDate: new Date('2026-10-01').toISOString() },
    { transferName: 'UK HR hosting', transferType: 'international', transferMechanism: 'BCRs', jurisdiction: 'UK to EU', sccInPlace: false, bcrInPlace: true, transferRiskRating: 'low', reviewDate: new Date('2026-11-15').toISOString() },
  ];
  for (const item of transfers) await createTransferRecord(workspaceId, item);

  const thirdParties: Array<Partial<ThirdPartyPrivacyRecord>> = [
    { vendorName: 'Salesforce', role: 'processor', privacyAssessmentStatus: 'healthy', dataTransferRisk: 'medium', dpaStatus: 'healthy', complianceRating: 84, privacyIncidentCount: 0, contractClauses: ['DPA', 'SCCs'] },
    { vendorName: 'DataLake Host', role: 'subprocessor', privacyAssessmentStatus: 'watch', dataTransferRisk: 'high', dpaStatus: 'watch', complianceRating: 68, privacyIncidentCount: 1, contractClauses: ['DPA', 'Security addendum'] },
  ];
  for (const item of thirdParties) await createThirdPartyPrivacyRecord(workspaceId, item);

  const controls: Array<Partial<PrivacyControlRecord>> = [
    { controlName: 'Consent evidence retention', category: 'consent', mappedFrameworks: ['GDPR', 'CCPA', 'ISO27701'], status: 'healthy', evidenceCoveragePercent: 88 },
    { controlName: 'Data retention enforcement', category: 'retention', mappedFrameworks: ['GDPR', 'POPIA', 'NIST_PF'], status: 'watch', evidenceCoveragePercent: 74 },
    { controlName: 'DSAR workflow monitoring', category: 'data_subject_rights', mappedFrameworks: ['GDPR', 'ISO27701'], status: 'healthy', evidenceCoveragePercent: 85 },
  ];
  for (const item of controls) await createPrivacyControlRecord(workspaceId, item);

  const governance: Array<Partial<DataGovernanceRecord>> = [
    { dataDomain: 'Customer', dataOwner: 'Chief Revenue Officer', dataSteward: 'CRM Steward', dataCustodian: 'CRM Platform Owner', dataQualityScore: 82, lifecycleStage: 'Operate', glossaryTerm: 'Customer Profile', status: 'healthy' },
    { dataDomain: 'People', dataOwner: 'Chief People Officer', dataSteward: 'HR Steward', dataCustodian: 'HRIS Manager', dataQualityScore: 77, lifecycleStage: 'Improve', glossaryTerm: 'Employee Record', status: 'watch' },
  ];
  for (const item of governance) await createDataGovernanceRecord(workspaceId, item);

  const lineages: Array<Partial<DataLineageRecord>> = [
    { lineageName: 'Customer onboarding flow', source: 'Web forms', transformation: 'Validation and enrichment', processing: 'CRM ingestion', storage: 'Salesforce', sharing: 'Payment processor', retention: '7 years', disposal: 'Automated deletion workflow' },
    { lineageName: 'Claims medical record flow', source: 'Claims portal', transformation: 'OCR and tagging', processing: 'Claims triage', storage: 'MedArchive', sharing: 'Approved clinicians', retention: '10 years', disposal: 'Secure destruction' },
  ];
  for (const item of lineages) await createDataLineageRecord(workspaceId, item);

  const quality: Array<Partial<DataQualityRecord>> = [
    { datasetName: 'Customer Master', completeness: 91, accuracy: 87, consistency: 84, timeliness: 90, validity: 89, uniqueness: 93, remediationAction: 'Address duplicate billing addresses', status: 'healthy' },
    { datasetName: 'HR Records', completeness: 82, accuracy: 79, consistency: 77, timeliness: 81, validity: 80, uniqueness: 88, remediationAction: 'Reconcile legacy employee status values', status: 'watch' },
  ];
  for (const item of quality) await createDataQualityRecord(workspaceId, item);

  const discovery: Array<Partial<DataDiscoveryRecord>> = [
    { repositoryName: 'Salesforce', repositoryType: 'application', piiLocations: ['Contacts', 'Leads'], sensitiveDataLocations: ['Payment notes'], dataFlowMapping: ['Web -> CRM -> Billing'], owner: 'CRM Platform Owner', status: 'healthy' },
    { repositoryName: 'Claims DB', repositoryType: 'database', piiLocations: ['Claimant details'], sensitiveDataLocations: ['Medical diagnoses'], dataFlowMapping: ['Portal -> OCR -> Archive'], owner: 'Claims Data Lead', status: 'critical' },
  ];
  for (const item of discovery) await createDataDiscoveryRecord(workspaceId, item);

  const programs: Array<Partial<PrivacyComplianceProgramRecord>> = [
    { frameworkCode: 'GDPR', frameworkName: 'GDPR', score: 78, targetScore: 90, gapCount: 5, evidenceCoveragePercent: 81, riskExposureScore: 62, controlCoveragePercent: 84, readinessPercent: 79, status: 'watch' },
    { frameworkCode: 'POPIA', frameworkName: 'POPIA', score: 73, targetScore: 88, gapCount: 6, evidenceCoveragePercent: 74, riskExposureScore: 66, controlCoveragePercent: 79, readinessPercent: 75, status: 'watch' },
    { frameworkCode: 'ISO27701', frameworkName: 'ISO 27701', score: 83, targetScore: 92, gapCount: 3, evidenceCoveragePercent: 86, riskExposureScore: 54, controlCoveragePercent: 88, readinessPercent: 84, status: 'healthy' },
  ];
  for (const item of programs) await upsertPrivacyComplianceProgram(workspaceId, item);

  const audits: Array<Partial<PrivacyAuditRecord>> = [
    { auditName: 'GDPR readiness review', auditType: 'privacy', status: 'in_progress', findingsCount: 4, recommendationsCount: 7, owner: 'Head of Internal Audit', dueDate: new Date('2026-09-30').toISOString() },
    { auditName: 'Consent lifecycle review', auditType: 'consent', status: 'planned', findingsCount: 0, recommendationsCount: 3, owner: 'Privacy Audit Lead', dueDate: new Date('2026-08-20').toISOString() },
  ];
  for (const item of audits) await createPrivacyAuditRecord(workspaceId, item);

  await createPrivacyReportRecord(workspaceId, {
    reportType: 'board_privacy_pack',
    title: 'Board Privacy Pack - Q2',
    generatedBy: 'System',
    status: 'approved',
    summary: ['Privacy compliance remains above 78% across priority frameworks.', 'Open privacy risks are concentrated in cross-border transfer and PHI access controls.', 'DSAR response remains within SLA and retention compliance is improving.'],
  });
}

export async function createDataInventoryRecord(workspaceId: string, input: Partial<DataInventoryRecord>) {
  const score = input.classificationRiskScore ?? calculateClassificationRiskScore(input.classification || 'Internal');
  const result = await query(
    `INSERT INTO privacy_data_inventory
     (id, workspace_id, data_asset_id, data_asset_name, business_owner, custodian, location, system_name, application, department, country, jurisdiction, data_category, sensitivity_level, classification, retention_requirement, legal_basis, status, classification_risk_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [generateId('pdi'), workspaceId, input.dataAssetId, input.dataAssetName, input.businessOwner, input.custodian, input.location, input.systemName, input.application, input.department, input.country, input.jurisdiction, input.dataCategory, input.sensitivityLevel, input.classification, input.retentionRequirement, input.legalBasis, input.status || 'planned', score],
  );
  return mapInventory(result.rows[0] as Row);
}
export async function createRopaRecord(workspaceId: string, input: Partial<RopaRecord>) {
  const result = await query(
    `INSERT INTO privacy_ropa
     (id, workspace_id, processing_activity, purpose, legal_basis, data_categories, data_subjects, recipients, cross_border_transfers, retention_period, security_measures, controllers, processors, review_date, status)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15)
     RETURNING *`,
    [generateId('ropa'), workspaceId, input.processingActivity, input.purpose, input.legalBasis, JSON.stringify(input.dataCategories || []), JSON.stringify(input.dataSubjects || []), JSON.stringify(input.recipients || []), JSON.stringify(input.crossBorderTransfers || []), input.retentionPeriod, JSON.stringify(input.securityMeasures || []), JSON.stringify(input.controllers || []), JSON.stringify(input.processors || []), input.reviewDate || new Date().toISOString(), input.status || 'planned'],
  );
  return mapRopa(result.rows[0] as Row);
}
export async function createDpiaRecord(workspaceId: string, input: Partial<DpiaRecord>) {
  const result = await query(
    `INSERT INTO privacy_dpias
     (id, workspace_id, assessment_name, owner, purpose, risk_rating, likelihood, impact, controls, residual_risk, approval_status, review_date, evidence, linked_risk_ids, linked_control_ids, linked_asset_ids, linked_ai_system_ids, linked_vendor_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb)
     RETURNING *`,
    [generateId('dpia'), workspaceId, input.assessmentName, input.owner, input.purpose, input.riskRating || 'medium', input.likelihood || 0, input.impact || 0, JSON.stringify(input.controls || []), input.residualRisk || 0, input.approvalStatus || 'draft', input.reviewDate || new Date().toISOString(), JSON.stringify(input.evidence || []), JSON.stringify(input.linkedRiskIds || []), JSON.stringify(input.linkedControlIds || []), JSON.stringify(input.linkedAssetIds || []), JSON.stringify(input.linkedAiSystemIds || []), JSON.stringify(input.linkedVendorIds || [])],
  );
  return mapDpia(result.rows[0] as Row);
}
export async function createPrivacyRiskRecord(workspaceId: string, input: Partial<PrivacyRiskRecord>) {
  const result = await query(
    `INSERT INTO privacy_risks (id, workspace_id, title, category, severity, status, owner, risk_score, mitigation, linked_enterprise_risk_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [generateId('prrisk'), workspaceId, input.title, input.category, input.severity || 'medium', input.status || 'identified', input.owner, input.riskScore || 0, input.mitigation || '', input.linkedEnterpriseRiskId || null],
  );
  return mapRisk(result.rows[0] as Row);
}
export async function createConsentRecord(workspaceId: string, input: Partial<ConsentRecord>) {
  const result = await query(
    `INSERT INTO privacy_consents
     (id, workspace_id, consent_type, purpose, data_subject, collection_method, date_collected, expiration_date, withdrawal_date, status, evidence, consent_history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) RETURNING *`,
    [generateId('consent'), workspaceId, input.consentType, input.purpose, input.dataSubject, input.collectionMethod, input.dateCollected || new Date().toISOString(), input.expirationDate || null, input.withdrawalDate || null, input.status || 'granted', input.evidence || '', JSON.stringify(input.consentHistory || [])],
  );
  return mapConsent(result.rows[0] as Row);
}
export async function createDsarRecord(workspaceId: string, input: Partial<DsarRecord>) {
  const result = await query(
    `INSERT INTO privacy_dsars
     (id, workspace_id, request_id, request_type, data_subject, submission_date, due_date, status, owner, evidence, completion_date, sla_compliant)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) RETURNING *`,
    [generateId('dsar'), workspaceId, input.requestId, input.requestType, input.dataSubject, input.submissionDate || new Date().toISOString(), input.dueDate || new Date().toISOString(), input.status || 'submitted', input.owner || '', JSON.stringify(input.evidence || []), input.completionDate || null, input.slaCompliant ?? true],
  );
  return mapDsar(result.rows[0] as Row);
}
export async function createPrivacyBreachRecord(workspaceId: string, input: Partial<PrivacyBreachRecord>) {
  const result = await query(
    `INSERT INTO privacy_breaches
     (id, workspace_id, breach_type, discovery_date, affected_records, affected_individuals, root_cause, risk_level, regulator_notification_status, customer_notification_status, remediation, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [generateId('breach'), workspaceId, input.breachType, input.discoveryDate || new Date().toISOString(), input.affectedRecords || 0, input.affectedIndividuals || 0, input.rootCause || '', input.riskLevel || 'medium', input.regulatorNotificationStatus || 'not_required', input.customerNotificationStatus || 'not_required', input.remediation || '', input.status || 'open'],
  );
  return mapBreach(result.rows[0] as Row);
}
export async function createRetentionRecord(workspaceId: string, input: Partial<RetentionRecord>) {
  const result = await query(
    `INSERT INTO privacy_retention
     (id, workspace_id, asset_name, retention_period, legal_hold, deletion_schedule, archive_status, disposal_status, review_date, violation_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [generateId('retain'), workspaceId, input.assetName, input.retentionPeriod, input.legalHold ?? false, input.deletionSchedule, input.archiveStatus || 'planned', input.disposalStatus || 'planned', input.reviewDate || new Date().toISOString(), input.violationStatus || 'healthy'],
  );
  return mapRetention(result.rows[0] as Row);
}
export async function createTransferRecord(workspaceId: string, input: Partial<DataTransferRecord>) {
  const result = await query(
    `INSERT INTO privacy_transfers
     (id, workspace_id, transfer_name, transfer_type, transfer_mechanism, jurisdiction, scc_in_place, bcr_in_place, transfer_risk_rating, review_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [generateId('transfer'), workspaceId, input.transferName, input.transferType || 'cross_border', input.transferMechanism || '', input.jurisdiction || '', input.sccInPlace ?? false, input.bcrInPlace ?? false, input.transferRiskRating || 'medium', input.reviewDate || new Date().toISOString()],
  );
  return mapTransfer(result.rows[0] as Row);
}
export async function createThirdPartyPrivacyRecord(workspaceId: string, input: Partial<ThirdPartyPrivacyRecord>) {
  const result = await query(
    `INSERT INTO privacy_third_parties
     (id, workspace_id, vendor_name, role, privacy_assessment_status, data_transfer_risk, dpa_status, compliance_rating, privacy_incident_count, contract_clauses)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
    [generateId('ptp'), workspaceId, input.vendorName, input.role || 'processor', input.privacyAssessmentStatus || 'planned', input.dataTransferRisk || 'medium', input.dpaStatus || 'watch', input.complianceRating || 0, input.privacyIncidentCount || 0, JSON.stringify(input.contractClauses || [])],
  );
  return mapThirdParty(result.rows[0] as Row);
}
export async function createPrivacyControlRecord(workspaceId: string, input: Partial<PrivacyControlRecord>) {
  const result = await query(
    `INSERT INTO privacy_controls
     (id, workspace_id, control_name, category, mapped_frameworks, status, evidence_coverage_percent)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING *`,
    [generateId('pctrl'), workspaceId, input.controlName, input.category || 'governance', JSON.stringify(input.mappedFrameworks || []), input.status || 'planned', input.evidenceCoveragePercent || 0],
  );
  return mapControl(result.rows[0] as Row);
}
export async function createDataGovernanceRecord(workspaceId: string, input: Partial<DataGovernanceRecord>) {
  const result = await query(
    `INSERT INTO data_governance_center
     (id, workspace_id, data_domain, data_owner, data_steward, data_custodian, data_quality_score, lifecycle_stage, glossary_term, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [generateId('dgov'), workspaceId, input.dataDomain, input.dataOwner, input.dataSteward, input.dataCustodian, input.dataQualityScore || 0, input.lifecycleStage || '', input.glossaryTerm || '', input.status || 'planned'],
  );
  return mapGovernance(result.rows[0] as Row);
}
export async function createDataLineageRecord(workspaceId: string, input: Partial<DataLineageRecord>) {
  const result = await query(
    `INSERT INTO data_lineage
     (id, workspace_id, lineage_name, source, transformation, processing, storage, sharing, retention, disposal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [generateId('lineage'), workspaceId, input.lineageName, input.source || '', input.transformation || '', input.processing || '', input.storage || '', input.sharing || '', input.retention || '', input.disposal || ''],
  );
  return mapLineage(result.rows[0] as Row);
}
export async function createDataQualityRecord(workspaceId: string, input: Partial<DataQualityRecord>) {
  const qualityScore = input.qualityScore ?? avg([input.completeness || 0, input.accuracy || 0, input.consistency || 0, input.timeliness || 0, input.validity || 0, input.uniqueness || 0]);
  const result = await query(
    `INSERT INTO data_quality_records
     (id, workspace_id, dataset_name, completeness, accuracy, consistency, timeliness, validity, uniqueness, quality_score, remediation_action, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [generateId('quality'), workspaceId, input.datasetName, input.completeness || 0, input.accuracy || 0, input.consistency || 0, input.timeliness || 0, input.validity || 0, input.uniqueness || 0, qualityScore, input.remediationAction || '', input.status || 'planned'],
  );
  return mapQuality(result.rows[0] as Row);
}
export async function createDataDiscoveryRecord(workspaceId: string, input: Partial<DataDiscoveryRecord>) {
  const result = await query(
    `INSERT INTO data_discovery_records
     (id, workspace_id, repository_name, repository_type, pii_locations, sensitive_data_locations, data_flow_mapping, owner, status)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9) RETURNING *`,
    [generateId('discover'), workspaceId, input.repositoryName, input.repositoryType || 'application', JSON.stringify(input.piiLocations || []), JSON.stringify(input.sensitiveDataLocations || []), JSON.stringify(input.dataFlowMapping || []), input.owner || '', input.status || 'planned'],
  );
  return mapDiscovery(result.rows[0] as Row);
}
export async function upsertPrivacyComplianceProgram(workspaceId: string, input: Partial<PrivacyComplianceProgramRecord>) {
  const result = await query(
    `INSERT INTO privacy_compliance_programs
     (id, workspace_id, framework_code, framework_name, score, target_score, gap_count, evidence_coverage_percent, risk_exposure_score, control_coverage_percent, readiness_percent, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (workspace_id, framework_code)
     DO UPDATE SET framework_name = EXCLUDED.framework_name, score = EXCLUDED.score, target_score = EXCLUDED.target_score, gap_count = EXCLUDED.gap_count,
                   evidence_coverage_percent = EXCLUDED.evidence_coverage_percent, risk_exposure_score = EXCLUDED.risk_exposure_score, control_coverage_percent = EXCLUDED.control_coverage_percent,
                   readiness_percent = EXCLUDED.readiness_percent, status = EXCLUDED.status, updated_at = NOW()
     RETURNING *`,
    [generateId('pcmp'), workspaceId, input.frameworkCode, input.frameworkName, input.score || 0, input.targetScore || 0, input.gapCount || 0, input.evidenceCoveragePercent || 0, input.riskExposureScore || 0, input.controlCoveragePercent || 0, input.readinessPercent || 0, input.status || 'watch'],
  );
  return mapCompliance(result.rows[0] as Row);
}
export async function createPrivacyAuditRecord(workspaceId: string, input: Partial<PrivacyAuditRecord>) {
  const result = await query(
    `INSERT INTO privacy_audits
     (id, workspace_id, audit_name, audit_type, status, findings_count, recommendations_count, owner, due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [generateId('paudit'), workspaceId, input.auditName, input.auditType || 'privacy', input.status || 'planned', input.findingsCount || 0, input.recommendationsCount || 0, input.owner || '', input.dueDate || new Date().toISOString()],
  );
  return mapAudit(result.rows[0] as Row);
}
export async function createPrivacyReportRecord(workspaceId: string, input: Partial<PrivacyReportRecord>) {
  const result = await query(
    `INSERT INTO privacy_reports (id, workspace_id, report_type, title, status, generated_by, summary, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
    [generateId('prpt'), workspaceId, input.reportType, input.title, input.status || 'generated', input.generatedBy || 'System', JSON.stringify(input.summary || []), input.generatedAt || new Date().toISOString()],
  );
  return mapReport(result.rows[0] as Row);
}

function buildSummary(
  inventory: DataInventoryRecord[],
  risks: PrivacyRiskRecord[],
  dsars: DsarRecord[],
  dpias: DpiaRecord[],
  breaches: PrivacyBreachRecord[],
  thirdParties: ThirdPartyPrivacyRecord[],
  consents: ConsentRecord[],
  retention: RetentionRecord[],
  audits: PrivacyAuditRecord[],
  compliancePrograms: PrivacyComplianceProgramRecord[],
): PrivacySummary {
  return {
    complianceScore: clamp(avg(compliancePrograms.map((item) => item.score))),
    openPrivacyRisks: risks.filter((item) => item.status !== 'closed').length,
    piiAssets: inventory.filter((item) => ['Personal Data', 'Sensitive Personal Data', 'Protected Health Information'].includes(item.classification)).length,
    sensitiveDataAssets: inventory.filter((item) => ['Highly Restricted', 'Sensitive Personal Data', 'Special Category Data', 'Protected Health Information', 'Payment Card Data'].includes(item.classification)).length,
    dsarRequests: dsars.length,
    openDpias: dpias.filter((item) => item.approvalStatus !== 'approved').length,
    dataBreaches: breaches.filter((item) => item.status !== 'closed').length,
    thirdPartyProcessors: thirdParties.length,
    consentCoverage: clamp((consents.filter((item) => item.status === 'granted' || item.status === 'renewed').length / Math.max(consents.length, 1)) * 100),
    retentionCompliance: clamp((retention.filter((item) => item.violationStatus === 'healthy').length / Math.max(retention.length, 1)) * 100),
    privacyAuditStatus: clamp(avg(audits.map((item) => item.status === 'complete' ? 100 : item.status === 'in_progress' ? 65 : 35))),
  };
}

function buildExecutiveView(summary: PrivacySummary, transfers: DataTransferRecord[], thirdParties: ThirdPartyPrivacyRecord[]): PrivacyExecutiveView {
  return {
    privacyScore: summary.complianceScore,
    openPrivacyRisks: summary.openPrivacyRisks,
    privacyIncidents: summary.dataBreaches,
    dsarPerformance: `${summary.dsarRequests} requests, ${summary.openDpias} open DPIAs`,
    thirdPartyExposure: `${thirdParties.filter((item) => item.dataTransferRisk === 'high' || item.dataTransferRisk === 'critical').length} high-risk processors`,
    complianceStatus: `${summary.complianceScore}% privacy compliance`,
    dataTransferRisk: `${transfers.filter((item) => item.transferRiskRating === 'high' || item.transferRiskRating === 'critical').length} elevated transfers`,
    retentionCompliance: `${summary.retentionCompliance}% retention compliant`,
  };
}

export async function getPrivacyState(workspaceId: string): Promise<PrivacyState> {
  await seedPrivacyDefaults(workspaceId);
  const [
    frameworks,
    dataInventory,
    ropaRecords,
    dpias,
    risks,
    consents,
    dsars,
    breaches,
    retentionRecords,
    transfers,
    thirdParties,
    controls,
    governanceRecords,
    lineages,
    qualityRecords,
    discoveryRecords,
    compliancePrograms,
    audits,
    reports,
  ] = await Promise.all([
    list('privacy_frameworks', workspaceId, mapFramework, 'name'),
    list('privacy_data_inventory', workspaceId, mapInventory, 'data_asset_name'),
    list('privacy_ropa', workspaceId, mapRopa, 'processing_activity'),
    list('privacy_dpias', workspaceId, mapDpia, 'review_date'),
    list('privacy_risks', workspaceId, mapRisk, 'risk_score DESC, title'),
    list('privacy_consents', workspaceId, mapConsent, 'date_collected DESC'),
    list('privacy_dsars', workspaceId, mapDsar, 'submission_date DESC'),
    list('privacy_breaches', workspaceId, mapBreach, 'discovery_date DESC'),
    list('privacy_retention', workspaceId, mapRetention, 'review_date'),
    list('privacy_transfers', workspaceId, mapTransfer, 'review_date'),
    list('privacy_third_parties', workspaceId, mapThirdParty, 'vendor_name'),
    list('privacy_controls', workspaceId, mapControl, 'control_name'),
    list('data_governance_center', workspaceId, mapGovernance, 'data_domain'),
    list('data_lineage', workspaceId, mapLineage, 'lineage_name'),
    list('data_quality_records', workspaceId, mapQuality, 'dataset_name'),
    list('data_discovery_records', workspaceId, mapDiscovery, 'repository_name'),
    list('privacy_compliance_programs', workspaceId, mapCompliance, 'framework_name'),
    list('privacy_audits', workspaceId, mapAudit, 'due_date'),
    list('privacy_reports', workspaceId, mapReport, 'generated_at DESC'),
  ]);

  const summary = buildSummary(dataInventory, risks, dsars, dpias, breaches, thirdParties, consents, retentionRecords, audits, compliancePrograms);
  const executiveView = buildExecutiveView(summary, transfers, thirdParties);

  return {
    summary,
    frameworks,
    dataInventory,
    ropaRecords,
    dpias,
    risks,
    consents,
    dsars,
    breaches,
    retentionRecords,
    transfers,
    thirdParties,
    controls,
    governanceRecords,
    lineages,
    qualityRecords,
    discoveryRecords,
    compliancePrograms,
    audits,
    reports,
    analytics: {
      privacyTrend: [
        { month: 'Jan', score: 69 },
        { month: 'Feb', score: 71 },
        { month: 'Mar', score: 72 },
        { month: 'Apr', score: 74 },
        { month: 'May', score: 76 },
        { month: 'Jun', score: summary.complianceScore },
      ],
      consentTrend: [
        { month: 'Jan', value: 84 },
        { month: 'Feb', value: 85 },
        { month: 'Mar', value: 87 },
        { month: 'Apr', value: 88 },
        { month: 'May', value: 89 },
        { month: 'Jun', value: summary.consentCoverage },
      ],
      dsarTrend: [
        { month: 'Jan', value: 3 },
        { month: 'Feb', value: 4 },
        { month: 'Mar', value: 4 },
        { month: 'Apr', value: 5 },
        { month: 'May', value: 5 },
        { month: 'Jun', value: summary.dsarRequests },
      ],
      retentionTrend: [
        { month: 'Jan', value: 70 },
        { month: 'Feb', value: 71 },
        { month: 'Mar', value: 72 },
        { month: 'Apr', value: 74 },
        { month: 'May', value: 76 },
        { month: 'Jun', value: summary.retentionCompliance },
      ],
      thirdPartyTrend: [
        { label: 'High risk', value: thirdParties.filter((item) => item.dataTransferRisk === 'high' || item.dataTransferRisk === 'critical').length },
        { label: 'Watch', value: thirdParties.filter((item) => item.privacyAssessmentStatus === 'watch').length },
        { label: 'Healthy', value: thirdParties.filter((item) => item.privacyAssessmentStatus === 'healthy').length },
      ],
      classificationDistribution: [
        { label: 'PII', value: summary.piiAssets },
        { label: 'Sensitive', value: summary.sensitiveDataAssets },
        { label: 'Other', value: Math.max(dataInventory.length - summary.piiAssets, 0) },
      ],
      riskHeatmap: risks.map((risk) => ({ category: risk.category.replace(/_/g, ' '), riskScore: risk.riskScore })),
    },
    executiveView,
  };
}
