import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('workspace provisioning defaults to no example records', () => {
  const routes = read('src/routes/workspaces.ts');
  const service = read('src/services/workspaceSeedingService.ts');

  assert.match(routes, /const profile = seedProfile \?\? 'empty'/);
  assert.match(routes, /profile === 'empty'[\s\S]*Workspace created without example records/);
  assert.match(service, /seedProfile: WorkspaceSeedProfile = 'empty'/);
  assert.match(service, /case 'empty':\s*return;/);
  assert.doesNotMatch(service, /default:\s*await seedMinimalData/);
});

test('starter content requires a valid explicit profile selection', () => {
  const routes = read('src/routes/workspaces.ts');
  const management = read('../frontend/src/pages/WorkspaceManagement.tsx');
  const wizard = read('../frontend/src/pages/WorkspaceWizard.tsx');

  assert.match(routes, /\['empty', 'minimal', 'standard', 'full'\]\.includes\(profile\)/);
  assert.match(routes, /seedProfile must be empty, minimal, standard, or full/);
  assert.match(management, /seedProfile: 'empty'/);
  assert.match(wizard, /useState<WorkspaceSeedProfile>\('empty'\)/);
});
