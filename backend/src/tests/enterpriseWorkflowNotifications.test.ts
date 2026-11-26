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

test('workflow initiation uses authorised workspace records and server-derived references', () => {
  assert.match(repository, /sourceOptionQueries: Record<string, string>/);
  assert.match(repository, /WHERE workspace_id=\$1/);
  assert.match(routes, /initiation-options\/:templateId/);
  assert.match(routes, /template\.sourceModule, 'view'/);
  assert.match(routes, /sourceRecordReference: sourceOption\.reference/);
  assert.match(routes, /ownerUserId \|\| ''/);
  assert.match(routes, /defaultOwnerUserId: req\.authUser!\.userId/);
});

test('workflow submission enforces source edit permission and the UI serializes creation', () => {
  assert.match(routes, /workflow\.sourceModule, 'edit'/);
  assert.match(routes, /action: 'workflow_submitted'/);
  assert.match(page, /workflowMutationLock\.current/);
  assert.match(page, /Create workflow draft/);
  assert.match(page, /Submit workflow/);
  assert.match(page, /No authorised source records are available/);
});

test('workflow transfer and cancellation are governed, audited and operable', () => {
  assert.match(repository, /Assignment is already assigned to this workspace member/);
  assert.match(repository, /client\.query\('BEGIN'\)[\s\S]*workflow_cancelled[\s\S]*client\.query\('COMMIT'\)/);
  assert.match(routes, /assignments\/:assignmentId\/:operation\(delegate\|reassign\)', requirePermission\('Settings', 'configure'\)/);
  assert.match(routes, /workflow_assignment_delegated/);
  assert.match(routes, /workflow_assignment_reassigned/);
  assert.match(routes, /:workflowId\/cancel', requirePermission\('Dashboard', 'delete'\)/);
  assert.match(routes, /action: 'workflow_cancelled'/);
  assert.match(page, /fetchWorkspaceMembers\(currentWorkspace\.id\)/);
  assert.match(page, /Confirm delegation/);
  assert.match(page, /Confirm reassignment/);
  assert.match(page, /Cancellation rationale/);
  assert.match(page, /runLifecycleMutation/);
});

test('workflow template configuration exposes validated versioned lifecycle controls', () => {
  assert.match(repository, /pg_advisory_xact_lock/);
  assert.match(repository, /setTemplateStatus/);
  assert.match(repository, /status='inactive'[\s\S]*name=\$2/);
  assert.match(routes, /templates\/:templateId\/status', requirePermission\('Settings', 'configure'\)/);
  assert.match(routes, /INVALID_ESCALATION_TARGET/);
  assert.match(routes, /workflow_template_\$\{status\}/);
  assert.match(page, /Create versioned template/);
  assert.match(page, /Approval stages/);
  assert.match(page, /Required approvals/);
  assert.match(page, /Escalate overdue assignments/);
  assert.match(page, /In-app notification events/);
});
