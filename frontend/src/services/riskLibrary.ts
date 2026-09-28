import { apiCall, API_BASE } from '../lib/api';
import type { RiskLibraryTemplate, RiskLibraryTemplateInput } from '../types/riskLibrary';
export async function listRiskLibrary(){return (await apiCall<{data:RiskLibraryTemplate[]}>(`${API_BASE}/risk-library`)).data;}
export async function createRiskLibraryTemplate(input:RiskLibraryTemplateInput){return (await apiCall<{data:RiskLibraryTemplate}>(`${API_BASE}/risk-library`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).data;}
export async function updateRiskLibraryTemplate(id:string,input:Partial<RiskLibraryTemplateInput>){return (await apiCall<{data:RiskLibraryTemplate}>(`${API_BASE}/risk-library/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).data;}
export async function recordRiskLibraryUse(id:string,riskId:string){return (await apiCall<{data:RiskLibraryTemplate}>(`${API_BASE}/risk-library/${encodeURIComponent(id)}/record-use`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({riskId})})).data;}
