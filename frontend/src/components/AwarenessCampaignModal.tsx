import { useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button } from './Button';
import { Modal } from './Modal';
import './TrainingAssignmentModal.css';

export function AwarenessCampaignModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const { currentWorkspace } = useWorkspace();
  const [form, setForm] = useState({ title: '', topic: '', channel: 'email', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const requestClose = () => { if (!saving && !submitLock.current) onClose(); };

  const submit = async () => {
    if (submitLock.current) return;
    if (!form.title.trim() || !form.topic.trim() || !form.startDate) {
      setError('Title, topic and start date are required.');
      return;
    }
    submitLock.current = true;
    try {
      setSaving(true);
      setError(null);
      const response = await fetch('/api/v1/training/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': currentWorkspace.id },
        body: JSON.stringify(form),
      });
      const result = await response.json() as { error?: { message?: string } | null };
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Unable to create awareness campaign.');
      await onSaved();
      setForm({ title: '', topic: '', channel: 'email', startDate: '', endDate: '' });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create awareness campaign.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal accessibleDialog isOpen={isOpen} onClose={requestClose} title="Create awareness campaign" width="620px" footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Review and create'}</Button></>}>
      <fieldset disabled={saving} aria-busy={saving} className="training-assignment-form" style={{ margin: 0, padding: 0, border: 0 }}>
        <p className="training-assignment-form__notice">This records a planned campaign. External delivery remains inactive until separately configured.</p>
        <label className="training-assignment-form__field"><span>Campaign title</span><input value={form.title} onChange={(event) => set('title', event.target.value)} required /></label>
        <label className="training-assignment-form__field"><span>Topic</span><input value={form.topic} onChange={(event) => set('topic', event.target.value)} required /></label>
        <label className="training-assignment-form__field"><span>Channel</span><select value={form.channel} onChange={(event) => set('channel', event.target.value)}><option value="email">Email</option><option value="poster">Poster</option><option value="event">Event</option><option value="phishing_sim">Phishing simulation</option><option value="video">Video</option><option value="portal">Portal</option></select></label>
        <div className="training-assignment-form__dates">
          <label className="training-assignment-form__field"><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} required /></label>
          <label className="training-assignment-form__field"><span>End date (optional)</span><input type="date" value={form.endDate} onChange={(event) => set('endDate', event.target.value)} /></label>
        </div>
        {error ? <div className="training-assignment-form__error" role="alert">{error}</div> : null}
      </fieldset>
    </Modal>
  );
}
