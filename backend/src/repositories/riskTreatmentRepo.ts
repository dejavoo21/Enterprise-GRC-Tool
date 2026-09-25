import { ensureTreatmentControlSchema, replaceTreatmentControls, CONTROL_LINKS_SELECT } from './treatmentControlRepo.js';
import { generateId, query, pool } from '../db.js';
import type { RiskTreatmentPlan, RiskTreatmentPlanInput, RiskTreatmentSummary } from '../types/riskTreatment.js';
import type { PoolClient } from 'pg';

type Row = Record<string, unknown>;
const CLOSED = new Set(['completed', 'accepted', 'cancelled']);

async function requireTreatmentScoringGuard(client: PoolClient): Promise<void> {
  const guard = await client.query("SELECT 1 FROM pg_trigger WHERE tgrelid='risk_treatment_plans'::regclass AND tgname='treatment_methodology_guard' AND tgenabled='O'");
  if (!guard.rowCount) throw Object.assign(new Error('Risk methodology migration is required before writing treatment plans'), { code: 'P0001' });
}

function iso(value: unknown): string | undefined { return value ? new Date(String(value)).toISOString() : undefined; }
function effectiveStatus(status: string, dueDate: string): RiskTreatmentPlan['status'] {
  return !CLOSED.has(status) && new Date(dueDate).getTime() < Date.now() ? 'overdue' : status as RiskTreatmentPlan['status'];
}
function map(row: Row): RiskTreatmentPlan {
  const dueDate = iso(row.due_date)!;
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), riskId: String(row.risk_id), riskRef: row.risk_ref ? String(row.risk_ref) : undefined, riskTitle: row.risk_title ? String(row.risk_title) : undefined,
    title: String(row.title), description: String(row.description || ''), strategy: row.strategy as RiskTreatmentPlan['strategy'], owner: String(row.owner), dueDate,
    status: effectiveStatus(String(row.status), dueDate), progressPercent: Number(row.progress_percent), priority: row.priority as RiskTreatmentPlan['priority'],
    expectedResidualRating: row.expected_residual_rating == null ? null : String(row.expected_residual_rating),
    expectedResidualScore: row.expected_residual_score == null ? undefined : Number(row.expected_residual_score), effectivenessRating: row.effectiveness_rating == null ? undefined : Number(row.effectiveness_rating),
    evidenceSummary: row.evidence_summary ? String(row.evidence_summary) : undefined, approvalStatus: row.approval_status as RiskTreatmentPlan['approvalStatus'],
    createdBy: row.created_by ? String(row.created_by) : undefined, completedAt: iso(row.completed_at), reviewDate: iso(row.review_date), notes: row.notes ? String(row.notes) : undefined,
    linkedControls: (row.linked_controls || []) as RiskTreatmentPlan['linkedControls'],
    createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!,
  };
}

export async function ensureRiskTreatmentSchema(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS risk_treatment_plans (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, risk_id TEXT NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', strategy TEXT NOT NULL, owner TEXT NOT NULL, due_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100), priority TEXT NOT NULL DEFAULT 'medium',
    expected_residual_score NUMERIC(8,2), effectiveness_rating NUMERIC(8,2), evidence_summary TEXT, approval_status TEXT NOT NULL DEFAULT 'not_required',
    created_by TEXT, completed_at TIMESTAMPTZ, review_date TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_treatment_plans_workspace ON risk_treatment_plans (workspace_id, updated_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_treatment_plans_risk ON risk_treatment_plans (workspace_id, risk_id)`);
  await ensureTreatmentControlSchema();
}

export async function list(workspaceId: string, riskId?: string): Promise<RiskTreatmentPlan[]> {
  const result = await query(`SELECT p.*, r.title AS risk_title, r.risk_ref, ${CONTROL_LINKS_SELECT} FROM risk_treatment_plans p JOIN risks r ON r.id = p.risk_id AND r.workspace_id = p.workspace_id WHERE p.workspace_id = $1 ${riskId ? 'AND p.risk_id = $2' : ''} ORDER BY p.updated_at DESC`, riskId ? [workspaceId, riskId] : [workspaceId]);
  return result.rows.map((row) => map(row as Row));
}
export async function get(workspaceId: string, id: string): Promise<RiskTreatmentPlan | null> {
  const result = await query(`SELECT p.*, r.title AS risk_title, r.risk_ref, ${CONTROL_LINKS_SELECT} FROM risk_treatment_plans p JOIN risks r ON r.id = p.risk_id AND r.workspace_id = p.workspace_id WHERE p.workspace_id = $1 AND p.id = $2`, [workspaceId, id]);
  return result.rows[0] ? map(result.rows[0] as Row) : null;
}
export async function create(workspaceId: string, input: RiskTreatmentPlanInput): Promise<RiskTreatmentPlan> {
  const client = await pool.connect();
  try {
  await client.query('BEGIN');
  await requireTreatmentScoringGuard(client);
  const completedAt = input.status === 'completed' ? new Date().toISOString() : null;
  const result = await client.query(`INSERT INTO risk_treatment_plans (id, workspace_id, risk_id, title, description, strategy, owner, due_date, status, progress_percent, priority, expected_residual_score, effectiveness_rating, evidence_summary, approval_status, created_by, completed_at, review_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`, [generateId('rtp'), workspaceId, input.riskId, input.title.trim(), input.description?.trim() || '', input.strategy, input.owner.trim(), input.dueDate, input.status, input.progressPercent, input.priority, input.expectedResidualScore ?? null, input.effectivenessRating ?? null, input.evidenceSummary?.trim() || null, input.approvalStatus, input.createdBy || null, completedAt, input.reviewDate || null, input.notes?.trim() || null]);
  if (input.linkedControls !== undefined) await replaceTreatmentControls(client, workspaceId, String(result.rows[0].id), input.linkedControls, input.createdBy);
  await client.query('COMMIT');
  return get(workspaceId, String(result.rows[0].id)) as Promise<RiskTreatmentPlan>;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function update(workspaceId: string, id: string, input: Partial<RiskTreatmentPlanInput>): Promise<RiskTreatmentPlan | null> {
  const client = await pool.connect();
  try {
  await client.query('BEGIN');
  await requireTreatmentScoringGuard(client);
  const locked = await client.query('SELECT id FROM risk_treatment_plans WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [id, workspaceId]);
  if (!locked.rows.length) { await client.query('ROLLBACK'); return null; }
  const fields: Record<string, string> = { title:'title', description:'description', strategy:'strategy', owner:'owner', dueDate:'due_date', status:'status', progressPercent:'progress_percent', priority:'priority', expectedResidualScore:'expected_residual_score', effectivenessRating:'effectiveness_rating', evidenceSummary:'evidence_summary', approvalStatus:'approval_status', reviewDate:'review_date', notes:'notes' };
  const sets: string[] = []; const values: unknown[] = [id, workspaceId];
  for (const [key, column] of Object.entries(fields)) if (input[key as keyof RiskTreatmentPlanInput] !== undefined) { values.push(input[key as keyof RiskTreatmentPlanInput] ?? null); sets.push(`${column} = $${values.length}`); }
  if (input.status === 'completed') sets.push('completed_at = COALESCE(completed_at, NOW())');
  else if (input.status) sets.push('completed_at = NULL');
  if (input.linkedControls !== undefined) await replaceTreatmentControls(client, workspaceId, id, input.linkedControls, input.createdBy);
  if (!sets.length) { await client.query('COMMIT'); return get(workspaceId, id); }
  await client.query(`UPDATE risk_treatment_plans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, values);
  await client.query('COMMIT');
  return get(workspaceId, id);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function summary(workspaceId: string): Promise<RiskTreatmentSummary> {
  const plans = await list(workspaceId); const byStatus: Record<string, number> = {}; const byStrategy: Record<string, number> = {};
  plans.forEach((p) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; byStrategy[p.strategy] = (byStrategy[p.strategy] || 0) + 1; });
  return { total: plans.length, open: plans.filter((p) => !CLOSED.has(p.status)).length, overdue: plans.filter((p) => p.status === 'overdue').length, completed: plans.filter((p) => p.status === 'completed').length, averageProgress: plans.length ? Math.round(plans.reduce((sum,p) => sum + p.progressPercent, 0) / plans.length) : 0, byStatus, byStrategy };
}
