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
  assert.match(repository, /assigned_user_id=\$2 OR \(assigned_user_id IS NULL AND assigned_role=\$3\)/);
  assert.match(repository, /recipient_user_id=\$2 OR \(recipient_user_id IS NULL AND recipient_role=\$3\)/);
  assert.match(repository, /workspace_id=\$1 AND id=\$2[\s\S]*recipient_user_id=\$3 OR \(recipient_user_id IS NULL AND recipient_role=\$4\)/);
  assert.match(routes, /getState\(req\.authUser!\.workspaceId, req\.authUser!\.userId, req\.enterpriseRoleId \|\| null\)/);
  assert.match(routes, /updateNotificationStatus\(req\.authUser!\.workspaceId, req\.params\.notificationId, req\.authUser!\.userId, req\.enterpriseRoleId \|\| null/);
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

test('workflow decisions require rationale and approved workspace evidence', () => {
  assert.match(routes, /validateDecisionPayload\(req\.body\?\.decision/);
  assert.match(repository, /SELECT id,review_status FROM evidence WHERE workspace_id=\$1 AND id=ANY\(\$2::text\[\]\) FOR SHARE/);
  assert.match(repository, /Supporting evidence must be approved and available in this workspace/);
  assert.match(repository, /supportingEvidenceIds: payload\.evidenceIds/);
  assert.match(page, /Reviewer rationale/);
  assert.match(page, /Approved supporting evidence/);
  assert.match(page, /listWorkflowEvidence/);
  assert.doesNotMatch(page, /Approved from workflow inbox|Changes requested from workflow inbox|Rejected from workflow inbox/);
});

test('workflow command centre derives bottlenecks and progress from persisted records', () => {
  assert.match(repository, /enterprise_workflow_events WHERE workspace_id=\$1 ORDER BY created_at DESC LIMIT 200/);
  assert.match(page, /Workflow bottlenecks/);
  assert.match(page, /Pending assignment concentration by configured workflow stage/);
  assert.match(page, /state\.history\.filter\(item=>item\.workflow_id===selectedWorkflowId\)/);
  assert.match(page, /Workflow progress timeline/);
  assert.match(page, /No workflow events recorded/);
});

test('My GRC exposes personal workflow workload without workspace-wide escalation counts', () => {
  assert.match(page, /My workflow workload/);
  assert.match(page, /Awaiting acknowledgement/);
  assert.match(page, /Due this week/);
  assert.match(page, /My overdue approvals/);
  assert.match(page, /Recently completed approvals/);
  assert.match(page, /assignmentIds\.has\(String\(item\.assignment_id/);
});

test('workflow escalations honor configured delay and resolve with the owning lifecycle', () => {
  assert.match(repository, /escalationEligibleAt\(row\.due_date, rule\.afterDays\)/);
  assert.match(repository, /eligibleAt > Date\.now\(\)/);
  assert.match(repository, /FOR UPDATE OF a,w/);
  assert.match(repository, /workflow_escalated[\s\S]*eligibleAt: new Date\(eligibleAt\)\.toISOString\(\)/);
  assert.match(repository, /resolution_notes='Assignment decision recorded'/);
  assert.match(repository, /resolution_notes='Workflow cancelled'/);
  assert.match(repository, /EXISTS \(SELECT 1 FROM enterprise_workflow_escalations[\s\S]*THEN 'escalated' ELSE 'awaiting_review'/);
  assert.match(repository, /resolution_notes='Stage approval requirement satisfied'/);
  assert.match(repository, /a\.stage_order=w\.current_stage_order/);
  assert.match(repository, /w\.status NOT IN \('completed','cancelled','approved','rejected','changes_requested'\)/);
});

test('workflow notification settings govern canonical lifecycle events', () => {
  assert.match(repository, /if \(!template\.notificationEvents\.includes\(input\.event\)\) return false/);
  for (const event of ['assignment_created','approval_requested','assignment_acknowledged','due_date_approaching','overdue','escalation','workflow_completion']) {
    assert.match(repository, new RegExp(`event:'${event}'`));
  }
  assert.match(repository, /payload\.decision === 'reject' \? 'rejection' : payload\.decision === 'request_changes' \? 'changes_requested' : 'approval_completed'/);
  assert.match(repository, /ON CONFLICT\(workspace_id,deduplication_key\) DO NOTHING RETURNING id/);
  assert.doesNotMatch(repository, /workflow_approved|workflow_rejected|workflow_changes_requested|workflow_decision_recorded/);
});

test('deadline evaluation creates bounded deduplicated reminder events', () => {
  assert.match(repository, /a\.due_date>=NOW\(\) AND a\.due_date<=NOW\(\)\+INTERVAL '24 hours'/);
  assert.match(repository, /FOR SHARE OF a,w/);
  assert.match(repository, /dueSoonEvaluated: dueSoon\.length, dueSoonNotified, overdueNotified/);
  assert.match(repository, /event:'due_date_approaching'/);
  assert.match(page, /deadlineEvaluationLock\.current/);
  assert.match(page, /This does not claim automatic scheduling or external delivery/);
  assert.match(page, /dueSoonEvaluated.*dueSoonNotified.*evaluated.*overdueNotified.*created/);
});

test('role-addressed workflow assignments use the resolved role for acknowledgement', () => {
  assert.match(repository, /assigned_user_id=\$3 OR \(assigned_user_id IS NULL AND assigned_role=\$4\)/);
  assert.match(routes, /acknowledgeAssignment\(req\.authUser!\.workspaceId, req\.params\.assignmentId, req\.authUser!\.userId, req\.enterpriseRoleId \|\| null\)/);
});
