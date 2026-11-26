import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { migrationManifest } from './migrationManifest.js';
import {
  fingerprintCatalogEvidence,
  fingerprintMigrationPlan,
  normalizeAttestationTimestamp,
  normalizeMigrationId,
  validateCatalogCheckpoint,
  validateDatabaseIdentity,
  validateLegacyLedgerReconciliation,
  validateModernLedgerReconciliation,
  validateReconciliationRecoveryState,
  type LegacyLedgerRow,
  type MigrationCompatibilityAttestation,
  type ModernLedgerRow,
  type ReconciliationContext,
} from './migrationReconciliation.js';
import { assertAppliedPrefix, validateMigrationManifest } from './migrationValidation.js';

const migrationDirectory = path.resolve(__dirname, '../../sql/migrations');
const attestationMigrationId = '20261122-migration-reconciliation-attestations';

function requireExecutionApproval() {
  if (process.env.MIGRATION_RUN !== 'true') throw new Error('Migration execution is disabled. Set MIGRATION_RUN=true for a deliberate release operation.');
  const environment = process.env.NODE_ENV?.toLowerCase();
  if (environment === 'production' && process.env.MIGRATION_PRODUCTION_APPROVED !== 'true') throw new Error('Production migration execution requires MIGRATION_PRODUCTION_APPROVED=true.');
  if (migrationManifest.some(item => item.destructive) && process.env.MIGRATION_DESTRUCTIVE_APPROVED !== 'true') throw new Error('The manifest contains destructive migrations and requires MIGRATION_DESTRUCTIVE_APPROVED=true.');
  if (!process.env.MIGRATION_EXPECTED_DATABASE) throw new Error('MIGRATION_EXPECTED_DATABASE is required to prevent execution against an unintended database.');
}

async function calculateCatalogFingerprint(client: PoolClient): Promise<string> {
  const queries = [
    `SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position FROM information_schema.columns WHERE table_schema NOT LIKE 'pg_%' AND table_schema<>'information_schema' ORDER BY table_schema,table_name,ordinal_position`,
    `SELECT n.nspname,c.relname,con.conname,con.contype,con.convalidated,pg_get_constraintdef(con.oid,true) FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY n.nspname,c.relname,con.conname`,
    `SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname NOT LIKE 'pg_%' AND schemaname<>'information_schema' ORDER BY schemaname,tablename,indexname`,
    `SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY n.nspname,p.proname,3`,
    `SELECT n.nspname,c.relname,t.tgname,t.tgenabled,p.proname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE NOT t.tgisinternal AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY n.nspname,c.relname,t.tgname`,
  ];
  const evidence: unknown[] = [];
  for (const queryText of queries) evidence.push((await client.query(queryText)).rows);
  return fingerprintCatalogEvidence(evidence);
}

function mapAttestationRow(row: Record<string, unknown>): MigrationCompatibilityAttestation {
  return {
    migrationId: String(row.migration_id), expectedRepositoryChecksum: String(row.expected_repository_checksum),
    databaseIdentityId: String(row.database_identity_id), baselineCatalogFingerprint: String(row.baseline_catalog_fingerprint),
    baselineEvidenceVersion: String(row.baseline_evidence_version), migrationPlanFingerprint: String(row.migration_plan_fingerprint),
    observedSchemaEvidence: row.observed_schema_evidence as Record<string, unknown>,
    compatibilityAssessment: row.compatibility_assessment as MigrationCompatibilityAttestation['compatibilityAssessment'],
    authorisingDecision: row.authorising_decision as 'approved', approvalReference: String(row.approval_reference),
    attestedAt: normalizeAttestationTimestamp(row.attested_at), reconciliationVersion: String(row.reconciliation_version),
    releaseCandidateSha: String(row.release_candidate_sha),
    requiredRepairMigrationId: row.required_repair_migration_id ? String(row.required_repair_migration_id) : undefined,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function attestationMismatchFields(left: MigrationCompatibilityAttestation, right: MigrationCompatibilityAttestation): string[] {
  const comparisons: Array<[string, boolean]> = [
    ['migrationId', left.migrationId === right.migrationId],
    ['expectedRepositoryChecksum', left.expectedRepositoryChecksum === right.expectedRepositoryChecksum],
    ['databaseIdentityId', left.databaseIdentityId.toLowerCase() === right.databaseIdentityId.toLowerCase()],
    ['baselineCatalogFingerprint', left.baselineCatalogFingerprint === right.baselineCatalogFingerprint],
    ['baselineEvidenceVersion', left.baselineEvidenceVersion === right.baselineEvidenceVersion],
    ['migrationPlanFingerprint', left.migrationPlanFingerprint === right.migrationPlanFingerprint],
    ['observedSchemaEvidence', stableJson(left.observedSchemaEvidence) === stableJson(right.observedSchemaEvidence)],
    ['compatibilityAssessment', left.compatibilityAssessment === right.compatibilityAssessment],
    ['authorisingDecision', left.authorisingDecision === right.authorisingDecision],
    ['approvalReference', left.approvalReference === right.approvalReference],
    ['attestedAt', left.attestedAt === new Date(right.attestedAt).toISOString()],
    ['reconciliationVersion', left.reconciliationVersion === right.reconciliationVersion],
    ['releaseCandidateSha', left.releaseCandidateSha === right.releaseCandidateSha],
    ['requiredRepairMigrationId', left.requiredRepairMigrationId === right.requiredRepairMigrationId],
  ];
  return comparisons.filter(([, matches]) => !matches).map(([field]) => field);
}

async function loadApprovedAttestations(client: PoolClient, reconciliationVersion: string): Promise<MigrationCompatibilityAttestation[]> {
  const tableExists = (await client.query<{ exists: boolean }>("SELECT to_regclass('public.risk_schema_migration_attestations') IS NOT NULL AS exists")).rows[0]?.exists;
  let persisted: MigrationCompatibilityAttestation[] = [];
  if (tableExists) {
    const result = await client.query(
      `SELECT migration_id,expected_repository_checksum,database_identity_id,baseline_catalog_fingerprint,baseline_evidence_version,migration_plan_fingerprint,observed_schema_evidence,compatibility_assessment,authorising_decision,approval_reference,attested_at,reconciliation_version,release_candidate_sha,required_repair_migration_id FROM risk_schema_migration_attestations WHERE reconciliation_version=$1 ORDER BY migration_id`,
      [reconciliationVersion],
    );
    persisted = result.rows.map(mapAttestationRow);
  }
  const file = process.env.MIGRATION_RECONCILIATION_ATTESTATION_FILE;
  if (!file) {
    if (persisted.length) return persisted;
    throw new Error('Legacy ledger requires MIGRATION_RECONCILIATION_ATTESTATION_FILE or persisted approved attestations.');
  }
  const parsed = JSON.parse(await readFile(path.resolve(file), 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Migration reconciliation attestation file must contain an array.');
  const approved = parsed as MigrationCompatibilityAttestation[];
  const merged = new Map(persisted.map(item => [item.migrationId, item]));
  const fileIds = new Set<string>();
  for (const item of approved) {
    if (fileIds.has(item.migrationId)) throw new Error(`Migration reconciliation attestation file contains duplicate migration: ${item.migrationId}`);
    fileIds.add(item.migrationId);
    const stored = merged.get(item.migrationId);
    if (stored) {
      const mismatches = attestationMismatchFields(stored, item);
      if (mismatches.length) throw new Error(`Approved migration attestation conflicts with persisted record: ${item.migrationId} (${mismatches.join(', ')})`);
    }
    merged.set(item.migrationId, item);
  }
  return [...merged.values()];
}

async function persistAttestations(client: PoolClient, attestations: readonly MigrationCompatibilityAttestation[]): Promise<void> {
  for (const item of attestations) {
    await client.query(
      `INSERT INTO risk_schema_migration_attestations(migration_id,expected_repository_checksum,database_identity_id,baseline_catalog_fingerprint,baseline_evidence_version,migration_plan_fingerprint,observed_schema_evidence,compatibility_assessment,authorising_decision,approval_reference,attested_at,reconciliation_version,release_candidate_sha,required_repair_migration_id) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (migration_id,reconciliation_version) DO NOTHING`,
      [item.migrationId,item.expectedRepositoryChecksum,item.databaseIdentityId,item.baselineCatalogFingerprint,item.baselineEvidenceVersion,item.migrationPlanFingerprint,JSON.stringify(item.observedSchemaEvidence),item.compatibilityAssessment,item.authorisingDecision,item.approvalReference,item.attestedAt,item.reconciliationVersion,item.releaseCandidateSha,item.requiredRepairMigrationId ?? null],
    );
    const persisted = await client.query<Record<string, unknown>>(
      `SELECT migration_id,expected_repository_checksum,database_identity_id,baseline_catalog_fingerprint,baseline_evidence_version,migration_plan_fingerprint,observed_schema_evidence,compatibility_assessment,authorising_decision,approval_reference,attested_at,reconciliation_version,release_candidate_sha,required_repair_migration_id FROM risk_schema_migration_attestations WHERE migration_id=$1 AND reconciliation_version=$2`,
      [item.migrationId, item.reconciliationVersion],
    );
    const stored = persisted.rows[0] ? mapAttestationRow(persisted.rows[0]) : undefined;
    const mismatches = stored ? attestationMismatchFields(stored, item) : ['persistedRecord'];
    if (mismatches.length) {
      throw new Error(`Persisted migration attestation conflicts with approved input: ${item.migrationId} (${mismatches.join(', ')})`);
    }
  }
}

function executionMetadata(row: Record<string, unknown>): Record<string, unknown> {
  if (!row.execution_metadata) return {};
  if (typeof row.execution_metadata === 'string') return JSON.parse(row.execution_metadata) as Record<string, unknown>;
  return row.execution_metadata as Record<string, unknown>;
}

export async function migrate() {
  requireExecutionApproval();
  const statementTimeoutMs = Number(process.env.MIGRATION_STATEMENT_TIMEOUT_MS || 30_000);
  const lockTimeoutMs = Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 5_000);
  if (!Number.isInteger(statementTimeoutMs) || statementTimeoutMs < 1_000 || statementTimeoutMs > 300_000) throw new Error('MIGRATION_STATEMENT_TIMEOUT_MS must be between 1000 and 300000.');
  if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs < 500 || lockTimeoutMs > 30_000) throw new Error('MIGRATION_LOCK_TIMEOUT_MS must be between 500 and 30000.');
  const validation = await validateMigrationManifest(migrationManifest, migrationDirectory);
  if (validation.errors.length) throw new Error(`Migration manifest validation failed: ${validation.errors.join('; ')}`);
  const client = await pool.connect();
  try {
    const identity = await client.query<{ database_name: string }>('SELECT current_database() AS database_name');
    const databaseName = identity.rows[0]?.database_name;
    if (databaseName !== process.env.MIGRATION_EXPECTED_DATABASE) throw new Error('Connected database does not match MIGRATION_EXPECTED_DATABASE.');
    await client.query("SELECT pg_advisory_lock(hashtext('laflo-risk-migrations'))");
    const ledgerTable = await client.query<{ exists: boolean }>("SELECT to_regclass('public.risk_schema_migrations') IS NOT NULL AS exists");
    if (!ledgerTable.rows[0]?.exists) {
      await client.query(`CREATE TABLE risk_schema_migrations (name TEXT PRIMARY KEY,checksum TEXT NOT NULL,status TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),execution_metadata JSONB NOT NULL DEFAULT '{}'::jsonb)`);
    }
    const databaseIdentityId = process.env.MIGRATION_DATABASE_IDENTITY;
    if (!databaseIdentityId) throw new Error('MIGRATION_DATABASE_IDENTITY is required for durable target binding.');
    const releaseCandidateSha = process.env.MIGRATION_RELEASE_CANDIDATE_SHA;
    if (!releaseCandidateSha || !/^[a-f0-9]{40}$/i.test(releaseCandidateSha)) throw new Error('MIGRATION_RELEASE_CANDIDATE_SHA must be an explicit 40-character Git SHA.');
    const identityTableExists = (await client.query<{ exists: boolean }>("SELECT to_regclass('public.risk_database_identity') IS NOT NULL AS exists")).rows[0]?.exists;
    const attestationTableExists = (await client.query<{ exists: boolean }>("SELECT to_regclass('public.risk_schema_migration_attestations') IS NOT NULL AS exists")).rows[0]?.exists;
    const registeredIdentityRows = identityTableExists
      ? (await client.query<{ identity_id: string; registered_for_release_sha: string }>("SELECT identity_id::text,registered_for_release_sha FROM risk_database_identity WHERE status='active' ORDER BY registered_at")).rows
      : [];
    const registeredIdentities = registeredIdentityRows.map(row => row.identity_id);
    const identityError = validateDatabaseIdentity(databaseIdentityId, registeredIdentities, identityTableExists);
    if (identityError) throw new Error(identityError);
    const identityRegistrationReference = process.env.MIGRATION_DATABASE_IDENTITY_APPROVAL_REFERENCE;
    if (!identityTableExists && !identityRegistrationReference?.trim()) {
      throw new Error('Initial database identity registration requires MIGRATION_DATABASE_IDENTITY_APPROVAL_REFERENCE.');
    }
    const columns = await client.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='risk_schema_migrations'`);
    const columnNames = new Set(columns.rows.map(row => row.column_name));
    const selected = ['name','applied_at','checksum','status','execution_metadata'].filter(column => columnNames.has(column));
    const ledger = await client.query<Record<string, unknown>>(`SELECT ${selected.map(column => `"${column}"`).join(',')} FROM risk_schema_migrations ORDER BY applied_at,name`);
    const legacyRows: LegacyLedgerRow[] = ledger.rows.filter(row => !columnNames.has('checksum') || !row.checksum).map(row => ({ name: String(row.name), appliedAt: new Date(String(row.applied_at)).toISOString() }));
    const modernRows = ledger.rows.filter(row => columnNames.has('checksum') && row.checksum).sort((left, right) => {
      const leftIndex = migrationManifest.findIndex(item => item.id === normalizeMigrationId(String(left.name)));
      const rightIndex = migrationManifest.findIndex(item => item.id === normalizeMigrationId(String(right.name)));
      return leftIndex - rightIndex;
    });
    const currentCatalogFingerprint = await calculateCatalogFingerprint(client);
    if (modernRows.length) {
      const latestMetadata = executionMetadata(modernRows.at(-1)!);
      const checkpointError = validateCatalogCheckpoint(currentCatalogFingerprint, typeof latestMetadata.catalogFingerprintAfter === 'string' ? latestMetadata.catalogFingerprintAfter : undefined);
      if (checkpointError) throw new Error(checkpointError);
    }
    const recoveryError = validateReconciliationRecoveryState({
      identityTableExists,
      attestationTableExists,
      reconciliationLedgerApplied: modernRows.some(row => normalizeMigrationId(String(row.name)) === attestationMigrationId),
    });
    if (recoveryError) throw new Error(recoveryError);
    let appliedNames: string[] = [];
    let approvedAttestations: MigrationCompatibilityAttestation[] = [];
    let reconciliationContext: ReconciliationContext | undefined;
    if (legacyRows.length) {
      if (process.env.MIGRATION_RECONCILIATION_APPROVED !== 'true') throw new Error('Legacy migration ledger requires MIGRATION_RECONCILIATION_APPROVED=true and approved attestations.');
      const reconciliationVersion = process.env.MIGRATION_RECONCILIATION_VERSION;
      const baselineEvidenceVersion = process.env.MIGRATION_BASELINE_EVIDENCE_VERSION;
      if (!reconciliationVersion) throw new Error('MIGRATION_RECONCILIATION_VERSION is required.');
      if (!baselineEvidenceVersion) throw new Error('MIGRATION_BASELINE_EVIDENCE_VERSION is required.');
      reconciliationContext = {
        databaseIdentityId,
        currentCatalogFingerprint,
        baselineEvidenceVersion,
        migrationPlanFingerprint: fingerprintMigrationPlan(migrationManifest),
        releaseCandidateSha: registeredIdentityRows[0]?.registered_for_release_sha || releaseCandidateSha,
        reconciliationVersion,
        requireBaselineCatalogMatch: !attestationTableExists,
      };
      approvedAttestations = await loadApprovedAttestations(client, reconciliationVersion);
      const highestLegacyIndex = Math.max(...legacyRows.map(row => migrationManifest.findIndex(item => item.id === normalizeMigrationId(row.name))));
      const legacyAttestations = approvedAttestations.filter(item => migrationManifest.findIndex(migration => migration.id === item.migrationId) <= highestLegacyIndex);
      const result = validateLegacyLedgerReconciliation(legacyRows, legacyAttestations, migrationManifest, reconciliationContext);
      if (result.errors.length) throw new Error(`Legacy ledger reconciliation failed: ${result.errors.join('; ')}`);
      appliedNames = result.effectiveHistory.map(entry => entry.migrationId);
    }
    if (modernRows.length && reconciliationContext) {
      const typedModernRows: ModernLedgerRow[] = modernRows.map(row => ({
        name: String(row.name),
        appliedAt: new Date(String(row.applied_at)).toISOString(),
        checksum: String(row.checksum),
        status: String(row.status),
      }));
      const adoptionContext: ReconciliationContext = {
        ...reconciliationContext,
        releaseCandidateSha,
        requireBaselineCatalogMatch: true,
      };
      const result = validateModernLedgerReconciliation(appliedNames, typedModernRows, approvedAttestations, migrationManifest, adoptionContext);
      if (result.errors.length) throw new Error(`Modern ledger reconciliation failed: ${result.errors.join('; ')}`);
      if (result.adoptionRequired.length) {
        if (process.env.MIGRATION_SCHEMA_ADOPTION_APPROVED !== 'true') {
          throw new Error(`Schema adoption requires MIGRATION_SCHEMA_ADOPTION_APPROVED=true for: ${result.adoptionRequired.join(', ')}`);
        }
        const adoptionAttestations = approvedAttestations.filter(item => result.adoptionRequired.includes(item.migrationId));
        await client.query('BEGIN');
        try {
          await client.query(`SET LOCAL statement_timeout = '${statementTimeoutMs}ms'`);
          await client.query(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);
          await persistAttestations(client, adoptionAttestations);
          for (const migrationId of result.adoptionRequired) {
            const migration = migrationManifest.find(item => item.id === migrationId)!;
            const attestation = adoptionAttestations.find(item => item.migrationId === migrationId)!;
            await client.query(
              `INSERT INTO risk_schema_migrations(name,checksum,status,execution_metadata) VALUES($1,$2,'attested',$3::jsonb)`,
              [migration.id, migration.sha256, JSON.stringify({
                runner: 'laflo-manifest-v2',
                catalogFingerprintAfter: currentCatalogFingerprint,
                databaseIdentityId,
                adoptionApprovalReference: attestation.approvalReference,
                adoptedWithoutSqlExecution: true,
              })],
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
      appliedNames = result.effectiveHistory.map(entry => entry.migrationId);
    } else if (modernRows.length) {
      for (const row of modernRows) {
        const id = normalizeMigrationId(String(row.name));
        const migration = migrationManifest.find(item => item.id === id);
        if (!migration) throw new Error(`Ledger contains unknown migration ${row.name}; manual reconciliation is required.`);
        if (row.checksum !== migration.sha256) throw new Error(`Historical migration checksum mismatch: ${row.name}`);
        if (row.status !== 'applied') throw new Error(`Migration ${row.name} is recorded as ${row.status}; manual recovery is required.`);
        appliedNames.push(id);
      }
    }
    assertAppliedPrefix(appliedNames, migrationManifest);
    for (const migration of migrationManifest.slice(appliedNames.length)) {
      const sql = await readFile(path.join(migrationDirectory, migration.file), 'utf8');
      const body = sql.replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, '');
      await client.query('BEGIN');
      try {
        await client.query(`SET LOCAL statement_timeout = '${statementTimeoutMs}ms'`);
        await client.query(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);
        await client.query(body);
        if (migration.id === attestationMigrationId) {
          await client.query(
            `INSERT INTO risk_database_identity(identity_id,registration_reference,registered_for_release_sha) VALUES($1,$2,$3) ON CONFLICT (identity_id) DO NOTHING`,
            [databaseIdentityId, identityRegistrationReference, releaseCandidateSha],
          );
          await persistAttestations(client, approvedAttestations);
        }
        const catalogFingerprintAfter = await calculateCatalogFingerprint(client);
        await client.query(`INSERT INTO risk_schema_migrations(name,checksum,status,execution_metadata) VALUES($1,$2,'applied',$3::jsonb)`, [migration.id,migration.sha256,JSON.stringify({ runner: 'laflo-manifest-v2', catalogFingerprintAfter, databaseIdentityId })]);
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
  migrate().catch(error => { console.error('Risk migration failed; release operation aborted:', error); process.exitCode = 1; }).finally(() => pool.end());
}
