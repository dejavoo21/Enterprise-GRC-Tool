import { randomUUID } from 'node:crypto';
import { Risk } from '../types/models';
import { query } from '../db';
import { MethodologyValidationError } from '../services/riskMethodologyRules.js';

export interface RiskFilter {
  status?: string;
  severity?: string;
  category?: string;
  workspaceId?: string;
  ciaImpact?: 'Confidentiality' | 'Integrity' | 'Availability';
}

export interface CreateRiskInput {
  title: string;
  description?: string;
  owner: string;
  category: string;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood?: number;
  residualImpact?: number;
  ciaImpacts: Array<'Confidentiality' | 'Integrity' | 'Availability'>;
  dueDate?: string;
  treatmentPlan?: string;
  status?: Risk['status'];
  treatmentStrategy?: Risk['treatmentStrategy']; treatmentOwner?: string; treatmentStatus?: Risk['treatmentStatus']; treatmentProgress?: number; treatmentDueDate?: string;
  targetLikelihood?: number | null; targetImpact?: number | null; acceptanceRationale?: string; nextReviewDate?: string; reviewStatus?: Risk['reviewStatus']; reviewNotes?: string; reviewOwner?: string; reassessmentRequired?: boolean;
}

export interface UpdateRiskInput {
  title?: string;
  description?: string;
  owner?: string;
  category?: string;
  status?: string;
  inherentLikelihood?: number;
  inherentImpact?: number;
  residualLikelihood?: number;
  residualImpact?: number;
  dueDate?: string | null;
  treatmentPlan?: string | null;
  ciaImpacts?: Array<'Confidentiality' | 'Integrity' | 'Availability'>;
  treatmentStrategy?: Risk['treatmentStrategy']; treatmentOwner?: string; treatmentStatus?: Risk['treatmentStatus']; treatmentProgress?: number; treatmentDueDate?: string | null;
  targetLikelihood?: number | null; targetImpact?: number | null; acceptanceRationale?: string | null; nextReviewDate?: string | null; reviewStatus?: Risk['reviewStatus']; reviewNotes?: string | null; reviewOwner?: string | null; reassessmentRequired?: boolean;
}

function uniqueCiaImpacts(values: CreateRiskInput['ciaImpacts']): CreateRiskInput['ciaImpacts'] {
  return [...new Set(values)];
}

// Map database row to Risk object
function rowToRisk(row: any): Risk {
  const config = row.methodology?.config;
  const threshold = (key: string) => config && Number.isInteger(config[key]) && row.residual_score != null
    ? row.residual_score >= config[key] : null;
  return {
    legacyCompatibility: row.methodology_id == null,
    treatmentRequired: threshold('treatmentRequiredFromScore'),
    escalationRequired: threshold('escalationRequiredFromScore'),
    id: row.id,
    methodologyId: row.methodology_id ?? null, methodologyVersion: row.methodology_version ?? null,
    inherentScore: row.inherent_score ?? null, inherentRating: row.inherent_rating ?? null,
    residualScore: row.residual_score ?? null, residualRating: row.residual_rating ?? null,
    targetScore: row.target_score ?? null, targetRating: row.target_rating ?? null,
    methodologyOutsideAppetite: row.methodology_outside_appetite ?? null, methodology: row.methodology ?? null,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    category: row.category,
    status: row.status,
    inherentLikelihood: row.inherent_likelihood,
    inherentImpact: row.inherent_impact,
    residualLikelihood: row.residual_likelihood,
    residualImpact: row.residual_impact,
    ciaImpacts: Array.isArray(row.cia_impacts) ? row.cia_impacts : [],
    dueDate: row.due_date ? new Date(row.due_date).toISOString().split('T')[0] : undefined,
    treatmentPlan: row.treatment_plan,
    treatmentStrategy: row.treatment_strategy || undefined,
    treatmentOwner: row.treatment_owner || undefined,
    treatmentStatus: row.treatment_status || undefined,
    treatmentProgress: Number(row.treatment_progress || 0),
    treatmentDueDate: row.treatment_due_date ? new Date(row.treatment_due_date).toISOString() : undefined,
    targetLikelihood: row.target_likelihood == null ? undefined : Number(row.target_likelihood),
    targetImpact: row.target_impact == null ? undefined : Number(row.target_impact),
    acceptanceRationale: row.acceptance_rationale || undefined,
    acceptedBy: row.accepted_by || undefined,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : undefined,
    nextReviewDate: row.next_review_date ? new Date(row.next_review_date).toISOString() : undefined,
    lastReviewedAt: row.last_reviewed_at ? new Date(row.last_reviewed_at).toISOString() : undefined,
    reviewStatus: row.review_status || 'not_reviewed',
    reviewNotes: row.review_notes || undefined,
    reviewOwner: row.review_owner || undefined,
    reassessmentRequired: Boolean(row.reassessment_required),
    controlIds: [], // Will be fetched separately if needed
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const riskSelect = `SELECT r.*, (SELECT jsonb_build_object('id', m.id, 'workspaceId',m.workspace_id,'version',m.version,'status',m.status,'config',m.config) FROM risk_methodologies m WHERE m.id=r.methodology_id AND m.workspace_id=r.workspace_id AND m.version=r.methodology_version) AS methodology FROM risks r`;
async function requireScoringGuard() {
  const result = await query("SELECT 1 FROM pg_trigger WHERE tgrelid='risks'::regclass AND tgname='risk_methodology_pin' AND tgenabled='O'");
  if (!result.rowCount) throw new MethodologyValidationError('Risk version-pinning migration is required before writing risks.');
}
export async function getRisks(workspaceId: string, filters?: RiskFilter): Promise<Risk[]> {
  try {
    let whereClause = 'workspace_id = $1';
    const params: any[] = [workspaceId];

    if (filters?.status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(filters.status);
    }
    if (filters?.category) {
      whereClause += ' AND category = $' + (params.length + 1);
      params.push(filters.category);
    }
    if (filters?.ciaImpact) {
      whereClause += ' AND cia_impacts ? $' + (params.length + 1);
      params.push(filters.ciaImpact);
    }

    const result = await query<any>(
      `${riskSelect} WHERE ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map(rowToRisk);
  } catch (error) {
    console.error('Error fetching risks:', error);
    throw error;
  }
}

export async function getRiskById(workspaceId: string, id: string): Promise<Risk | null> {
  try {
    const result = await query<any>(
      `${riskSelect} WHERE r.id = $1 AND r.workspace_id = $2`,
      [id, workspaceId]
    );
    return result.rows.length > 0 ? rowToRisk(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching risk by ID:', error);
    throw error;
  }
}

export async function createRisk(workspaceId: string, input: CreateRiskInput): Promise<Risk> {
  await requireScoringGuard();
  const columns: Record<string,string> = {
    title:'title',description:'description',owner:'owner',category:'category',status:'status',
    inherentLikelihood:'inherent_likelihood',inherentImpact:'inherent_impact',residualLikelihood:'residual_likelihood',residualImpact:'residual_impact',
    targetLikelihood:'target_likelihood',targetImpact:'target_impact',dueDate:'due_date',treatmentPlan:'treatment_plan',
    treatmentStrategy:'treatment_strategy',treatmentOwner:'treatment_owner',treatmentStatus:'treatment_status',treatmentProgress:'treatment_progress',treatmentDueDate:'treatment_due_date',
    acceptanceRationale:'acceptance_rationale',nextReviewDate:'next_review_date',reviewStatus:'review_status',reviewNotes:'review_notes',reviewOwner:'review_owner',reassessmentRequired:'reassessment_required',
  };
  const source = { ...input, status: input.status ?? 'identified' };
  const names = ['id','workspace_id','cia_impacts'];
  const values: unknown[] = [randomUUID(), workspaceId, JSON.stringify(uniqueCiaImpacts(input.ciaImpacts))];
  for (const [key,column] of Object.entries(columns)) {
    const value = source[key as keyof typeof source];
    if (value !== undefined) { names.push(column); values.push(value === '' ? null : value); }
  }
  // The database guard selects/locks the active methodology and derives every score.
  const result = await query(`INSERT INTO risks (${names.join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`, values);
  return (await getRiskById(workspaceId, result.rows[0].id))!;
}

export async function updateRisk(workspaceId: string, id: string, input: UpdateRiskInput): Promise<Risk | null> {
  try {
    await requireScoringGuard();
    const updates: string[] = [];
    const params: any[] = [id, workspaceId];
    let paramIndex = 3;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(input.title);
      paramIndex++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description || null);
      paramIndex++;
    }
    if (input.owner !== undefined) {
      updates.push(`owner = $${paramIndex}`);
      params.push(input.owner);
      paramIndex++;
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(input.category);
      paramIndex++;
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }
    if (input.inherentLikelihood !== undefined) {
      updates.push(`inherent_likelihood = $${paramIndex}`);
      params.push(input.inherentLikelihood);
      paramIndex++;
    }
    if (input.inherentImpact !== undefined) {
      updates.push(`inherent_impact = $${paramIndex}`);
      params.push(input.inherentImpact);
      paramIndex++;
    }
    if (input.residualLikelihood !== undefined) {
      updates.push(`residual_likelihood = $${paramIndex}`);
      params.push(input.residualLikelihood);
      paramIndex++;
    }
    if (input.residualImpact !== undefined) {
      updates.push(`residual_impact = $${paramIndex}`);
      params.push(input.residualImpact);
      paramIndex++;
    }
    if (input.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex}`);
      params.push(input.dueDate || null);
      paramIndex++;
    }
    if (input.treatmentPlan !== undefined) {
      updates.push(`treatment_plan = $${paramIndex}`);
      params.push(input.treatmentPlan || null);
      paramIndex++;
    }
    if (input.ciaImpacts !== undefined) {
      updates.push(`cia_impacts = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(uniqueCiaImpacts(input.ciaImpacts)));
      paramIndex++;
    }
    const extraFields: Array<[keyof UpdateRiskInput, string]> = [
      ['treatmentStrategy', 'treatment_strategy'], ['treatmentOwner', 'treatment_owner'], ['treatmentStatus', 'treatment_status'], ['treatmentProgress', 'treatment_progress'], ['treatmentDueDate', 'treatment_due_date'],
      ['targetLikelihood', 'target_likelihood'], ['targetImpact', 'target_impact'], ['acceptanceRationale', 'acceptance_rationale'], ['nextReviewDate', 'next_review_date'], ['reviewStatus', 'review_status'], ['reviewNotes', 'review_notes'], ['reviewOwner', 'review_owner'], ['reassessmentRequired', 'reassessment_required'],
    ];
    for (const [key, column] of extraFields) {
      if (input[key] !== undefined) {
        updates.push(`${column} = $${paramIndex}`);
        params.push(input[key] || (typeof input[key] === 'boolean' || typeof input[key] === 'number' ? input[key] : null));
        paramIndex++;
      }
    }

    if (updates.length === 0) return getRiskById(workspaceId, id);

    updates.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE risks SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? getRiskById(workspaceId, id) : null;
  } catch (error) {
    console.error('Error updating risk:', error);
    throw error;
  }
}

export async function deleteRisk(workspaceId: string, id: string): Promise<boolean> {
  try {
    const result = await query('DELETE FROM risks WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting risk:', error);
    throw error;
  }
}
