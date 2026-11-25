import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const knownRuntimeDdlOwners = [
  'repositories/aiGovernanceRepo.ts',
  'repositories/auditManagementRepo.ts',
  'repositories/bcmRepo.ts',
  'repositories/enterpriseOpsRepo.ts',
  'repositories/frameworkAssessmentScopeRepo.ts',
  'repositories/privacyRepo.ts',
  'repositories/regulatoryRepo.ts',
  'repositories/reportingCenterRepo.ts',
  'repositories/riskIntelligenceRepo.ts',
  'repositories/workspacesRepo.ts',
  'services/activityLedger/activityLedger.ts',
  'services/assetBootstrap.ts',
  'services/authBootstrap.ts',
] as const;

export const knownSeedDdlOwners = ['scripts/seed-core-grc.ts'] as const;
export const canonicalRunnerOwners = ['scripts/migrate-risk.ts'] as const;

const permanentDdlPattern = /\b(?:CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER|DROP\s+TRIGGER)\b/i;

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(absolute);
  }
  return files;
}

export async function findTypeScriptDdlOwners(sourceRoot: string): Promise<string[]> {
  const files = await walk(sourceRoot);
  const owners: string[] = [];
  for (const file of files) {
    const relative = path.relative(sourceRoot, file).replaceAll('\\', '/');
    if (relative.startsWith('tests/')) continue;
    const content = await readFile(file, 'utf8');
    if (permanentDdlPattern.test(content)) owners.push(relative);
  }
  return owners.sort();
}

export function unexpectedRuntimeDdlOwners(owners: readonly string[]): string[] {
  const allowed = new Set([...knownRuntimeDdlOwners, ...knownSeedDdlOwners, ...canonicalRunnerOwners]);
  return owners.filter(owner => !allowed.has(owner as never));
}

export function extractCreatedTables(content: string): string[] {
  const tables = new Set<string>();
  const pattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;
  for (const match of content.matchAll(pattern)) {
    if (match[1].toLowerCase() !== 'if') tables.add(match[1].toLowerCase());
  }
  return [...tables].sort();
}
