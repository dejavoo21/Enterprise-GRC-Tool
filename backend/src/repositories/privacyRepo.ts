import { generateId, query } from '../db.js';
import type {
  ConsentRecord,
  DataDiscoveryRecord,
  DataGovernanceRecord,
  DataInventoryRecord,
  DataClassificationEvent,
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
    classificationScope: row.classification_scope ? String(row.classification_scope) : undefined,
    classificationRationale: row.classification_rationale ? String(row.classification_rationale) : undefined,
    linkedPolicyIds: asArray(row.linked_policy_ids),
    linkedControlIds: asArray(row.linked_control_ids),
    linkedEvidenceIds: asArray(row.linked_evidence_ids),
    classificationUpdatedBy: row.classification_updated_by ? String(row.classification_updated_by) : undefined,
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
    linkedEvidenceIds: asArray(row.linked_evidence_ids),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
    submittedAt: row.submitted_at ? toIso(row.submitted_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedAt: row.reviewed_at ? toIso(row.reviewed_at) : undefined,
    reviewNotes: row.review_notes ? String(row.review_notes) : undefined,
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

async function list<T>(table: string, workspaceId: string, mapper: (row: Row) => T, orderBy: string) {
  const result = await query(`SELECT * FROM ${table} WHERE workspace_id = $1 ORDER BY ${orderBy}`, [workspaceId]);
  return result.rows.map((row) => mapper(row as Row));
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

export async function createDataInventoryRecord(workspaceId: string, input: Partial<DataInventoryRecord>, actorId: string) {
  const score = input.classificationRiskScore ?? calculateClassificationRiskScore(input.classification || 'Internal');
  const result = await query(
    `WITH inserted AS (
       INSERT INTO privacy_data_inventory
       (id, workspace_id, data_asset_id, data_asset_name, business_owner, custodian, location, system_name, application, department, country, jurisdiction, data_category, sensitivity_level, classification, retention_requirement, legal_basis, status, classification_risk_score, classification_scope, classification_rationale, linked_policy_ids, linked_control_ids, linked_evidence_ids, classification_updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25::uuid)
       RETURNING *
     ), event AS (
       INSERT INTO privacy_data_classification_events(workspace_id,inventory_id,event_type,actor_id,new_classification,rationale,snapshot)
       SELECT workspace_id,id,'created',$25::uuid,classification,classification_rationale,to_jsonb(inserted) FROM inserted
     ) SELECT * FROM inserted`,
    [generateId('pdi'), workspaceId, input.dataAssetId, input.dataAssetName, input.businessOwner, input.custodian, input.location, input.systemName, input.application, input.department, input.country, input.jurisdiction, input.dataCategory, input.sensitivityLevel, input.classification, input.retentionRequirement, input.legalBasis, input.status || 'planned', score, input.classificationScope, input.classificationRationale, JSON.stringify(input.linkedPolicyIds || []), JSON.stringify(input.linkedControlIds || []), JSON.stringify(input.linkedEvidenceIds || []), actorId],
  );
  return mapInventory(result.rows[0] as Row);
}

export async function getDataInventoryRecord(workspaceId: string, id: string): Promise<DataInventoryRecord | null> {
  const result = await query(`SELECT * FROM privacy_data_inventory WHERE workspace_id=$1 AND id=$2`, [workspaceId, id]);
  return result.rows[0] ? mapInventory(result.rows[0] as Row) : null;
}

export async function getDataClassificationHistory(workspaceId: string, inventoryId: string): Promise<DataClassificationEvent[]> {
  const result = await query<Row>(
    `SELECT * FROM privacy_data_classification_events WHERE workspace_id=$1 AND inventory_id=$2 ORDER BY created_at DESC`,
    [workspaceId, inventoryId],
  );
  return result.rows.map((row) => ({
    id: String(row.id), workspaceId: String(row.workspace_id), inventoryId: String(row.inventory_id),
    eventType: row.event_type as DataClassificationEvent['eventType'], actorId: String(row.actor_id),
    previousClassification: row.previous_classification ? String(row.previous_classification) : undefined,
    newClassification: row.new_classification as PrivacyClassification, rationale: String(row.rationale),
    snapshot: mapInventory(row.snapshot as Row), createdAt: toIso(row.created_at),
  }));
}

export async function reviseDataClassification(workspaceId: string, id: string, input: Partial<DataInventoryRecord>, actorId: string): Promise<DataInventoryRecord | null> {
  const score = calculateClassificationRiskScore(input.classification || 'Internal');
  const result = await query(
    `WITH previous AS (SELECT * FROM privacy_data_inventory WHERE workspace_id=$1 AND id=$2 FOR UPDATE),
     updated AS (
       UPDATE privacy_data_inventory p SET
         business_owner=$3,sensitivity_level=$4,classification=$5,status=$6,classification_risk_score=$7,
         classification_scope=$8,classification_rationale=$9,linked_policy_ids=$10::jsonb,
         linked_control_ids=$11::jsonb,linked_evidence_ids=$12::jsonb,classification_updated_by=$13::uuid,updated_at=NOW()
       FROM previous WHERE p.id=previous.id AND p.workspace_id=previous.workspace_id RETURNING p.*
     ), event AS (
       INSERT INTO privacy_data_classification_events(workspace_id,inventory_id,event_type,actor_id,previous_classification,new_classification,rationale,snapshot)
       SELECT workspace_id,id,'revised',$13::uuid,previous.classification,updated.classification,updated.classification_rationale,to_jsonb(updated)
       FROM updated CROSS JOIN previous
     ) SELECT * FROM updated`,
    [workspaceId, id, input.businessOwner, input.sensitivityLevel, input.classification, input.status, score,
      input.classificationScope, input.classificationRationale, JSON.stringify(input.linkedPolicyIds || []),
      JSON.stringify(input.linkedControlIds || []), JSON.stringify(input.linkedEvidenceIds || []), actorId],
  );
  return result.rows[0] ? mapInventory(result.rows[0] as Row) : null;
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
export async function createDpiaRecord(workspaceId: string, input: Partial<DpiaRecord>, actorId?: string) {
  const result = await query(
    `WITH inserted AS (INSERT INTO privacy_dpias
     (id, workspace_id, assessment_name, owner, purpose, risk_rating, likelihood, impact, controls, residual_risk, approval_status, review_date, evidence, linked_risk_ids, linked_control_ids, linked_asset_ids, linked_ai_system_ids, linked_vendor_ids, linked_evidence_ids, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'draft',$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::uuid)
     RETURNING *),
     logged AS (INSERT INTO privacy_dpia_events(workspace_id,dpia_id,event_type,new_status,actor_id)
       SELECT workspace_id,id,'created','draft',$19::uuid FROM inserted WHERE $19::uuid IS NOT NULL)
     SELECT * FROM inserted`,
    [generateId('dpia'), workspaceId, input.assessmentName, input.owner, input.purpose, input.riskRating || 'medium', input.likelihood || 0, input.impact || 0, JSON.stringify(input.controls || []), input.residualRisk || 0, input.reviewDate || new Date().toISOString(), JSON.stringify(input.evidence || []), JSON.stringify(input.linkedRiskIds || []), JSON.stringify(input.linkedControlIds || []), JSON.stringify(input.linkedAssetIds || []), JSON.stringify(input.linkedAiSystemIds || []), JSON.stringify(input.linkedVendorIds || []), JSON.stringify(input.linkedEvidenceIds || []), actorId || null],
  );
  return mapDpia(result.rows[0] as Row);
}

export async function getDpiaById(workspaceId: string, id: string): Promise<DpiaRecord | null> {
  const result = await query('SELECT * FROM privacy_dpias WHERE workspace_id=$1 AND id=$2', [workspaceId, id]);
  return result.rows[0] ? mapDpia(result.rows[0] as Row) : null;
}

export async function recordDpiaEvent(workspaceId: string, dpiaId: string, eventType: string, actorId: string, previousStatus?: string, newStatus?: string, notes?: string): Promise<void> {
  await query(`INSERT INTO privacy_dpia_events(workspace_id,dpia_id,event_type,previous_status,new_status,notes,actor_id)
    SELECT $1,$2,$3,$4,$5,$6,$7::uuid WHERE EXISTS(SELECT 1 FROM privacy_dpias WHERE workspace_id=$1 AND id=$2)`, [workspaceId,dpiaId,eventType,previousStatus||null,newStatus||null,notes||null,actorId]);
}

export async function getDpiaHistory(workspaceId: string, dpiaId: string) {
  return (await query(`SELECT id,event_type "eventType",previous_status "previousStatus",new_status "newStatus",notes,actor_id "actorId",created_at "createdAt"
    FROM privacy_dpia_events WHERE workspace_id=$1 AND dpia_id=$2 ORDER BY created_at DESC`, [workspaceId, dpiaId])).rows;
}

export async function submitDpia(workspaceId: string, id: string, actorId: string): Promise<DpiaRecord | null> {
  const result = await query(`WITH current AS (SELECT * FROM privacy_dpias WHERE workspace_id=$1 AND id=$2 FOR UPDATE),
    changed AS (UPDATE privacy_dpias d SET approval_status='in_review',submitted_by=$3::uuid,submitted_at=NOW(),reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL,updated_at=NOW() FROM current c WHERE d.id=c.id AND d.workspace_id=c.workspace_id RETURNING d.*),
    logged AS (INSERT INTO privacy_dpia_events(workspace_id,dpia_id,event_type,previous_status,new_status,actor_id) SELECT c.workspace_id,c.id,'submitted',c.approval_status,'in_review',$3::uuid FROM current c JOIN changed d ON d.id=c.id)
    SELECT * FROM changed`, [workspaceId,id,actorId]);
  return result.rows[0] ? mapDpia(result.rows[0] as Row) : null;
}

export async function decideDpia(workspaceId: string, id: string, actorId: string, decision: 'approved'|'rejected', notes?: string): Promise<DpiaRecord | null> {
  const result = await query(`WITH changed AS (UPDATE privacy_dpias SET approval_status=$3,reviewed_by=$4::uuid,reviewed_at=NOW(),review_notes=$5,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 AND approval_status='in_review' AND (created_by IS NULL OR created_by<>$4::uuid) RETURNING *),
    logged AS (INSERT INTO privacy_dpia_events(workspace_id,dpia_id,event_type,previous_status,new_status,notes,actor_id) SELECT workspace_id,id,'review_decision','in_review',$3,$5,$4::uuid FROM changed)
    SELECT * FROM changed`, [workspaceId,id,decision,actorId,notes||null]);
  return result.rows[0] ? mapDpia(result.rows[0] as Row) : null;
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
