import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db.js';
import { migrationManifest } from './migrationManifest.js';
import { assertAppliedPrefix, validateMigrationManifest } from './migrationValidation.js';

const migrationDirectory = path.resolve(__dirname, '../../sql/migrations');

function requireExecutionApproval() {
  if (process.env.MIGRATION_RUN !== 'true') {
    throw new Error('Migration execution is disabled. Set MIGRATION_RUN=true for a deliberate release operation.');
  }
  const environment = process.env.NODE_ENV?.toLowerCase();
  if (environment === 'production' && process.env.MIGRATION_PRODUCTION_APPROVED !== 'true') {
    throw new Error('Production migration execution requires MIGRATION_PRODUCTION_APPROVED=true.');
  }
  if (migrationManifest.some(item => item.destructive) && process.env.MIGRATION_DESTRUCTIVE_APPROVED !== 'true') {
    throw new Error('The manifest contains destructive migrations and requires MIGRATION_DESTRUCTIVE_APPROVED=true.');
  }
  if (!process.env.MIGRATION_EXPECTED_DATABASE) {
    throw new Error('MIGRATION_EXPECTED_DATABASE is required to prevent execution against an unintended database.');
  }
}

export async function migrate() {
  requireExecutionApproval();
  const validation = await validateMigrationManifest(migrationManifest, migrationDirectory);
  if (validation.errors.length) throw new Error(`Migration manifest validation failed: ${validation.errors.join('; ')}`);

  const client = await pool.connect();
  try {
    const identity = await client.query<{ database_name: string }>('SELECT current_database() AS database_name');
    if (identity.rows[0]?.database_name !== process.env.MIGRATION_EXPECTED_DATABASE) {
      throw new Error('Connected database does not match MIGRATION_EXPECTED_DATABASE.');
    }
    // Serialize startup migrations across replicas, including legacy bootstrap.
    await client.query("SELECT pg_advisory_lock(hashtext('laflo-risk-migrations'))");
    const ledgerTable = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.risk_schema_migrations') IS NOT NULL AS exists",
    );
    if (ledgerTable.rows[0]?.exists) {
      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'risk_schema_migrations'`,
      );
      const columnNames = new Set(columns.rows.map(row => row.column_name));
      const missing = ['name', 'checksum', 'status', 'applied_at', 'execution_metadata'].filter(
        column => !columnNames.has(column),
      );
      if (missing.length) {
        throw new Error(`Legacy migration ledger requires an explicit adoption plan; missing columns: ${missing.join(', ')}`);
      }
    } else {
      await client.query(`CREATE TABLE risk_schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        status TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      )`);
    }

    const ledger = await client.query<{ name: string; checksum: string | null; status: string }>(
      'SELECT name, checksum, status FROM risk_schema_migrations ORDER BY applied_at, name',
    );
    const appliedNames = ledger.rows.filter(row => row.status === 'applied').map(row => row.name.replace(/\.sql$/, ''));
    assertAppliedPrefix(appliedNames, migrationManifest);
    for (const row of ledger.rows) {
      const migration = migrationManifest.find(item => item.id === row.name.replace(/\.sql$/, ''));
      if (!migration) throw new Error(`Ledger contains unknown migration ${row.name}; manual reconciliation is required.`);
      if (!row.checksum) throw new Error(`Ledger migration ${row.name} has no checksum; explicit baseline adoption is required.`);
      if (row.checksum !== migration.sha256) throw new Error(`Historical migration checksum mismatch: ${row.name}`);
      if (row.status !== 'applied') throw new Error(`Migration ${row.name} is recorded as ${row.status}; manual recovery is required.`);
    }

    for (const migration of migrationManifest.slice(appliedNames.length)) {
      const sql = await readFile(path.join(migrationDirectory, migration.file), 'utf8');
      // Existing SQL files also support standalone execution; own the transaction here.
      const body = sql.replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
      await client.query('BEGIN');
      try {
        await client.query(body);
        await client.query(
          `INSERT INTO risk_schema_migrations(name, checksum, status, execution_metadata)
           VALUES($1, $2, 'applied', $3::jsonb)`,
          [migration.id, migration.sha256, JSON.stringify({ runner: 'laflo-manifest-v1' })],
        );
        await client.query('COMMIT');
        console.log(`Applied migration: ${migration.id}`);
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

if (require.main === module) {
  migrate().catch(error => {
    console.error('Risk migration failed; release operation aborted:', error);
    process.exitCode = 1;
  }).finally(() => pool.end());
}
