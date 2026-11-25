import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import { Button } from './Button';

type Rating = 'not_tested' | 'effective' | 'partially_effective' | 'ineffective';
type Assessment = {
  id: string;
  assessmentRef: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  rating: Rating;
  designRating: Rating;
  operatingRating: Rating;
  testMethod: string;
  summary?: string;
  evidenceIds: string[];
  createdAt: string;
  reviewNotes?: string;
};
type Api<T> = { data: T | null; error: { message: string } | null };

const ratings: Rating[] = ['not_tested', 'effective', 'partially_effective', 'ineffective'];
const emptyForm = {
  testMethod: '', summary: '', rating: 'not_tested' as Rating,
  designRating: 'not_tested' as Rating, operatingRating: 'not_tested' as Rating, evidenceIds: '',
};

export function ControlEffectivenessPanel({ controlId }: { controlId: string }) {
  const [items, setItems] = useState<Assessment[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    try {
      const response = await apiCall<Api<Assessment[]>>(`/api/v1/controls/${controlId}/effectiveness`);
      setItems(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assessments.');
    }
  }, [controlId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (mutationLock.current || !form.testMethod.trim()) return;
    mutationLock.current = true;
    const capturedControlId = controlId;
    const payload = JSON.stringify({
      ...form,
      testMethod: form.testMethod.trim(),
      summary: form.summary.trim(),
      evidenceIds: form.evidenceIds.split(',').map((value) => value.trim()).filter(Boolean),
    });
    try {
      setMutationKey('create');
      setError('');
      const response = await apiCall<Api<Assessment>>(`/api/v1/controls/${capturedControlId}/effectiveness`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
      });
      if (response.error) throw new Error(response.error.message);
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create assessment.');
    } finally {
      mutationLock.current = false;
      setMutationKey(null);
    }
  };

  const transition = async (item: Assessment, path: 'submit' | 'decision', decision?: 'approved' | 'rejected') => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    const capturedControlId = controlId;
    const assessmentId = item.id;
    const payload = JSON.stringify(decision ? { decision } : {});
    try {
      setMutationKey(assessmentId);
      setError('');
      const response = await apiCall<Api<Assessment>>(`/api/v1/controls/${capturedControlId}/effectiveness/${assessmentId}/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
      });
      if (response.error) throw new Error(response.error.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change assessment status.');
    } finally {
      mutationLock.current = false;
      setMutationKey(null);
    }
  };

  const busy = mutationKey !== null;
  return (
    <div style={{ marginTop: theme.spacing[6], paddingTop: theme.spacing[4], borderTop: `1px solid ${theme.colors.borderLight}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[2] }}>
        <div style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.colors.text.muted }}>
          Effectiveness Assessments ({items.length})
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (!mutationLock.current) setOpen((value) => !value); }}>
          {open ? 'Cancel' : 'New assessment'}
        </Button>
      </div>
      {error ? <div role="alert" style={{ marginTop: theme.spacing[2], color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.sm }}>{error}</div> : null}
      {open ? (
        <fieldset disabled={busy} aria-busy={mutationKey === 'create'} style={{ margin: 0, border: 0, padding: 0 }}>
          <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md }}>
            <input aria-label="Test method" placeholder="Test method" value={form.testMethod} onChange={(event) => setForm({ ...form, testMethod: event.target.value })} />
            <textarea aria-label="Assessment summary" placeholder="Summary" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
            <input aria-label="Evidence IDs" placeholder="Reviewed evidence IDs, comma separated" value={form.evidenceIds} onChange={(event) => setForm({ ...form, evidenceIds: event.target.value })} />
            {(['rating', 'designRating', 'operatingRating'] as const).map((field) => (
              <label key={field} style={{ fontSize: theme.typography.sizes.sm }}>
                {field.replace(/[A-Z]/g, (value) => ` ${value.toLowerCase()}`)}
                <select value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value as Rating })}>
                  {ratings.map((rating) => <option key={rating} value={rating}>{rating.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
            ))}
            <Button size="sm" variant="primary" onClick={() => void create()} disabled={!form.testMethod.trim() || busy}>
              {mutationKey === 'create' ? 'Saving...' : 'Save draft'}
            </Button>
          </div>
        </fieldset>
      ) : null}
      <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
        {items.length ? items.map((item) => (
          <div key={item.id} style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm }}>
            <strong>{item.assessmentRef} · {item.rating.replace(/_/g, ' ')}</strong>
            <div style={{ color: theme.colors.text.secondary, marginTop: theme.spacing[1] }}>
              {item.testMethod} · {item.status.replace(/_/g, ' ')} · {item.evidenceIds.length} evidence references
            </div>
            <div style={{ display: 'flex', gap: theme.spacing[2], marginTop: theme.spacing[2] }}>
              {(item.status === 'draft' || item.status === 'rejected') ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void transition(item, 'submit')}>
                  {mutationKey === item.id ? 'Submitting...' : 'Submit'}
                </Button>
              ) : null}
              {item.status === 'pending_review' ? <>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void transition(item, 'decision', 'approved')}>{mutationKey === item.id ? 'Saving...' : 'Approve'}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void transition(item, 'decision', 'rejected')}>{mutationKey === item.id ? 'Saving...' : 'Reject'}</Button>
              </> : null}
            </div>
          </div>
        )) : <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>No effectiveness assessment has been recorded.</div>}
      </div>
    </div>
  );
}
