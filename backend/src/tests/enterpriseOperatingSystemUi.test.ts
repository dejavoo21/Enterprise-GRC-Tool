import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('enterprise entity 360 uses the shared accessible detail dialog', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/EnterpriseOperatingSystem.tsx'), 'utf8');
  assert.match(page, /<Modal accessibleDialog isOpen onClose=\{onClose\} title=\{view\.entity\.name\}/);
  assert.match(page, /<PageSectionCard title="Overview">/);
  assert.match(page, /<PageSectionCard title="Related Entities">/);
  assert.match(page, /<PageSectionCard title="Relationship Map">/);
  assert.match(page, /<PageSectionCard title="Activity">/);
  assert.doesNotMatch(page, /position: 'fixed'/);
});

test('enterprise operating system rejects stale workspace, search, and detail responses', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/EnterpriseOperatingSystem.tsx'), 'utf8');
  assert.match(page, /const activeWorkspaceId = workspaceId \|\| ''/);
  assert.match(page, /const \[stateWorkspaceId, setStateWorkspaceId\] = useState\(''\)/);
  assert.match(page, /const stateRequestSequence = useRef\(0\)/);
  assert.match(page, /const searchRequestSequence = useRef\(0\)/);
  assert.match(page, /const detailRequestSequence = useRef\(0\)/);
  assert.match(page, /sequence !== stateRequestSequence\.current \|\| requestedWorkspaceId !== currentWorkspaceIdRef\.current/);
  assert.match(page, /setState\(null\);[\s\S]*setSearchResults\(\[\]\);[\s\S]*setSearchQuery\(''\);[\s\S]*setSelectedView\(null\)/);
  assert.match(page, /\[activeWorkspaceId, loadState\]/);
  assert.match(page, /const query = searchQuery\.trim\(\)/);
  assert.match(page, /sequence !== searchRequestSequence\.current \|\| requestedWorkspaceId !== currentWorkspaceIdRef\.current/);
  assert.match(page, /sequence !== detailRequestSequence\.current \|\| requestedWorkspaceId !== currentWorkspaceIdRef\.current/);
  assert.match(page, /loading \|\| stateWorkspaceId !== activeWorkspaceId/);
});
