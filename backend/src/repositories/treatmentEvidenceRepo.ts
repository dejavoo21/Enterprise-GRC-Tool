import { pool, query, generateId } from '../db.js';
import { ReportWorkflowError } from '../services/riskReportWorkflow.js';

export async function listTreatmentEvidence(workspace: string, treatment: string) {
  const plan = await query('SELECT id FROM risk_treatment_plans WHERE workspace_id=$1 AND id=$2',[workspace,treatment]);
  if (!plan.rowCount) throw new ReportWorkflowError('Treatment not found.',404);
  const result = await query(`SELECT e.id,e.name,e.type,e.collected_at,e.last_reviewed_at,l.linked_at
    FROM risk_treatment_evidence_links l JOIN evidence e ON e.workspace_id=l.workspace_id AND e.id=l.evidence_id
    WHERE l.workspace_id=$1 AND l.treatment_id=$2 ORDER BY l.linked_at DESC`,[workspace,treatment]);
  return result.rows;
}
export async function changeTreatmentEvidence(workspace: string, treatment: string, evidence: string, actor: string, link: boolean) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evidence)) throw new ReportWorkflowError('Choose a valid evidence record.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = await client.query('SELECT id FROM risk_treatment_plans WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspace,treatment]);
    if (!plan.rowCount) throw new ReportWorkflowError('Treatment not found.',404);
    const item = await client.query('SELECT id FROM evidence WHERE workspace_id=$1 AND id=$2 FOR KEY SHARE',[workspace,evidence]);
    if (!item.rowCount) throw new ReportWorkflowError('Evidence not found in this workspace.',404);
    const result = link
      ? await client.query(`INSERT INTO risk_treatment_evidence_links(workspace_id,treatment_id,evidence_id,linked_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[workspace,treatment,evidence,actor])
      : await client.query('DELETE FROM risk_treatment_evidence_links WHERE workspace_id=$1 AND treatment_id=$2 AND evidence_id=$3',[workspace,treatment,evidence]);
    if (result.rowCount) await client.query(`INSERT INTO risk_treatment_evidence_events(id,workspace_id,treatment_id,evidence_id,action,actor_id) VALUES($1,$2,$3,$4,$5,$6)`,[generateId('tee'),workspace,treatment,evidence,link?'linked':'unlinked',actor]);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  return listTreatmentEvidence(workspace,treatment);
}
