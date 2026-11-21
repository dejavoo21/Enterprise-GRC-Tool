import { apiCall } from '../lib/api';
import type { WorkflowState } from '../types/enterpriseWorkflow';

const unwrap = <T>(response: { data:T }) => response.data;
export async function getWorkflowState(personal = false) { return unwrap(await apiCall<{data:WorkflowState}>(`/api/v1/workflows/${personal ? 'my' : 'state'}`)); }
export async function acknowledgeWorkflowAssignment(id:string) { return unwrap(await apiCall<{data:unknown}>(`/api/v1/workflows/assignments/${id}/acknowledge`, { method:'POST' })); }
export async function decideWorkflowAssignment(id:string, decision:'approve'|'reject'|'request_changes', comments:string) { return unwrap(await apiCall<{data:unknown}>(`/api/v1/workflows/assignments/${id}/decision`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({decision,comments,supportingEvidenceIds:[]}) })); }
export async function evaluateWorkflowEscalations() { return unwrap(await apiCall<{data:{evaluated:number;created:number}}>('/api/v1/workflows/escalations/evaluate', { method:'POST' })); }
