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
