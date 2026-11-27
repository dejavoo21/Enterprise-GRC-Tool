import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { theme } from '../theme';
import { RegulatoryObligationLinkSelector, type RegulatoryObligationLinks } from './RegulatoryObligationLinkSelector';

export type RegulatoryEntryKind = 'requirement' | 'change' | 'obligation' | 'task';

export function RegulatoryEntryModal({ kind, isOpen, requirements, changes, onClose, onSubmit }: {
  kind: RegulatoryEntryKind | null;
  isOpen: boolean;
  requirements: Array<{ id: string; requirementId: string; regulationName: string }>;
  changes: Array<{ id: string; regulationName: string }>;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [obligationLinks, setObligationLinks] = useState<RegulatoryObligationLinks>({ linkedControls: [], complianceEvidence: [] });
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const submitSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!saving && !submitLock.current) onClose(); };
  useEffect(() => {
    submitSequence.current += 1;
    submitLock.current = false;
    setSaving(false);
    if (isOpen) { setForm({}); setObligationLinks({ linkedControls: [], complianceEvidence: [] }); setError(null); }
  }, [isOpen, kind]);
  if (!kind) return null;
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const required: Record<RegulatoryEntryKind, string[]> = {
    requirement: ['requirementId','regulationName','title','description','jurisdiction','regulator','category','owner','businessUnit'],
    change: ['regulationName','changeSummary','versionTag','reviewer','changeDate'],
    obligation: ['sourceRequirementId','title','description','owner','dueDate','reviewFrequency'],
    task: ['changeLogId','title','owner','dueDate','workflowStage'],
  };
  const canSave = required[kind].every((key) => form[key]?.trim());
  const field = (key: string, label: string, type = 'text') => <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>{label}<input type={type} value={form[key] || ''} onChange={(e) => set(key, e.target.value)} required style={{ padding: 10, border: `1px solid ${theme.colors.border}`, borderRadius: 8 }} /></label>;
  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    const sequence = ++submitSequence.current;
    setSaving(true);
    setError(null);
    try {
      const csv = (value?: string) => value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
      const payload: Record<string, unknown> = { ...form };
      ['linkedControls','linkedPolicies','linkedRisks','linkedEvidence','affectedControls','affectedPolicies','affectedRisks','affectedVendors','affectedAssets','affectedAiSystems','requiredActions'].forEach((key) => { if (key in form) payload[key] = csv(form[key]); });
      if (kind === 'requirement') Object.assign(payload, { status: 'draft', complianceRating: null, riskRating: null, frameworkCodes: csv(form.frameworkCodes) });
      if (kind === 'change') Object.assign(payload, { approvalStatus: 'pending', impactAssessment: '', changeDate: form.changeDate || new Date().toISOString() });
      if (kind === 'obligation') Object.assign(payload, { status: 'open', obligationType: 'regulatory', linkedControls: [...obligationLinks.linkedControls], complianceEvidence: [...obligationLinks.complianceEvidence] });
      if (kind === 'task') Object.assign(payload, { status: 'open' });
      await onSubmit(payload);
      if (sequence === submitSequence.current) onClose();
    } catch (reason) {
      if (sequence === submitSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to save the regulatory record.');
      }
    } finally {
      if (sequence === submitSequence.current) {
        submitLock.current = false;
        setSaving(false);
      }
    }
  };
  return <Modal isOpen={isOpen} onClose={requestClose} title={`Add regulatory ${kind}`} accessibleDialog width="720px" footer={<><Button variant="secondary" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={submit} disabled={saving || !canSave}>{saving ? 'Saving...' : 'Review and save'}</Button></>}>
    <fieldset disabled={saving} aria-busy={saving} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      {error ? <div role="alert" style={{ gridColumn: '1 / -1', color: theme.colors.semantic.danger }}>{error}</div> : null}
      {kind === 'requirement' && <>{field('requirementId','Requirement ID')}{field('regulationName','Regulation')}{field('title','Title')}{field('jurisdiction','Jurisdiction')}{field('regulator','Regulator')}{field('category','Category')}{field('owner','Owner')}{field('businessUnit','Business unit')}{field('description','Description')}{field('frameworkCodes','Framework codes (comma-separated)')}</>}
      {kind === 'change' && <><label>Source requirement (optional)<select value={form.requirementId || ''} onChange={(e)=>set('requirementId',e.target.value)}><option value="">None</option>{requirements.map((r)=><option key={r.id} value={r.requirementId}>{r.requirementId} · {r.regulationName}</option>)}</select></label>{field('regulationName','Regulation')}{field('versionTag','Version/source reference')}{field('changeSummary','Change summary')}{field('reviewer','Reviewer')}{field('changeDate','Change date','date')}<label>Severity<select value={form.severity || 'medium'} onChange={(e)=>set('severity',e.target.value)}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>{field('requiredActions','Required actions (comma-separated)')}</>}
      {kind === 'obligation' && <><label>Source requirement<select value={form.sourceRequirementId || ''} onChange={(e)=>set('sourceRequirementId',e.target.value)} required><option value="">Select</option>{requirements.map((r)=><option key={r.id} value={r.requirementId}>{r.requirementId} · {r.regulationName}</option>)}</select></label>{field('title','Title')}{field('description','Description')}{field('owner','Owner')}{field('dueDate','Due date','date')}{field('reviewFrequency','Review frequency')}<RegulatoryObligationLinkSelector active={isOpen && kind === 'obligation'} value={obligationLinks} onChange={(field, value) => setObligationLinks(current => ({ ...current, [field]: value }))} disabled={saving} /></>}
      {kind === 'task' && <><label>Regulatory change<select value={form.changeLogId || ''} onChange={(e)=>set('changeLogId',e.target.value)} required><option value="">Select</option>{changes.map((c)=><option key={c.id} value={c.id}>{c.regulationName}</option>)}</select></label>{field('title','Title')}{field('owner','Owner')}{field('dueDate','Due date','date')}{field('workflowStage','Workflow stage')}{field('escalation','Escalation notes')}</>}
    </fieldset>
  </Modal>;
}
