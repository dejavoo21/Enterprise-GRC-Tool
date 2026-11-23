import { createHash } from 'node:crypto';
import type { MigrationDefinition } from './migrationManifest.js';

export type CompatibilityAssessment = 'compatible' | 'compatible_with_forward_repair';

export interface LegacyLedgerRow {
  name: string;
  appliedAt: string;
}

export interface MigrationCompatibilityAttestation {
  migrationId: string;
  expectedRepositoryChecksum: string;
  databaseIdentityId: string;
  baselineCatalogFingerprint: string;
  baselineEvidenceVersion: string;
  migrationPlanFingerprint: string;
  observedSchemaEvidence: Record<string, unknown>;
  compatibilityAssessment: CompatibilityAssessment;
  authorisingDecision: 'approved';
  approvalReference: string;
  attestedAt: string;
  reconciliationVersion: string;
  releaseCandidateSha: string;
  requiredRepairMigrationId?: string;
}

export interface ReconciliationContext {
  databaseIdentityId: string;
  currentCatalogFingerprint: string;
  baselineEvidenceVersion: string;
  migrationPlanFingerprint: string;
  releaseCandidateSha: string;
  reconciliationVersion: string;
  requireBaselineCatalogMatch: boolean;
}

export interface EffectiveMigrationHistoryEntry {
  migrationId: string;
  source: 'legacy_ledger' | 'compatibility_attestation';
  historicalAppliedAt: string | null;
}

export interface ReconciliationValidationResult {
  errors: string[];
  effectiveHistory: EffectiveMigrationHistoryEntry[];
}

export interface RiskLibraryIndexSignature {
  exists: boolean;
  table?: string;
  columns?: string[];
  predicate?: string | null;
  valid?: boolean;
}

export type RiskLibraryIndexState = 'absent' | 'compatible' | 'incompatible';

export const normalizeMigrationId = (name: string): string => name.replace(/\.sql$/i, '');

export function fingerprintMigrationPlan(manifest: readonly MigrationDefinition[]): string {
  return createHash('sha256').update(JSON.stringify(manifest.map(item => ({
    id: item.id,
    sha256: item.sha256,
    dependsOn: item.dependsOn,
    destructive: item.destructive,
  })))).digest('hex');
}

export function validateDatabaseIdentity(expected: string, registered: readonly string[]): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expected)) {
    return 'Database identity must be an explicitly approved UUID';
  }
  if (registered.length > 1) return 'Database identity state is ambiguous: multiple active identities are registered';
  if (registered.length === 1 && registered[0].toLowerCase() !== expected.toLowerCase()) {
    return 'Database identity does not match the registered target';
  }
  return null;
}

export function validateCatalogCheckpoint(currentFingerprint: string, expectedFingerprint?: string): string | null {
  if (!expectedFingerprint) return 'No verified catalog checkpoint exists for the current migration state';
  return currentFingerprint === expectedFingerprint ? null : 'Current catalog differs from the last committed migration checkpoint';
}

export interface ReconciliationRecoveryState {
  identityTableExists: boolean;
  attestationTableExists: boolean;
  reconciliationLedgerApplied: boolean;
}

export function validateReconciliationRecoveryState(state: ReconciliationRecoveryState): string | null {
  if (state.identityTableExists !== state.attestationTableExists) {
    return 'Reconciliation schema is partial; manual recovery is required';
  }
  if (state.reconciliationLedgerApplied !== state.attestationTableExists) {
    return 'Reconciliation schema and ledger checkpoint are inconsistent; manual recovery is required';
  }
  return null;
}

export function fingerprintCatalogEvidence(parts: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function validateForeignKeyTypeSignature(referencingType: string, referencedType: string): string | null {
  const normalize = (value: string) => value.trim().toLowerCase();
  return normalize(referencingType) === normalize(referencedType)
    ? null
    : `Foreign-key type mismatch: ${referencingType} cannot reference ${referencedType}`;
}

export function classifyRiskLibraryIndex(signature: RiskLibraryIndexSignature): RiskLibraryIndexState {
  if (!signature.exists) return 'absent';
  const predicate = (signature.predicate || '').replace(/[()\s]/g, '').toLowerCase();
  const compatible = signature.table?.toLowerCase() === 'risks'
    && signature.columns?.map(column => column.toLowerCase()).join(',') === 'workspace_id,library_risk_id'
    && predicate === 'library_risk_idisnotnull'
    && signature.valid === true;
  return compatible ? 'compatible' : 'incompatible';
}

export function validateLegacyLedgerReconciliation(
  ledgerRows: readonly LegacyLedgerRow[],
  attestations: readonly MigrationCompatibilityAttestation[],
  manifest: readonly MigrationDefinition[],
  context: ReconciliationContext,
): ReconciliationValidationResult {
  const errors: string[] = [];
  const manifestById = new Map(manifest.map((migration, index) => [migration.id, { migration, index }]));
  const ledgerById = new Map<string, LegacyLedgerRow>();
  const attestationById = new Map<string, MigrationCompatibilityAttestation>();

  for (const row of ledgerRows) {
    const id = normalizeMigrationId(row.name);
    if (!manifestById.has(id)) errors.push(`Legacy ledger contains unrecognised migration ${row.name}`);
    if (ledgerById.has(id)) errors.push(`Legacy ledger contains duplicate migration ${row.name}`);
    ledgerById.set(id, row);
  }
  for (const attestation of attestations) {
    if (attestationById.has(attestation.migrationId)) errors.push(`Duplicate attestation for ${attestation.migrationId}`);
    attestationById.set(attestation.migrationId, attestation);
  }

  const highestLedgerIndex = Math.max(-1, ...[...ledgerById.keys()].map(id => manifestById.get(id)?.index ?? -1));
  const effectiveHistory: EffectiveMigrationHistoryEntry[] = [];
  for (let index = 0; index <= highestLedgerIndex; index += 1) {
    const migration = manifest[index];
    const row = ledgerById.get(migration.id);
    const attestation = attestationById.get(migration.id);
    if (!attestation) {
      errors.push(`Approved attestation is required for ${migration.id}`);
      continue;
    }
    if (attestation.expectedRepositoryChecksum !== migration.sha256) errors.push(`Attestation checksum mismatch for ${migration.id}`);
    if (attestation.databaseIdentityId.toLowerCase() !== context.databaseIdentityId.toLowerCase()) errors.push(`Database identity mismatch for ${migration.id}`);
    if (context.requireBaselineCatalogMatch && attestation.baselineCatalogFingerprint !== context.currentCatalogFingerprint) errors.push(`Baseline catalog evidence mismatch for ${migration.id}`);
    if (attestation.baselineEvidenceVersion !== context.baselineEvidenceVersion) errors.push(`Baseline evidence version mismatch for ${migration.id}`);
    if (attestation.migrationPlanFingerprint !== context.migrationPlanFingerprint) errors.push(`Migration plan mismatch for ${migration.id}`);
    if (attestation.releaseCandidateSha !== context.releaseCandidateSha) errors.push(`Release candidate mismatch for ${migration.id}`);
    if (attestation.reconciliationVersion !== context.reconciliationVersion) errors.push(`Reconciliation version mismatch for ${migration.id}`);
    if (attestation.authorisingDecision !== 'approved' || !attestation.approvalReference.trim()) errors.push(`Attestation for ${migration.id} is not explicitly approved`);
    if (!Number.isFinite(Date.parse(attestation.attestedAt))) errors.push(`Attestation timestamp is invalid for ${migration.id}`);
    if (!attestation.observedSchemaEvidence || Object.keys(attestation.observedSchemaEvidence).length === 0) errors.push(`Schema evidence is missing for ${migration.id}`);
    if (!row && attestation.compatibilityAssessment !== 'compatible_with_forward_repair') errors.push(`Missing legacy migration ${migration.id} requires an explicit forward-repair assessment`);
    if (attestation.compatibilityAssessment === 'compatible_with_forward_repair') {
      const repair = attestation.requiredRepairMigrationId && manifestById.get(attestation.requiredRepairMigrationId);
      if (!repair || repair.index <= index) errors.push(`Forward repair for ${migration.id} is missing or ordered incorrectly`);
    }
    for (const dependency of migration.dependsOn) {
      if (!manifest.slice(0, index).some(candidate => candidate.id === dependency)) errors.push(`Dependency conflict for ${migration.id}: ${dependency}`);
    }
    effectiveHistory.push({
      migrationId: migration.id,
      source: row ? 'legacy_ledger' : 'compatibility_attestation',
      historicalAppliedAt: row?.appliedAt ?? null,
    });
  }

  for (const id of attestationById.keys()) {
    const definition = manifestById.get(id);
    if (!definition) errors.push(`Attestation references unrecognised migration ${id}`);
    else if (definition.index > highestLedgerIndex) errors.push(`Attestation for pending migration ${id} is not allowed`);
  }

  return { errors, effectiveHistory };
}
