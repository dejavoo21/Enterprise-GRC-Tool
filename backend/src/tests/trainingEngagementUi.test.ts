import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(__dirname, '../../..');

test('training engagement workflows use accessible dialogs and announced feedback', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/TrainingEngagements.tsx'), 'utf8');
  assert.match(page, /<Modal[\s\S]*accessibleDialog[\s\S]*title="New Engagement"/);
  assert.match(page, /<Modal accessibleDialog isOpen onClose=\{requestClose\} title=\{engagement\.title\}/);
  assert.match(page, /role="tablist" aria-label="Engagement detail sections"/);
  assert.match(page, /role="tab" aria-selected=\{activeTab === 'details'\}/);
  assert.match(page, /htmlFor="engagement-question"/);
  assert.match(page, /id="engagement-question"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /onClose=\{requestClose\}/);
  assert.match(page, /onClick=\{requestClose\} disabled=\{isSubmitting\}/);
  assert.match(page, /<fieldset disabled=\{isSubmitting\} aria-busy=\{isSubmitting\}/);
  assert.doesNotMatch(page, /position: 'fixed'/);
});

test('training assistant requests serialize captured engagement context', async () => {
  const page = await readFile(path.join(root, 'frontend/src/pages/TrainingEngagements.tsx'), 'utf8');
  assert.match(page, /const assistantLock = useRef\(false\)/);
  assert.equal((page.match(/assistantLock\.current = true/g) || []).length, 2);
  assert.equal((page.match(/assistantLock\.current = false/g) || []).length, 2);
  assert.match(page, /if \(assistantLock\.current \|\| !question\.trim\(\)\) return/);
  assert.match(page, /const engagementId = engagement\.id/);
  assert.match(page, /const workspaceId = currentWorkspace\.id/);
  assert.match(page, /const payload = JSON\.stringify\(\{ question: question\.trim\(\) \}\)/);
  assert.match(page, /<Modal accessibleDialog isOpen onClose=\{requestClose\} title=\{engagement\.title\}/);
  assert.match(page, /disabled=\{assistantBusy\}/);
});
