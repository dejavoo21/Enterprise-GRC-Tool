import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTreatmentControls } from '../types/treatmentControl.js';
import { validateRiskTreatment } from '../services/riskTreatmentValidation.js';
const valid = { title:'Treatment', strategy:'mitigate' as const, owner:'Owner', dueDate:'2026-12-01', status:'planned' as const, progressPercent:0, priority:'high' as const, approvalStatus:'not_required' as const };
test('accepts multiple control roles and empty selection', () => {
 assert.equal(validateTreatmentControls([]), null);
 assert.equal(validateTreatmentControls([{controlId:'one',role:'Preventive'},{controlId:'two',role:'Recovery'}]), null);
});
test('rejects duplicate, invalid, excessive and malformed links', () => {
 assert.match(validateTreatmentControls([{controlId:'one',role:'Other'},{controlId:'one',role:'Other'}])!, /Duplicate/);
 assert.match(validateTreatmentControls([{controlId:'one',role:'invented'}])!, /role/);
 assert.ok(validateTreatmentControls(null)); assert.ok(validateTreatmentControls([null]));
 assert.ok(validateTreatmentControls([{controlId:'one',role:'Other',implementationNote:'x'.repeat(4001)}]));
 assert.ok(validateTreatmentControls(Array.from({length:101},(_,i)=>({controlId:String(i),role:'Other'}))));
});
test('validates expected residual without changing actual risk', () => {
 for (const score of [1, 12, 25, 100, null]) assert.equal(validateRiskTreatment({...valid,expectedResidualScore:score}),null);
 for (const score of [0,-1,101,1.5,NaN,Infinity]) assert.match(validateRiskTreatment({...valid,expectedResidualScore:score})!, /Expected residual/);
});
test('treatment validation enforces linked control roles', () => {
 assert.match(validateRiskTreatment({...valid,linkedControls:[{controlId:'one',role:'invalid'}]})!, /role/);
});
import type { PoolClient } from 'pg';
import { replaceTreatmentControls, InvalidTreatmentControl } from '../repositories/treatmentControlRepo.js';

test('rejects a missing or foreign-workspace control before any mutation', async () => {
 const calls: {sql:string; values:unknown[]}[] = [];
 const client = {query: async (sql:string, values:unknown[]) => {calls.push({sql,values}); return {rows:[]};}} as unknown as PoolClient;
 await assert.rejects(replaceTreatmentControls(client,'workspace-a','plan-a',[{controlId:'foreign',role:'Other'}]),InvalidTreatmentControl);
 assert.equal(calls.length,1); assert.deepEqual(calls[0].values,['workspace-a',['foreign']]);
 assert.match(calls[0].sql,/workspace_id = \$1/);
});
test('unlink deletes only relationship records and is workspace scoped', async () => {
 const calls: {sql:string; values:unknown[]}[] = [];
 const client = {query: async (sql:string, values:unknown[]) => {calls.push({sql,values}); return {rows:[]};}} as unknown as PoolClient;
 await replaceTreatmentControls(client,'workspace-a','plan-a',[]);
 assert.equal(calls.length,2); assert.match(calls[1].sql,/DELETE FROM risk_treatment_plan_controls/);
 assert.deepEqual(calls[1].values,['workspace-a','plan-a',[]]);
});
test('link replacement preserves parameterized role and note fields', async () => {
 const calls: {sql:string; values:unknown[]}[] = [];
 const client = {query: async (sql:string, values:unknown[]) => {calls.push({sql,values}); return {rows:sql.startsWith('SELECT')?[{id:'control-a'}]:[]};}} as unknown as PoolClient;
 await replaceTreatmentControls(client,'workspace-a','plan-a',[{controlId:'control-a',role:'Preventive',implementationNote:'Delivery note'}],'actor-a');
 assert.equal(calls.length,3); assert.match(calls[2].sql,/ON CONFLICT/);
 assert.deepEqual(calls[2].values.slice(1),['workspace-a','plan-a','control-a','Preventive','Delivery note','actor-a']);
});

test('treatment required fields, progress, acceptance and completion remain enforced', () => {
 assert.equal(validateRiskTreatment({...valid, description:''}), null);
 for (const field of ['title','owner','dueDate'] as const) assert.ok(validateRiskTreatment({...valid,[field]:''}));
 for (const progressPercent of [-1,101,0.5,NaN]) assert.match(validateRiskTreatment({...valid,progressPercent})!, /Progress/);
 assert.match(validateRiskTreatment({...valid,strategy:'accept',notes:' '})!, /rationale/);
 assert.equal(validateRiskTreatment({...valid,strategy:'accept',notes:'Approved rationale'}), null);
 assert.match(validateRiskTreatment({...valid,status:'completed',progressPercent:99})!, /100/);
 assert.equal(validateRiskTreatment({...valid,status:'completed',progressPercent:100}), null);
 assert.ok(validateRiskTreatment({...valid,reviewDate:'invalid'}));
});
