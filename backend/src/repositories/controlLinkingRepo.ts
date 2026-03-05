import { pool } from '../db.js';
import type {
  GovernanceDocument,
  TrainingCourse,
  Control,
  ControlRelationType,
  ControlTrainingRelationType,
  DocumentTrainingRelationType,
  ControlGovernanceDocumentLink,
  ControlTrainingCourseLink,
  GovernanceDocumentTrainingLink,
} from '../types/models.js';

// ============================================
// Control ↔ Governance Document Functions
// ============================================

export async function getDocumentsForControl(
  workspaceId: string,
  controlId: string
): Promise<(GovernanceDocument & { relationType: ControlRelationType })[]> {
  const result = await pool.query(
    `SELECT
      gd.id,
      gd.workspace_id as "workspaceId",
      gd.title,
      gd.doc_type as "docType",
      gd.owner,
      gd.status,
      gd.current_version as "currentVersion",
      gd.location_url as "locationUrl",
      gd.review_frequency_months as "reviewFrequencyMonths",
      gd.next_review_date as "nextReviewDate",
      gd.last_reviewed_at as "lastReviewedAt",
      gd.created_at as "createdAt",
      gd.updated_at as "updatedAt",
      cgd.relation_type as "relationType"
    FROM control_governance_documents cgd
    JOIN governance_documents gd ON cgd.document_id = gd.id
    WHERE cgd.workspace_id = $1 AND cgd.control_id = $2
    ORDER BY gd.title`,
    [workspaceId, controlId]
  );
  return result.rows;
}

export async function getControlsForDocument(
  workspaceId: string,
  documentId: string
): Promise<(Control & { relationType: ControlRelationType })[]> {
  const result = await pool.query(
    `SELECT
      c.id,
      c.workspace_id as "workspaceId",
      c.title,
      c.description,
      c.owner,
      c.status,
      c.domain,
      c.primary_framework as "primaryFramework",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt",
      cgd.relation_type as "relationType"
    FROM control_governance_documents cgd
    JOIN controls c ON cgd.control_id = c.id AND cgd.workspace_id = c.workspace_id
    WHERE cgd.workspace_id = $1 AND cgd.document_id = $2
    ORDER BY c.id`,
    [workspaceId, documentId]
  );
  return result.rows;
}

export async function linkControlToDocument(
  workspaceId: string,
  controlId: string,
  documentId: string,
  relationType: ControlRelationType = 'supports'
): Promise<ControlGovernanceDocumentLink> {
  const result = await pool.query(
    `INSERT INTO control_governance_documents (workspace_id, control_id, document_id, relation_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, control_id, document_id)
     DO UPDATE SET relation_type = EXCLUDED.relation_type
     RETURNING
       id,
       workspace_id as "workspaceId",
       control_id as "controlId",
       document_id as "documentId",
       relation_type as "relationType",
       created_at as "createdAt"`,
    [workspaceId, controlId, documentId, relationType]
  );
  return result.rows[0];
}

export async function unlinkControlFromDocument(
  workspaceId: string,
  controlId: string,
  documentId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM control_governance_documents
     WHERE workspace_id = $1 AND control_id = $2 AND document_id = $3`,
    [workspaceId, controlId, documentId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Control ↔ Training Course Functions
// ============================================

export async function getTrainingForControl(
  workspaceId: string,
  controlId: string
): Promise<(TrainingCourse & { relationType: ControlTrainingRelationType })[]> {
  const result = await pool.query(
    `SELECT
      tc.id,
      tc.workspace_id as "workspaceId",
      tc.title,
      tc.description,
      tc.duration_minutes as "durationMinutes",
      tc.mandatory,
      tc.delivery_format as "deliveryFormat",
      tc.content_url as "contentUrl",
      tc.category,
      tc.is_custom as "isCustom",
      tc.is_active as "isActive",
      tc.created_at as "createdAt",
      tc.updated_at as "updatedAt",
      ctc.relation_type as "relationType",
      COALESCE(
        (SELECT array_agg(tcf.framework_code) FROM training_course_frameworks tcf WHERE tcf.course_id = tc.id),
        ARRAY[]::TEXT[]
      ) as "frameworkCodes"
    FROM control_training_courses ctc
    JOIN training_courses tc ON ctc.course_id = tc.id
    WHERE ctc.workspace_id = $1 AND ctc.control_id = $2 AND tc.is_active = true
    ORDER BY tc.title`,
    [workspaceId, controlId]
  );
  return result.rows;
}

export async function getControlsForTraining(
  workspaceId: string,
  courseId: string
): Promise<(Control & { relationType: ControlTrainingRelationType })[]> {
  const result = await pool.query(
    `SELECT
      c.id,
      c.workspace_id as "workspaceId",
      c.title,
      c.description,
      c.owner,
      c.status,
      c.domain,
      c.primary_framework as "primaryFramework",
      c.created_at as "createdAt",
      c.updated_at as "updatedAt",
      ctc.relation_type as "relationType"
    FROM control_training_courses ctc
    JOIN controls c ON ctc.control_id = c.id AND ctc.workspace_id = c.workspace_id
    WHERE ctc.workspace_id = $1 AND ctc.course_id = $2
    ORDER BY c.id`,
    [workspaceId, courseId]
  );
  return result.rows;
}

export async function linkControlToTraining(
  workspaceId: string,
  controlId: string,
  courseId: string,
  relationType: ControlTrainingRelationType = 'reinforces'
): Promise<ControlTrainingCourseLink> {
  const result = await pool.query(
    `INSERT INTO control_training_courses (workspace_id, control_id, course_id, relation_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, control_id, course_id)
     DO UPDATE SET relation_type = EXCLUDED.relation_type
     RETURNING
       id,
       workspace_id as "workspaceId",
       control_id as "controlId",
       course_id as "courseId",
       relation_type as "relationType",
       created_at as "createdAt"`,
    [workspaceId, controlId, courseId, relationType]
  );
  return result.rows[0];
}

export async function unlinkControlFromTraining(
  workspaceId: string,
  controlId: string,
  courseId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM control_training_courses
     WHERE workspace_id = $1 AND control_id = $2 AND course_id = $3`,
    [workspaceId, controlId, courseId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Governance Document ↔ Training Course Functions
// ============================================

export async function getTrainingForDocument(
  workspaceId: string,
  documentId: string
): Promise<(TrainingCourse & { relationType: DocumentTrainingRelationType })[]> {
  const result = await pool.query(
    `SELECT
      tc.id,
      tc.workspace_id as "workspaceId",
      tc.title,
      tc.description,
      tc.duration_minutes as "durationMinutes",
      tc.mandatory,
      tc.delivery_format as "deliveryFormat",
      tc.content_url as "contentUrl",
      tc.category,
      tc.is_custom as "isCustom",
      tc.is_active as "isActive",
      tc.created_at as "createdAt",
      tc.updated_at as "updatedAt",
      gdtc.relation_type as "relationType",
      COALESCE(
        (SELECT array_agg(tcf.framework_code) FROM training_course_frameworks tcf WHERE tcf.course_id = tc.id),
        ARRAY[]::TEXT[]
      ) as "frameworkCodes"
    FROM governance_document_training_courses gdtc
    JOIN training_courses tc ON gdtc.course_id = tc.id
    WHERE gdtc.workspace_id = $1 AND gdtc.document_id = $2 AND tc.is_active = true
    ORDER BY tc.title`,
    [workspaceId, documentId]
  );
  return result.rows;
}

export async function getDocumentsForTraining(
  workspaceId: string,
  courseId: string
): Promise<(GovernanceDocument & { relationType: DocumentTrainingRelationType })[]> {
  const result = await pool.query(
    `SELECT
      gd.id,
      gd.workspace_id as "workspaceId",
      gd.title,
      gd.doc_type as "docType",
      gd.owner,
      gd.status,
      gd.current_version as "currentVersion",
      gd.location_url as "locationUrl",
      gd.review_frequency_months as "reviewFrequencyMonths",
      gd.next_review_date as "nextReviewDate",
      gd.last_reviewed_at as "lastReviewedAt",
      gd.created_at as "createdAt",
      gd.updated_at as "updatedAt",
      gdtc.relation_type as "relationType"
    FROM governance_document_training_courses gdtc
    JOIN governance_documents gd ON gdtc.document_id = gd.id
    WHERE gdtc.workspace_id = $1 AND gdtc.course_id = $2
    ORDER BY gd.title`,
    [workspaceId, courseId]
  );
  return result.rows;
}

export async function linkDocumentToTraining(
  workspaceId: string,
  documentId: string,
  courseId: string,
  relationType: DocumentTrainingRelationType = 'enforces'
): Promise<GovernanceDocumentTrainingLink> {
  const result = await pool.query(
    `INSERT INTO governance_document_training_courses (workspace_id, document_id, course_id, relation_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, document_id, course_id)
     DO UPDATE SET relation_type = EXCLUDED.relation_type
     RETURNING
       id,
       workspace_id as "workspaceId",
       document_id as "documentId",
       course_id as "courseId",
       relation_type as "relationType",
       created_at as "createdAt"`,
    [workspaceId, documentId, courseId, relationType]
  );
  return result.rows[0];
}

export async function unlinkDocumentFromTraining(
  workspaceId: string,
  documentId: string,
  courseId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM governance_document_training_courses
     WHERE workspace_id = $1 AND document_id = $2 AND course_id = $3`,
    [workspaceId, documentId, courseId]
  );
  return (result.rowCount ?? 0) > 0;
}
