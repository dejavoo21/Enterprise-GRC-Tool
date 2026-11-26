import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const repository = read('src/repositories/enterpriseWorkflowRepo.ts');
const routes = read('src/routes/enterpriseWorkflows.ts');
const migration = read('sql/migrations/20261126-enterprise-workflow-notification-lifecycle.sql');
const page = read('../frontend/src/pages/WorkflowManagement.tsx');

test('workflow notification reads and mutations remain workspace and recipient scoped', () => {
  assert.match(repository, /workspace_id=\$1 AND \(recipient_user_id IS NULL OR recipient_user_id=\$2\)/);
  assert.match(repository, /workspace_id=\$1 AND id=\$2[\s\S]*recipient_user_id IS NULL OR recipient_user_id=\$3/);
  assert.match(routes, /getState\(req\.authUser!\.workspaceId, req\.authUser!\.userId\)/);
});

test('workflow notification archival is terminal and audited behind edit permission', () => {
  assert.match(repository, /inbox_status<>'archived'/);
  assert.match(routes, /notifications\/:notificationId', requirePermission\('Dashboard', 'edit'\)/);
  assert.match(routes, /workflow_notification_\$\{status\}/);
  assert.match(routes, /INVALID_NOTIFICATION_STATUS/);
});

test('migration separates inbox lifecycle from provider delivery state', () => {
  assert.match(migration, /inbox_status TEXT NOT NULL DEFAULT 'active'/);
  assert.match(migration, /CHECK \(inbox_status IN \('active', 'read', 'archived'\)\)/);
  assert.doesNotMatch(migration, /ALTER COLUMN delivery_status/);
});

test('workflow notification inbox exposes governed actions and truthful delivery language', () => {
  assert.match(page, /Workflow notification inbox/);
  assert.match(page, /Mark read/);
  assert.match(page, /Archive/);
  assert.match(page, /does not claim external provider delivery/);
  assert.match(page, /if\(notificationPending\)return/);
});
