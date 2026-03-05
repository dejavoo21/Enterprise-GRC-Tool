import {
  VendorRiskAssessment,
  CreateVendorRiskAssessmentInput,
  VendorQuestionnaire,
  CreateVendorQuestionnaireInput,
  VendorQuestionnaireQuestion,
  CreateVendorQuestionnaireQuestionInput,
  VendorQuestionnaireResponse,
  CreateVendorQuestionnaireResponseInput,
  VendorSubprocessor,
  CreateVendorSubprocessorInput,
  VendorContract,
  CreateVendorContractInput,
  VendorIncident,
  CreateVendorIncidentInput,
  TPRMSummary,
  VendorAssessmentFinding,
} from '../types/models';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Vendor Risk Assessments
// ============================================

function rowToAssessment(row: Record<string, unknown>): VendorRiskAssessment {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    vendorId: row.vendor_id as string,
    assessmentType: row.assessment_type as VendorRiskAssessment['assessmentType'],
    status: row.status as VendorRiskAssessment['status'],
    riskTier: row.risk_tier as VendorRiskAssessment['riskTier'],
    inherentRiskScore: row.inherent_risk_score as number | undefined,
    residualRiskScore: row.residual_risk_score as number | undefined,
    dueDate: row.due_date ? (row.due_date as Date).toISOString().split('T')[0] : undefined,
    completedDate: row.completed_date ? (row.completed_date as Date).toISOString().split('T')[0] : undefined,
    nextReviewDate: row.next_review_date ? (row.next_review_date as Date).toISOString().split('T')[0] : undefined,
    assessorId: row.assessor_id as string | undefined,
    reviewerId: row.reviewer_id as string | undefined,
    findings: (row.findings as VendorAssessmentFinding[]) || [],
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    vendorName: row.vendor_name as string | undefined,
    assessorName: row.assessor_name as string | undefined,
    reviewerName: row.reviewer_name as string | undefined,
  };
}

export async function getAssessments(
  workspaceId: string,
  filter?: { vendorId?: string; status?: string; riskTier?: string }
): Promise<VendorRiskAssessment[]> {
  let queryText = `
    SELECT a.*, v.name as vendor_name,
           u1.full_name as assessor_name, u2.full_name as reviewer_name
    FROM vendor_risk_assessments a
    LEFT JOIN vendors v ON a.vendor_id = v.id
    LEFT JOIN users u1 ON a.assessor_id = u1.id
    LEFT JOIN users u2 ON a.reviewer_id = u2.id
    WHERE a.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];
  let paramCount = 2;

  if (filter?.vendorId) {
    queryText += ` AND a.vendor_id = $${paramCount}`;
    params.push(filter.vendorId);
    paramCount++;
  }
  if (filter?.status) {
    queryText += ` AND a.status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }
  if (filter?.riskTier) {
    queryText += ` AND a.risk_tier = $${paramCount}`;
    params.push(filter.riskTier);
    paramCount++;
  }

  queryText += ' ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC';

  const result = await query<Record<string, unknown>>(queryText, params);
  return result.rows.map(rowToAssessment);
}

export async function getAssessmentById(
  workspaceId: string,
  id: string
): Promise<VendorRiskAssessment | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT a.*, v.name as vendor_name,
            u1.full_name as assessor_name, u2.full_name as reviewer_name
     FROM vendor_risk_assessments a
     LEFT JOIN vendors v ON a.vendor_id = v.id
     LEFT JOIN users u1 ON a.assessor_id = u1.id
     LEFT JOIN users u2 ON a.reviewer_id = u2.id
     WHERE a.id = $1 AND a.workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToAssessment(result.rows[0]);
}

export async function createAssessment(
  workspaceId: string,
  input: CreateVendorRiskAssessmentInput
): Promise<VendorRiskAssessment> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_risk_assessments (
      id, workspace_id, vendor_id, assessment_type, risk_tier, due_date, assessor_id, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.vendorId,
      input.assessmentType || 'initial',
      input.riskTier || null,
      input.dueDate || null,
      input.assessorId || null,
      input.notes || null,
    ]
  );
  return rowToAssessment(result.rows[0]);
}

export async function updateAssessment(
  workspaceId: string,
  id: string,
  input: Partial<VendorRiskAssessment>
): Promise<VendorRiskAssessment | null> {
  const fields: string[] = [];
  const params: unknown[] = [id, workspaceId];
  let paramCount = 3;

  const fieldMap: Record<string, string> = {
    assessmentType: 'assessment_type',
    status: 'status',
    riskTier: 'risk_tier',
    inherentRiskScore: 'inherent_risk_score',
    residualRiskScore: 'residual_risk_score',
    dueDate: 'due_date',
    completedDate: 'completed_date',
    nextReviewDate: 'next_review_date',
    assessorId: 'assessor_id',
    reviewerId: 'reviewer_id',
    findings: 'findings',
    notes: 'notes',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (input[key as keyof typeof input] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      const value = input[key as keyof typeof input];
      params.push(key === 'findings' ? JSON.stringify(value) : value);
      paramCount++;
    }
  }

  if (fields.length === 0) return getAssessmentById(workspaceId, id);

  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_risk_assessments SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToAssessment(result.rows[0]);
}

export async function deleteAssessment(workspaceId: string, id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM vendor_risk_assessments WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

// ============================================
// Vendor Questionnaires
// ============================================

function rowToQuestionnaire(row: Record<string, unknown>): VendorQuestionnaire {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    vendorId: row.vendor_id as string | undefined,
    assessmentId: row.assessment_id as string | undefined,
    name: row.name as string,
    description: row.description as string | undefined,
    questionnaireType: row.questionnaire_type as VendorQuestionnaire['questionnaireType'],
    isTemplate: row.is_template as boolean,
    status: row.status as VendorQuestionnaire['status'],
    sentDate: row.sent_date ? (row.sent_date as Date).toISOString().split('T')[0] : undefined,
    dueDate: row.due_date ? (row.due_date as Date).toISOString().split('T')[0] : undefined,
    submittedDate: row.submitted_date ? (row.submitted_date as Date).toISOString().split('T')[0] : undefined,
    reviewedDate: row.reviewed_date ? (row.reviewed_date as Date).toISOString().split('T')[0] : undefined,
    completionPercentage: row.completion_percentage as number,
    riskScore: row.risk_score as number | undefined,
    createdBy: row.created_by as string | undefined,
    reviewedBy: row.reviewed_by as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    vendorName: row.vendor_name as string | undefined,
    questionCount: row.question_count as number | undefined,
    respondedCount: row.responded_count as number | undefined,
  };
}

export async function getQuestionnaires(
  workspaceId: string,
  filter?: { vendorId?: string; isTemplate?: boolean; status?: string }
): Promise<VendorQuestionnaire[]> {
  let queryText = `
    SELECT q.*, v.name as vendor_name,
           (SELECT COUNT(*) FROM vendor_questionnaire_questions WHERE questionnaire_id = q.id) as question_count,
           (SELECT COUNT(*) FROM vendor_questionnaire_responses r
            JOIN vendor_questionnaire_questions qq ON r.question_id = qq.id
            WHERE qq.questionnaire_id = q.id AND r.response_text IS NOT NULL) as responded_count
    FROM vendor_questionnaires q
    LEFT JOIN vendors v ON q.vendor_id = v.id
    WHERE q.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];
  let paramCount = 2;

  if (filter?.vendorId) {
    queryText += ` AND q.vendor_id = $${paramCount}`;
    params.push(filter.vendorId);
    paramCount++;
  }
  if (filter?.isTemplate !== undefined) {
    queryText += ` AND q.is_template = $${paramCount}`;
    params.push(filter.isTemplate);
    paramCount++;
  }
  if (filter?.status) {
    queryText += ` AND q.status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }

  queryText += ' ORDER BY q.created_at DESC';

  const result = await query<Record<string, unknown>>(queryText, params);
  return result.rows.map(rowToQuestionnaire);
}

export async function getQuestionnaireById(
  workspaceId: string,
  id: string
): Promise<VendorQuestionnaire | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT q.*, v.name as vendor_name,
            (SELECT COUNT(*) FROM vendor_questionnaire_questions WHERE questionnaire_id = q.id) as question_count,
            (SELECT COUNT(*) FROM vendor_questionnaire_responses r
             JOIN vendor_questionnaire_questions qq ON r.question_id = qq.id
             WHERE qq.questionnaire_id = q.id AND r.response_text IS NOT NULL) as responded_count
     FROM vendor_questionnaires q
     LEFT JOIN vendors v ON q.vendor_id = v.id
     WHERE q.id = $1 AND q.workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToQuestionnaire(result.rows[0]);
}

export async function createQuestionnaire(
  workspaceId: string,
  input: CreateVendorQuestionnaireInput,
  userId?: string
): Promise<VendorQuestionnaire> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_questionnaires (
      id, workspace_id, vendor_id, assessment_id, name, description,
      questionnaire_type, is_template, due_date, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.vendorId || null,
      input.assessmentId || null,
      input.name,
      input.description || null,
      input.questionnaireType || 'security',
      input.isTemplate || false,
      input.dueDate || null,
      userId || null,
    ]
  );
  return rowToQuestionnaire(result.rows[0]);
}

export async function updateQuestionnaire(
  workspaceId: string,
  id: string,
  input: Partial<VendorQuestionnaire>
): Promise<VendorQuestionnaire | null> {
  const fields: string[] = [];
  const params: unknown[] = [id, workspaceId];
  let paramCount = 3;

  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    questionnaireType: 'questionnaire_type',
    status: 'status',
    sentDate: 'sent_date',
    dueDate: 'due_date',
    submittedDate: 'submitted_date',
    reviewedDate: 'reviewed_date',
    completionPercentage: 'completion_percentage',
    riskScore: 'risk_score',
    reviewedBy: 'reviewed_by',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (input[key as keyof typeof input] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      params.push(input[key as keyof typeof input]);
      paramCount++;
    }
  }

  if (fields.length === 0) return getQuestionnaireById(workspaceId, id);

  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_questionnaires SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToQuestionnaire(result.rows[0]);
}

export async function deleteQuestionnaire(workspaceId: string, id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM vendor_questionnaires WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

// ============================================
// Questionnaire Questions
// ============================================

function rowToQuestion(row: Record<string, unknown>): VendorQuestionnaireQuestion {
  return {
    id: row.id as string,
    questionnaireId: row.questionnaire_id as string,
    category: row.category as string,
    questionText: row.question_text as string,
    questionType: row.question_type as VendorQuestionnaireQuestion['questionType'],
    options: row.options as string[] | undefined,
    isRequired: row.is_required as boolean,
    weight: row.weight as number,
    riskIfNegative: row.risk_if_negative as VendorQuestionnaireQuestion['riskIfNegative'],
    displayOrder: row.display_order as number,
    guidance: row.guidance as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getQuestionsByQuestionnaireId(
  questionnaireId: string
): Promise<VendorQuestionnaireQuestion[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM vendor_questionnaire_questions
     WHERE questionnaire_id = $1
     ORDER BY display_order ASC, created_at ASC`,
    [questionnaireId]
  );
  return result.rows.map(rowToQuestion);
}

export async function createQuestion(
  input: CreateVendorQuestionnaireQuestionInput
): Promise<VendorQuestionnaireQuestion> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_questionnaire_questions (
      id, questionnaire_id, category, question_text, question_type,
      options, is_required, weight, risk_if_negative, display_order, guidance
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id,
      input.questionnaireId,
      input.category,
      input.questionText,
      input.questionType || 'text',
      input.options ? JSON.stringify(input.options) : null,
      input.isRequired !== false,
      input.weight || 1,
      input.riskIfNegative || 'medium',
      input.displayOrder || 0,
      input.guidance || null,
    ]
  );
  return rowToQuestion(result.rows[0]);
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const result = await query('DELETE FROM vendor_questionnaire_questions WHERE id = $1', [id]);
  return result.rowCount ? result.rowCount > 0 : false;
}

// ============================================
// Questionnaire Responses
// ============================================

function rowToResponse(row: Record<string, unknown>): VendorQuestionnaireResponse {
  return {
    id: row.id as string,
    questionId: row.question_id as string,
    responseText: row.response_text as string | undefined,
    responseValue: row.response_value as Record<string, unknown> | undefined,
    fileUrl: row.file_url as string | undefined,
    isCompliant: row.is_compliant as boolean | undefined,
    riskFlag: row.risk_flag as VendorQuestionnaireResponse['riskFlag'],
    reviewerNotes: row.reviewer_notes as string | undefined,
    respondedAt: row.responded_at ? (row.responded_at as Date).toISOString() : undefined,
    reviewedAt: row.reviewed_at ? (row.reviewed_at as Date).toISOString() : undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function getResponseByQuestionId(
  questionId: string
): Promise<VendorQuestionnaireResponse | null> {
  const result = await query<Record<string, unknown>>(
    'SELECT * FROM vendor_questionnaire_responses WHERE question_id = $1',
    [questionId]
  );
  if (result.rows.length === 0) return null;
  return rowToResponse(result.rows[0]);
}

export async function upsertResponse(
  input: CreateVendorQuestionnaireResponseInput
): Promise<VendorQuestionnaireResponse> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_questionnaire_responses (
      id, question_id, response_text, response_value, file_url, responded_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (question_id) DO UPDATE SET
      response_text = EXCLUDED.response_text,
      response_value = EXCLUDED.response_value,
      file_url = EXCLUDED.file_url,
      responded_at = NOW(),
      updated_at = NOW()
    RETURNING *`,
    [
      id,
      input.questionId,
      input.responseText || null,
      input.responseValue ? JSON.stringify(input.responseValue) : null,
      input.fileUrl || null,
    ]
  );
  return rowToResponse(result.rows[0]);
}

// ============================================
// Vendor Subprocessors
// ============================================

function rowToSubprocessor(row: Record<string, unknown>): VendorSubprocessor {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    vendorId: row.vendor_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    serviceType: row.service_type as string | undefined,
    dataAccess: row.data_access as VendorSubprocessor['dataAccess'],
    dataTypes: (row.data_types as string[]) || [],
    location: row.location as string | undefined,
    riskTier: row.risk_tier as VendorSubprocessor['riskTier'],
    status: row.status as VendorSubprocessor['status'],
    contractEndDate: row.contract_end_date ? (row.contract_end_date as Date).toISOString().split('T')[0] : undefined,
    lastReviewed: row.last_reviewed ? (row.last_reviewed as Date).toISOString().split('T')[0] : undefined,
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    vendorName: row.vendor_name as string | undefined,
  };
}

export async function getSubprocessors(
  workspaceId: string,
  filter?: { vendorId?: string; riskTier?: string; status?: string }
): Promise<VendorSubprocessor[]> {
  let queryText = `
    SELECT s.*, v.name as vendor_name
    FROM vendor_subprocessors s
    LEFT JOIN vendors v ON s.vendor_id = v.id
    WHERE s.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];
  let paramCount = 2;

  if (filter?.vendorId) {
    queryText += ` AND s.vendor_id = $${paramCount}`;
    params.push(filter.vendorId);
    paramCount++;
  }
  if (filter?.riskTier) {
    queryText += ` AND s.risk_tier = $${paramCount}`;
    params.push(filter.riskTier);
    paramCount++;
  }
  if (filter?.status) {
    queryText += ` AND s.status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }

  queryText += ' ORDER BY s.name ASC';

  const result = await query<Record<string, unknown>>(queryText, params);
  return result.rows.map(rowToSubprocessor);
}

export async function getSubprocessorById(
  workspaceId: string,
  id: string
): Promise<VendorSubprocessor | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT s.*, v.name as vendor_name
     FROM vendor_subprocessors s
     LEFT JOIN vendors v ON s.vendor_id = v.id
     WHERE s.id = $1 AND s.workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToSubprocessor(result.rows[0]);
}

export async function createSubprocessor(
  workspaceId: string,
  input: CreateVendorSubprocessorInput
): Promise<VendorSubprocessor> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_subprocessors (
      id, workspace_id, vendor_id, name, description, service_type,
      data_access, data_types, location, risk_tier, contract_end_date, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.vendorId,
      input.name,
      input.description || null,
      input.serviceType || null,
      input.dataAccess || 'none',
      input.dataTypes || [],
      input.location || null,
      input.riskTier || 'medium',
      input.contractEndDate || null,
      input.notes || null,
    ]
  );
  return rowToSubprocessor(result.rows[0]);
}

export async function updateSubprocessor(
  workspaceId: string,
  id: string,
  input: Partial<VendorSubprocessor>
): Promise<VendorSubprocessor | null> {
  const fields: string[] = [];
  const params: unknown[] = [id, workspaceId];
  let paramCount = 3;

  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    serviceType: 'service_type',
    dataAccess: 'data_access',
    dataTypes: 'data_types',
    location: 'location',
    riskTier: 'risk_tier',
    status: 'status',
    contractEndDate: 'contract_end_date',
    lastReviewed: 'last_reviewed',
    notes: 'notes',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (input[key as keyof typeof input] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      params.push(input[key as keyof typeof input]);
      paramCount++;
    }
  }

  if (fields.length === 0) return getSubprocessorById(workspaceId, id);

  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_subprocessors SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToSubprocessor(result.rows[0]);
}

export async function deleteSubprocessor(workspaceId: string, id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM vendor_subprocessors WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

// ============================================
// Vendor Contracts
// ============================================

function rowToContract(row: Record<string, unknown>): VendorContract {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    vendorId: row.vendor_id as string,
    contractName: row.contract_name as string,
    contractType: row.contract_type as VendorContract['contractType'],
    status: row.status as VendorContract['status'],
    effectiveDate: row.effective_date ? (row.effective_date as Date).toISOString().split('T')[0] : undefined,
    expirationDate: row.expiration_date ? (row.expiration_date as Date).toISOString().split('T')[0] : undefined,
    renewalType: row.renewal_type as VendorContract['renewalType'],
    renewalNoticeDays: row.renewal_notice_days as number,
    contractValue: row.contract_value ? parseFloat(row.contract_value as string) : undefined,
    currency: row.currency as string,
    keyTerms: (row.key_terms as Record<string, unknown>) || {},
    documentUrl: row.document_url as string | undefined,
    ownerId: row.owner_id as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    vendorName: row.vendor_name as string | undefined,
    ownerName: row.owner_name as string | undefined,
  };
}

export async function getContracts(
  workspaceId: string,
  filter?: { vendorId?: string; status?: string; contractType?: string }
): Promise<VendorContract[]> {
  let queryText = `
    SELECT c.*, v.name as vendor_name, u.full_name as owner_name
    FROM vendor_contracts c
    LEFT JOIN vendors v ON c.vendor_id = v.id
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];
  let paramCount = 2;

  if (filter?.vendorId) {
    queryText += ` AND c.vendor_id = $${paramCount}`;
    params.push(filter.vendorId);
    paramCount++;
  }
  if (filter?.status) {
    queryText += ` AND c.status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }
  if (filter?.contractType) {
    queryText += ` AND c.contract_type = $${paramCount}`;
    params.push(filter.contractType);
    paramCount++;
  }

  queryText += ' ORDER BY c.expiration_date ASC NULLS LAST, c.created_at DESC';

  const result = await query<Record<string, unknown>>(queryText, params);
  return result.rows.map(rowToContract);
}

export async function getContractById(
  workspaceId: string,
  id: string
): Promise<VendorContract | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT c.*, v.name as vendor_name, u.full_name as owner_name
     FROM vendor_contracts c
     LEFT JOIN vendors v ON c.vendor_id = v.id
     LEFT JOIN users u ON c.owner_id = u.id
     WHERE c.id = $1 AND c.workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToContract(result.rows[0]);
}

export async function createContract(
  workspaceId: string,
  input: CreateVendorContractInput
): Promise<VendorContract> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_contracts (
      id, workspace_id, vendor_id, contract_name, contract_type, effective_date,
      expiration_date, renewal_type, renewal_notice_days, contract_value, currency,
      key_terms, document_url, owner_id, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.vendorId,
      input.contractName,
      input.contractType || 'msa',
      input.effectiveDate || null,
      input.expirationDate || null,
      input.renewalType || 'manual',
      input.renewalNoticeDays || 30,
      input.contractValue || null,
      input.currency || 'USD',
      JSON.stringify(input.keyTerms || {}),
      input.documentUrl || null,
      input.ownerId || null,
      input.notes || null,
    ]
  );
  return rowToContract(result.rows[0]);
}

export async function updateContract(
  workspaceId: string,
  id: string,
  input: Partial<VendorContract>
): Promise<VendorContract | null> {
  const fields: string[] = [];
  const params: unknown[] = [id, workspaceId];
  let paramCount = 3;

  const fieldMap: Record<string, string> = {
    contractName: 'contract_name',
    contractType: 'contract_type',
    status: 'status',
    effectiveDate: 'effective_date',
    expirationDate: 'expiration_date',
    renewalType: 'renewal_type',
    renewalNoticeDays: 'renewal_notice_days',
    contractValue: 'contract_value',
    currency: 'currency',
    keyTerms: 'key_terms',
    documentUrl: 'document_url',
    ownerId: 'owner_id',
    notes: 'notes',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (input[key as keyof typeof input] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      const value = input[key as keyof typeof input];
      params.push(key === 'keyTerms' ? JSON.stringify(value) : value);
      paramCount++;
    }
  }

  if (fields.length === 0) return getContractById(workspaceId, id);

  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_contracts SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToContract(result.rows[0]);
}

export async function deleteContract(workspaceId: string, id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM vendor_contracts WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

// ============================================
// Vendor Incidents
// ============================================

function rowToIncident(row: Record<string, unknown>): VendorIncident {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    vendorId: row.vendor_id as string,
    incidentType: row.incident_type as VendorIncident['incidentType'],
    severity: row.severity as VendorIncident['severity'],
    status: row.status as VendorIncident['status'],
    title: row.title as string,
    description: row.description as string | undefined,
    impact: row.impact as string | undefined,
    dataAffected: row.data_affected as boolean,
    dataTypesAffected: (row.data_types_affected as string[]) || [],
    recordsAffected: row.records_affected as number | undefined,
    occurredAt: row.occurred_at ? (row.occurred_at as Date).toISOString() : undefined,
    detectedAt: row.detected_at ? (row.detected_at as Date).toISOString() : undefined,
    reportedAt: (row.reported_at as Date).toISOString(),
    resolvedAt: row.resolved_at ? (row.resolved_at as Date).toISOString() : undefined,
    rootCause: row.root_cause as string | undefined,
    remediation: row.remediation as string | undefined,
    lessonsLearned: row.lessons_learned as string | undefined,
    reportedBy: row.reported_by as string | undefined,
    assignedTo: row.assigned_to as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    vendorName: row.vendor_name as string | undefined,
    reportedByName: row.reported_by_name as string | undefined,
    assignedToName: row.assigned_to_name as string | undefined,
  };
}

export async function getIncidents(
  workspaceId: string,
  filter?: { vendorId?: string; severity?: string; status?: string; incidentType?: string }
): Promise<VendorIncident[]> {
  let queryText = `
    SELECT i.*, v.name as vendor_name,
           u1.full_name as reported_by_name, u2.full_name as assigned_to_name
    FROM vendor_incidents i
    LEFT JOIN vendors v ON i.vendor_id = v.id
    LEFT JOIN users u1 ON i.reported_by = u1.id
    LEFT JOIN users u2 ON i.assigned_to = u2.id
    WHERE i.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];
  let paramCount = 2;

  if (filter?.vendorId) {
    queryText += ` AND i.vendor_id = $${paramCount}`;
    params.push(filter.vendorId);
    paramCount++;
  }
  if (filter?.severity) {
    queryText += ` AND i.severity = $${paramCount}`;
    params.push(filter.severity);
    paramCount++;
  }
  if (filter?.status) {
    queryText += ` AND i.status = $${paramCount}`;
    params.push(filter.status);
    paramCount++;
  }
  if (filter?.incidentType) {
    queryText += ` AND i.incident_type = $${paramCount}`;
    params.push(filter.incidentType);
    paramCount++;
  }

  queryText += ' ORDER BY i.reported_at DESC';

  const result = await query<Record<string, unknown>>(queryText, params);
  return result.rows.map(rowToIncident);
}

export async function getIncidentById(
  workspaceId: string,
  id: string
): Promise<VendorIncident | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT i.*, v.name as vendor_name,
            u1.full_name as reported_by_name, u2.full_name as assigned_to_name
     FROM vendor_incidents i
     LEFT JOIN vendors v ON i.vendor_id = v.id
     LEFT JOIN users u1 ON i.reported_by = u1.id
     LEFT JOIN users u2 ON i.assigned_to = u2.id
     WHERE i.id = $1 AND i.workspace_id = $2`,
    [id, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToIncident(result.rows[0]);
}

export async function createIncident(
  workspaceId: string,
  input: CreateVendorIncidentInput,
  userId?: string
): Promise<VendorIncident> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_incidents (
      id, workspace_id, vendor_id, incident_type, severity, title, description,
      impact, data_affected, data_types_affected, records_affected,
      occurred_at, detected_at, assigned_to, reported_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      id,
      workspaceId,
      input.vendorId,
      input.incidentType,
      input.severity || 'medium',
      input.title,
      input.description || null,
      input.impact || null,
      input.dataAffected || false,
      input.dataTypesAffected || [],
      input.recordsAffected || null,
      input.occurredAt || null,
      input.detectedAt || null,
      input.assignedTo || null,
      userId || null,
    ]
  );
  return rowToIncident(result.rows[0]);
}

export async function updateIncident(
  workspaceId: string,
  id: string,
  input: Partial<VendorIncident>
): Promise<VendorIncident | null> {
  const fields: string[] = [];
  const params: unknown[] = [id, workspaceId];
  let paramCount = 3;

  const fieldMap: Record<string, string> = {
    incidentType: 'incident_type',
    severity: 'severity',
    status: 'status',
    title: 'title',
    description: 'description',
    impact: 'impact',
    dataAffected: 'data_affected',
    dataTypesAffected: 'data_types_affected',
    recordsAffected: 'records_affected',
    occurredAt: 'occurred_at',
    detectedAt: 'detected_at',
    resolvedAt: 'resolved_at',
    rootCause: 'root_cause',
    remediation: 'remediation',
    lessonsLearned: 'lessons_learned',
    assignedTo: 'assigned_to',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (input[key as keyof typeof input] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      params.push(input[key as keyof typeof input]);
      paramCount++;
    }
  }

  if (fields.length === 0) return getIncidentById(workspaceId, id);

  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_incidents SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToIncident(result.rows[0]);
}

export async function deleteIncident(workspaceId: string, id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM vendor_incidents WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

// ============================================
// TPRM Summary for Executive Dashboard
// ============================================

export async function getTPRMSummary(workspaceId: string): Promise<TPRMSummary> {
  const [vendors, assessments, incidents, contracts, questionnaires] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT risk_level, COUNT(*) as count FROM vendors
       WHERE workspace_id = $1 GROUP BY risk_level`,
      [workspaceId]
    ),
    query<Record<string, unknown>>(
      `SELECT
         COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE + INTERVAL '30 days' AND status NOT IN ('completed', 'expired')) as due_soon,
         COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed', 'expired')) as overdue,
         AVG(residual_risk_score) as avg_risk_score
       FROM vendor_risk_assessments WHERE workspace_id = $1`,
      [workspaceId]
    ),
    query<Record<string, unknown>>(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed')) as open_count,
         COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved', 'closed')) as critical_count
       FROM vendor_incidents WHERE workspace_id = $1`,
      [workspaceId]
    ),
    query<Record<string, unknown>>(
      `SELECT COUNT(*) as expiring_soon
       FROM vendor_contracts
       WHERE workspace_id = $1
         AND status = 'active'
         AND expiration_date <= CURRENT_DATE + INTERVAL '60 days'
         AND expiration_date > CURRENT_DATE`,
      [workspaceId]
    ),
    query<Record<string, unknown>>(
      `SELECT COUNT(*) as pending
       FROM vendor_questionnaires
       WHERE workspace_id = $1 AND status IN ('sent', 'in_progress')`,
      [workspaceId]
    ),
  ]);

  const vendorsByRiskTier = { critical: 0, high: 0, medium: 0, low: 0 };
  let totalVendors = 0;
  for (const row of vendors.rows) {
    const level = row.risk_level as string;
    const count = parseInt(row.count as string, 10);
    totalVendors += count;
    if (level in vendorsByRiskTier) {
      vendorsByRiskTier[level as keyof typeof vendorsByRiskTier] = count;
    }
  }

  const assessmentRow = assessments.rows[0] || {};
  const incidentRow = incidents.rows[0] || {};
  const contractRow = contracts.rows[0] || {};
  const questionnaireRow = questionnaires.rows[0] || {};

  return {
    totalVendors,
    vendorsByRiskTier,
    assessmentsDue: parseInt(assessmentRow.due_soon as string, 10) || 0,
    overdueAssessments: parseInt(assessmentRow.overdue as string, 10) || 0,
    openIncidents: parseInt(incidentRow.open_count as string, 10) || 0,
    criticalIncidents: parseInt(incidentRow.critical_count as string, 10) || 0,
    contractsExpiringSoon: parseInt(contractRow.expiring_soon as string, 10) || 0,
    pendingQuestionnaires: parseInt(questionnaireRow.pending as string, 10) || 0,
    averageRiskScore: Math.round(parseFloat(assessmentRow.avg_risk_score as string) || 0),
  };
}
