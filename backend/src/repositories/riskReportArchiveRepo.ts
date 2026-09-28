import { pool, query, generateId } from '../db.js';
import type { RiskReportPack } from '../types/riskIntelligence.js';
import { nextReportStatus, ReportWorkflowError, type ReportAction, type ReportStatus } from '../services/riskReportWorkflow.js';

export interface ArchivedReport {
  id: string; workspace_id: string; report_type: string; title: string; pack: RiskReportPack;
  prepared_by: string; prepared_email: string; status: ReportStatus; revision: number;
  reviewed_by: string | null; approved_by: string | null; created_at: string;
}
export async function archiveReport(workspace: string, user: string, email: string, pack: RiskReportPack) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = generateId('rpt');
    await client.query(`INSERT INTO risk_report_snapshots(id,workspace_id,report_type,title,pack,prepared_by,prepared_email)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [id,workspace,pack.reportType,pack.title,JSON.stringify(pack),user,email]);
    await client.query(`INSERT INTO risk_report_events(id,workspace_id,report_id,action,actor_id,actor_email) VALUES($1,$2,$3,'generated',$4,$5)`, [generateId('rpe'),workspace,id,user,email]);
    await client.query('COMMIT');
    return id;
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export async function listReports(workspace: string, page: number) {
  const result = await query(`SELECT id,title,report_type,status,revision,prepared_email,created_at FROM risk_report_snapshots WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $2`,[workspace,(page-1)*20]);
  const total = await query('SELECT COUNT(*)::int AS count FROM risk_report_snapshots WHERE workspace_id=$1',[workspace]);
  return { items: result.rows, total: total.rows[0].count, page };
}
export async function getReport(workspace: string, id: string) {
  const result = await query<ArchivedReport>('SELECT * FROM risk_report_snapshots WHERE workspace_id=$1 AND id=$2',[workspace,id]);
  if (!result.rows[0]) throw new ReportWorkflowError('Report not found.',404);
  const events = await query('SELECT action,actor_email,comment,created_at FROM risk_report_events WHERE workspace_id=$1 AND report_id=$2 ORDER BY created_at,id',[workspace,id]);
  return { ...result.rows[0], events: events.rows };
}
export async function transitionReport(workspace: string, id: string, user: string, email: string, action: ReportAction, revision: number, comment: unknown) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<ArchivedReport>('SELECT * FROM risk_report_snapshots WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspace,id]);
    const report = result.rows[0];
    if (!report) throw new ReportWorkflowError('Report not found.',404);
    if (report.revision !== revision) throw new ReportWorkflowError('Report changed. Reload before acting.',409);
    const status = nextReportStatus(report,action,user,comment);
    await client.query(`UPDATE risk_report_snapshots SET status=$3,revision=revision+1,updated_at=NOW(),
      reviewed_by=CASE WHEN $3='reviewed' THEN $4 ELSE reviewed_by END,
      approved_by=CASE WHEN $3='approved' THEN $4 ELSE approved_by END WHERE workspace_id=$1 AND id=$2`,[workspace,id,status,user]);
    await client.query(`INSERT INTO risk_report_events(id,workspace_id,report_id,action,actor_id,actor_email,comment) VALUES($1,$2,$3,$4,$5,$6,$7)`,[generateId('rpe'),workspace,id,action,user,email,String(comment).trim()]);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  return getReport(workspace,id);
}
