import { useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import type { RiskIntelligenceRiskSummary } from '../types/riskIntelligence';
import type { RiskTreatmentPlan, RiskTreatmentPlanInput, RiskTreatmentPriority, RiskTreatmentStatus, RiskTreatmentStrategy } from '../types/riskTreatment';
import './RiskTreatmentModal.css';

interface Props { isOpen:boolean; risk:RiskIntelligenceRiskSummary|null; treatment?:RiskTreatmentPlan|null; saving:boolean; error?:string|null; onClose:()=>void; onSubmit:(value:RiskTreatmentPlanInput)=>Promise<void>; }
const empty = (risk:RiskIntelligenceRiskSummary|null):RiskTreatmentPlanInput => ({ title:'', description:'', strategy:'mitigate', owner:risk?.owner || '', dueDate:'', status:'planned', progressPercent:0, priority:'medium', approvalStatus:'not_required', notes:'', expectedResidualScore:risk ? Math.round(risk.residualScore) : undefined });
const label = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase());

export function RiskTreatmentModal({ isOpen, risk, treatment, saving, error, onClose, onSubmit }:Props) {
  const [form,setForm]=useState<RiskTreatmentPlanInput>(()=>treatment ? { title:treatment.title, description:treatment.description, strategy:treatment.strategy, owner:treatment.owner, dueDate:treatment.dueDate.slice(0,10), status:treatment.status === 'overdue' ? 'in_progress' : treatment.status, progressPercent:treatment.progressPercent, priority:treatment.priority, approvalStatus:treatment.approvalStatus, expectedResidualScore:treatment.expectedResidualScore, effectivenessRating:treatment.effectivenessRating, evidenceSummary:treatment.evidenceSummary, reviewDate:treatment.reviewDate?.slice(0,10), notes:treatment.notes } : empty(risk)); const [validation,setValidation]=useState<string|null>(null);
  const riskContext=useMemo(()=>risk ? `${risk.title} · ${Math.round(risk.residualScore)} residual score · ${risk.owner}`:'', [risk]);
  const set=<K extends keyof RiskTreatmentPlanInput>(key:K,value:RiskTreatmentPlanInput[K])=>setForm((current)=>({...current,[key]:value}));
  const submit=async()=>{ let message:string|null=null; if(!form.title.trim()||!form.owner.trim()||!form.dueDate||!form.description.trim()) message='Title, owner, due date, and description are required.'; else if(form.progressPercent<0||form.progressPercent>100) message='Progress must be between 0 and 100.'; else if(form.status==='completed'&&form.progressPercent!==100) message='Completed treatments require 100% progress.'; else if(form.strategy==='accept'&&!form.notes?.trim()) message='Acceptance requires rationale in Notes.'; setValidation(message); if(!message) await onSubmit(form); };
  return <Modal isOpen={isOpen} onClose={onClose} title={treatment?'Edit Treatment Plan':'Record Treatment Plan'} width="760px" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving}>{saving?'Saving...':treatment?'Save Changes':'Create Treatment'}</Button></>}>
    <form className="treatmentForm" onSubmit={(e)=>{e.preventDefault();void submit();}}>
      <div className="treatmentRiskContext"><span>Linked risk</span><strong>{riskContext}</strong></div>
      {(validation||error)&&<div className="treatmentFormError" role="alert">{validation||error}</div>}
      <label className="treatmentField treatmentFieldWide"><span>Treatment title *</span><input value={form.title} onChange={(e)=>set('title',e.target.value)} autoFocus /></label>
      <label className="treatmentField"><span>Strategy *</span><select value={form.strategy} onChange={(e)=>set('strategy',e.target.value as RiskTreatmentStrategy)}>{['mitigate','accept','transfer','avoid','monitor'].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="treatmentField"><span>Owner *</span><input value={form.owner} onChange={(e)=>set('owner',e.target.value)} /></label>
      <label className="treatmentField"><span>Due date *</span><input type="date" value={form.dueDate} onChange={(e)=>set('dueDate',e.target.value)} /></label>
      <label className="treatmentField"><span>Status *</span><select value={form.status} onChange={(e)=>set('status',e.target.value as RiskTreatmentStatus)}>{['draft','planned','in_progress','awaiting_evidence','under_review','completed','accepted','deferred','cancelled'].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="treatmentField"><span>Progress % *</span><input type="number" min="0" max="100" step="1" value={form.progressPercent} onChange={(e)=>set('progressPercent',Number(e.target.value))} /></label>
      <label className="treatmentField"><span>Priority *</span><select value={form.priority} onChange={(e)=>set('priority',e.target.value as RiskTreatmentPriority)}>{['critical','high','medium','low'].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="treatmentField treatmentFieldWide"><span>Description *</span><textarea rows={3} value={form.description} onChange={(e)=>set('description',e.target.value)} /></label>
      <label className="treatmentField"><span>Expected residual score</span><input type="number" min="0" max="25" value={form.expectedResidualScore??''} onChange={(e)=>set('expectedResidualScore',e.target.value===''?undefined:Number(e.target.value))} /></label>
      <label className="treatmentField"><span>Review date</span><input type="date" value={form.reviewDate||''} onChange={(e)=>set('reviewDate',e.target.value||undefined)} /></label>
      <label className="treatmentField treatmentFieldWide"><span>Notes {form.strategy==='accept'?'(acceptance rationale required)':''}</span><textarea rows={3} value={form.notes||''} onChange={(e)=>set('notes',e.target.value)} /></label>
    </form>
  </Modal>;
}
