import { generateId, query } from '../db.js';
import type {
  AiAssessmentStatus,
  AiClassification,
  AiComplianceProgramRecord,
  AiComplianceStatus,
  AiControlCategory,
  AiControlRecord,
  AiCriticality,
  AiGovernanceSummary,
  AiIncidentRecord,
  AiIncidentStatus,
  AiIncidentType,
  AiModelRecord,
  AiReportRecord,
  AiReportType,
  AiRiskAssessmentRecord,
  AiSystemLifecycleStatus,
  AiSystemRecord,
  AiTrainingProgramRecord,
  AiVendorCategory,
  AiVendorRecord,
} from '../types/aiGovernance.js';

type Row = Record<string, unknown>;

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function num(value: unknown) {
  return Number(value || 0);
}

function mapSystem(row: Row): AiSystemRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemName: String(row.system_name),
    owner: String(row.owner),
    businessUnit: String(row.business_unit),
    purpose: String(row.purpose),
    description: String(row.description),
    modelType: String(row.model_type),
    vendor: String(row.vendor),
    deploymentModel: row.deployment_model as 'internal' | 'external',
    deploymentDate: toIso(row.deployment_date)!,
    lifecycleStatus: row.lifecycle_status as AiSystemLifecycleStatus,
    criticality: row.criticality as AiCriticality,
    classification: row.classification as AiClassification,
    riskRating: row.risk_rating as AiCriticality,
    complianceStatus: row.compliance_status as AiComplianceStatus,
    useCase: String(row.use_case),
    dataType: String(row.data_type),
    industry: String(row.industry),
    jurisdictions: asArray(row.jurisdictions),
    ciaImpacts: asArray(row.cia_impacts) as AiSystemRecord['ciaImpacts'],
    impact: row.impact as AiSystemRecord['impact'],
    inventoryCoveragePercent: num(row.inventory_coverage_percent),
    inventoryCoverageRecorded: Boolean(row.inventory_coverage_recorded),
    assuranceStatus: row.assurance_status as AiSystemRecord['assuranceStatus'],
    linkedRiskIds: asArray(row.linked_risk_ids),
    linkedControlIds: asArray(row.linked_control_ids),
    linkedEvidenceIds: asArray(row.linked_evidence_ids),
    linkedVendorIds: asArray(row.linked_vendor_ids),
    linkedIncidentIds: asArray(row.linked_incident_ids),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapModel(row: Row): AiModelRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemId: row.system_id ? String(row.system_id) : null,
    modelName: String(row.model_name),
    version: String(row.version),
    owner: String(row.owner),
    purpose: String(row.purpose),
    validationStatus: row.validation_status as AiModelRecord['validationStatus'],
    approvalStatus: row.approval_status as AiModelRecord['approvalStatus'],
    retirementDate: toIso(row.retirement_date),
    lifecycleStatus: row.lifecycle_status as AiSystemLifecycleStatus,
    modelFamily: String(row.model_family),
    accuracy: num(row.accuracy),
    precision: num(row.precision_score),
    recall: num(row.recall_score),
    drift: num(row.drift_score),
    biasScore: num(row.bias_score),
    robustnessScore: num(row.robustness_score),
    explainabilityScore: num(row.explainability_score),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    submittedBy: row.submitted_by ? String(row.submitted_by) : undefined,
    submittedAt: toIso(row.submitted_at) || undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedAt: toIso(row.reviewed_at) || undefined,
    reviewNotes: row.review_notes ? String(row.review_notes) : undefined,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapAssessment(row: Row): AiRiskAssessmentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemId: row.system_id ? String(row.system_id) : null,
    assessmentName: String(row.assessment_name),
    owner: String(row.owner),
    status: row.status as AiAssessmentStatus,
    biasRisk: num(row.bias_risk),
    fairnessRisk: num(row.fairness_risk),
    transparencyRisk: num(row.transparency_risk),
    privacyRisk: num(row.privacy_risk),
    securityRisk: num(row.security_risk),
    hallucinationRisk: num(row.hallucination_risk),
    explainabilityRisk: num(row.explainability_risk),
    ethicalRisk: num(row.ethical_risk),
    safetyRisk: num(row.safety_risk),
    regulatoryRisk: num(row.regulatory_risk),
    operationalRisk: num(row.operational_risk),
    vendorRisk: num(row.vendor_risk),
    overallRiskScore: num(row.overall_risk_score),
    dueDate: toIso(row.due_date),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapControl(row: Row): AiControlRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    controlName: String(row.control_name),
    category: row.category as AiControlCategory,
    description: String(row.description),
    owner: String(row.owner),
    status: row.status as AiControlRecord['status'],
    mappedFrameworks: asArray(row.mapped_frameworks),
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    automationLevel: row.automation_level as AiControlRecord['automationLevel'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapIncident(row: Row): AiIncidentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemId: row.system_id ? String(row.system_id) : null,
    title: String(row.title),
    incidentType: row.incident_type as AiIncidentType,
    severity: row.severity as AiCriticality,
    status: row.status as AiIncidentStatus,
    owner: String(row.owner),
    detectedAt: toIso(row.detected_at)!,
    reportedExternally: Boolean(row.reported_externally),
    summary: String(row.summary),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapVendor(row: Row): AiVendorRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    vendorName: String(row.vendor_name),
    vendorCategory: row.vendor_category as AiVendorCategory,
    services: asArray(row.services),
    riskRating: row.risk_rating as AiCriticality,
    complianceScore: num(row.compliance_score),
    contractStatus: row.contract_status as AiVendorRecord['contractStatus'],
    securityReviewStatus: row.security_review_status as AiVendorRecord['securityReviewStatus'],
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapTraining(row: Row): AiTrainingProgramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    programName: String(row.program_name),
    focusArea: String(row.focus_area),
    completionRate: num(row.completion_rate),
    overdueLearners: num(row.overdue_learners),
    certificationStatus: row.certification_status as AiTrainingProgramRecord['certificationStatus'],
    status: row.status as AiTrainingProgramRecord['status'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapReport(row: Row): AiReportRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    reportType: row.report_type as AiReportType,
    title: String(row.title),
    status: row.status as AiReportRecord['status'],
    generatedBy: String(row.generated_by),
    summary: asArray(row.summary),
    generatedAt: toIso(row.generated_at)!,
  };
}

function mapComplianceProgram(row: Row): AiComplianceProgramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    frameworkCode: row.framework_code as AiComplianceProgramRecord['frameworkCode'],
    frameworkName: String(row.framework_name),
    score: num(row.score),
    targetScore: num(row.target_score),
    gapCount: num(row.gap_count),
    controlCoveragePercent: num(row.control_coverage_percent),
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    documentationCoveragePercent: num(row.documentation_coverage_percent),
    trainingCoveragePercent: num(row.training_coverage_percent),
    status: row.status as AiComplianceProgramRecord['status'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

export async function listAiSystems(workspaceId: string): Promise<AiSystemRecord[]> {
  const result = await query(`SELECT * FROM ai_inventory WHERE workspace_id = $1 ORDER BY updated_at DESC, system_name`, [workspaceId]);
  return result.rows.map((row) => mapSystem(row as Row));
}

export async function createAiSystem(workspaceId: string, input: Partial<AiSystemRecord>): Promise<AiSystemRecord> {
  const result = await query(
    `INSERT INTO ai_inventory (
      id, workspace_id, system_name, owner, business_unit, purpose, description, model_type, vendor, deployment_model,
      deployment_date, lifecycle_status, criticality, classification, risk_rating, compliance_status, use_case, data_type, industry,
      jurisdictions, cia_impacts, impact, inventory_coverage_percent, inventory_coverage_recorded, assurance_status, linked_risk_ids, linked_control_ids,
      linked_evidence_ids, linked_vendor_ids, linked_incident_ids
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22,$23,$24,$25,$26::jsonb,$27::jsonb,$28::jsonb,$29::jsonb,$30::jsonb
    ) RETURNING *`,
    [
      input.id || generateId('aisys'),
      workspaceId,
      input.systemName,
      input.owner,
      input.businessUnit,
      input.purpose,
      input.description,
      input.modelType,
      input.vendor,
      input.deploymentModel || 'internal',
      input.deploymentDate || new Date().toISOString(),
      input.lifecycleStatus || 'intake',
      input.criticality || 'medium',
      input.classification || 'limited_risk',
      input.riskRating || 'medium',
      input.complianceStatus || 'monitoring',
      input.useCase || '',
      input.dataType || '',
      input.industry || '',
      JSON.stringify(input.jurisdictions || []),
      JSON.stringify(input.ciaImpacts || []),
      input.impact || 'medium',
      input.inventoryCoveragePercent || 0,
      Boolean(input.inventoryCoverageRecorded),
      input.assuranceStatus || 'monitoring',
      JSON.stringify(input.linkedRiskIds || []),
      JSON.stringify(input.linkedControlIds || []),
      JSON.stringify(input.linkedEvidenceIds || []),
      JSON.stringify(input.linkedVendorIds || []),
      JSON.stringify(input.linkedIncidentIds || []),
    ],
  );
  return mapSystem(result.rows[0] as Row);
}

export async function updateAiSystem(workspaceId: string, id: string, input: Partial<AiSystemRecord>): Promise<AiSystemRecord | null> {
  const current = await query(`SELECT * FROM ai_inventory WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0] as Row;
  const result = await query(
    `UPDATE ai_inventory
     SET system_name = $3, owner = $4, business_unit = $5, purpose = $6, description = $7, model_type = $8, vendor = $9,
         deployment_model = $10, deployment_date = $11, lifecycle_status = $12, criticality = $13, classification = $14, risk_rating = $15,
         compliance_status = $16, use_case = $17, data_type = $18, industry = $19, jurisdictions = $20::jsonb, cia_impacts = $21::jsonb, impact = $22,
         inventory_coverage_percent = $23, inventory_coverage_recorded = $24, assurance_status = $25, linked_risk_ids = $26::jsonb, linked_control_ids = $27::jsonb,
         linked_evidence_ids = $28::jsonb, linked_vendor_ids = $29::jsonb, linked_incident_ids = $30::jsonb, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.systemName ?? row.system_name,
      input.owner ?? row.owner,
      input.businessUnit ?? row.business_unit,
      input.purpose ?? row.purpose,
      input.description ?? row.description,
      input.modelType ?? row.model_type,
      input.vendor ?? row.vendor,
      input.deploymentModel ?? row.deployment_model,
      input.deploymentDate ?? row.deployment_date,
      input.lifecycleStatus ?? row.lifecycle_status,
      input.criticality ?? row.criticality,
      input.classification ?? row.classification,
      input.riskRating ?? row.risk_rating,
      input.complianceStatus ?? row.compliance_status,
      input.useCase ?? row.use_case,
      input.dataType ?? row.data_type,
      input.industry ?? row.industry,
      JSON.stringify(input.jurisdictions ?? row.jurisdictions ?? []),
      JSON.stringify(input.ciaImpacts ?? row.cia_impacts ?? []),
      input.impact ?? row.impact,
      input.inventoryCoveragePercent ?? row.inventory_coverage_percent ?? 0,
      input.inventoryCoverageRecorded ?? Boolean(row.inventory_coverage_recorded),
      input.assuranceStatus ?? row.assurance_status,
      JSON.stringify(input.linkedRiskIds ?? row.linked_risk_ids ?? []),
      JSON.stringify(input.linkedControlIds ?? row.linked_control_ids ?? []),
      JSON.stringify(input.linkedEvidenceIds ?? row.linked_evidence_ids ?? []),
      JSON.stringify(input.linkedVendorIds ?? row.linked_vendor_ids ?? []),
      JSON.stringify(input.linkedIncidentIds ?? row.linked_incident_ids ?? []),
    ],
  );
  return mapSystem(result.rows[0] as Row);
}

export async function listAiModels(workspaceId: string): Promise<AiModelRecord[]> {
  const result = await query(`SELECT * FROM ai_models WHERE workspace_id = $1 ORDER BY updated_at DESC, model_name`, [workspaceId]);
  return result.rows.map((row) => mapModel(row as Row));
}

export async function createAiModel(workspaceId: string, input: Partial<AiModelRecord>, actorId?: string): Promise<AiModelRecord> {
  const result = await query(
    `WITH inserted AS (INSERT INTO ai_models (
      id, workspace_id, system_id, model_name, version, owner, purpose, validation_status, approval_status, retirement_date,
      lifecycle_status, model_family, accuracy, precision_score, recall_score, drift_score, bias_score, robustness_score, explainability_score, created_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::uuid
    ) RETURNING *), logged AS (
      INSERT INTO ai_model_events(workspace_id,model_id,event_type,new_status,actor_id)
      SELECT workspace_id,id,'created','pending',$19::uuid FROM inserted WHERE $19::uuid IS NOT NULL
    ) SELECT * FROM inserted`,
    [
      input.id || generateId('aimodel'),
      workspaceId,
      input.systemId || null,
      input.modelName,
      input.version,
      input.owner,
      input.purpose,
      input.validationStatus || 'pending',
      input.retirementDate || null,
      input.lifecycleStatus || 'pilot',
      input.modelFamily || '',
      input.accuracy || 0,
      input.precision || 0,
      input.recall || 0,
      input.drift || 0,
      input.biasScore || 0,
      input.robustnessScore || 0,
      input.explainabilityScore || 0,
      actorId || null,
    ],
  );
  return mapModel(result.rows[0] as Row);
}

export async function getAiModel(workspaceId: string, id: string): Promise<AiModelRecord | null> {
  const result = await query(`SELECT * FROM ai_models WHERE workspace_id=$1 AND id=$2`, [workspaceId, id]);
  return result.rows[0] ? mapModel(result.rows[0] as Row) : null;
}

export async function listAiModelEvents(workspaceId: string, modelId: string) {
  return (await query(`SELECT id,event_type "eventType",previous_status "previousStatus",new_status "newStatus",notes,actor_id "actorId",created_at "createdAt"
    FROM ai_model_events WHERE workspace_id=$1 AND model_id=$2 ORDER BY created_at DESC`, [workspaceId, modelId])).rows;
}

export async function submitAiModel(workspaceId: string, id: string, actorId: string): Promise<AiModelRecord | null> {
  const result = await query(`WITH current AS (SELECT * FROM ai_models WHERE workspace_id=$1 AND id=$2 FOR UPDATE), changed AS (
    UPDATE ai_models m SET approval_status='in_review',submitted_by=$3::uuid,submitted_at=NOW(),reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL,updated_at=NOW()
    FROM current c WHERE m.workspace_id=c.workspace_id AND m.id=c.id AND c.approval_status IN ('pending','rejected') RETURNING m.*), logged AS (
    INSERT INTO ai_model_events(workspace_id,model_id,event_type,previous_status,new_status,actor_id)
    SELECT c.workspace_id,c.id,'submitted',c.approval_status,'in_review',$3::uuid FROM current c JOIN changed d ON d.id=c.id)
    SELECT * FROM changed`, [workspaceId, id, actorId]);
  return result.rows[0] ? mapModel(result.rows[0] as Row) : null;
}

export async function decideAiModel(workspaceId: string, id: string, actorId: string, decision: 'approved'|'rejected', notes?: string): Promise<AiModelRecord | null> {
  const lifecycleStatus = decision === 'approved' ? 'active' : 'under_review';
  const result = await query(`WITH changed AS (UPDATE ai_models SET approval_status=$3,lifecycle_status=$4,reviewed_by=$5::uuid,reviewed_at=NOW(),review_notes=$6,updated_at=NOW()
    WHERE workspace_id=$1 AND id=$2 AND approval_status='in_review' AND created_by IS NOT NULL AND created_by<>$5::uuid RETURNING *), logged AS (
    INSERT INTO ai_model_events(workspace_id,model_id,event_type,previous_status,new_status,notes,actor_id)
    SELECT workspace_id,id,'review_decision','in_review',$3,$6,$5::uuid FROM changed) SELECT * FROM changed`, [workspaceId,id,decision,lifecycleStatus,actorId,notes||null]);
  return result.rows[0] ? mapModel(result.rows[0] as Row) : null;
}

export async function updateAiModel(workspaceId: string, id: string, input: Partial<AiModelRecord>): Promise<AiModelRecord | null> {
  const current = await query(`SELECT * FROM ai_models WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0] as Row;
  const result = await query(
    `UPDATE ai_models
     SET system_id = $3, model_name = $4, version = $5, owner = $6, purpose = $7, validation_status = $8, approval_status = $9,
         retirement_date = $10, lifecycle_status = $11, model_family = $12, accuracy = $13, precision_score = $14, recall_score = $15,
         drift_score = $16, bias_score = $17, robustness_score = $18, explainability_score = $19, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.systemId ?? row.system_id ?? null,
      input.modelName ?? row.model_name,
      input.version ?? row.version,
      input.owner ?? row.owner,
      input.purpose ?? row.purpose,
      input.validationStatus ?? row.validation_status,
      input.approvalStatus ?? row.approval_status,
      input.retirementDate ?? row.retirement_date ?? null,
      input.lifecycleStatus ?? row.lifecycle_status,
      input.modelFamily ?? row.model_family,
      input.accuracy ?? row.accuracy ?? 0,
      input.precision ?? row.precision_score ?? 0,
      input.recall ?? row.recall_score ?? 0,
      input.drift ?? row.drift_score ?? 0,
      input.biasScore ?? row.bias_score ?? 0,
      input.robustnessScore ?? row.robustness_score ?? 0,
      input.explainabilityScore ?? row.explainability_score ?? 0,
    ],
  );
  return mapModel(result.rows[0] as Row);
}

export async function listAiAssessments(workspaceId: string): Promise<AiRiskAssessmentRecord[]> {
  const result = await query(`SELECT * FROM ai_risk_assessments WHERE workspace_id = $1 ORDER BY overall_risk_score DESC, updated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapAssessment(row as Row));
}

export async function createAiAssessment(workspaceId: string, input: Partial<AiRiskAssessmentRecord>): Promise<AiRiskAssessmentRecord> {
  const result = await query(
    `INSERT INTO ai_risk_assessments (
      id, workspace_id, system_id, assessment_name, owner, status, bias_risk, fairness_risk, transparency_risk, privacy_risk,
      security_risk, hallucination_risk, explainability_risk, ethical_risk, safety_risk, regulatory_risk, operational_risk, vendor_risk,
      overall_risk_score, due_date
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    ) RETURNING *`,
    [
      input.id || generateId('aiasm'),
      workspaceId,
      input.systemId || null,
      input.assessmentName,
      input.owner,
      input.status || 'draft',
      input.biasRisk || 0,
      input.fairnessRisk || 0,
      input.transparencyRisk || 0,
      input.privacyRisk || 0,
      input.securityRisk || 0,
      input.hallucinationRisk || 0,
      input.explainabilityRisk || 0,
      input.ethicalRisk || 0,
      input.safetyRisk || 0,
      input.regulatoryRisk || 0,
      input.operationalRisk || 0,
      input.vendorRisk || 0,
      input.overallRiskScore || 0,
      input.dueDate || null,
    ],
  );
  return mapAssessment(result.rows[0] as Row);
}

export async function updateAiAssessmentStatus(workspaceId: string, id: string, status: AiAssessmentStatus): Promise<AiRiskAssessmentRecord | null> {
  const result = await query(`UPDATE ai_risk_assessments SET status=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId,id,status]);
  return result.rows[0] ? mapAssessment(result.rows[0] as Row) : null;
}

export async function listAiControls(workspaceId: string): Promise<AiControlRecord[]> {
  const result = await query(`SELECT * FROM ai_controls WHERE workspace_id = $1 ORDER BY category, control_name`, [workspaceId]);
  return result.rows.map((row) => mapControl(row as Row));
}

export async function createAiControl(workspaceId: string, input: Partial<AiControlRecord>): Promise<AiControlRecord> {
  const result = await query(
    `INSERT INTO ai_controls (
      id, workspace_id, control_name, category, description, owner, status, mapped_frameworks, evidence_coverage_percent, automation_level
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10
    ) RETURNING *`,
    [
      input.id || generateId('aictrl'),
      workspaceId,
      input.controlName,
      input.category,
      input.description,
      input.owner,
      input.status || 'planned',
      JSON.stringify(input.mappedFrameworks || []),
      input.evidenceCoveragePercent || 0,
      input.automationLevel || 'manual',
    ],
  );
  return mapControl(result.rows[0] as Row);
}

export async function updateAiControlStatus(workspaceId: string, id: string, status: AiControlRecord['status']): Promise<AiControlRecord | null> {
  const result = await query(`UPDATE ai_controls SET status=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId,id,status]);
  return result.rows[0] ? mapControl(result.rows[0] as Row) : null;
}

export async function listAiIncidents(workspaceId: string): Promise<AiIncidentRecord[]> {
  const result = await query(`SELECT * FROM ai_incidents WHERE workspace_id = $1 ORDER BY detected_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapIncident(row as Row));
}

export async function createAiIncident(workspaceId: string, input: Partial<AiIncidentRecord>): Promise<AiIncidentRecord> {
  const result = await query(
    `INSERT INTO ai_incidents (
      id, workspace_id, system_id, title, incident_type, severity, status, owner, detected_at, reported_externally, summary
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    ) RETURNING *`,
    [
      input.id || generateId('aiinc'),
      workspaceId,
      input.systemId || null,
      input.title,
      input.incidentType,
      input.severity || 'medium',
      input.status || 'open',
      input.owner,
      input.detectedAt || new Date().toISOString(),
      input.reportedExternally || false,
      input.summary,
    ],
  );
  return mapIncident(result.rows[0] as Row);
}

export async function updateAiIncidentStatus(workspaceId: string, id: string, status: AiIncidentStatus): Promise<AiIncidentRecord | null> {
  const result = await query(`UPDATE ai_incidents SET status=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId,id,status]);
  return result.rows[0] ? mapIncident(result.rows[0] as Row) : null;
}

export async function listAiVendors(workspaceId: string): Promise<AiVendorRecord[]> {
  const result = await query(`SELECT * FROM ai_vendors WHERE workspace_id = $1 ORDER BY risk_rating DESC, vendor_name`, [workspaceId]);
  return result.rows.map((row) => mapVendor(row as Row));
}

export async function createAiVendor(workspaceId: string, input: Partial<AiVendorRecord>): Promise<AiVendorRecord> {
  const result = await query(
    `INSERT INTO ai_vendors (
      id, workspace_id, vendor_name, vendor_category, services, risk_rating, compliance_score, contract_status, security_review_status, evidence_coverage_percent
    ) VALUES (
      $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10
    ) RETURNING *`,
    [
      input.id || generateId('aivnd'),
      workspaceId,
      input.vendorName,
      input.vendorCategory,
      JSON.stringify(input.services || []),
      input.riskRating || 'medium',
      input.complianceScore || 0,
      input.contractStatus || 'active',
      input.securityReviewStatus || 'in_progress',
      input.evidenceCoveragePercent || 0,
    ],
  );
  return mapVendor(result.rows[0] as Row);
}

export async function listAiTrainingPrograms(workspaceId: string): Promise<AiTrainingProgramRecord[]> {
  const result = await query(`SELECT * FROM ai_training_programs WHERE workspace_id = $1 ORDER BY completion_rate DESC, program_name`, [workspaceId]);
  return result.rows.map((row) => mapTraining(row as Row));
}

export async function createAiTrainingProgram(workspaceId: string, input: Partial<AiTrainingProgramRecord>): Promise<AiTrainingProgramRecord> {
  const result = await query(
    `INSERT INTO ai_training_programs (
      id, workspace_id, program_name, focus_area, completion_rate, overdue_learners, certification_status, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8
    ) RETURNING *`,
    [
      input.id || generateId('aitrn'),
      workspaceId,
      input.programName,
      input.focusArea,
      input.completionRate || 0,
      input.overdueLearners || 0,
      input.certificationStatus || 'healthy',
      input.status || 'planned',
    ],
  );
  return mapTraining(result.rows[0] as Row);
}

export async function listAiReports(workspaceId: string): Promise<AiReportRecord[]> {
  const result = await query(`SELECT * FROM ai_reports WHERE workspace_id = $1 ORDER BY generated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapReport(row as Row));
}

export async function createAiReport(workspaceId: string, input: Partial<AiReportRecord>): Promise<AiReportRecord> {
  const result = await query(
    `INSERT INTO ai_reports (id, workspace_id, report_type, title, status, generated_by, summary, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [
      input.id || generateId('airpt'),
      workspaceId,
      input.reportType,
      input.title,
      input.status || 'generated',
      input.generatedBy,
      JSON.stringify(input.summary || []),
      input.generatedAt || new Date().toISOString(),
    ],
  );
  return mapReport(result.rows[0] as Row);
}

export async function listAiCompliancePrograms(workspaceId: string): Promise<AiComplianceProgramRecord[]> {
  const result = await query(`SELECT * FROM ai_compliance_programs WHERE workspace_id = $1 ORDER BY framework_name`, [workspaceId]);
  return result.rows.map((row) => mapComplianceProgram(row as Row));
}

export async function upsertAiComplianceProgram(workspaceId: string, input: Partial<AiComplianceProgramRecord>): Promise<AiComplianceProgramRecord> {
  const result = await query(
    `INSERT INTO ai_compliance_programs (
      id, workspace_id, framework_code, framework_name, score, target_score, gap_count, control_coverage_percent,
      evidence_coverage_percent, documentation_coverage_percent, training_coverage_percent, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
    )
    ON CONFLICT (workspace_id, framework_code)
    DO UPDATE SET framework_name = EXCLUDED.framework_name,
                  score = EXCLUDED.score,
                  target_score = EXCLUDED.target_score,
                  gap_count = EXCLUDED.gap_count,
                  control_coverage_percent = EXCLUDED.control_coverage_percent,
                  evidence_coverage_percent = EXCLUDED.evidence_coverage_percent,
                  documentation_coverage_percent = EXCLUDED.documentation_coverage_percent,
                  training_coverage_percent = EXCLUDED.training_coverage_percent,
                  status = EXCLUDED.status,
                  updated_at = NOW()
    RETURNING *`,
    [
      input.id || generateId('aicmp'),
      workspaceId,
      input.frameworkCode,
      input.frameworkName,
      input.score || 0,
      input.targetScore || 0,
      input.gapCount || 0,
      input.controlCoveragePercent || 0,
      input.evidenceCoveragePercent || 0,
      input.documentationCoveragePercent || 0,
      input.trainingCoveragePercent || 0,
      input.status || 'watch',
    ],
  );
  return mapComplianceProgram(result.rows[0] as Row);
}

export async function getAiGovernanceSummary(workspaceId: string): Promise<AiGovernanceSummary> {
  const [systems, assessments, controls, incidents, vendors, models, training, programs] = await Promise.all([
    listAiSystems(workspaceId),
    listAiAssessments(workspaceId),
    listAiControls(workspaceId),
    listAiIncidents(workspaceId),
    listAiVendors(workspaceId),
    listAiModels(workspaceId),
    listAiTrainingPrograms(workspaceId),
    listAiCompliancePrograms(workspaceId),
  ]);

  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const aiComplianceScore = avg(programs.map((item) => item.score));
  const aiRiskScore = avg(assessments.map((item) => item.overallRiskScore));
  const aiControlsCoverage = avg(controls.map((item) => item.evidenceCoveragePercent));
  const assessedInventory = systems.filter((item) => item.inventoryCoverageRecorded);
  const aiInventoryCoverage = avg(assessedInventory.map((item) => item.inventoryCoveragePercent));
  const aiAssuranceStatus: number | null = assessedInventory.length
    ? Math.round((assessedInventory.filter((item) => item.assuranceStatus === 'assured').length / assessedInventory.length) * 100)
    : null;
  const modelRiskScore = avg(models.map((item) => (item.drift + item.biasScore + (100 - item.robustnessScore)) / 3));
  const responsibleAiComponents = [
    avg(training.map((item) => item.completionRate)),
    avg(controls.map((item) => item.evidenceCoveragePercent)),
    avg(programs.map((item) => item.documentationCoveragePercent)),
  ].filter((value): value is number => value !== null);
  const responsibleAiScore = avg(responsibleAiComponents);
  const maturityComponents = [
    aiComplianceScore,
    aiRiskScore === null ? null : Math.max(0, 100 - aiRiskScore),
    aiControlsCoverage,
    aiInventoryCoverage,
    responsibleAiScore,
  ].filter((value): value is number => value !== null);
  const aiMaturityScore = avg(maturityComponents);

  return {
    aiSystems: systems.length,
    highRiskAi: systems.filter((item) => item.classification === 'high_risk' || item.riskRating === 'critical' || item.riskRating === 'high').length,
    aiVendors: vendors.length,
    aiAssessments: assessments.length,
    aiIncidents: incidents.length,
    aiComplianceScore,
    aiRiskScore,
    aiControlsCoverage,
    aiInventoryCoverage,
    aiAssuranceStatus,
    modelRiskScore,
    responsibleAiScore,
    aiMaturityScore,
  };
}
