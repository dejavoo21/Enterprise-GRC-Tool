import { randomUUID } from 'node:crypto';
import { pool, query } from '../db.js';
import { MethodologyValidationError, validateMethodology, type MethodologyConfig } from '../services/riskMethodologyRules.js';

export type Methodology = {
  id: string; workspaceId: string; version: number; status: 'Draft' | 'Active' | 'Retired';
  config: MethodologyConfig; createdAt: string; updatedAt: string;
};
const select = `SELECT id, workspace_id AS "workspaceId", version, status, config,
  created_at AS "createdAt", updated_at AS "updatedAt" FROM risk_methodologies`;
export async function workspaceState(workspace: string) {
  const row = (await query(`SELECT w.risk_methodology_mode AS "methodologyMode",
    m.id AS "activeMethodologyId", m.version AS "activeMethodologyVersion"
    FROM workspaces w LEFT JOIN risk_methodologies m ON m.workspace_id=w.id AND m.status='Active'
    WHERE w.id=$1`, [workspace])).rows[0];
  if (!row) throw new MethodologyValidationError('Workspace not found.');
  const hasActiveMethodology = Boolean(row.activeMethodologyId);
  return {...row, hasActiveMethodology, legacyCompatibility: row.methodologyMode === 'legacy' && !hasActiveMethodology,
    enforcementWarning: hasActiveMethodology ? null : row.methodologyMode === 'enforced'
      ? 'Risk methodology must be configured before creating risks.'
      : 'Legacy scoring mode. Methodology pinning is not active. Configure and activate a methodology before switching to enforced mode.'};
}

export async function setWorkspaceMode(workspace: string, actor: string, mode: 'legacy' | 'enforced') {
  if (!['legacy','enforced'].includes(mode)) throw new MethodologyValidationError('Invalid methodology mode.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT risk_methodology_mode FROM workspaces WHERE id=$1 FOR UPDATE',[workspace])).rows[0];
    if (!row) throw new MethodologyValidationError('Workspace not found.');
    if (row.risk_methodology_mode !== mode) {
      await client.query('UPDATE workspaces SET risk_methodology_mode=$2 WHERE id=$1',[workspace,mode]);
      await client.query('INSERT INTO risk_methodology_mode_events(id,workspace_id,actor_id,previous_mode,next_mode) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(),workspace,actor,row.risk_methodology_mode,mode]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function list(workspace: string): Promise<Methodology[]> {
  return (await query<Methodology>(`${select} WHERE workspace_id = $1 ORDER BY version DESC`, [workspace])).rows;
}
export async function get(workspace: string, id: string): Promise<Methodology | null> {
  return (await query<Methodology>(`${select} WHERE workspace_id = $1 AND id = $2`, [workspace, id])).rows[0] || null;
}

export async function activate(workspace: string, id: string, actor: string, confirmed: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM workspaces WHERE id = $1 FOR UPDATE', [workspace]);
    const item = (await client.query(`${select} WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspace, id])).rows[0] as Methodology | undefined;
    if (!item || item.status !== 'Draft') throw new MethodologyValidationError('Only a draft in this workspace can be activated.');
    const config = validateMethodology(item.config);
    if (config.likelihoodLevels.length > 5 || config.impactLevels.length > 5) throw new MethodologyValidationError('Database axis constraints currently support at most five levels. Larger custom matrices cannot be activated yet.');
    const guard = await client.query("SELECT 1 FROM pg_trigger WHERE ((tgrelid='risks'::regclass AND tgname='risk_methodology_pin') OR (tgrelid='risk_treatment_plans'::regclass AND tgname='treatment_methodology_guard')) AND tgenabled='O'");
    if (guard.rowCount !== 2) throw new MethodologyValidationError('Risk version-pinning migration must be applied before activation.');
    const count = Number((await client.query('SELECT COUNT(*) AS count FROM risks WHERE workspace_id=$1', [workspace])).rows[0].count);
    if (!confirmed) throw new MethodologyValidationError(`Confirm activation explicitly. ${count} existing risks will retain their original or legacy methodology.`);
    const previous = (await client.query("UPDATE risk_methodologies SET status='Retired', retired_at=NOW(), updated_at=NOW() WHERE workspace_id=$1 AND status='Active' RETURNING id,version", [workspace])).rows;
    await client.query("UPDATE risk_methodologies SET status='Active',effective_from=NOW(),updated_at=NOW() WHERE workspace_id=$1 AND id=$2", [workspace, id]);
    await client.query(`INSERT INTO risk_methodology_events (id,workspace_id,methodology_id,actor_id,action,snapshot) VALUES ($1,$2,$3,$4,'activated',$5::jsonb)`, [randomUUID(),workspace,id,actor,JSON.stringify({ previous, next: { ...item, status: 'Active' }, historicalRisksPreserved: count })]);
    const active = (await client.query(`${select} WHERE workspace_id=$1 AND id=$2`, [workspace,id])).rows[0];
    await client.query('COMMIT');
    return { ...active, warning: `${count} historical risks retained their existing scores and methodology.`, historicalRisksPreserved: count };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

// Lock the workspace to serialize version allocation. Draft updates also use this lock.
export async function saveDraft(workspace: string, actor: string, config: MethodologyConfig, id?: string, expectedUpdatedAt?: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scope = await client.query('SELECT id FROM workspaces WHERE id = $1 FOR UPDATE', [workspace]);
    if (!scope.rowCount) throw new MethodologyValidationError('Workspace not found.');
    let previous: unknown = null;
    if (id) {
      const existing = (await client.query(`${select} WHERE workspace_id = $1 AND id = $2 FOR UPDATE`, [workspace, id])).rows[0];
      if (!existing || existing.status !== 'Draft') throw new MethodologyValidationError('Only a draft in this workspace can be edited.');
      if (!expectedUpdatedAt || new Date(existing.updatedAt).toISOString() !== expectedUpdatedAt) throw new MethodologyValidationError('Draft has changed. Reload before saving.');
      previous = existing.config;
      await client.query('UPDATE risk_methodologies SET config = $1, updated_at = NOW() WHERE workspace_id = $2 AND id = $3', [JSON.stringify(config), workspace, id]);
    } else {
      id = randomUUID();
      await client.query(`INSERT INTO risk_methodologies (id, workspace_id, version, config, created_by)
        SELECT $1, $2, COALESCE(MAX(version), 0) + 1, $3::jsonb, $4 FROM risk_methodologies WHERE workspace_id = $2`, [id, workspace, JSON.stringify(config), actor]);
    }
    await client.query(`INSERT INTO risk_methodology_events (id, workspace_id, methodology_id, actor_id, action, snapshot)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)`, [randomUUID(), workspace, id, actor, previous ? 'draft_updated' : 'draft_created', JSON.stringify({ previous, next: config })]);
    const result = (await client.query(`${select} WHERE workspace_id = $1 AND id = $2`, [workspace, id])).rows[0] as Methodology;
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
