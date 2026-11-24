import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export type EffectivenessRating = 'not_tested' | 'effective' | 'partially_effective' | 'ineffective';
export type EffectivenessStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface ControlEffectivenessAssessment {
  id: string; workspaceId: string; controlId: string; assessmentRef: string;
  status: EffectivenessStatus; rating: EffectivenessRating; designRating: EffectivenessRating;
  operatingRating: EffectivenessRating; testMethod: string; summary?: string;
  periodStart?: string; periodEnd?: string; evidenceIds: string[]; findings: unknown[];
  createdBy: string; submittedBy?: string; submittedAt?: string; reviewedBy?: string;
  reviewedAt?: string; reviewNotes?: string; createdAt: string; updatedAt: string;
}

function mapAssessment(row: Record<string, any>): ControlEffectivenessAssessment {
  const date = (value: unknown) => value ? new Date(value as string).toISOString() : undefined;
  return { id: row.id, workspaceId: row.workspace_id, controlId: row.control_id, assessmentRef: row.assessment_ref,
    status: row.status, rating: row.rating, designRating: row.design_rating, operatingRating: row.operating_rating,
    testMethod: row.test_method, summary: row.summary || undefined, periodStart: row.period_start?.toISOString?.().slice(0,10) || row.period_start || undefined,
    periodEnd: row.period_end?.toISOString?.().slice(0,10) || row.period_end || undefined, evidenceIds: row.evidence_ids || [], findings: row.findings || [],
    createdBy: row.created_by, submittedBy: row.submitted_by || undefined, submittedAt: date(row.submitted_at), reviewedBy: row.reviewed_by || undefined,
    reviewedAt: date(row.reviewed_at), reviewNotes: row.review_notes || undefined, createdAt: date(row.created_at)!, updatedAt: date(row.updated_at)! };
}

export async function listAssessments(workspaceId: string, controlId: string) {
  const result = await query<Record<string, any>>('SELECT * FROM control_effectiveness_assessments WHERE workspace_id=$1 AND control_id=$2 ORDER BY created_at DESC', [workspaceId, controlId]);
  return result.rows.map(mapAssessment);
}

export async function getAssessment(workspaceId: string, id: string) {
  const result = await query<Record<string, any>>('SELECT * FROM control_effectiveness_assessments WHERE workspace_id=$1 AND id=$2', [workspaceId, id]);
  return result.rows[0] ? mapAssessment(result.rows[0]) : null;
}

export async function createAssessment(workspaceId: string, controlId: string, actorId: string, input: Record<string, any>) {
  const id = uuidv4();
  const ref = `CEA-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const result = await query<Record<string, any>>(
    `INSERT INTO control_effectiveness_assessments
      (id,workspace_id,control_id,assessment_ref,rating,design_rating,operating_rating,test_method,summary,period_start,period_end,evidence_ids,findings,created_by)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::uuid
     WHERE EXISTS (SELECT 1 FROM controls WHERE workspace_id=$2 AND id=$3 AND archived_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text($12::jsonb) e WHERE NOT EXISTS (SELECT 1 FROM evidence WHERE workspace_id=$2 AND id=e::uuid))
     RETURNING *`,
    [id,workspaceId,controlId,ref,input.rating||'not_tested',input.designRating||'not_tested',input.operatingRating||'not_tested',input.testMethod,input.summary||null,input.periodStart||null,input.periodEnd||null,JSON.stringify(input.evidenceIds||[]),JSON.stringify(input.findings||[]),actorId]);
  if (!result.rows[0]) throw Object.assign(new Error('Control or evidence reference is unavailable in this workspace.'), { code: 'INVALID_RELATIONSHIP' });
  return mapAssessment(result.rows[0]);
}

export async function submitAssessment(workspaceId: string, id: string, actorId: string) {
  const result = await query<Record<string, any>>(`UPDATE control_effectiveness_assessments SET status='pending_review',submitted_by=$3::uuid,submitted_at=NOW(),reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`,[workspaceId,id,actorId]);
  return result.rows[0] ? mapAssessment(result.rows[0]) : null;
}

export async function decideAssessment(workspaceId: string, id: string, actorId: string, decision: 'approved'|'rejected', notes?: string) {
  const result = await query<Record<string, any>>(`UPDATE control_effectiveness_assessments SET status=$3,reviewed_by=$4::uuid,reviewed_at=NOW(),review_notes=$5,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`,[workspaceId,id,decision,actorId,notes||null]);
  return result.rows[0] ? mapAssessment(result.rows[0]) : null;
}
