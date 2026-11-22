import { createHash } from 'node:crypto';

export type QualitySeverity='low'|'medium'|'high'|'critical';
export type QualityFinding={ruleId:string;module:'Risk Management';entityType:'risk';sourceRecordId:string;sourceReference?:string;sourceTitle:string;category:string;severity:QualitySeverity;description:string;recommendedCorrection:string;assignedOwner?:string;fingerprint:string};
export type QualityRisk={id:string;riskRef?:string;title:string;owner?:string;ciaImpacts?:string[];nextReviewDate?:string;methodologyId?:string|null;methodologyVersion?:number|null;status?:string};
export const QUALITY_RULES=[
  {id:'risk-owner-required',category:'Ownership',severity:'high' as const,name:'Risk owner is assigned',description:'Active enterprise risks require an accountable owner.',mandatory:true},
  {id:'risk-cia-required',category:'Completeness',severity:'medium' as const,name:'CIA impact is recorded',description:'Risk impact context should identify applicable confidentiality, integrity, or availability dimensions.',mandatory:false},
  {id:'risk-methodology-pinning',category:'Governance Compliance',severity:'high' as const,name:'Methodology version is pinned',description:'Scored risks must retain their methodology and version basis.',mandatory:true},
  {id:'risk-review-stale',category:'Timeliness',severity:'high' as const,name:'Risk review is current',description:'Persisted next-review dates must not be overdue.',mandatory:false},
  {id:'risk-reference-unique',category:'Uniqueness',severity:'critical' as const,name:'Risk reference is unique',description:'Risk Ref IDs must be unique within a workspace.',mandatory:true},
  {id:'risk-title-duplicate',category:'Uniqueness',severity:'medium' as const,name:'Risk title is distinguishable',description:'Normalised duplicate titles require human review.',mandatory:false},
] as const;

const normalise=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
const fingerprint=(ruleId:string,id:string)=>createHash('sha256').update(`${ruleId}:${id}`).digest('hex');
export function evaluateRiskQuality(risks:QualityRisk[], now=new Date()):QualityFinding[]{
  const titleCounts=new Map<string,number>();const refCounts=new Map<string,number>();
  risks.forEach(r=>{const title=normalise(r.title);if(title)titleCounts.set(title,(titleCounts.get(title)||0)+1);if(r.riskRef)refCounts.set(r.riskRef,(refCounts.get(r.riskRef)||0)+1);});
  const findings:QualityFinding[]=[]; const add=(risk:QualityRisk,ruleId:string,category:string,severity:QualitySeverity,description:string,correction:string)=>findings.push({ruleId,module:'Risk Management',entityType:'risk',sourceRecordId:risk.id,sourceReference:risk.riskRef,sourceTitle:risk.title,category,severity,description,recommendedCorrection:correction,assignedOwner:risk.owner,fingerprint:fingerprint(ruleId,risk.id)});
  for(const risk of risks){
    if(!risk.owner?.trim())add(risk,'risk-owner-required','Ownership','high','Risk has no accountable owner.','Assign an authorised workspace member through the Risk Register.');
    if(!risk.ciaImpacts?.length)add(risk,'risk-cia-required','Completeness','medium','Risk has no CIA impact recorded.','Review the scenario and record applicable CIA impacts.');
    if(!risk.methodologyId||risk.methodologyVersion==null)add(risk,'risk-methodology-pinning','Governance Compliance','high','Risk has no pinned methodology/version and is using legacy compatibility scoring.','Review the risk methodology basis; do not silently rescore historical values.');
    if(risk.nextReviewDate&&!Number.isNaN(Date.parse(risk.nextReviewDate))&&Date.parse(risk.nextReviewDate)<now.getTime())add(risk,'risk-review-stale','Timeliness','high','Risk next-review date is overdue.','Open the Risk Register and complete an authorised review.');
    if(risk.riskRef&&(refCounts.get(risk.riskRef)||0)>1)add(risk,'risk-reference-unique','Uniqueness','critical',`Risk Ref ID ${risk.riskRef} is duplicated.`,'Escalate for controlled reference reconciliation; do not overwrite either record.');
    if((titleCounts.get(normalise(risk.title))||0)>1)add(risk,'risk-title-duplicate','Uniqueness','medium','Another risk has the same normalised title.','Compare records and record a duplicate decision; do not merge automatically.');
  }
  return findings;
}

export const QUALITY_STATUSES=['Detected','Under Review','Assigned','Correction Proposed','Approved','Resolved','False Positive','Accepted Exception','Deferred','Reopened'] as const;
export function validateQualityTransition(from:string,to:string):string|null{
  const allowed:Record<string,string[]>={Detected:['Under Review','Assigned','False Positive','Deferred'], 'Under Review':['Assigned','Correction Proposed','False Positive','Accepted Exception','Deferred'],Assigned:['Correction Proposed','Deferred'], 'Correction Proposed':['Approved','Under Review'],Approved:['Resolved','Under Review'],Resolved:['Reopened'],'False Positive':['Reopened'],'Accepted Exception':['Reopened'],Deferred:['Reopened','Under Review'],Reopened:['Under Review','Assigned']};
  return allowed[from]?.includes(to)?null:`Cannot move a quality issue from ${from} to ${to}.`;
}
