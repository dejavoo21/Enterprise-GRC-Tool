import { pool } from '../db.js';

// Demo fixtures retain legacy provenance. Never apply fixed-scale fixtures to an active policy.
export async function legacyRiskSeedQuery(sql: string, values: unknown[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [values[1]]);
    // Startup fixtures must never overwrite an existing risk, including legacy records.
    const existing = await client.query('SELECT id FROM risks WHERE id=$1', [values[0]]);
    if (existing.rowCount) { await client.query('COMMIT'); return; }
    const table = await client.query("SELECT to_regclass('risk_methodologies') AS name");
    if (table.rows[0].name) {
      const active = await client.query("SELECT id FROM risk_methodologies WHERE workspace_id=$1 AND status='Active'", [values[1]]);
      if (active.rowCount) { await client.query('COMMIT'); return; }
    }
    await client.query("SET LOCAL laflo.legacy_seed = 'true'");
    await client.query(sql, values);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
