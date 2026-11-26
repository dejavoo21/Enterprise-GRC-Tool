import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('governance document details use an accessible non-modal drawer', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceDocuments.tsx'), 'utf8');
  assert.match(page, /ref=\{drawerRef\}[\s\S]*role="dialog"[\s\S]*aria-modal="false"/);
  assert.match(page, /aria-label=\{`\$\{document\.title\} details`\}/);
  assert.match(page, /width: 'min\(520px, 100vw\)'/);
  assert.match(page, /event\.key === 'Escape' && !showLinkControlModal && !showLinkCourseModal/);
  assert.match(page, /aria-label="Close document details"/);
  assert.match(page, /previous instanceof HTMLElement && previous\.isConnected/);
});

test('governance document filters ignore stale responses', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/GovernanceDocuments.tsx'), 'utf8');
  assert.match(page, /const documentRequestSequence = useRef\(0\)/);
  assert.match(page, /const sequence = \+\+documentRequestSequence\.current/);
  assert.match(page, /if \(sequence !== documentRequestSequence\.current\) return/);
  assert.match(page, /sequence === documentRequestSequence\.current\) setError/);
  assert.match(page, /sequence === documentRequestSequence\.current\) setLoading\(false\)/);
  assert.match(page, /return \(\) => \{ sequenceRef\.current\+\+; \}/);
});
