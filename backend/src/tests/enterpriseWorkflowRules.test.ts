import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDecisionAllowed, assertSequentialTurn, escalationEligibleAt, nextWorkflowStatus, notificationKey, stageSatisfied, validateCancellationRationale, validateDecisionPayload, validateStages, validateTemplateConfiguration, WorkflowRuleError } from '../services/enterpriseWorkflowRules.js';
import type { WorkflowAssignment, WorkflowStageDefinition } from '../types/enterpriseWorkflow.js';

const stage = (mode: WorkflowStageDefinition['mode'], quorum = 1): WorkflowStageDefinition => ({ id:'stage-1', name:'Review', order:1, mode, kind:'approval', assignedUserIds:['reviewer-a','reviewer-b'], quorum, dueDays:3, independentReview:false, evidenceRequired:false });
const assignment = (sequenceIndex:number, decision?:WorkflowAssignment['decision']): WorkflowAssignment => ({ id:`assignment-${sequenceIndex}`,workspaceId:'workspace-a',workflowId:'workflow-1',stageId:'stage-1',stageOrder:1,sequenceIndex,assignedUserId:`reviewer-${sequenceIndex}`,requestedByUserId:'requester',assignedAt:'2026-11-21T00:00:00.000Z',status:decision==='approve'?'approved':'acknowledged',decision,supportingEvidenceIds:[] });

test('validates ordered workflow stages and rejects duplicate order', () => {
  assert.deepEqual(validateStages([{...stage('parallel'),order:2},{...stage('parallel'),id:'first',order:1}]).map(item=>item.order),[1,2]);
  assert.throws(()=>validateStages([stage('parallel'),{...stage('parallel'),id:'duplicate'}]),WorkflowRuleError);
});
test('parallel and quorum stages complete only at configured approval count', () => {
  assert.equal(stageSatisfied(stage('parallel',2),[assignment(0,'approve'),assignment(1)]),false);
  assert.equal(stageSatisfied(stage('parallel',2),[assignment(0,'approve'),assignment(1,'approve')]),true);
});
test('sequential approval enforces reviewer order', () => {
  const sequential=stage('sequential',2); const rows=[assignment(0),assignment(1)];
  assert.throws(()=>assertSequentialTurn(sequential,rows[1],rows),/earlier sequential reviewer/);
  assert.doesNotThrow(()=>assertSequentialTurn(sequential,rows[0],rows));
});
test('independent review, evidence, duplicate and cross-assignee decisions are blocked', () => {
  const base={...assignment(0),assignedUserId:'requester'}; const input={workflowStatus:'awaiting_review' as const,stage:{...stage('single'),independentReview:true,evidenceRequired:true},assignment:base,actorUserId:'requester',requesterUserId:'requester',evidenceIds:[] as string[],decision:'approve' as const};
  assert.throws(()=>assertDecisionAllowed(input),/self-approval/);
  assert.throws(()=>assertDecisionAllowed({...input,actorUserId:'reviewer-0',assignment:{...base,assignedUserId:'reviewer-0'}}),/evidence/);
  assert.throws(()=>assertDecisionAllowed({...input,actorUserId:'intruder',evidenceIds:['ev-1']}),/another reviewer/);
  assert.throws(()=>assertDecisionAllowed({...input,actorUserId:'reviewer-0',evidenceIds:['ev-1'],assignment:{...base,assignedUserId:'reviewer-0',decision:'approve'}}),/already been recorded/);
  assert.throws(()=>assertDecisionAllowed({...input,actorUserId:'reviewer-0',evidenceIds:['ev-1'],assignment:{...base,assignedUserId:'reviewer-0',status:'awaiting_acknowledgement'}}),/Acknowledge/);
});

test('cancelled and delegated residual assignments cannot record decisions', () => {
  const roleAssignment = {...assignment(0),assignedUserId:undefined,assignedRole:'Risk Manager'};
  assert.throws(() => assertDecisionAllowed({workflowStatus:'awaiting_review',stage:stage('parallel'),assignment:{...roleAssignment,status:'cancelled'},actorUserId:'reviewer',requesterUserId:'requester',evidenceIds:[],decision:'approve'}), /no longer accepts decisions/);
  assert.throws(() => assertDecisionAllowed({workflowStatus:'awaiting_review',stage:stage('parallel'),assignment:{...roleAssignment,status:'delegated'},actorUserId:'reviewer',requesterUserId:'requester',evidenceIds:[],decision:'approve'}), /no longer accepts decisions/);
});
test('rejection and changes requested produce terminal and return states', () => {
  assert.equal(nextWorkflowStatus('reject'),'rejected');
  assert.equal(nextWorkflowStatus('request_changes'),'changes_requested');
});
test('decision payload requires explicit rationale and normalizes bounded evidence references', () => {
  assert.deepEqual(validateDecisionPayload('approve','  Reviewed against the approved control record.  ',['ev-1','ev-1','ev-2']),{decision:'approve',comments:'Reviewed against the approved control record.',evidenceIds:['ev-1','ev-2']});
  assert.throws(()=>validateDecisionPayload('override','Valid rationale',[]),/decision is invalid/);
  assert.throws(()=>validateDecisionPayload('reject','no',[]),/5 to 2000/);
  assert.throws(()=>validateDecisionPayload('approve','Valid rationale',Array.from({length:51},(_,index)=>`ev-${index}`)),/at most 50/);
});
test('notification keys are deterministic and workspace-safe inputs remain explicit', () => {
  assert.equal(notificationKey('workflow-1','assignment-1','approval_requested','reviewer-a'),notificationKey('workflow-1','assignment-1','approval_requested','reviewer-a'));
  assert.notEqual(notificationKey('workflow-1','assignment-1','approval_requested','reviewer-a'),notificationKey('workflow-2','assignment-1','approval_requested','reviewer-a'));
});
test('workflow cancellation requires a bounded explicit rationale', () => {
  assert.match(validateCancellationRationale('short') || '', /10 to 1000/);
  assert.equal(validateCancellationRationale('Operational owner confirmed the workflow is no longer required.'), null);
  assert.match(validateCancellationRationale('x'.repeat(1001)) || '', /10 to 1000/);
});

test('workflow escalation delay starts after the assignment due date', () => {
  assert.equal(escalationEligibleAt('2026-11-26T10:00:00.000Z', 2), Date.parse('2026-11-28T10:00:00.000Z'));
  assert.equal(escalationEligibleAt(new Date('2026-11-26T10:00:00.000Z'), 0), Date.parse('2026-11-26T10:00:00.000Z'));
  assert.throws(() => escalationEligibleAt('invalid', 2), /timing is invalid/);
  assert.throws(() => escalationEligibleAt('2026-11-26T10:00:00.000Z', -1), /timing is invalid/);
});
test('template configuration allowlists source types, stages, escalation and notifications', () => {
  const valid={sourceModule:'Risks' as const,sourceRecordType:'risk',stages:[stage('parallel',2)],escalationRules:[{afterDays:2,targetRole:'Risk Manager'}],notificationEvents:['approval_requested','workflow_completion']};
  assert.doesNotThrow(()=>validateTemplateConfiguration(valid));
  assert.throws(()=>validateTemplateConfiguration({...valid,sourceRecordType:'policy'}),/source module and record type/);
  assert.throws(()=>validateTemplateConfiguration({...valid,stages:[{...stage('single'),assignedRole:'Risk Manager'}]}),/exactly one/);
  assert.throws(()=>validateTemplateConfiguration({...valid,escalationRules:[{afterDays:0,targetRole:''}]}),/Escalation rules/);
  assert.throws(()=>validateTemplateConfiguration({...valid,notificationEvents:['provider_delivered']}),/notification event/);
});
