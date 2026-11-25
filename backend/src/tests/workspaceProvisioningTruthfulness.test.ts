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

test('workspace mutations reject synchronous duplicates and freeze reviewed values', () => {
  const management = read('../frontend/src/pages/WorkspaceManagement.tsx');
  assert.match(management, /const saveLock = useRef\(false\)/);
  assert.match(management, /if \(saveLock\.current\) return/);
  assert.match(management, /const createLock = useRef\(false\)/);
  assert.match(management, /if \(createLock\.current\) return/);
  assert.match(management, /const actionLock = useRef\(false\)/);
  assert.match(management, /if \(actionLock\.current\) return/);
  assert.equal((management.match(/aria-busy=\{(?:saving|creating)\}/g) || []).length, 2);
  assert.equal((management.match(/<fieldset disabled=\{(?:saving|creating)\}/g) || []).length, 2);
  assert.match(management, /const requestArchiveClose = \(\) => \{ if \(!busyId && !actionLock\.current\) setArchiveTarget\(null\); \}/);
  assert.match(management, /onClose=\{requestArchiveClose\}/);
  assert.match(management, /onClick=\{requestArchiveClose\}>Cancel/);
});

test('initial workspace provisioning cannot duplicate after creation starts or partially succeeds', () => {
  const wizard = read('../frontend/src/pages/WorkspaceWizard.tsx');
  assert.match(wizard, /const provisionLock = useRef\(false\)/);
  assert.match(wizard, /if \(createdWorkspaceId \|\| provisionLock\.current\) return/);
  assert.match(wizard, /const payload = \{ displayName: displayName\.trim\(\), industry, region, seedProfile \}/);
  assert.match(wizard, /provisionLock\.current = true/);
  assert.match(wizard, /workspaceCreated = true/);
  assert.match(wizard, /finally \{ if \(!workspaceCreated\) provisionLock\.current = false/);
  assert.match(wizard, /onSubmit=\{handleSubmit\} aria-busy=\{isSubmitting\}/);
  assert.equal((wizard.match(/disabled=\{isSubmitting\}/g) || []).length, 4);
});
