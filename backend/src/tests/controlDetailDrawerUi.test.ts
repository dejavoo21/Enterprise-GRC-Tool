import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('control details use an accessible non-modal drawer', async () => {
  const panel = await readFile(path.join(root, 'frontend/src/components/ControlDetailPanel.tsx'), 'utf8');
  assert.match(panel, /ref=\{drawerRef\}[\s\S]*role="dialog"[\s\S]*aria-modal="false"/);
  assert.match(panel, /aria-label=\{`\$\{control\.title\} details`\}/);
  assert.match(panel, /width: 'min\(520px, 100vw\)'/);
  assert.match(panel, /event\.key === 'Escape' && !showLinkDocModal && !showLinkCourseModal/);
  assert.match(panel, /aria-label="Close control details"/);
  assert.match(panel, /previous instanceof HTMLElement && previous\.isConnected/);
});
