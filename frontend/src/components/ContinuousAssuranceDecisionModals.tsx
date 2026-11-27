import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { EvidenceItem } from '../types/evidence';
import type { Control } from '../types/control';
import type { AssuranceException, AutomatedTest, TestResultStatus } from '../types/continuousAssurance';
import { Button } from './Button';
import { GovernanceControlSelect } from './GovernanceControlSelect';
import { Modal } from './Modal';

const fieldStyle = {
  width: '100%',
  padding: theme.spacing[3],
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  background: theme.colors.surface,
  color: theme.colors.text.main,
};

function FormError({ message }: { message: string | null }) {
  return message ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{message}</div> : null;
}

type Api<T> = { data: T | null; error: { message: string } | null };

function EvidenceMetadataSelector({ value, onChange, disabled, required }: { value: string[]; onChange: (value: string[]) => void; disabled: boolean; required: boolean }) {
  const { currentWorkspace } = useWorkspace();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  useEffect(() => {
    const sequence = ++requestSequence.current;
    const workspaceId = currentWorkspace.id;
    void apiCall<Api<EvidenceItem[]>>('/api/v1/evidence').then(result => {
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      if (result.error) throw new Error(result.error.message);
      setItems(result.data || []);
    }).catch(cause => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setError(cause instanceof Error ? cause.message : 'Evidence metadata could not be loaded.');
    }).finally(() => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false);
    });
    return () => { requestSequence.current += 1; };
  }, [currentWorkspace.id]);
  const query = search.trim().toLowerCase();
  const visible = items.filter(item => !query || `${item.name} ${item.type} ${item.collectedBy} ${item.reviewStatus || ''}`.toLowerCase().includes(query));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  return <div style={{ display: 'grid', gap: theme.spacing[2] }}><strong>Evidence metadata {required ? '*' : '(optional)'}</strong><span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Select existing workspace evidence. Metadata does not prove that a binary attachment is stored.</span><input aria-label="Search evidence metadata" style={fieldStyle} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled || loading || Boolean(error)} placeholder="Search name, type, collector or review status" />{loading ? <span role="status">Loading evidence metadata...</span> : error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : visible.length ? <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 220, overflowY: 'auto' }}>{visible.map(item => <label key={item.id} style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'flex-start' }}><input type="checkbox" checked={value.includes(item.id)} onChange={() => toggle(item.id)} /><span><strong>{item.name}</strong><br/><small>{item.type} · {item.reviewStatus || 'not reviewed'} · {item.attachmentStatus === 'stored' ? 'stored attachment' : 'metadata/reference only'}</small></span></label>)}</div> : <span>No matching evidence metadata is available.</span>}</div>;
}

export interface MonitorDraft {
  name: string;
  controlId: string;
  controlName: string;
  controlObjective: string;
  owner: string;
}

export function ControlMonitorModal({ open, onClose, onSubmit }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: MonitorDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MonitorDraft>({ name: '', controlId: '', controlName: '', controlObjective: '', owner: '' });
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  useEffect(() => { if (open) setError(null); }, [open]);
  const set = (key: keyof MonitorDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const selectControl = (control: Control | null) => setDraft(current => ({
    ...current,
    controlId: control?.id || '',
    controlName: control?.title || '',
  }));
  const valid = Object.values(draft).every((value) => value.trim().length > 0);
  const submit = async () => {
    if (submitLock.current) return;
    if (!valid) { setError('Complete every required monitor field.'); return; }
    submitLock.current = true;
    try {
      setBusy(true); setError(null);
      await onSubmit(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as unknown as MonitorDraft);
      setDraft({ name: '', controlId: '', controlName: '', controlObjective: '', owner: '' });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create the control monitor.'); }
    finally { submitLock.current = false; setBusy(false); }
  };
  const field = (key: keyof MonitorDraft, label: string) => <label style={{ display: 'grid', gap: theme.spacing[1] }}>{label}<input style={fieldStyle} value={draft[key]} onChange={(event) => set(key, event.target.value)} required /></label>;
  return <Modal accessibleDialog isOpen={open} onClose={requestClose} title="Create control monitor" width="680px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy || !valid}>{busy ? 'Creating...' : 'Review and create'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <p style={{ margin: 0, color: theme.colors.text.secondary }}>Select an existing workspace control. Its identifier and title remain canonical and are validated again by the workspace-scoped API.</p>
      {field('name', 'Monitor name')}
      <GovernanceControlSelect value={draft.controlId} onChange={(controlId) => set('controlId', controlId)} onSelect={selectControl} disabled={busy} label="Existing workspace control" />
      {draft.controlId ? <div style={{ display: 'grid', gap: theme.spacing[1], padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, background: theme.colors.surfaceHover }}><strong>{draft.controlName}</strong><span>Canonical control selected from this workspace.</span></div> : null}
      {field('controlObjective', 'Monitoring objective')}{field('owner', 'Monitor owner')}
      <FormError message={error} />
    </fieldset>
  </Modal>;
}

export function TestResultModal({ test, onClose, onSubmit }: {
  test: AutomatedTest | null;
  onClose: () => void;
  onSubmit: (testId: string, input: { status: Exclude<TestResultStatus, 'not_run'>; summary: string; details: string; evidenceIds: string[] }) => Promise<void>;
}) {
  const [status, setStatus] = useState<Exclude<TestResultStatus, 'not_run'>>('passed');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  useEffect(() => { if (test) { setStatus('passed'); setSummary(''); setDetails(''); setEvidence([]); setError(null); } }, [test]);
  if (!test) return null;
  const submit = async () => {
    if (submitLock.current) return;
    if (!summary.trim() || !details.trim()) { setError('Result summary and review basis are required.'); return; }
    submitLock.current = true;
    try {
      setBusy(true); setError(null);
      await onSubmit(test.id, { status, summary: summary.trim(), details: details.trim(), evidenceIds: [...evidence] });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record the reviewed result.'); }
    finally { submitLock.current = false; setBusy(false); }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Record reviewed result: ${test.name}`} width="680px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Recording...' : 'Record reviewed result'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Reviewed result<select style={fieldStyle} value={status} onChange={(event) => setStatus(event.target.value as Exclude<TestResultStatus, 'not_run'>)}><option value="passed">Passed</option><option value="failed">Failed</option><option value="warning">Warning</option><option value="not_applicable">Not applicable</option></select></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Result summary<input style={fieldStyle} value={summary} onChange={(event) => setSummary(event.target.value)} required /></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Review details and basis<textarea style={fieldStyle} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} required /></label>
      <EvidenceMetadataSelector value={evidence} onChange={setEvidence} disabled={busy} required={false} />
      <FormError message={error} />
    </fieldset>
  </Modal>;
}

export function ExceptionResolutionModal({ exception, onClose, onSubmit }: {
  exception: AssuranceException | null;
  onClose: () => void;
  onSubmit: (exceptionId: string, evidenceIds: string[], rationale: string) => Promise<void>;
}) {
  const [evidence, setEvidence] = useState<string[]>([]);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  useEffect(() => { if (exception) { setEvidence([]); setRationale(''); setError(null); } }, [exception]);
  if (!exception) return null;
  const submit = async () => {
    if (submitLock.current) return;
    const evidenceIds = [...evidence];
    if (!evidenceIds.length || !rationale.trim()) { setError('Select evidence metadata and enter a resolution rationale.'); return; }
    submitLock.current = true;
    try { setBusy(true); setError(null); await onSubmit(exception.id, evidenceIds, rationale.trim()); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to resolve the assurance exception.'); }
    finally { submitLock.current = false; setBusy(false); }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Resolve assurance exception: ${exception.type}`} width="680px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Resolving...' : 'Confirm resolution'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <p style={{ margin: 0, color: theme.colors.text.secondary }}>Resolution requires persisted workspace evidence. The API validates all evidence references before changing status.</p>
      <EvidenceMetadataSelector value={evidence} onChange={setEvidence} disabled={busy} required />
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Resolution rationale<textarea style={fieldStyle} rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} required /></label>
      <FormError message={error} />
    </fieldset>
  </Modal>;
}
