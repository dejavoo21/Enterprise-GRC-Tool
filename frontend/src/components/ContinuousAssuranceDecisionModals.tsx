import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import type { AssuranceException, AutomatedTest, TestResultStatus } from '../types/continuousAssurance';
import { Button } from './Button';
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
      <p style={{ margin: 0, color: theme.colors.text.secondary }}>Link this monitor to an existing control. The control identifier is validated by the workspace-scoped API.</p>
      {field('name', 'Monitor name')}{field('controlId', 'Existing control ID')}{field('controlName', 'Control name')}{field('controlObjective', 'Control objective')}{field('owner', 'Monitor owner')}
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
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  useEffect(() => { if (test) { setStatus('passed'); setSummary(''); setDetails(''); setEvidence(''); setError(null); } }, [test]);
  if (!test) return null;
  const submit = async () => {
    if (submitLock.current) return;
    if (!summary.trim() || !details.trim()) { setError('Result summary and review basis are required.'); return; }
    submitLock.current = true;
    try {
      setBusy(true); setError(null);
      await onSubmit(test.id, { status, summary: summary.trim(), details: details.trim(), evidenceIds: evidence.split(',').map((item) => item.trim()).filter(Boolean) });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record the reviewed result.'); }
    finally { submitLock.current = false; setBusy(false); }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Record reviewed result: ${test.name}`} width="680px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Recording...' : 'Record reviewed result'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Reviewed result<select style={fieldStyle} value={status} onChange={(event) => setStatus(event.target.value as Exclude<TestResultStatus, 'not_run'>)}><option value="passed">Passed</option><option value="failed">Failed</option><option value="warning">Warning</option><option value="not_applicable">Not applicable</option></select></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Result summary<input style={fieldStyle} value={summary} onChange={(event) => setSummary(event.target.value)} required /></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Review details and basis<textarea style={fieldStyle} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} required /></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Evidence IDs (comma separated, optional)<input style={fieldStyle} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
      <FormError message={error} />
    </fieldset>
  </Modal>;
}

export function ExceptionResolutionModal({ exception, onClose, onSubmit }: {
  exception: AssuranceException | null;
  onClose: () => void;
  onSubmit: (exceptionId: string, evidenceIds: string[], rationale: string) => Promise<void>;
}) {
  const [evidence, setEvidence] = useState('');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  useEffect(() => { if (exception) { setEvidence(''); setRationale(''); setError(null); } }, [exception]);
  if (!exception) return null;
  const submit = async () => {
    if (submitLock.current) return;
    const evidenceIds = evidence.split(',').map((item) => item.trim()).filter(Boolean);
    if (!evidenceIds.length || !rationale.trim()) { setError('Persisted evidence IDs and a resolution rationale are required.'); return; }
    submitLock.current = true;
    try { setBusy(true); setError(null); await onSubmit(exception.id, evidenceIds, rationale.trim()); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to resolve the assurance exception.'); }
    finally { submitLock.current = false; setBusy(false); }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Resolve assurance exception: ${exception.type}`} width="680px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Resolving...' : 'Confirm resolution'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <p style={{ margin: 0, color: theme.colors.text.secondary }}>Resolution requires persisted workspace evidence. The API validates all evidence references before changing status.</p>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Evidence IDs (comma separated)<input style={fieldStyle} value={evidence} onChange={(event) => setEvidence(event.target.value)} required /></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Resolution rationale<textarea style={fieldStyle} rows={4} value={rationale} onChange={(event) => setRationale(event.target.value)} required /></label>
      <FormError message={error} />
    </fieldset>
  </Modal>;
}
