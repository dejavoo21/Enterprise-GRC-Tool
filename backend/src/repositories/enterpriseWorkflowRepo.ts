import { generateId, pool, query } from '../db.js';
import type { EnterpriseWorkflowState, WorkflowAssignment, WorkflowDecision, WorkflowInstance, WorkflowNotificationStatus, WorkflowSourceOption, WorkflowStageDefinition, WorkflowTemplate } from '../types/enterpriseWorkflow.js';
import { assertDecisionAllowed, assertSequentialTurn, nextWorkflowStatus, notificationKey, stageSatisfied, validateCancellationRationale, validateStages, validateTemplateConfiguration } from '../services/enterpriseWorkflowRules.js';
import { assertPolicyCanBePublished, policyStatusForWorkflowOutcome, type PolicyWorkflowOutcome } from '../services/policyWorkflowRules.js';

type Row = Record<string, any>;
const iso = (value: unknown) => value ? new Date(String(value)).toISOString() : undefined;

function mapTemplate(row: Row): WorkflowTemplate {
  return { id: row.id, workspaceId: row.workspace_id, name: row.name, sourceModule: row.source_module, sourceRecordType: row.source_record_type, version: Number(row.version), stages: row.stages || [], escalationRules: row.escalation_rules || [], notificationEvents: row.notification_events || [], status: row.status, createdBy: row.created_by, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
}
function mapWorkflow(row: Row): WorkflowInstance {
  return { id: row.id, workspaceId: row.workspace_id, templateId: row.template_id, templateVersion: Number(row.template_version), name: row.name, sourceModule: row.source_module, sourceRecordType: row.source_record_type, sourceRecordId: row.source_record_id, sourceRecordReference: row.source_record_reference || undefined, ownerUserId: row.owner_user_id, requestedByUserId: row.requested_by_user_id, currentStageOrder: Number(row.current_stage_order), status: row.status, effectiveDate: iso(row.effective_date), reviewDate: iso(row.review_date), createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
}
function mapAssignment(row: Row): WorkflowAssignment {
  return { id: row.id, workspaceId: row.workspace_id, workflowId: row.workflow_id, stageId: row.stage_id, stageOrder: Number(row.stage_order), sequenceIndex: Number(row.sequence_index), assignedUserId: row.assigned_user_id || undefined, assignedRole: row.assigned_role || undefined, requestedByUserId: row.requested_by_user_id, assignedAt: iso(row.assigned_at)!, acknowledgedAt: iso(row.acknowledged_at), dueDate: iso(row.due_date), status: row.status, decision: row.decision || undefined, decisionAt: iso(row.decision_at), reviewerComments: row.reviewer_comments || undefined, supportingEvidenceIds: row.supporting_evidence_ids || [], delegatedFromUserId: row.delegated_from_user_id || undefined };
}

async function applyPolicyWorkflowOutcome(client: any, workflow: WorkflowInstance, actorUserId: string, outcome: PolicyWorkflowOutcome) {
  if (workflow.sourceRecordType !== 'policy') return;
  const row = (await client.query(`SELECT status FROM governance_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workflow.workspaceId, workflow.sourceRecordId])).rows[0];
  if (!row) throw new Error('Source policy is unavailable in this workspace');
  const nextStatus = policyStatusForWorkflowOutcome(row.status, outcome);
  if (nextStatus === row.status) return;
  await client.query(`UPDATE governance_documents SET status=$3,last_reviewed_at=CASE WHEN $3='approved' THEN NOW() ELSE last_reviewed_at END,updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workflow.workspaceId, workflow.sourceRecordId, nextStatus]);
  await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,actor_user_id,event_type,previous_state,next_state) VALUES($1,$2,$3,$4,'source_state_applied',$5::jsonb,$6::jsonb)`, [generateId('wfe'), workflow.workspaceId, workflow.id, actorUserId, JSON.stringify({ policyStatus: row.status }), JSON.stringify({ policyStatus: nextStatus, outcome })]);
}

export async function listTemplates(workspaceId: string) { return (await query(`SELECT * FROM enterprise_workflow_definitions WHERE workspace_id=$1 ORDER BY name,version DESC`, [workspaceId])).rows.map(mapTemplate); }
export async function getTemplate(workspaceId: string, templateId: string) { const row = (await query(`SELECT * FROM enterprise_workflow_definitions WHERE workspace_id=$1 AND id=$2`, [workspaceId, templateId])).rows[0]; return row ? mapTemplate(row) : null; }
export async function listWorkflows(workspaceId: string) { return (await query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 ORDER BY updated_at DESC`, [workspaceId])).rows.map(mapWorkflow); }
export async function getWorkflow(workspaceId: string, workflowId: string) { const row = (await query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflowId])).rows[0]; return row ? mapWorkflow(row) : null; }

const sourceOptionQueries: Record<string, string> = {
  risk: `SELECT id,COALESCE(risk_ref,id) AS reference,title AS label FROM risks WHERE workspace_id=$1`,
  treatment: `SELECT id,id AS reference,title AS label FROM risk_treatment_plans WHERE workspace_id=$1`,
  control: `SELECT id,id AS reference,title AS label FROM controls WHERE workspace_id=$1 AND archived_at IS NULL`,
  evidence: `SELECT id,id AS reference,name AS label FROM evidence WHERE workspace_id=$1`,
  policy: `SELECT id,id AS reference,title AS label FROM governance_documents WHERE workspace_id=$1 AND archived_at IS NULL`,
  supplier: `SELECT id,COALESCE(supplier_ref,id) AS reference,name AS label FROM vendors WHERE workspace_id=$1 AND archived_at IS NULL`,
  vendor: `SELECT id,COALESCE(supplier_ref,id) AS reference,name AS label FROM vendors WHERE workspace_id=$1 AND archived_at IS NULL`,
  asset: `SELECT id,COALESCE(asset_tag,id) AS reference,name AS label FROM assets WHERE workspace_id=$1 AND COALESCE(lifecycle_status,status,'active')<>'archived'`,
  finding: `SELECT id,COALESCE(finding_id,id) AS reference,title AS label FROM audit_findings WHERE workspace_id=$1`,
};

export async function listWorkflowSourceOptions(workspaceId: string, sourceRecordType: string): Promise<WorkflowSourceOption[]> {
  const sourceQuery = sourceOptionQueries[sourceRecordType];
  if (!sourceQuery) throw new Error('Unsupported workflow source record type');
  const result = await query<WorkflowSourceOption>(`${sourceQuery} ORDER BY label,reference LIMIT 200`, [workspaceId]);
  return result.rows.map((row) => ({ id: String(row.id), reference: String(row.reference), label: String(row.label) }));
}
export async function listAssignments(workspaceId: string, userId?: string) {
  const result = userId
    ? await query(`SELECT * FROM enterprise_workflow_assignments WHERE workspace_id=$1 AND (assigned_user_id=$2 OR assigned_user_id IS NULL) ORDER BY due_date NULLS LAST,assigned_at DESC`, [workspaceId, userId])
    : await query(`SELECT * FROM enterprise_workflow_assignments WHERE workspace_id=$1 ORDER BY due_date NULLS LAST,assigned_at DESC`, [workspaceId]);
  return result.rows.map(mapAssignment);
}

export async function createTemplate(workspaceId: string, actorUserId: string, input: Pick<WorkflowTemplate, 'name'|'sourceModule'|'sourceRecordType'|'stages'|'escalationRules'|'notificationEvents'|'status'>) {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 160) throw new Error('Workflow template name must contain 3 to 160 characters');
  if (!['draft', 'active'].includes(input.status)) throw new Error('New workflow templates must be draft or active');
  validateTemplateConfiguration(input);
  const stages = input.stages.slice().sort((a, b) => a.order - b.order);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1::text || ':' || $2::text))`, [workspaceId, name]);
    const version = Number((await client.query(`SELECT COALESCE(MAX(version),0)+1 AS version FROM enterprise_workflow_definitions WHERE workspace_id=$1 AND name=$2`, [workspaceId, name])).rows[0].version);
    if (input.status === 'active') await client.query(`UPDATE enterprise_workflow_definitions SET status='inactive',updated_at=NOW() WHERE workspace_id=$1 AND name=$2 AND status='active'`, [workspaceId, name]);
    const result = await client.query(`INSERT INTO enterprise_workflow_definitions(id,workspace_id,name,source_module,source_record_type,version,stages,escalation_rules,notification_events,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) RETURNING *`, [generateId('wft'), workspaceId, name, input.sourceModule, input.sourceRecordType, version, JSON.stringify(stages), JSON.stringify(input.escalationRules || []), JSON.stringify(input.notificationEvents || []), input.status, actorUserId]);
    await client.query('COMMIT');
    return mapTemplate(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function setTemplateStatus(workspaceId: string, templateId: string, status: 'active' | 'inactive') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query(`SELECT * FROM enterprise_workflow_definitions WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, templateId])).rows[0];
    if (!current) throw new Error('Workflow template not found');
    if (current.status === status) throw new Error(`Workflow template is already ${status}`);
    if (status === 'active') await client.query(`UPDATE enterprise_workflow_definitions SET status='inactive',updated_at=NOW() WHERE workspace_id=$1 AND name=$2 AND id<>$3 AND status='active'`, [workspaceId, current.name, templateId]);
    const updated = (await client.query(`UPDATE enterprise_workflow_definitions SET status=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId, templateId, status])).rows[0];
    await client.query('COMMIT');
    return mapTemplate(updated);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function createWorkflow(workspaceId: string, actorUserId: string, input: { templateId: string; sourceRecordId: string; sourceRecordReference?: string; ownerUserId: string; effectiveDate?: string; reviewDate?: string }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const templateRow = (await client.query(`SELECT * FROM enterprise_workflow_definitions WHERE workspace_id=$1 AND id=$2 AND status='active' FOR SHARE`, [workspaceId, input.templateId])).rows[0];
    if (!templateRow) throw new Error('Active workflow template not found');
    const template = mapTemplate(templateRow);
    const id = generateId('wf');
    const workflowRow = (await client.query(`INSERT INTO enterprise_workflows(id,workspace_id,template_id,template_version,name,source_module,source_record_type,source_record_id,source_record_reference,owner_user_id,requested_by_user_id,current_stage_order,status,effective_date,review_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,'draft',$12,$13) RETURNING *`, [id, workspaceId, template.id, template.version, template.name, template.sourceModule, template.sourceRecordType, input.sourceRecordId, input.sourceRecordReference || null, input.ownerUserId, actorUserId, input.effectiveDate || null, input.reviewDate || null])).rows[0];
    await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,actor_user_id,event_type,next_state) VALUES($1,$2,$3,$4,'workflow_created',$5::jsonb)`, [generateId('wfe'), workspaceId, id, actorUserId, JSON.stringify({ status: 'draft' })]);
    await client.query('COMMIT');
    return mapWorkflow(workflowRow);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

function assignmentTargets(stage: WorkflowStageDefinition) {
  const users = stage.assignedUserIds.map((userId) => ({ userId, role: null as string | null }));
  if (stage.assignedRole) users.push({ userId: null as any, role: stage.assignedRole });
  return users;
}

async function startStage(client: any, workflow: WorkflowInstance, stage: WorkflowStageDefinition, actorUserId: string) {
  const dueDate = new Date(Date.now() + stage.dueDays * 86_400_000).toISOString();
  for (const [sequenceIndex, target] of assignmentTargets(stage).entries()) {
    const assignmentId = generateId('wfa');
    await client.query(`INSERT INTO enterprise_workflow_assignments(id,workspace_id,workflow_id,stage_id,stage_order,sequence_index,assigned_user_id,assigned_role,requested_by_user_id,due_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'awaiting_acknowledgement')`, [assignmentId, workflow.workspaceId, workflow.id, stage.id, stage.order, sequenceIndex, target.userId, target.role, workflow.requestedByUserId, dueDate]);
    await client.query(`INSERT INTO enterprise_workflow_notifications(id,workspace_id,workflow_id,assignment_id,event_type,recipient_user_id,recipient_role,deduplication_key) VALUES($1,$2,$3,$4,'approval_requested',$5,$6,$7) ON CONFLICT(workspace_id,deduplication_key) DO NOTHING`, [generateId('wfn'), workflow.workspaceId, workflow.id, assignmentId, target.userId, target.role, notificationKey(workflow.id, assignmentId, 'approval_requested', target.userId || target.role || 'unassigned')]);
  }
  await client.query(`UPDATE enterprise_workflows SET current_stage_order=$3,status='awaiting_review',updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workflow.workspaceId, workflow.id, stage.order]);
  await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,actor_user_id,event_type,next_state) VALUES($1,$2,$3,$4,'stage_started',$5::jsonb)`, [generateId('wfe'), workflow.workspaceId, workflow.id, actorUserId, JSON.stringify({ stageId: stage.id, stageOrder: stage.order })]);
}

export async function submitWorkflow(workspaceId: string, workflowId: string, actorUserId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, workflowId])).rows[0];
    if (!row) throw new Error('Workflow not found');
    const workflow = mapWorkflow(row);
    if (!['draft','changes_requested'].includes(workflow.status)) throw new Error('Only draft or changes-requested workflows can be submitted');
    const template = mapTemplate((await client.query(`SELECT * FROM enterprise_workflow_definitions WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflow.templateId])).rows[0]);
    await startStage(client, workflow, validateStages(template.stages)[0], actorUserId);
    await applyPolicyWorkflowOutcome(client, workflow, actorUserId, 'submitted');
    await client.query('COMMIT');
    return (await query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflowId])).rows[0] ? mapWorkflow((await query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflowId])).rows[0]) : null;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function decideAssignment(workspaceId: string, assignmentId: string, actorUserId: string, actorRole: string | null, decision: WorkflowDecision, comments: string, evidenceIds: string[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assignmentRow = (await client.query(`SELECT * FROM enterprise_workflow_assignments WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, assignmentId])).rows[0];
    if (!assignmentRow) throw new Error('Workflow assignment not found');
    const assignment = mapAssignment(assignmentRow);
    if (!assignment.assignedUserId && assignment.assignedRole && assignment.assignedRole !== actorRole) throw new Error('This assignment requires a different workflow role');
    const workflow = mapWorkflow((await client.query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, assignment.workflowId])).rows[0]);
    const template = mapTemplate((await client.query(`SELECT * FROM enterprise_workflow_definitions WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflow.templateId])).rows[0]);
    const stage = template.stages.find((item) => item.id === assignment.stageId)!;
    const existing = (await client.query(`SELECT * FROM enterprise_workflow_assignments WHERE workspace_id=$1 AND workflow_id=$2 AND stage_id=$3 ORDER BY sequence_index`, [workspaceId, workflow.id, stage.id])).rows.map(mapAssignment);
    assertSequentialTurn(stage, assignment, existing);
    assertDecisionAllowed({ workflowStatus: workflow.status, stage, assignment, actorUserId, requesterUserId: workflow.requestedByUserId, evidenceIds, decision });
    await client.query(`UPDATE enterprise_workflow_assignments SET status=$3,decision=$4,decision_at=NOW(),reviewer_comments=$5,supporting_evidence_ids=$6::jsonb,updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, assignmentId, decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'changes_requested', decision, comments || null, JSON.stringify(evidenceIds)]);
    const all = (await client.query(`SELECT * FROM enterprise_workflow_assignments WHERE workspace_id=$1 AND workflow_id=$2 AND stage_id=$3 ORDER BY assigned_at`, [workspaceId, workflow.id, stage.id])).rows.map(mapAssignment);
    let workflowStatus = nextWorkflowStatus(decision);
    if (decision === 'approve' && stageSatisfied(stage, all)) {
      const nextStage = validateStages(template.stages).find((item) => item.order > stage.order);
      if (nextStage) await startStage(client, workflow, nextStage, actorUserId);
      else { workflowStatus = 'approved'; await client.query(`UPDATE enterprise_workflows SET status='approved',updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflow.id]); await applyPolicyWorkflowOutcome(client, workflow, actorUserId, 'approved'); }
    } else if (decision !== 'approve') await client.query(`UPDATE enterprise_workflows SET status=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflow.id, workflowStatus]);
    if (decision === 'reject') await applyPolicyWorkflowOutcome(client, workflow, actorUserId, 'rejected');
    if (decision === 'request_changes') await applyPolicyWorkflowOutcome(client, workflow, actorUserId, 'changes_requested');
    await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,assignment_id,actor_user_id,event_type,previous_state,next_state,rationale) VALUES($1,$2,$3,$4,$5,'approval_decision',$6::jsonb,$7::jsonb,$8)`, [generateId('wfe'), workspaceId, workflow.id, assignment.id, actorUserId, JSON.stringify({ status: assignment.status }), JSON.stringify({ decision, workflowStatus }), comments || null]);
    const decisionEvent = workflowStatus === 'approved' ? 'workflow_approved' : decision === 'reject' ? 'workflow_rejected' : decision === 'request_changes' ? 'workflow_changes_requested' : 'workflow_decision_recorded';
    await client.query(`INSERT INTO enterprise_workflow_notifications(id,workspace_id,workflow_id,assignment_id,event_type,recipient_user_id,deduplication_key) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,deduplication_key) DO NOTHING`, [generateId('wfn'), workspaceId, workflow.id, assignment.id, decisionEvent, workflow.requestedByUserId, notificationKey(workflow.id, assignment.id, decisionEvent, workflow.requestedByUserId)]);
    await client.query('COMMIT');
    return { workflowId: workflow.id, decision, workflowStatus };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function acknowledgeAssignment(workspaceId: string, assignmentId: string, actorUserId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(`UPDATE enterprise_workflow_assignments SET status='acknowledged',acknowledged_at=NOW(),updated_at=NOW() WHERE workspace_id=$1 AND id=$2 AND assigned_user_id=$3 AND status='awaiting_acknowledgement' RETURNING *`, [workspaceId, assignmentId, actorUserId])).rows[0];
    if (!row) throw new Error('Assignment cannot be acknowledged');
    await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,assignment_id,actor_user_id,event_type,next_state) VALUES($1,$2,$3,$4,$5,'assignment_acknowledged',$6::jsonb)`, [generateId('wfe'), workspaceId, row.workflow_id, assignmentId, actorUserId, JSON.stringify({ status: 'acknowledged' })]);
    await client.query('COMMIT');
    return mapAssignment(row);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function publishApprovedPolicy(workspaceId: string, workflowId: string, actorUserId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const workflowRow = (await client.query(`SELECT * FROM enterprise_workflows WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, workflowId])).rows[0];
    if (!workflowRow) throw new Error('Workflow not found');
    const workflow = mapWorkflow(workflowRow);
    if (workflow.sourceRecordType !== 'policy') throw new Error('This workflow is not linked to a policy');
    const policy = (await client.query(`SELECT * FROM governance_documents WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, workflow.sourceRecordId])).rows[0];
    if (!policy) throw new Error('Source policy is unavailable in this workspace');
    if (policy.status === 'published') { await client.query('COMMIT'); return { workflowId, documentId: policy.id, status: policy.status, changed: false }; }
    assertPolicyCanBePublished(policy.status, workflow.status);
    await client.query(`UPDATE governance_documents SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, policy.id]);
    await client.query(`UPDATE enterprise_workflows SET status='completed',updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, workflowId]);
    await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,actor_user_id,event_type,previous_state,next_state) VALUES($1,$2,$3,$4,'source_published',$5::jsonb,$6::jsonb)`, [generateId('wfe'), workspaceId, workflowId, actorUserId, JSON.stringify({ workflowStatus: workflow.status, policyStatus: policy.status }), JSON.stringify({ workflowStatus: 'completed', policyStatus: 'published' })]);
    await client.query(`INSERT INTO enterprise_workflow_notifications(id,workspace_id,workflow_id,event_type,recipient_user_id,deduplication_key) VALUES($1,$2,$3,'source_published',$4,$5) ON CONFLICT(workspace_id,deduplication_key) DO NOTHING`, [generateId('wfn'), workspaceId, workflowId, workflow.requestedByUserId, notificationKey(workflowId, undefined, 'source_published', workflow.requestedByUserId)]);
    await client.query('COMMIT');
    return { workflowId, documentId: policy.id, status: 'published', changed: true };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function reassignAssignment(workspaceId: string, assignmentId: string, actorUserId: string, targetUserId: string, delegated: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query(`SELECT * FROM enterprise_workflow_assignments WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, assignmentId])).rows[0];
    if (!current || current.decision) throw new Error('Assignment cannot be reassigned');
    if (String(current.assigned_user_id || '') === targetUserId) throw new Error('Assignment is already assigned to this workspace member');
    const updated = (await client.query(`UPDATE enterprise_workflow_assignments SET assigned_user_id=$3,assigned_role=NULL,status='awaiting_acknowledgement',acknowledged_at=NULL,delegated_from_user_id=CASE WHEN $4 THEN COALESCE(assigned_user_id,$5) ELSE delegated_from_user_id END,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId, assignmentId, targetUserId, delegated, actorUserId])).rows[0];
    await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,assignment_id,actor_user_id,event_type,next_state) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, [generateId('wfe'), workspaceId, updated.workflow_id, assignmentId, actorUserId, delegated ? 'assignment_delegated' : 'assignment_reassigned', JSON.stringify({ assignedUserId: targetUserId })]);
    await client.query('COMMIT');
    return mapAssignment(updated);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function cancelWorkflow(workspaceId: string, workflowId: string, actorUserId: string, rationale: string) {
  const reason = rationale.trim();
  const rationaleError = validateCancellationRationale(reason);
  if (rationaleError) throw new Error(rationaleError);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`UPDATE enterprise_workflows SET status='cancelled',updated_at=NOW() WHERE workspace_id=$1 AND id=$2 AND status NOT IN ('completed','cancelled','approved','rejected') RETURNING *`, [workspaceId, workflowId]);
    if (!result.rows[0]) throw new Error('Workflow cannot be cancelled');
    await client.query(`UPDATE enterprise_workflow_assignments SET status='cancelled',updated_at=NOW() WHERE workspace_id=$1 AND workflow_id=$2 AND decision IS NULL`, [workspaceId, workflowId]);
    await client.query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,actor_user_id,event_type,next_state,rationale) VALUES($1,$2,$3,$4,'workflow_cancelled',$5::jsonb,$6)`, [generateId('wfe'), workspaceId, workflowId, actorUserId, JSON.stringify({ status: 'cancelled' }), reason]);
    await client.query('COMMIT');
    return mapWorkflow(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function escalateOverdue(workspaceId: string, actorUserId: string) {
  const overdue = (await query(`SELECT a.*,w.template_id FROM enterprise_workflow_assignments a JOIN enterprise_workflows w ON w.id=a.workflow_id AND w.workspace_id=a.workspace_id WHERE a.workspace_id=$1 AND a.due_date<NOW() AND a.decision IS NULL AND a.status NOT IN ('cancelled','delegated')`, [workspaceId])).rows;
  let created = 0;
  for (const row of overdue) {
    const template = await getTemplate(workspaceId, row.template_id);
    const rule = template?.escalationRules.find((item) => item.targetRole || item.targetUserId);
    if (!rule) continue;
    const deduplicationKey = notificationKey(row.workflow_id, row.id, 'escalation', rule.targetUserId || rule.targetRole || 'unassigned');
    const inserted = await query(`INSERT INTO enterprise_workflow_escalations(id,workspace_id,workflow_id,assignment_id,escalation_level,trigger_type,target_role,target_user_id) SELECT $1,$2,$3,$4,1,'overdue',$5,$6 WHERE NOT EXISTS (SELECT 1 FROM enterprise_workflow_escalations WHERE workspace_id=$2 AND assignment_id=$4 AND status='open') RETURNING id`, [generateId('wfs'), workspaceId, row.workflow_id, row.id, rule.targetRole || null, rule.targetUserId || null]);
    if (!inserted.rows[0]) continue;
    created += 1;
    await query(`UPDATE enterprise_workflows SET status='escalated',updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, row.workflow_id]);
    await query(`INSERT INTO enterprise_workflow_notifications(id,workspace_id,workflow_id,assignment_id,event_type,recipient_user_id,recipient_role,deduplication_key) VALUES($1,$2,$3,$4,'escalation',$5,$6,$7) ON CONFLICT(workspace_id,deduplication_key) DO NOTHING`, [generateId('wfn'), workspaceId, row.workflow_id, row.id, rule.targetUserId || null, rule.targetRole || null, deduplicationKey]);
    await query(`INSERT INTO enterprise_workflow_events(id,workspace_id,workflow_id,assignment_id,actor_user_id,event_type,next_state) VALUES($1,$2,$3,$4,$5,'workflow_escalated',$6::jsonb)`, [generateId('wfe'), workspaceId, row.workflow_id, row.id, actorUserId, JSON.stringify({ escalationRule: rule })]);
  }
  return { evaluated: overdue.length, created };
}

export async function updateNotificationStatus(workspaceId: string, notificationId: string, actorUserId: string, status: WorkflowNotificationStatus) {
  const result = await query(
    `UPDATE enterprise_workflow_notifications
     SET inbox_status=$4,
         read_at=CASE WHEN $4 IN ('read','archived') THEN COALESCE(read_at,NOW()) ELSE read_at END,
         archived_at=CASE WHEN $4='archived' THEN COALESCE(archived_at,NOW()) ELSE archived_at END,
         updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2
       AND (recipient_user_id IS NULL OR recipient_user_id=$3)
       AND inbox_status<>'archived'
     RETURNING *`,
    [workspaceId, notificationId, actorUserId, status],
  );
  if (!result.rows[0]) throw new Error('Workflow notification is unavailable or already archived');
  return result.rows[0];
}

export async function getState(workspaceId: string, userId?: string): Promise<EnterpriseWorkflowState> {
  const [templates, workflows, assignments, escalations, notifications, history] = await Promise.all([
    listTemplates(workspaceId), listWorkflows(workspaceId), listAssignments(workspaceId, userId),
    query(`SELECT * FROM enterprise_workflow_escalations WHERE workspace_id=$1 ORDER BY escalated_at DESC`, [workspaceId]),
    query(`SELECT * FROM enterprise_workflow_notifications WHERE workspace_id=$1 AND (recipient_user_id IS NULL OR recipient_user_id=$2) ORDER BY created_at DESC`, [workspaceId, userId || null]),
    query(`SELECT * FROM enterprise_workflow_events WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 200`, [workspaceId]),
  ]);
  return { templates, workflows, assignments, escalations: escalations.rows, notifications: notifications.rows, history: history.rows, summary: { active: workflows.filter((w) => !['completed','cancelled','rejected'].includes(w.status)).length, awaitingApproval: workflows.filter((w) => w.status === 'awaiting_review').length, overdue: workflows.filter((w) => w.status === 'overdue').length, escalated: workflows.filter((w) => w.status === 'escalated').length, completed: workflows.filter((w) => ['approved','completed'].includes(w.status)).length, rejected: workflows.filter((w) => w.status === 'rejected').length } };
}
