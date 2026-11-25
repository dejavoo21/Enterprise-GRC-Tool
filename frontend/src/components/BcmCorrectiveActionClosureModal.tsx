import { useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { theme } from '../theme';
import type { BcmCorrectiveActionRecord } from '../types/resilience';

export function BcmCorrectiveActionClosureModal({ action, onClose, onSubmit }: { action: BcmCorrectiveActionRecord | null; onClose: () => void; onSubmit: (evidenceIds: string[], closureNotes: string) => Promise<void> }) {
  const [evidence, setEvidence] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  if (!action) return null;
  const submit = async () => {
    if (submitLock.current) return;
    const evidenceIds = evidence.split(',').map((item) => item.trim()).filter(Boolean);
    if (!evidenceIds.length || !notes.trim()) { setError('Evidence IDs and closure notes are required.'); return; }
    submitLock.current = true;
    try { setBusy(true); setError(null); await onSubmit(evidenceIds, notes.trim()); setEvidence(''); setNotes(''); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Closure failed.'); } finally { submitLock.current = false; setBusy(false); }
  };
  const fieldStyle = { width: '100%', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Close corrective action: ${action.title}`} width="640px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Closing...' : 'Confirm independent closure'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <p style={{ margin: 0, color: theme.colors.text.secondary }}>Closure requires persisted evidence from this workspace and a reviewer other than the action creator.</p>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Evidence IDs (comma separated)<input aria-label="Evidence IDs" style={fieldStyle} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Closure notes<textarea aria-label="Closure notes" style={fieldStyle} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
    </fieldset>
  </Modal>;
}
