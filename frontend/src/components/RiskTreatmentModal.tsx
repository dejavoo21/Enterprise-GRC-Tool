import { TreatmentControlPicker } from './TreatmentControlPicker';
import { RiskScoreProfile } from './RiskScoreProfile';
import { scoreLabel } from '../lib/riskScoreProfile';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import type { RiskIntelligenceRiskSummary } from '../types/riskIntelligence';
import type { RiskTreatmentPlan, RiskTreatmentPlanInput, RiskTreatmentPriority, RiskTreatmentStatus, RiskTreatmentStrategy } from '../types/riskTreatment';
import './RiskTreatmentModal.css';

interface Props { focusProgress?:boolean; isOpen:boolean; risk:RiskIntelligenceRiskSummary|null; treatment?:RiskTreatmentPlan|null; saving:boolean; error?:string|null; onClose:()=>void; onSubmit:(value:RiskTreatmentPlanInput)=>Promise<void>; }
const empty = (risk:RiskIntelligenceRiskSummary|null):RiskTreatmentPlanInput => ({ title:'', description:'', strategy:'mitigate', owner:risk?.owner || '', dueDate:'', status:'planned', progressPercent:0, priority:'medium', approvalStatus:'not_required', notes:'', expectedResidualScore:null, linkedControls:[] });
const label = (value:string) => value.replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase());

export function RiskTreatmentModal({ isOpen, risk, treatment, saving, error, onClose, onSubmit, focusProgress = false }:Props) {
  const [form,setForm]=useState<RiskTreatmentPlanInput>(()=>treatment ? { title:treatment.title, description:treatment.description, strategy:treatment.strategy, owner:treatment.owner, dueDate:treatment.dueDate.slice(0,10), status:treatment.status === 'overdue' ? 'in_progress' : treatment.status, progressPercent:treatment.progressPercent, priority:treatment.priority, approvalStatus:treatment.approvalStatus, expectedResidualScore:treatment.expectedResidualScore, linkedControls:treatment.linkedControls || [], effectivenessRating:treatment.effectivenessRating, evidenceSummary:treatment.evidenceSummary, reviewDate:treatment.reviewDate?.slice(0,10), notes:treatment.notes } : empty(risk)); const [validation,setValidation]=useState<string|null>(null);
  const progressInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen || !focusProgress) return;
    const frame = requestAnimationFrame(() => progressInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, focusProgress]);
  const maximum = risk?.methodology ? risk.methodology.config.likelihoodLevels.length * risk.methodology.config.impactLevels.length : risk?.methodologyId ? null : 25;
  const riskContext=useMemo(()=>risk ? `${risk.riskRef || 'Reference not assigned'} · ${risk.title} · ${Math.round(risk.residualScore)} residual score · ${risk.owner}`:'', [risk]);
  const set=<K extends keyof RiskTreatmentPlanInput>(key:K,value:RiskTreatmentPlanInput[K])=>setForm((current)=>({...current,[key]:value}));
  const submit=async()=>{ let message:string|null=null; if(!form.title.trim()||!form.owner.trim()||!form.dueDate) message='Title, owner, and due date are required.'; else if(Number.isNaN(Date.parse(form.dueDate)) || (form.reviewDate && Number.isNaN(Date.parse(form.reviewDate)))) message='Dates must be valid.'; else if(!Number.isInteger(form.progressPercent)||form.progressPercent<0||form.progressPercent>100) message='Progress must be an integer between 0 and 100.'; else if(form.status==='completed'&&form.progressPercent!==100) message='Completed treatments require 100% progress.'; else if(form.strategy==='accept'&&!form.notes?.trim()) message='Acceptance requires rationale in Notes.'; if (!message && (!treatment || form.expectedResidualScore !== treatment.expectedResidualScore) && form.expectedResidualScore != null && (!Number.isInteger(form.expectedResidualScore) || maximum == null || form.expectedResidualScore < 1 || form.expectedResidualScore > maximum)) message='Expected residual must be a valid integer on the linked risk methodology scale.'; setValidation(message); if(!message) await onSubmit(form); };
  return <Modal accessibleDialog isOpen={isOpen} onClose={onClose} title={treatment ? (focusProgress ? 'Update Treatment Progress' : 'Edit Treatment Plan') : 'Record Treatment Plan'} width="760px" footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving}>{saving?'Saving...':treatment?'Save Changes':'Create Treatment'}</Button></>}>
    <form className="treatmentForm" onSubmit={(e)=>{e.preventDefault();void submit();}}>
      <div className="treatmentRiskContext"><span>Linked risk</span><strong>{riskContext}</strong></div>
      {(validation||error)&&<div className="treatmentFormError" role="alert">{validation||error}</div>}
      {risk && <div className="treatmentFieldWide"><RiskScoreProfile risk={risk}/><p>Target risk is read from the risk record when available. Target editing is not connected in this treatment form. Saving or completing this plan does not update current residual risk.</p></div>}
      <label className="treatmentField treatmentFieldWide"><span>Treatment title *</span><input value={form.title} onChange={(e)=>set('title',e.target.value)} /></label>
      <label className="treatmentField"><span>Strategy *</span><select value={form.strategy} onChange={(e)=>set('strategy',e.target.value as RiskTreatmentStrategy)}>{['mitigate','accept','transfer','avoid','monitor'].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="treatmentField"><span>Owner *</span><input value={form.owner} onChange={(e)=>set('owner',e.target.value)} /></label>
      <label className="treatmentField"><span>Due date *</span><input type="date" value={form.dueDate} onChange={(e)=>set('dueDate',e.target.value)} /></label>
      <label className="treatmentField"><span>Status *</span><select value={form.status} onChange={(e)=>set('status',e.target.value as RiskTreatmentStatus)}>{['draft','planned','in_progress','awaiting_evidence','under_review','completed','accepted','deferred','cancelled'].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="treatmentField"><span>Progress % *</span><input ref={progressInput} type="number" min="0" max="100" step="1" value={form.progressPercent} onChange={(e)=>set('progressPercent',Number(e.target.value))} /></label>
      <label className="treatmentField"><span>Priority *</span><select value={form.priority} onChange={(e)=>set('priority',e.target.value as RiskTreatmentPriority)}>{['critical','high','medium','low'].map((v)=><option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="treatmentField treatmentFieldWide"><span>Description (optional)</span><textarea rows={3} value={form.description} onChange={(e)=>set('description',e.target.value)} /></label>
      <label className="treatmentField"><span>Expected residual after treatment (1-{maximum ?? "unknown"})</span><input type="number" min="1" max={maximum ?? undefined} step="1" value={form.expectedResidualScore??''} onChange={(e)=>set('expectedResidualScore',e.target.value===''?null:Number(e.target.value))} /></label>
      <div className="treatmentField"><span>Expected residual rating after treatment</span><strong>{form.expectedResidualScore == null ? 'Not set' : scoreLabel(risk ?? {}, form.expectedResidualScore)}</strong></div>
      <TreatmentControlPicker value={form.linkedControls || []} onChange={links => set('linkedControls',links)} disabled={saving}/>
      <label className="treatmentField"><span>Review date</span><input type="date" value={form.reviewDate||''} onChange={(e)=>set('reviewDate',e.target.value||undefined)} /></label>
      <label className="treatmentField treatmentFieldWide"><span>Notes {form.strategy==='accept'?'(acceptance rationale required)':''}</span><textarea rows={3} value={form.notes||''} onChange={(e)=>set('notes',e.target.value)} /></label>
    </form>
  </Modal>;
}
