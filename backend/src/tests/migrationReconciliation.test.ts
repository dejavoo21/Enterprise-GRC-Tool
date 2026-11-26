import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { MigrationDefinition } from '../scripts/migrationManifest.js';
import { migrationManifest as repositoryManifest } from '../scripts/migrationManifest.js';
import {
  classifyRiskLibraryIndex,
  normalizeAttestationTimestamp,
  fingerprintMigrationPlan,
  isApprovedManifestPrefix,
  validateCatalogCheckpoint,
  validateDatabaseIdentity,
  validateForeignKeyTypeSignature,
  validateLegacyLedgerReconciliation,
  validateModernLedgerReconciliation,
  validateReconciliationRecoveryState,
  type MigrationCompatibilityAttestation,
  type ReconciliationContext,
} from '../scripts/migrationReconciliation.js';

test('attestation timestamp normalization preserves driver Date milliseconds', () => {
  const timestamp = new Date('2026-11-23T13:55:39.170Z');
  assert.equal(normalizeAttestationTimestamp(timestamp), '2026-11-23T13:55:39.170Z');
  assert.equal(normalizeAttestationTimestamp(timestamp.toISOString()), '2026-11-23T13:55:39.170Z');
});

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

function adoptionAttestation(
  migrationId: string,
  requiredRepairMigrationId: string,
  overrides: Partial<MigrationCompatibilityAttestation> = {},
): MigrationCompatibilityAttestation {
  return attestation(migrationId, {
    compatibilityAssessment: 'compatible_with_forward_repair',
    requiredRepairMigrationId,
    observedSchemaEvidence: {
      inspectionType: 'read_only_catalog',
      catalogFingerprint: context.currentCatalogFingerprint,
      forwardRepairMigrationId: requiredRepairMigrationId,
    },
    ...overrides,
  });
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
  assert.match(source, /MIGRATION_SCHEMA_ADOPTION_APPROVED/);
  assert.match(source, /MIGRATION_LEGACY_BASELINE_EVIDENCE_VERSION/);
  assert.match(source, /MIGRATION_LEGACY_PLAN_FINGERPRINT/);
  assert.match(source, /MIGRATION_DATABASE_IDENTITY/);
  assert.match(source, /MIGRATION_STATEMENT_TIMEOUT_MS/);
  assert.match(source, /MIGRATION_LOCK_TIMEOUT_MS/);
  assert.match(source, /SET LOCAL statement_timeout/);
  assert.match(source, /SET LOCAL lock_timeout/);
  assert.match(source, /catalogFingerprintAfter/);
  assert.match(source, /adoptedWithoutSqlExecution/);
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
  assert.equal(validateDatabaseIdentity(productionIdentity, [], false), null);
  assert.equal(validateDatabaseIdentity(productionIdentity, [productionIdentity], true), null);
  assert.match(validateDatabaseIdentity(productionIdentity, [], true) ?? '', /no active identity/i);
  assert.match(validateDatabaseIdentity(cloneIdentity, [productionIdentity], true) ?? '', /does not match/i);
  assert.match(validateDatabaseIdentity(productionIdentity, [productionIdentity, cloneIdentity], true) ?? '', /ambiguous/i);
  assert.match(validateDatabaseIdentity('not-an-approved-identity', [], false) ?? '', /approved UUID/i);
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

test('an approved historical migration plan remains valid only as an exact manifest prefix', () => {
  const historical = manifest.slice(0, 2);
  const historicalFingerprint = fingerprintMigrationPlan(historical);
  const extended = [...manifest, { id: 'm4', file: 'm4.sql', sha256: 'checksum-4', dependsOn: ['m3-repair'], purpose: 'extension', destructive: false }];
  assert.equal(isApprovedManifestPrefix(extended, historicalFingerprint), true);
  const changedHistory = [{ ...manifest[0], sha256: 'changed' }, ...manifest.slice(1)];
  assert.equal(isApprovedManifestPrefix(changedHistory, historicalFingerprint), false);
  const ledger = [{ name: 'm1.sql', appliedAt: '2026-01-01T00:00:00.000Z' }];
  const extendedContext = { ...context, migrationPlanFingerprint: fingerprintMigrationPlan(extended) };
  assert.deepEqual(validateLegacyLedgerReconciliation(ledger, [attestation('m1', { migrationPlanFingerprint: historicalFingerprint })], extended, extendedContext).errors, []);
});

test('legacy reconciliation and current schema adoption use independently approved evidence bindings', () => {
  const historicalContext: ReconciliationContext = {
    ...context,
    baselineEvidenceVersion: 'production-readonly-preflight-2026-11-23',
    migrationPlanFingerprint: '1'.repeat(64),
    releaseCandidateSha: '3'.repeat(40),
    requireBaselineCatalogMatch: false,
  };
  const legacyApproval = attestation('m1', {
    baselineEvidenceVersion: historicalContext.baselineEvidenceVersion,
    migrationPlanFingerprint: historicalContext.migrationPlanFingerprint,
    releaseCandidateSha: historicalContext.releaseCandidateSha,
  });
  const legacy = validateLegacyLedgerReconciliation(
    [{ name: 'm1.sql', appliedAt: '2026-11-23T13:00:00.000Z' }],
    [legacyApproval],
    manifest,
    historicalContext,
  );
  assert.deepEqual(legacy.errors, []);

  const adoptionContext: ReconciliationContext = {
    ...historicalContext,
    baselineEvidenceVersion: 'production-readonly-preflight-2026-11-26',
    migrationPlanFingerprint: fingerprintMigrationPlan(manifest),
    releaseCandidateSha: '4'.repeat(40),
    requireBaselineCatalogMatch: true,
  };
  const adoption = adoptionAttestation('m2', 'm3-repair', {
    baselineEvidenceVersion: adoptionContext.baselineEvidenceVersion,
    migrationPlanFingerprint: adoptionContext.migrationPlanFingerprint,
    releaseCandidateSha: adoptionContext.releaseCandidateSha,
  });
  const modern = validateModernLedgerReconciliation(
    ['m1'],
    [{ name: 'm3-repair', appliedAt: '2026-11-23T14:00:00.000Z', checksum: 'checksum-3', status: 'applied' }],
    [adoption],
    manifest,
    adoptionContext,
  );
  assert.deepEqual(modern.errors, []);
  assert.deepEqual(modern.adoptionRequired, ['m2']);
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

test('a post-legacy schema gap requires explicit adoption backed by a recorded forward repair', () => {
  const appliedPrefix = ['m1'];
  const modernRows = [{
    name: 'm3-repair',
    appliedAt: '2026-01-03T00:00:00.000Z',
    checksum: 'checksum-3',
    status: 'applied',
  }];
  const missingApproval = validateModernLedgerReconciliation(appliedPrefix, modernRows, [], manifest, context);
  assert.match(missingApproval.errors.join('; '), /unapproved gap at m2/i);

  const approved = validateModernLedgerReconciliation(appliedPrefix, modernRows, [
    adoptionAttestation('m2', 'm3-repair'),
  ], manifest, context);
  assert.deepEqual(approved.errors, []);
  assert.deepEqual(approved.adoptionRequired, ['m2']);
  assert.deepEqual(approved.effectiveHistory.map(item => item.migrationId), ['m1', 'm2', 'm3-repair']);
  assert.equal(approved.effectiveHistory[1]?.source, 'compatibility_attestation');
});

test('modern schema adoption fails closed on weak evidence or an unrecorded repair', () => {
  const appliedPrefix = ['m1'];
  const modernRows = [{
    name: 'm3-repair',
    appliedAt: '2026-01-03T00:00:00.000Z',
    checksum: 'checksum-3',
    status: 'applied',
  }];
  assert.match(validateModernLedgerReconciliation(appliedPrefix, modernRows, [
    attestation('m2'),
  ], manifest, context).errors.join('; '), /forward-repair assessment/i);
  assert.match(validateModernLedgerReconciliation(appliedPrefix, modernRows, [
    attestation('m2', {
      compatibilityAssessment: 'compatible_with_forward_repair',
      requiredRepairMigrationId: 'not-recorded',
    }),
  ], manifest, context).errors.join('; '), /repair.*missing or ordered/i);
});

test('an attested modern ledger row remains bound to its exact approved attestation', () => {
  const rows = [
    { name: 'm2', appliedAt: '2026-01-02T00:00:00.000Z', checksum: 'checksum-2', status: 'attested' },
    { name: 'm3-repair', appliedAt: '2026-01-03T00:00:00.000Z', checksum: 'checksum-3', status: 'applied' },
  ];
  assert.match(validateModernLedgerReconciliation(['m1'], rows, [], manifest, context).errors.join('; '), /requires its approved compatibility attestation/i);
  const approved = validateModernLedgerReconciliation(['m1'], rows, [adoptionAttestation('m2', 'm3-repair')], manifest, context);
  assert.deepEqual(approved.errors, []);
  assert.deepEqual(approved.adoptionRequired, []);
});

test('modern schema adoption is bound to the current catalog and complete migration plan', () => {
  const rows = [{ name: 'm3-repair', appliedAt: '2026-01-03T00:00:00.000Z', checksum: 'checksum-3', status: 'applied' }];
  const adoption = {
    compatibilityAssessment: 'compatible_with_forward_repair' as const,
    requiredRepairMigrationId: 'm3-repair',
    observedSchemaEvidence: {
      inspectionType: 'read_only_catalog',
      catalogFingerprint: context.currentCatalogFingerprint,
      forwardRepairMigrationId: 'm3-repair',
    },
  };
  assert.match(validateModernLedgerReconciliation(['m1'], rows, [
    attestation('m2', { ...adoption, baselineCatalogFingerprint: 'stale-catalog' }),
  ], manifest, context).errors.join('; '), /baseline catalog evidence mismatch/i);
  assert.match(validateModernLedgerReconciliation(['m1'], rows, [
    attestation('m2', { ...adoption, migrationPlanFingerprint: fingerprintMigrationPlan(manifest.slice(0, 2)) }),
  ], manifest, context).errors.join('; '), /migration plan mismatch/i);
});

test('observed production ledger shape requires only the reviewed Audit schema adoption', () => {
  const auditSchema = repositoryManifest.find(item => item.id === '20261125-audit-management-schema')!;
  const auditClosure = repositoryManifest.find(item => item.id === '20261122-audit-verified-closure')!;
  const evidenceIntegrity = repositoryManifest.find(item => item.id === '20261123-evidence-review-integrity')!;
  const auditIndex = repositoryManifest.indexOf(auditSchema);
  const modernRows = repositoryManifest.slice(14, repositoryManifest.indexOf(evidenceIntegrity) + 1)
    .filter(item => item.id !== auditSchema.id)
    .map((item, index) => ({
      name: item.id,
      appliedAt: new Date(Date.UTC(2026, 10, 23, 14, index)).toISOString(),
      checksum: item.sha256,
      status: 'applied',
    }));
  const productionContext: ReconciliationContext = {
    databaseIdentityId: 'ce4eedf5-a1e5-4004-8664-a5b15f8e0e96',
    currentCatalogFingerprint: 'current-production-catalog',
    baselineEvidenceVersion: 'production-readonly-preflight-2026-11-26',
    migrationPlanFingerprint: fingerprintMigrationPlan(repositoryManifest),
    releaseCandidateSha: 'b'.repeat(40),
    reconciliationVersion: 'production-reconciliation-2026-11-23-v1',
    requireBaselineCatalogMatch: true,
  };
  const adoption: MigrationCompatibilityAttestation = {
    migrationId: auditSchema.id,
    expectedRepositoryChecksum: auditSchema.sha256,
    databaseIdentityId: productionContext.databaseIdentityId,
    baselineCatalogFingerprint: productionContext.currentCatalogFingerprint,
    baselineEvidenceVersion: productionContext.baselineEvidenceVersion,
    migrationPlanFingerprint: productionContext.migrationPlanFingerprint,
    observedSchemaEvidence: {
      inspectionType: 'read_only_catalog',
      catalogFingerprint: productionContext.currentCatalogFingerprint,
      forwardRepairMigrationId: auditClosure.id,
      auditTablesPresent: 11,
      closureColumnsPresent: 13,
    },
    compatibilityAssessment: 'compatible_with_forward_repair',
    authorisingDecision: 'approved',
    approvalReference: 'CHANGE-PENDING',
    attestedAt: '2026-11-26T15:00:00.000Z',
    reconciliationVersion: productionContext.reconciliationVersion,
    releaseCandidateSha: productionContext.releaseCandidateSha,
    requiredRepairMigrationId: auditClosure.id,
  };
  const result = validateModernLedgerReconciliation(
    repositoryManifest.slice(0, 14).map(item => item.id),
    modernRows,
    [adoption],
    repositoryManifest,
    productionContext,
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.adoptionRequired, [auditSchema.id]);
  assert.equal(result.effectiveHistory[auditIndex]?.migrationId, auditSchema.id);
  assert.equal(result.effectiveHistory[auditIndex]?.source, 'compatibility_attestation');
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
