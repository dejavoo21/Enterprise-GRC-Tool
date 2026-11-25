import { useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { theme } from '../theme';
import type { BusinessContinuityState } from '../types/resilience';

export type BcmEntryKind = 'bia' | 'service' | 'plan' | 'exercise' | 'corrective' | 'crisis' | 'dependency' | 'scenario';

interface Props {
  kind: BcmEntryKind | null;
  state: BusinessContinuityState;
  onClose: () => void;
  onSubmit: (kind: BcmEntryKind, payload: Record<string, unknown>) => Promise<void>;
}

const inputStyle = { width: '100%', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] };
const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}><span>{label}</span>{children}</label>;
}

function Text({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <Field label={label}><input aria-label={label} style={inputStyle} type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} /></Field>;
}

export function BcmEntryModal({ kind, state, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!busy) onClose(); };
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const selectedSource = useMemo(() => [...state.biaProcesses.map((item) => ({ type: 'process', id: item.id, name: item.processName })), ...state.criticalServices.map((item) => ({ type: 'service', id: item.id, name: item.serviceName }))].find((item) => item.id === form.sourceId), [form.sourceId, state.biaProcesses, state.criticalServices]);
  if (!kind) return null;

  const submit = async () => {
    if (busy) return;
    setError(null);
    const number = (key: string) => Number(form[key] || 0);
    if (kind === 'exercise') {
      const score = Number(form.score);
      if (!form.exerciseDate || !form.scenario?.trim() || form.score === '' || form.score === undefined || !Number.isFinite(score) || score < 0 || score > 100) {
        setError('Record the exercise date, scenario and a performance score from 0 to 100.');
        return;
      }
    }
    let payload: Record<string, unknown>;
    if (kind === 'bia') payload = { processName: form.name, processOwner: form.owner, businessUnit: form.businessUnit, criticality: form.criticality || 'high', impactRating: form.impactRating || 'major', recoveryPriority: form.recoveryPriority || 'tier_2', productsServices: split(form.productsServices || ''), dependencies: split(form.dependencies || ''), rtoHours: number('rto'), rpoHours: number('rpo'), maximumTolerableDowntimeHours: number('mtd'), maximumDataLossHours: number('mdl'), status: 'draft' };
    else if (kind === 'service') payload = { serviceName: form.name, owner: form.owner, businessUnit: form.businessUnit, criticality: form.criticality || 'high', biaProcessIds: form.biaProcessId ? [form.biaProcessId] : [], recoveryPlanId: form.recoveryPlanId || null, status: 'draft', impactToleranceHours: number('impactTolerance'), recoveryCoveragePercent: 0, doraRelevant: form.doraRelevant === 'true' };
    else if (kind === 'plan') payload = { title: form.name, planType: form.planType || 'technology_recovery', owners: split(form.owners || ''), objectives: split(form.objectives || ''), steps: split(form.steps || ''), targetRtoHours: number('rto'), targetRpoHours: number('rpo'), maximumTolerableDowntimeHours: number('mtd'), recoveryReadinessPercent: 0, status: 'draft', nextReviewAt: form.nextReview || null };
    else if (kind === 'exercise') payload = { title: form.name, exerciseType: form.exerciseType || 'tabletop', exerciseDate: new Date(form.exerciseDate).toISOString(), participants: split(form.participants || ''), scenario: form.scenario.trim(), resultSummary: form.resultSummary, findings: split(form.findings || ''), lessonsLearned: split(form.lessons || ''), correctiveActions: [], performanceScore: number('score'), status: 'completed', linkedPlanIds: form.recoveryPlanId ? [form.recoveryPlanId] : [] };
    else if (kind === 'corrective') payload = { exerciseId: form.exerciseId, title: form.name, description: form.description, owner: form.owner, priority: form.priority || 'medium', status: 'open', dueDate: form.dueDate || null, evidenceIds: [] };
    else if (kind === 'crisis') payload = { eventTitle: form.name, owner: form.owner, severity: form.severity || 'high', status: 'declared', communications: [], stakeholders: split(form.stakeholders || ''), actions: split(form.actions || ''), escalations: [], lessonsLearned: [], openedAt: new Date().toISOString() };
    else if (kind === 'dependency') { const plan = state.recoveryPlans.find((item) => item.id === form.recoveryPlanId); payload = { sourceType: selectedSource?.type, sourceId: selectedSource?.id, sourceName: selectedSource?.name, targetType: 'recovery_plan', targetId: plan?.id, targetName: plan?.title, dependencyKind: selectedSource?.type === 'service' ? 'service_plan' : 'process_plan', criticality: form.criticality || 'high', status: 'active' }; }
    else payload = { title: form.name, criticalServiceId: form.serviceId || null, disruptionScenario: form.scenario, impactToleranceHours: number('impactTolerance'), operationalCapacityPercent: number('capacity'), recoveryCapabilityPercent: number('capability'), resilienceRating: number('rating'), status: 'active', doraScenario: form.doraRelevant === 'true' };
    if (!form.name && kind !== 'dependency') { setError('Complete the required name or title.'); return; }
    try { setBusy(true); await onSubmit(kind, payload); setForm({}); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save the record.'); } finally { setBusy(false); }
  };

  const title = ({ bia: 'Add BIA process', service: 'Register critical service', plan: 'Create recovery plan', exercise: 'Log recovery exercise', corrective: 'Create exercise corrective action', crisis: 'Declare crisis event', dependency: 'Map recovery dependency', scenario: 'Create resilience scenario' } as const)[kind];
  const select = (label: string, key: string, options: Array<[string, string]>) => <Field label={label}><select aria-label={label} style={inputStyle} value={form[key] || ''} onChange={(event) => set(key, event.target.value)}><option value="">Select</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>;

  return <Modal accessibleDialog isOpen onClose={requestClose} title={title} width="760px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Saving...' : 'Save record'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      {kind !== 'dependency' ? <Text label={kind === 'bia' || kind === 'service' ? 'Name' : 'Title'} value={form.name || ''} onChange={(value) => set('name', value)} required /> : null}
      {kind === 'bia' ? <><div style={gridStyle}><Text label="Process owner" value={form.owner || ''} onChange={(value) => set('owner', value)} required /><Text label="Business unit" value={form.businessUnit || ''} onChange={(value) => set('businessUnit', value)} required />{select('Criticality', 'criticality', [['critical','Critical'],['high','High'],['medium','Medium'],['low','Low']])}{select('Recovery priority', 'recoveryPriority', [['tier_1','Tier 1'],['tier_2','Tier 2'],['tier_3','Tier 3'],['tier_4','Tier 4']])}</div><Text label="Products/services (comma separated)" value={form.productsServices || ''} onChange={(value) => set('productsServices', value)} /><Text label="Dependencies (comma separated)" value={form.dependencies || ''} onChange={(value) => set('dependencies', value)} /><div style={gridStyle}><Text label="RTO hours" type="number" value={form.rto || ''} onChange={(value) => set('rto', value)} /><Text label="RPO hours" type="number" value={form.rpo || ''} onChange={(value) => set('rpo', value)} /><Text label="Maximum tolerable downtime hours" type="number" value={form.mtd || ''} onChange={(value) => set('mtd', value)} /><Text label="Maximum data loss hours" type="number" value={form.mdl || ''} onChange={(value) => set('mdl', value)} /></div></> : null}
      {kind === 'service' ? <><div style={gridStyle}><Text label="Owner" value={form.owner || ''} onChange={(value) => set('owner', value)} required /><Text label="Business unit" value={form.businessUnit || ''} onChange={(value) => set('businessUnit', value)} required />{select('Criticality', 'criticality', [['critical','Critical'],['high','High'],['medium','Medium'],['low','Low']])}<Text label="Impact tolerance hours" type="number" value={form.impactTolerance || ''} onChange={(value) => set('impactTolerance', value)} /></div><div style={gridStyle}>{select('Source BIA process', 'biaProcessId', state.biaProcesses.map((item) => [item.id, item.processName]))}{select('Recovery plan (optional)', 'recoveryPlanId', state.recoveryPlans.map((item) => [item.id, item.title]))}</div></> : null}
      {kind === 'plan' ? <><div style={gridStyle}>{select('Plan type', 'planType', [['technology_recovery','Technology recovery'],['cyber_recovery','Cyber recovery'],['vendor_failure','Vendor failure'],['facility_loss','Facility loss'],['data_recovery','Data recovery'],['crisis_response','Crisis response']])}<Text label="Owners (comma separated)" value={form.owners || ''} onChange={(value) => set('owners', value)} required /></div><Text label="Objectives (comma separated)" value={form.objectives || ''} onChange={(value) => set('objectives', value)} required /><Text label="Recovery steps (comma separated)" value={form.steps || ''} onChange={(value) => set('steps', value)} required /><div style={gridStyle}><Text label="Target RTO hours" type="number" value={form.rto || ''} onChange={(value) => set('rto', value)} /><Text label="Target RPO hours" type="number" value={form.rpo || ''} onChange={(value) => set('rpo', value)} /><Text label="Maximum tolerable downtime hours" type="number" value={form.mtd || ''} onChange={(value) => set('mtd', value)} /><Text label="Next review" type="date" value={form.nextReview || ''} onChange={(value) => set('nextReview', value)} /></div></> : null}
      {kind === 'exercise' ? <><div style={gridStyle}>{select('Exercise type', 'exerciseType', [['tabletop','Tabletop'],['simulation','Simulation'],['technical_recovery_test','Technical recovery test'],['cyber_exercise','Cyber exercise'],['vendor_exercise','Vendor exercise'],['operational_exercise','Operational exercise']])}<Text label="Exercise date" type="datetime-local" required value={form.exerciseDate || ''} onChange={(value) => set('exerciseDate', value)} />{select('Linked recovery plan', 'recoveryPlanId', state.recoveryPlans.map((item) => [item.id, item.title]))}<Text label="Performance score" type="number" required value={form.score || ''} onChange={(value) => set('score', value)} /></div><Text label="Participants (comma separated)" value={form.participants || ''} onChange={(value) => set('participants', value)} /><Field label="Scenario"><textarea aria-label="Scenario" required style={inputStyle} rows={3} value={form.scenario || ''} onChange={(event) => set('scenario', event.target.value)} /></Field><Field label="Result summary"><textarea aria-label="Result summary" style={inputStyle} rows={3} value={form.resultSummary || ''} onChange={(event) => set('resultSummary', event.target.value)} /></Field><Text label="Findings (comma separated)" value={form.findings || ''} onChange={(value) => set('findings', value)} /></> : null}
      {kind === 'corrective' ? <>{select('Source exercise', 'exerciseId', state.exercises.map((item) => [item.id, item.title]))}<Field label="Description"><textarea aria-label="Description" style={inputStyle} rows={3} value={form.description || ''} onChange={(event) => set('description', event.target.value)} /></Field><div style={gridStyle}><Text label="Owner" value={form.owner || ''} onChange={(value) => set('owner', value)} required />{select('Priority', 'priority', [['critical','Critical'],['high','High'],['medium','Medium'],['low','Low']])}<Text label="Due date" type="date" value={form.dueDate || ''} onChange={(value) => set('dueDate', value)} /></div></> : null}
      {kind === 'crisis' ? <><div style={gridStyle}><Text label="Owner" value={form.owner || ''} onChange={(value) => set('owner', value)} required />{select('Severity', 'severity', [['critical','Critical'],['high','High'],['medium','Medium']])}</div><Text label="Stakeholders (comma separated)" value={form.stakeholders || ''} onChange={(value) => set('stakeholders', value)} /><Text label="Initial actions (comma separated)" value={form.actions || ''} onChange={(value) => set('actions', value)} /></> : null}
      {kind === 'dependency' ? <><div style={gridStyle}>{select('Source process/service', 'sourceId', [...state.biaProcesses.map((item) => [item.id, item.processName] as [string,string]), ...state.criticalServices.map((item) => [item.id, item.serviceName] as [string,string])])}{select('Recovery plan', 'recoveryPlanId', state.recoveryPlans.map((item) => [item.id, item.title]))}</div>{!selectedSource || !form.recoveryPlanId ? <div style={{ color: theme.colors.text.secondary }}>Select existing records. No placeholder relationship will be created.</div> : null}</> : null}
      {kind === 'scenario' ? <>{select('Critical service', 'serviceId', state.criticalServices.map((item) => [item.id, item.serviceName]))}<Field label="Disruption scenario"><textarea aria-label="Disruption scenario" style={inputStyle} rows={3} value={form.scenario || ''} onChange={(event) => set('scenario', event.target.value)} /></Field><div style={gridStyle}><Text label="Impact tolerance hours" type="number" value={form.impactTolerance || ''} onChange={(value) => set('impactTolerance', value)} /><Text label="Operating capacity %" type="number" value={form.capacity || ''} onChange={(value) => set('capacity', value)} /><Text label="Recovery capability %" type="number" value={form.capability || ''} onChange={(value) => set('capability', value)} /><Text label="Resilience rating" type="number" value={form.rating || ''} onChange={(value) => set('rating', value)} /></div></> : null}
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
    </fieldset>
  </Modal>;
}
