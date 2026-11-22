import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDecisionAllowed, assertSequentialTurn, nextWorkflowStatus, notificationKey, stageSatisfied, validateStages, WorkflowRuleError } from '../services/enterpriseWorkflowRules.js';
import type { WorkflowAssignment, WorkflowStageDefinition } from '../types/enterpriseWorkflow.js';

const stage = (mode: WorkflowStageDefinition['mode'], quorum = 1): WorkflowStageDefinition => ({ id:'stage-1', name:'Review', order:1, mode, kind:'approval', assignedUserIds:['reviewer-a','reviewer-b'], quorum, dueDays:3, independentReview:false, evidenceRequired:false });
const assignment = (sequenceIndex:number, decision?:WorkflowAssignment['decision']): WorkflowAssignment => ({ id:`assignment-${sequenceIndex}`,workspaceId:'workspace-a',workflowId:'workflow-1',stageId:'stage-1',stageOrder:1,sequenceIndex,assignedUserId:`reviewer-${sequenceIndex}`,requestedByUserId:'requester',assignedAt:'2026-11-21T00:00:00.000Z',status:decision==='approve'?'approved':'acknowledged',decision,supportingEvidenceIds:[] });

test('validates ordered workflow stages and rejects duplicate order', () => {
  assert.deepEqual(validateStages([{...stage('single'),order:2},{...stage('single'),id:'first',order:1}]).map(item=>item.order),[1,2]);
  assert.throws(()=>validateStages([stage('single'),{...stage('single'),id:'duplicate'}]),WorkflowRuleError);
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
test('rejection and changes requested produce terminal and return states', () => {
  assert.equal(nextWorkflowStatus('reject'),'rejected');
  assert.equal(nextWorkflowStatus('request_changes'),'changes_requested');
});
test('notification keys are deterministic and workspace-safe inputs remain explicit', () => {
  assert.equal(notificationKey('workflow-1','assignment-1','approval_requested','reviewer-a'),notificationKey('workflow-1','assignment-1','approval_requested','reviewer-a'));
  assert.notEqual(notificationKey('workflow-1','assignment-1','approval_requested','reviewer-a'),notificationKey('workflow-2','assignment-1','approval_requested','reviewer-a'));
});
