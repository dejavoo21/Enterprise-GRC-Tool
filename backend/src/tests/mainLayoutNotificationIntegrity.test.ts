import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const page = readFileSync(resolve(process.cwd(), '../frontend/src/layouts/MainLayout.tsx'), 'utf8');

test('shell assurance notification actions retain workspace operation ownership', () => {
  assert.match(page, /const notificationOperationLock=useRef\(false\),notificationOperationSequence=useRef\(0\)/);
  assert.match(page, /if\(notificationOperationLock\.current\)return/);
  assert.match(page, /notificationOperationSequence\.current\+\+/);
  assert.match(page, /workspaceId!==currentWorkspaceIdRef\.current/);
  assert.match(page, /const sequence=\+\+notificationOperationSequence\.current,workspaceId=currentWorkspace\.id,notificationId=notification\.id,reviewedPatch=\{\.\.\.patch\},routeKey=notification\.routeKey/);
  assert.match(page, /const sequence=\+\+notificationOperationSequence\.current,workspaceId=currentWorkspace\.id,channel=preference\.channel,type=preference\.type,enabled=!preference\.enabled/);
  assert.equal((page.match(/if\(sequence===notificationOperationSequence\.current\)\{notificationOperationLock\.current=false;setNotificationOperation\(null\);\}/g) ?? []).length, 2);
  assert.match(page, /setNotificationError\(cause instanceof Error\?cause\.message:'Notification action could not be completed\.'\)/);
  assert.match(page, /setNotificationError\(cause instanceof Error\?cause\.message:'Notification preference could not be updated\.'\)/);
  assert.match(page, /disabled=\{Boolean\(notificationOperation\)\}/);
  assert.match(page, /role="alert"/);
});
