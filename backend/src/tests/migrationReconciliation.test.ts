import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { MigrationDefinition } from '../scripts/migrationManifest.js';
import {
  classifyRiskLibraryIndex,
  fingerprintMigrationPlan,
  validateCatalogCheckpoint,
  validateDatabaseIdentity,
  validateForeignKeyTypeSignature,
  validateLegacyLedgerReconciliation,
  validateReconciliationRecoveryState,
  type MigrationCompatibilityAttestation,
  type ReconciliationContext,
} from '../scripts/migrationReconciliation.js';

const context: ReconciliationContext = {
  databaseIdentityId: '11111111-1111-4111-8111-111111111111',
  currentCatalogFingerprint: 'catalog-fingerprint',
  baselineEvidenceVersion: 'inspection-2026-11-22',
  migrationPlanFingerprint: '',
  releaseCandidateSha: 'a'.repeat(40),
  reconciliationVersion: 'reconciliation-v1',
  requireBaselineCatalogMatch: true,
};

const manifest: readonly MigrationDefinition[] = [
  { id: 'm1', file: 'm1.sql', sha256: 'checksum-1', dependsOn: [], purpose: 'first', destructive: false },
  { id: 'm2', file: 'm2.sql', sha256: 'checksum-2', dependsOn: ['m1'], purpose: 'second', destructive: false },
  { id: 'm3-repair', file: 'm3.sql', sha256: 'checksum-3', dependsOn: ['m2'], purpose: 'repair', destructive: false },
];
context.migrationPlanFingerprint = fingerprintMigrationPlan(manifest);

function attestation(migrationId: string, overrides: Partial<MigrationCompatibilityAttestation> = {}): MigrationCompatibilityAttestation {
  const migration = manifest.find(item => item.id === migrationId);
  if (!migration) throw new Error(`Unknown test migration ${migrationId}`);
  return {
    migrationId,
    expectedRepositoryChecksum: migration.sha256,
    databaseIdentityId: context.databaseIdentityId,
    baselineCatalogFingerprint: context.currentCatalogFingerprint,
    baselineEvidenceVersion: context.baselineEvidenceVersion,
    migrationPlanFingerprint: context.migrationPlanFingerprint,
    observedSchemaEvidence: { tables: ['example'] },
    compatibilityAssessment: 'compatible',
    authorisingDecision: 'approved',
    approvalReference: 'CHANGE-123',
    attestedAt: '2026-11-22T10:00:00.000Z',
    reconciliationVersion: context.reconciliationVersion,
    releaseCandidateSha: context.releaseCandidateSha,
    ...overrides,
  };
}

test('policy acknowledgement foreign key uses the users UUID type', async () => {
  const sql = await readFile(path.resolve(__dirname, '../../sql/migrations/20261122-policy-workflow-integration.sql'), 'utf8');
  assert.match(sql, /user_id\s+UUID\s+NOT NULL REFERENCES users\(id\)/i);
  assert.doesNotMatch(sql, /user_id\s+TEXT\s+NOT NULL REFERENCES users\(id\)/i);
  assert.equal(validateForeignKeyTypeSignature('UUID', 'uuid'), null);
  assert.match(validateForeignKeyTypeSignature('TEXT', 'UUID') ?? '', /mismatch/i);
});

test('legacy migration history requires exact approved attestations', () => {
  const ledger = [{ name: 'm1.sql', appliedAt: '2026-01-01T00:00:00.000Z' }];
  assert.match(validateLegacyLedgerReconciliation(ledger, [], manifest, context).errors.join('; '), /required for m1/);
  assert.match(
    validateLegacyLedgerReconciliation(ledger, [attestation('m1', { expectedRepositoryChecksum: 'wrong' })], manifest, context).errors.join('; '),
    /checksum mismatch/i,
  );
  assert.match(
    validateLegacyLedgerReconciliation(ledger, [attestation('m1', { authorisingDecision: 'pending' as 'approved' })], manifest, context).errors.join('; '),
    /not explicitly approved/i,
  );
  assert.match(
    validateLegacyLedgerReconciliation(ledger, [attestation('m1', { baselineCatalogFingerprint: 'different-catalog' })], manifest, context).errors.join('; '),
    /baseline catalog evidence mismatch/i,
  );
  const accepted = validateLegacyLedgerReconciliation(ledger, [attestation('m1')], manifest, context);
  assert.deepEqual(accepted.errors, []);
  assert.deepEqual(accepted.effectiveHistory, [{ migrationId: 'm1', source: 'legacy_ledger', historicalAppliedAt: ledger[0].appliedAt }]);
});

test('controlled runner retains explicit execution and reconciliation gates', async () => {
  const source = await readFile(path.resolve(process.cwd(), 'src/scripts/migrate-risk.ts'), 'utf8');
  assert.match(source, /MIGRATION_RUN/);
  assert.match(source, /MIGRATION_EXPECTED_DATABASE/);
  assert.match(source, /MIGRATION_PRODUCTION_APPROVED/);
  assert.match(source, /MIGRATION_RECONCILIATION_APPROVED/);
  assert.match(source, /MIGRATION_RECONCILIATION_ATTESTATION_FILE/);
  assert.match(source, /MIGRATION_DATABASE_IDENTITY/);
  assert.match(source, /catalogFingerprintAfter/);
  const migrationLoop = source.indexOf('for (const migration of migrationManifest.slice');
  const transactionStart = source.indexOf("await client.query('BEGIN')", migrationLoop);
  const attestationWrite = source.indexOf('await persistAttestations(client, approvedAttestations)', transactionStart);
  const ledgerWrite = source.indexOf('INSERT INTO risk_schema_migrations', attestationWrite);
  const transactionCommit = source.indexOf("await client.query('COMMIT')", ledgerWrite);
  assert.ok(transactionStart < attestationWrite && attestationWrite < ledgerWrite && ledgerWrite < transactionCommit);
});

test('baseline evidence remains immutable while post-migration retries use checkpoints', () => {
  const ledger = [{ name: 'm1.sql', appliedAt: '2026-01-01T00:00:00.000Z' }];
  const approved = attestation('m1');
  const postMigrationContext = { ...context, currentCatalogFingerprint: 'post-migration-catalog', requireBaselineCatalogMatch: false };
  assert.deepEqual(validateLegacyLedgerReconciliation(ledger, [approved], manifest, postMigrationContext).errors, []);
  assert.equal(validateCatalogCheckpoint('post-migration-catalog', 'post-migration-catalog'), null);
  assert.match(validateCatalogCheckpoint('unexpected-drift', 'post-migration-catalog') ?? '', /differs/i);
  assert.match(validateCatalogCheckpoint('catalog', undefined) ?? '', /no verified/i);
});

test('database identity distinguishes same-named targets and fails closed for clones', () => {
  const productionIdentity = context.databaseIdentityId;
  const cloneIdentity = '22222222-2222-4222-8222-222222222222';
  assert.equal(validateDatabaseIdentity(productionIdentity, []), null);
  assert.equal(validateDatabaseIdentity(productionIdentity, [productionIdentity]), null);
  assert.match(validateDatabaseIdentity(cloneIdentity, [productionIdentity]) ?? '', /does not match/i);
  assert.match(validateDatabaseIdentity(productionIdentity, [productionIdentity, cloneIdentity]) ?? '', /ambiguous/i);
  assert.match(validateDatabaseIdentity('not-an-approved-identity', []) ?? '', /approved UUID/i);
});

test('interrupted reconciliation states are either retry-safe or rejected precisely', () => {
  const before = { identityTableExists: false, attestationTableExists: false, reconciliationLedgerApplied: false };
  const committed = { identityTableExists: true, attestationTableExists: true, reconciliationLedgerApplied: true };
  assert.equal(validateReconciliationRecoveryState(before), null);
  assert.equal(validateReconciliationRecoveryState(committed), null);
  assert.match(validateReconciliationRecoveryState({ ...before, identityTableExists: true }) ?? '', /partial/i);
  assert.match(validateReconciliationRecoveryState({ ...committed, reconciliationLedgerApplied: false }) ?? '', /inconsistent/i);
  assert.match(validateReconciliationRecoveryState({ ...before, reconciliationLedgerApplied: true }) ?? '', /inconsistent/i);
});

test('attestation rejects wrong target, candidate, plan, evidence version and missing approval', () => {
  const ledger = [{ name: 'm1.sql', appliedAt: '2026-01-01T00:00:00.000Z' }];
  const cases: Array<[Partial<MigrationCompatibilityAttestation>, RegExp]> = [
    [{ databaseIdentityId: '22222222-2222-4222-8222-222222222222' }, /database identity mismatch/i],
    [{ releaseCandidateSha: 'b'.repeat(40) }, /release candidate mismatch/i],
    [{ migrationPlanFingerprint: 'wrong-plan' }, /migration plan mismatch/i],
    [{ baselineEvidenceVersion: 'wrong-evidence' }, /baseline evidence version mismatch/i],
    [{ approvalReference: '' }, /not explicitly approved/i],
  ];
  for (const [overrides, expected] of cases) {
    assert.match(validateLegacyLedgerReconciliation(ledger, [attestation('m1', overrides)], manifest, context).errors.join('; '), expected);
  }
  assert.match(validateLegacyLedgerReconciliation(ledger, [attestation('m1'), attestation('m1')], manifest, context).errors.join('; '), /duplicate attestation/i);
});

test('a missing legacy row requires an explicitly ordered forward repair', () => {
  const ledger = [
    { name: 'm1.sql', appliedAt: '2026-01-01T00:00:00.000Z' },
    { name: 'm3-repair.sql', appliedAt: '2026-01-03T00:00:00.000Z' },
  ];
  const incomplete = [attestation('m1'), attestation('m2'), attestation('m3-repair')];
  assert.match(validateLegacyLedgerReconciliation(ledger, incomplete, manifest, context).errors.join('; '), /forward-repair assessment/i);
  const approved = [
    attestation('m1'),
    attestation('m2', { compatibilityAssessment: 'compatible_with_forward_repair', requiredRepairMigrationId: 'm3-repair' }),
    attestation('m3-repair'),
  ];
  const result = validateLegacyLedgerReconciliation(ledger, approved, manifest, context);
  assert.deepEqual(result.errors, []);
  assert.equal(result.effectiveHistory[1]?.source, 'compatibility_attestation');
  assert.equal(result.effectiveHistory[1]?.historicalAppliedAt, null);
});

test('Risk Library index classification fails closed on an incompatible signature', () => {
  assert.equal(classifyRiskLibraryIndex({ exists: false }), 'absent');
  assert.equal(classifyRiskLibraryIndex({
    exists: true,
    table: 'risks',
    columns: ['workspace_id', 'library_risk_id'],
    predicate: '(library_risk_id IS NOT NULL)',
    valid: true,
  }), 'compatible');
  assert.equal(classifyRiskLibraryIndex({
    exists: true,
    table: 'risks',
    columns: ['library_risk_id'],
    predicate: '(library_risk_id IS NOT NULL)',
    valid: true,
  }), 'incompatible');
});
