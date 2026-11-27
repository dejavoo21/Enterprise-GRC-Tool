import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { ApiResponse, EvidenceItem } from '../types/evidence';
import type { BcmCorrectiveActionRecord } from '../types/resilience';

export function BcmCorrectiveActionClosureModal({ action, onClose, onSubmit }: { action: BcmCorrectiveActionRecord | null; onClose: () => void; onSubmit: (evidenceIds: string[], closureNotes: string) => Promise<void> }) {
  const { currentWorkspace } = useWorkspace();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const evidenceSequence = useRef(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const requestClose = () => { if (!busy && !submitLock.current) onClose(); };
  useEffect(() => {
    if (!action) return;
    const sequence = ++evidenceSequence.current;
    const workspaceId = currentWorkspace.id;
    setEvidenceLoading(true); setEvidenceError('');
    void apiCall<ApiResponse<EvidenceItem[]>>('/api/v1/evidence').then(result => {
      if (sequence !== evidenceSequence.current || workspaceId !== currentWorkspace.id) return;
      if (result.error) throw new Error(result.error.message);
      setEvidence(result.data || []);
    }).catch(cause => {
      if (sequence === evidenceSequence.current && workspaceId === currentWorkspace.id) setEvidenceError(cause instanceof Error ? cause.message : 'Evidence metadata could not be loaded.');
    }).finally(() => {
      if (sequence === evidenceSequence.current && workspaceId === currentWorkspace.id) setEvidenceLoading(false);
    });
    return () => { evidenceSequence.current += 1; };
  }, [action, currentWorkspace.id]);
  if (!action) return null;
  const submit = async () => {
    if (submitLock.current) return;
    const evidenceIds = [...selectedEvidenceIds];
    if (!evidenceIds.length || !notes.trim()) { setError('Select evidence metadata and enter closure notes.'); return; }
    submitLock.current = true;
    try { setBusy(true); setError(null); await onSubmit(evidenceIds, notes.trim()); setSelectedEvidenceIds([]); setNotes(''); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Closure failed.'); } finally { submitLock.current = false; setBusy(false); }
  };
  const fieldStyle = { width: '100%', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md };
  const query = evidenceSearch.trim().toLowerCase();
  const visibleEvidence = evidence.filter(item => !query || `${item.name} ${item.type} ${item.collectedBy} ${item.reviewStatus || ''}`.toLowerCase().includes(query));
  const toggleEvidence = (id: string) => setSelectedEvidenceIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Close corrective action: ${action.title}`} width="640px" footer={<><Button variant="secondary" onClick={requestClose} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={busy}>{busy ? 'Closing...' : 'Confirm independent closure'}</Button></>}>
    <fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      <p style={{ margin: 0, color: theme.colors.text.secondary }}>Closure requires persisted evidence from this workspace and a reviewer other than the action creator.</p>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}><strong>Closure evidence metadata *</strong><span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Select existing workspace evidence. Metadata does not prove that a binary attachment is stored.</span><input aria-label="Search closure evidence" style={fieldStyle} value={evidenceSearch} onChange={event => setEvidenceSearch(event.target.value)} placeholder="Search name, type, collector or review status" disabled={evidenceLoading || Boolean(evidenceError)} />{evidenceLoading ? <span role="status">Loading evidence metadata...</span> : evidenceError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{evidenceError}</div> : visibleEvidence.length ? <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 220, overflowY: 'auto', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>{visibleEvidence.map(item => <label key={item.id} style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'flex-start' }}><input type="checkbox" checked={selectedEvidenceIds.includes(item.id)} onChange={() => toggleEvidence(item.id)} /><span><strong>{item.name}</strong><br/><small>{item.type} · {item.reviewStatus || 'not reviewed'} · {item.attachmentStatus === 'stored' ? 'stored attachment' : 'metadata/reference only'}</small></span></label>)}</div> : <span>No matching evidence metadata is available.</span>}</div>
      <label style={{ display: 'grid', gap: theme.spacing[1] }}>Closure notes<textarea aria-label="Closure notes" style={fieldStyle} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
    </fieldset>
  </Modal>;
}
