import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db.js';
import { ensureRiskIntelligenceSchema } from '../repositories/riskIntelligenceRepo.js';
import { ensureRiskTreatmentSchema } from '../repositories/riskTreatmentRepo.js';

const migrations = [
  '20260920-risk-cia-impact.sql',
  '20260920-risk-treatment-lifecycle.sql',
  '20260922-risk-treatment-plans.sql',
  '20260922-treatment-control-links.sql',
  '20260923-risk-methodologies.sql',
  '20260923-risk-version-pinning.sql',
  '20260924-risk-tenant-rollout.sql',
];

async function migrate() {
  const client = await pool.connect();
  try {
    // Serialize startup migrations across replicas, including legacy bootstrap.
    await client.query("SELECT pg_advisory_lock(hashtext('laflo-risk-migrations'))");
    await ensureRiskIntelligenceSchema();
    await ensureRiskTreatmentSchema();
    await client.query(`CREATE TABLE IF NOT EXISTS risk_schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for (const name of migrations) {
      const applied = await client.query('SELECT 1 FROM risk_schema_migrations WHERE name=$1', [name]);
      if (applied.rowCount) continue;
      const sql = await readFile(path.resolve(__dirname, '../../sql/migrations', name), 'utf8');
      // Existing SQL files also support standalone execution; own the transaction here.
      const body = sql.replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
      await client.query('BEGIN');
      try {
        await client.query(body);
        await client.query('INSERT INTO risk_schema_migrations(name) VALUES($1)', [name]);
        await client.query('COMMIT');
        console.log(`Applied risk migration: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('laflo-risk-migrations'))");
    client.release();
  }
}

migrate().catch(error => {
  console.error('Risk migration failed; startup aborted:', error);
  process.exitCode = 1;
}).finally(() => pool.end());
