import { apiCall } from '../lib/api';
import type { WorkflowInstance, WorkflowSourceOption, WorkflowState, WorkflowTemplate } from '../types/enterpriseWorkflow';

const unwrap = <T>(response: { data:T }) => response.data;
export async function getWorkflowState(personal = false) { return unwrap(await apiCall<{data:WorkflowState}>(`/api/v1/workflows/${personal ? 'my' : 'state'}`)); }
export async function acknowledgeWorkflowAssignment(id:string) { return unwrap(await apiCall<{data:unknown}>(`/api/v1/workflows/assignments/${id}/acknowledge`, { method:'POST' })); }
export async function decideWorkflowAssignment(id:string, decision:'approve'|'reject'|'request_changes', comments:string) { return unwrap(await apiCall<{data:unknown}>(`/api/v1/workflows/assignments/${id}/decision`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({decision,comments,supportingEvidenceIds:[]}) })); }
export async function evaluateWorkflowEscalations() { return unwrap(await apiCall<{data:{evaluated:number;created:number}}>('/api/v1/workflows/escalations/evaluate', { method:'POST' })); }
export async function publishWorkflowSource(id:string) { return unwrap(await apiCall<{data:{workflowId:string;documentId:string;status:string;changed:boolean}}>(`/api/v1/workflows/${id}/publish-source`, { method:'POST' })); }
export async function updateWorkflowNotification(id:string, status:'read'|'archived') { return unwrap(await apiCall<{data:unknown}>(`/api/v1/workflows/notifications/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })); }
export async function getWorkflowInitiationOptions(templateId:string) { return unwrap(await apiCall<{data:{template:WorkflowTemplate;records:WorkflowSourceOption[];defaultOwnerUserId:string}}>(`/api/v1/workflows/initiation-options/${encodeURIComponent(templateId)}`)); }
export async function createWorkflow(input:{templateId:string;sourceRecordId:string;ownerUserId:string;effectiveDate?:string;reviewDate?:string}) { return unwrap(await apiCall<{data:WorkflowInstance}>('/api/v1/workflows', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input) })); }
export async function submitWorkflow(id:string) { return unwrap(await apiCall<{data:WorkflowInstance}>(`/api/v1/workflows/${id}/submit`, { method:'POST' })); }
export async function createWorkflowTemplate(input:{name:string;sourceModule:string;sourceRecordType:string;assignedRole:string;dueDays:number;independentReview:boolean;evidenceRequired:boolean}) {
  return unwrap(await apiCall<{data:unknown}>('/api/v1/workflows/templates', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    name:input.name, sourceModule:input.sourceModule, sourceRecordType:input.sourceRecordType, status:'active',
    stages:[{id:'stage-1',name:'Review and approval',order:1,mode:'single',kind:'approval',assignedRole:input.assignedRole,assignedUserIds:[],quorum:1,dueDays:input.dueDays,independentReview:input.independentReview,evidenceRequired:input.evidenceRequired}],
    escalationRules:[], notificationEvents:['assignment_created','decision_recorded'],
  }) }));
}
