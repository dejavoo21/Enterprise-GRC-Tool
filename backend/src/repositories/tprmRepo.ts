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
import { assertAssessmentTransition, assertContractTransition, assertIndependentDecision, assertQuestionnaireResponseAllowed, assertQuestionnaireTransition, assertSupplierIncidentResolution, assertSupplierIncidentTransition, calculateContractDates, type SupplierAssessmentStatus, type SupplierContractStatus, type SupplierIncidentStatus, type SupplierQuestionnaireStatus } from '../services/supplierContractRules.js';

function isMissingRelationError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '42P01'
  );
}

async function safeSummaryQuery<T extends Record<string, unknown>>(
  text: string,
  params: unknown[],
  fallback: T
): Promise<T> {
  try {
    const result = await query<Record<string, unknown>>(text, params);
    return (result.rows[0] as T | undefined) || fallback;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return fallback;
    }
    throw error;
  }
}

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
    targetRiskScore: row.target_risk_score as number | undefined,
    dueDate: row.due_date ? (row.due_date as Date).toISOString().split('T')[0] : undefined,
    completedDate: row.completed_date ? (row.completed_date as Date).toISOString().split('T')[0] : undefined,
    nextReviewDate: row.next_review_date ? (row.next_review_date as Date).toISOString().split('T')[0] : undefined,
    assessorId: row.assessor_id as string | undefined,
    reviewerId: row.reviewer_id as string | undefined,
    createdBy: row.created_by as string | undefined,
    submittedBy: row.submitted_by as string | undefined,
    submittedAt: row.submitted_at ? (row.submitted_at as Date).toISOString() : undefined,
    reviewDecision: row.review_decision as string | undefined,
    reviewReason: row.review_reason as string | undefined,
    reviewedAt: row.reviewed_at ? (row.reviewed_at as Date).toISOString() : undefined,
    evidenceRequirements: (row.evidence_requirements as string[]) || [],
    evidenceReferences: (row.evidence_references as string[]) || [],
    remediationActions: (row.remediation_actions as Array<Record<string, unknown>>) || [],
    configuration: (row.configuration as Record<string, unknown>) || {},
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
  input: CreateVendorRiskAssessmentInput,
  actorId?: string,
): Promise<VendorRiskAssessment> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_risk_assessments (
      id, workspace_id, vendor_id, assessment_type, risk_tier, due_date, assessor_id, notes, status, created_by
    ) SELECT $1,$2,$3,$4,$5,$6,$7,$8,'not_started',$9::uuid
      WHERE EXISTS (SELECT 1 FROM vendors WHERE id=$3 AND workspace_id=$2 AND archived_at IS NULL)
        AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM workspace_user_memberships WHERE workspace_id=$2 AND user_id=$7::uuid))
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
      actorId || null,
    ]
  );
  if (!result.rows[0]) throw Object.assign(new Error('Supplier or assigned assessor is unavailable in this workspace.'), { code: 'INVALID_RELATIONSHIP' });
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
  const memberParams: number[] = [];

  const fieldMap: Record<string, string> = {
    assessmentType: 'assessment_type',
    status: 'status',
    riskTier: 'risk_tier',
    inherentRiskScore: 'inherent_risk_score',
    residualRiskScore: 'residual_risk_score',
    targetRiskScore: 'target_risk_score',
    dueDate: 'due_date',
    completedDate: 'completed_date',
    nextReviewDate: 'next_review_date',
    assessorId: 'assessor_id',
    reviewerId: 'reviewer_id',
    findings: 'findings',
    notes: 'notes',
    evidenceRequirements: 'evidence_requirements',
    evidenceReferences: 'evidence_references',
    remediationActions: 'remediation_actions',
    configuration: 'configuration',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (input[key as keyof typeof input] !== undefined) {
      if (key === 'assessorId' || key === 'reviewerId') memberParams.push(paramCount);
      fields.push(`${dbField} = $${paramCount}`);
      const value = input[key as keyof typeof input];
      params.push(['findings','evidenceRequirements','evidenceReferences','remediationActions','configuration'].includes(key) ? JSON.stringify(value) : value);
      paramCount++;
    }
  }

  if (fields.length === 0) return getAssessmentById(workspaceId, id);

  const memberScope = memberParams.map(param => ` AND ($${param}::uuid IS NULL OR EXISTS (SELECT 1 FROM workspace_user_memberships WHERE workspace_id=$2 AND user_id=$${param}::uuid))`).join('');
  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_risk_assessments SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2${memberScope} RETURNING *`,
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
           (SELECT COUNT(*)::int FROM vendor_questionnaire_questions WHERE questionnaire_id = q.id) as question_count,
           (SELECT COUNT(*)::int FROM vendor_questionnaire_responses r
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
            (SELECT COUNT(*)::int FROM vendor_questionnaire_questions WHERE questionnaire_id = q.id) as question_count,
            (SELECT COUNT(*)::int FROM vendor_questionnaire_responses r
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
  if (input.isTemplate && input.vendorId) throw new Error('A reusable template cannot be assigned to a supplier.');
  if (!input.isTemplate && !input.vendorId) throw new Error('A supplier is required for a non-template questionnaire.');
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_questionnaires (
      id, workspace_id, vendor_id, assessment_id, name, description,
      questionnaire_type, is_template, due_date, created_by
    ) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      WHERE ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM vendors WHERE id = $3 AND workspace_id = $2 AND archived_at IS NULL))
        AND ($4::uuid IS NULL OR EXISTS (
          SELECT 1 FROM vendor_risk_assessments
          WHERE id = $4 AND workspace_id = $2 AND ($3::uuid IS NULL OR vendor_id = $3)
        ))
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
  if (!result.rows[0]) throw new Error('Supplier or assessment is unavailable in this workspace');
  return rowToQuestionnaire(result.rows[0]);
}

export async function transitionQuestionnaire(
  workspaceId: string,
  id: string,
  nextStatus: SupplierQuestionnaireStatus,
  actorId: string,
): Promise<VendorQuestionnaire | null> {
  const current = await getQuestionnaireById(workspaceId, id);
  if (!current) return null;
  assertQuestionnaireTransition(current.status as SupplierQuestionnaireStatus, nextStatus);
  if (nextStatus === 'sent' && (current.questionCount ?? 0) === 0) throw new Error('At least one question is required before sending a questionnaire.');
  if (nextStatus === 'submitted' && (current.completionPercentage ?? 0) < 100) throw new Error('All questionnaire responses are required before submission.');
  if (nextStatus === 'reviewed') {
    assertIndependentDecision(current.createdBy, actorId, 'approved');
    if ((current.completionPercentage ?? 0) < 100) throw new Error('A questionnaire must be complete before independent review.');
  }
  if (nextStatus === 'sent' && current.isTemplate) throw new Error('Template questionnaires cannot be sent to suppliers.');
  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_questionnaires
       SET status = $4,
           sent_date = CASE WHEN $4 = 'sent' THEN CURRENT_DATE ELSE sent_date END,
           submitted_date = CASE WHEN $4 = 'submitted' THEN CURRENT_DATE ELSE submitted_date END,
           reviewed_date = CASE WHEN $4 = 'reviewed' THEN CURRENT_DATE ELSE reviewed_date END,
           reviewed_by = CASE WHEN $4 = 'reviewed' THEN $5 ELSE reviewed_by END,
           updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status = $3
     RETURNING *`,
    [id, workspaceId, current.status, nextStatus, actorId],
  );
  if (!result.rows[0]) throw new Error('Questionnaire status changed before this transition completed.');
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
    dueDate: 'due_date',
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
     WHERE id = $1 AND workspace_id = $2 AND status = 'draft' RETURNING *`,
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
  workspaceId: string,
  questionnaireId: string
): Promise<VendorQuestionnaireQuestion[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT q.* FROM vendor_questionnaire_questions q
     JOIN vendor_questionnaires questionnaire ON questionnaire.id = q.questionnaire_id
     WHERE questionnaire.workspace_id = $1 AND q.questionnaire_id = $2
     ORDER BY q.display_order ASC, q.created_at ASC`,
    [workspaceId, questionnaireId]
  );
  return result.rows.map(rowToQuestion);
}

export async function createQuestion(
  workspaceId: string,
  input: CreateVendorQuestionnaireQuestionInput
): Promise<VendorQuestionnaireQuestion> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_questionnaire_questions (
      id, questionnaire_id, category, question_text, question_type,
      options, is_required, weight, risk_if_negative, display_order, guidance
    ) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      WHERE EXISTS (SELECT 1 FROM vendor_questionnaires WHERE workspace_id = $12 AND id = $2 AND status = 'draft')
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
      workspaceId,
    ]
  );
  if (!result.rows[0]) throw new Error('Questionnaire is unavailable or no longer editable in this workspace');
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
  workspaceId: string,
  questionId: string
): Promise<VendorQuestionnaireResponse | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT response.* FROM vendor_questionnaire_responses response
     JOIN vendor_questionnaire_questions question ON question.id = response.question_id
     JOIN vendor_questionnaires questionnaire ON questionnaire.id = question.questionnaire_id
     WHERE response.question_id = $1 AND questionnaire.workspace_id = $2`,
    [questionId, workspaceId]
  );
  if (result.rows.length === 0) return null;
  return rowToResponse(result.rows[0]);
}

export async function getResponsesByQuestionnaireId(
  workspaceId: string,
  questionnaireId: string,
): Promise<VendorQuestionnaireResponse[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT response.* FROM vendor_questionnaire_responses response
     JOIN vendor_questionnaire_questions question ON question.id = response.question_id
     JOIN vendor_questionnaires questionnaire ON questionnaire.id = question.questionnaire_id
     WHERE questionnaire.workspace_id = $1 AND questionnaire.id = $2
     ORDER BY question.display_order, question.created_at`,
    [workspaceId, questionnaireId],
  );
  return result.rows.map(rowToResponse);
}

export async function upsertResponse(
  workspaceId: string,
  input: CreateVendorQuestionnaireResponseInput
): Promise<VendorQuestionnaireResponse> {
  const target = await query<Record<string, unknown>>(
    `SELECT questionnaire.status, questionnaire.is_template
     FROM vendor_questionnaire_questions question
     JOIN vendor_questionnaires questionnaire ON questionnaire.id = question.questionnaire_id
     WHERE question.id = $1 AND questionnaire.workspace_id = $2`,
    [input.questionId, workspaceId],
  );
  if (!target.rows[0]) throw new Error('Question is unavailable in this workspace');
  assertQuestionnaireResponseAllowed(target.rows[0].status as SupplierQuestionnaireStatus, Boolean(target.rows[0].is_template));
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_questionnaire_responses (
      id, question_id, response_text, response_value, file_url, responded_at
    ) SELECT $1, $2, $3, $4, $5, NOW()
      WHERE EXISTS (
        SELECT 1 FROM vendor_questionnaire_questions question
        JOIN vendor_questionnaires questionnaire ON questionnaire.id = question.questionnaire_id
        WHERE question.id = $2 AND questionnaire.workspace_id = $6
          AND questionnaire.is_template = false AND questionnaire.status IN ('sent', 'in_progress')
      )
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
      workspaceId,
    ]
  );
  if (!result.rows[0]) throw new Error('Question is unavailable in this workspace');
  await query(
    `UPDATE vendor_questionnaires questionnaire SET
       completion_percentage = CASE WHEN totals.total = 0 THEN 0 ELSE ROUND(totals.responded * 100.0 / totals.total)::int END,
       status = CASE WHEN questionnaire.status = 'sent' THEN 'in_progress' ELSE questionnaire.status END,
       updated_at = NOW()
     FROM (
       SELECT question.questionnaire_id, COUNT(*)::int total,
              COUNT(response.id) FILTER (WHERE NULLIF(BTRIM(response.response_text), '') IS NOT NULL OR response.response_value IS NOT NULL)::int responded
       FROM vendor_questionnaire_questions question
       LEFT JOIN vendor_questionnaire_responses response ON response.question_id = question.id
       WHERE question.questionnaire_id = (SELECT questionnaire_id FROM vendor_questionnaire_questions WHERE id = $1)
       GROUP BY question.questionnaire_id
     ) totals
     WHERE questionnaire.id = totals.questionnaire_id AND questionnaire.workspace_id = $2`,
    [input.questionId, workspaceId],
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
    contractRef: row.contract_ref as string | undefined,
    contractOwner: row.contract_owner as string | undefined,
    effectiveDate: row.effective_date ? (row.effective_date as Date).toISOString().split('T')[0] : undefined,
    expirationDate: row.expiration_date ? (row.expiration_date as Date).toISOString().split('T')[0] : undefined,
    renewalDate: row.renewal_date ? (row.renewal_date as Date).toISOString().split('T')[0] : undefined,
    noticeDate: row.notice_date ? (row.notice_date as Date).toISOString().split('T')[0] : undefined,
    renewalType: row.renewal_type as VendorContract['renewalType'],
    renewalNoticeDays: row.renewal_notice_days as number,
    contractValue: row.contract_value ? parseFloat(row.contract_value as string) : undefined,
    currency: row.currency as string,
    keyTerms: (row.key_terms as Record<string, unknown>) || {},
    relatedBusinessService: row.related_business_service as string | undefined,
    securityObligations: row.security_obligations as string | undefined,
    dataProtectionObligations: row.data_protection_obligations as string | undefined,
    slaRequirements: row.sla_requirements as string | undefined,
    auditRights: row.audit_rights as string | undefined,
    terminationProvisions: row.termination_provisions as string | undefined,
    exitRequirements: row.exit_requirements as string | undefined,
    renewalDecision: row.renewal_decision as string | undefined,
    documentUrl: row.document_url as string | undefined,
    ownerId: row.owner_id as string | undefined,
    approvedBy: row.approved_by as string | undefined,
    createdBy: row.created_by as string | undefined,
    approvedAt: row.approved_at ? (row.approved_at as Date).toISOString() : undefined,
    archivedAt: row.archived_at ? (row.archived_at as Date).toISOString() : undefined,
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
  input: CreateVendorContractInput,
  actorId: string,
): Promise<VendorContract> {
  const id = uuidv4();
  const result = await query<Record<string, unknown>>(
    `INSERT INTO vendor_contracts (
      id, workspace_id, vendor_id, contract_name, contract_type, effective_date,
      expiration_date, renewal_type, renewal_notice_days, contract_value, currency,
      key_terms, document_url, owner_id, notes, contract_ref, contract_owner, renewal_date,
      notice_date, related_business_service, security_obligations, data_protection_obligations,
      sla_requirements, audit_rights, termination_provisions, exit_requirements, created_by
    ) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      WHERE EXISTS (SELECT 1 FROM vendors WHERE id=$3 AND workspace_id=$2 AND archived_at IS NULL)
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
      `CTR-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      input.contractOwner || null,
      input.renewalDate || null,
      calculateContractDates(input.expirationDate, input.renewalNoticeDays || 30).noticeDate,
      input.relatedBusinessService || null,
      input.securityObligations || null,
      input.dataProtectionObligations || null,
      input.slaRequirements || null,
      input.auditRights || null,
      input.terminationProvisions || null,
      input.exitRequirements || null,
      actorId,
    ]
  );
  if (!result.rows[0]) throw new Error('Supplier is unavailable in this workspace.');
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
    renewalDate: 'renewal_date',
    renewalType: 'renewal_type',
    renewalNoticeDays: 'renewal_notice_days',
    contractValue: 'contract_value',
    currency: 'currency',
    keyTerms: 'key_terms',
    documentUrl: 'document_url',
    ownerId: 'owner_id',
    notes: 'notes',
    contractOwner: 'contract_owner',
    relatedBusinessService: 'related_business_service',
    securityObligations: 'security_obligations',
    dataProtectionObligations: 'data_protection_obligations',
    slaRequirements: 'sla_requirements', auditRights: 'audit_rights',
    terminationProvisions: 'termination_provisions', exitRequirements: 'exit_requirements',
    renewalDecision: 'renewal_decision',
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

export async function transitionAssessment(workspaceId: string, id: string, nextStatus: SupplierAssessmentStatus, actorId: string, reason?: string) {
  const current = await getAssessmentById(workspaceId, id);
  if (!current) return null;
  assertAssessmentTransition(current.status as SupplierAssessmentStatus, nextStatus);
  assertIndependentDecision(current.createdBy, actorId, nextStatus);
  const result = await query<Record<string, unknown>>(
    `WITH changed AS (UPDATE vendor_risk_assessments SET status=$3, reviewer_id=CASE WHEN $3 IN ('approved','approved_with_conditions','rejected') THEN $4::uuid ELSE reviewer_id END, review_decision=CASE WHEN $3 IN ('approved','approved_with_conditions','rejected') THEN $3 ELSE review_decision END, review_reason=COALESCE($5,review_reason), submitted_by=CASE WHEN $3='submitted' THEN $4::uuid ELSE submitted_by END, submitted_at=CASE WHEN $3='submitted' THEN NOW() ELSE submitted_at END, reviewed_at=CASE WHEN $3 IN ('approved','approved_with_conditions','rejected') THEN NOW() ELSE reviewed_at END, completed_date=CASE WHEN $3 IN ('approved','approved_with_conditions','rejected') THEN CURRENT_DATE ELSE completed_date END, updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *), history AS (INSERT INTO supplier_assessment_review_history(id,workspace_id,assessment_id,previous_status,new_status,decision,reason,changed_by) SELECT $6,workspace_id,id,$7,$3,review_decision,$5,$4::uuid FROM changed) SELECT * FROM changed`,
    [workspaceId,id,nextStatus,actorId,reason||null,uuidv4(),current.status],
  );
  return result.rows[0] ? rowToAssessment(result.rows[0]) : null;
}

export async function transitionContract(workspaceId: string, id: string, nextStatus: SupplierContractStatus, actorId: string, reason?: string) {
  const current = await getContractById(workspaceId, id);
  if (!current) return null;
  assertContractTransition(current.status as SupplierContractStatus, nextStatus);
  assertIndependentDecision(current.createdBy, actorId, nextStatus);
  const result = await query<Record<string, unknown>>(
    `WITH changed AS (UPDATE vendor_contracts SET status=$3, approved_by=CASE WHEN $3='approved' THEN $4::uuid ELSE approved_by END, approved_at=CASE WHEN $3='approved' THEN NOW() ELSE approved_at END, archived_at=CASE WHEN $3='archived' THEN NOW() ELSE archived_at END, updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *), history AS (INSERT INTO supplier_contract_lifecycle_history(id,workspace_id,contract_id,previous_status,new_status,reason,changed_by) SELECT $5,workspace_id,id,$6,$3,$7,$4::uuid FROM changed) SELECT * FROM changed`,
    [workspaceId,id,nextStatus,actorId,uuidv4(),current.status,reason||null],
  );
  return result.rows[0] ? rowToContract(result.rows[0]) : null;
}

export async function getAssessmentHistory(workspaceId: string, id: string) {
  return (await query(
    `SELECT id, previous_status "previousStatus", new_status "newStatus", decision, reason,
            changed_by "changedBy", changed_at "changedAt"
       FROM supplier_assessment_review_history
      WHERE workspace_id=$1 AND assessment_id=$2
      ORDER BY changed_at DESC`,
    [workspaceId, id],
  )).rows;
}

export async function getContractHistory(workspaceId: string, id: string) {
  return (await query(
    `SELECT id, previous_status "previousStatus", new_status "newStatus", reason,
            changed_by "changedBy", changed_at "changedAt"
       FROM supplier_contract_lifecycle_history
      WHERE workspace_id=$1 AND contract_id=$2
      ORDER BY changed_at DESC`,
    [workspaceId, id],
  )).rows;
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
    LEFT JOIN vendors v ON i.vendor_id = v.id AND v.workspace_id = i.workspace_id
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
     LEFT JOIN vendors v ON i.vendor_id = v.id AND v.workspace_id = i.workspace_id
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
    ) SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      WHERE EXISTS (SELECT 1 FROM vendors WHERE id = $3 AND workspace_id = $2 AND archived_at IS NULL)
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
  if (!result.rows[0]) throw new Error('Supplier is unavailable in this workspace');
  return rowToIncident(result.rows[0]);
}

export async function transitionIncident(
  workspaceId: string,
  id: string,
  nextStatus: SupplierIncidentStatus,
  input: { rootCause?: string; remediation?: string; lessonsLearned?: string },
): Promise<VendorIncident | null> {
  const current = await getIncidentById(workspaceId, id);
  if (!current) return null;
  assertSupplierIncidentTransition(current.status as SupplierIncidentStatus, nextStatus);
  const rootCause = input.rootCause?.trim() || current.rootCause || null;
  const remediation = input.remediation?.trim() || current.remediation || null;
  assertSupplierIncidentResolution(nextStatus, rootCause, remediation);
  const result = await query<Record<string, unknown>>(
    `UPDATE vendor_incidents SET
       status = $4,
       root_cause = COALESCE($5, root_cause),
       remediation = COALESCE($6, remediation),
       lessons_learned = COALESCE($7, lessons_learned),
       resolved_at = CASE WHEN $4 = 'resolved' THEN NOW() WHEN $4 = 'investigating' THEN NULL ELSE resolved_at END,
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status = $3
     RETURNING *`,
    [id, workspaceId, current.status, nextStatus, rootCause, remediation, input.lessonsLearned?.trim() || null],
  );
  if (!result.rows[0]) throw new Error('Supplier incident status changed before this transition completed.');
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
    title: 'title',
    description: 'description',
    impact: 'impact',
    dataAffected: 'data_affected',
    dataTypesAffected: 'data_types_affected',
    recordsAffected: 'records_affected',
    occurredAt: 'occurred_at',
    detectedAt: 'detected_at',
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
    safeSummaryQuery(
      `SELECT
         COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE + INTERVAL '30 days' AND status NOT IN ('completed', 'expired')) as due_soon,
         COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed', 'expired')) as overdue,
         AVG(residual_risk_score) as avg_risk_score
       FROM vendor_risk_assessments WHERE workspace_id = $1`,
      [workspaceId],
      { due_soon: '0', overdue: '0', avg_risk_score: '0' }
    ),
    safeSummaryQuery(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed')) as open_count,
         COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved', 'closed')) as critical_count
       FROM vendor_incidents WHERE workspace_id = $1`,
      [workspaceId],
      { open_count: '0', critical_count: '0' }
    ),
    safeSummaryQuery(
      `SELECT COUNT(*) as expiring_soon
       FROM vendor_contracts
       WHERE workspace_id = $1
         AND status = 'active'
         AND expiration_date <= CURRENT_DATE + INTERVAL '60 days'
         AND expiration_date > CURRENT_DATE`,
      [workspaceId],
      { expiring_soon: '0' }
    ),
    safeSummaryQuery(
      `SELECT COUNT(*) as pending
       FROM vendor_questionnaires
       WHERE workspace_id = $1 AND status IN ('sent', 'in_progress')`,
      [workspaceId],
      { pending: '0' }
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

  const assessmentRow = assessments || {};
  const incidentRow = incidents || {};
  const contractRow = contracts || {};
  const questionnaireRow = questionnaires || {};

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
