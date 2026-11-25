import { useEffect, useState } from 'react';
import { theme } from '../theme';
import type { DataClassificationEvent, DataInventoryRecord, PrivacyClassification, PrivacyStatus } from '../types/privacy';
import { Button } from './Button';
import { Modal } from './Modal';

const classifications: PrivacyClassification[] = ['Public', 'Internal', 'Confidential', 'Restricted', 'Highly Restricted', 'Personal Data', 'Sensitive Personal Data', 'Special Category Data', 'Regulated Data', 'Protected Health Information', 'Payment Card Data'];
const inputStyle = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
const labelStyle = { display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm };
const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const lifecycleOptions: Record<'planned' | 'in_progress' | 'complete', Array<'planned' | 'in_progress' | 'complete'>> = {
  planned: ['planned', 'in_progress'],
  in_progress: ['in_progress', 'complete'],
  complete: ['complete'],
};

export function PrivacyClassificationModal({ record, history, loadingHistory, onClose, onSave }: {
  record: DataInventoryRecord | null;
  history: DataClassificationEvent[];
  loadingHistory: boolean;
  onClose: () => void;
  onSave: (input: Partial<DataInventoryRecord>) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ businessOwner: '', sensitivityLevel: '', classification: 'Internal' as PrivacyClassification, status: 'planned' as PrivacyStatus, classificationScope: '', classificationRationale: '', linkedPolicyIds: '', linkedControlIds: '', linkedEvidenceIds: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const availableStatuses = record && record.status in lifecycleOptions
    ? lifecycleOptions[record.status as keyof typeof lifecycleOptions]
    : ['planned', 'in_progress', 'complete'] as const;

  useEffect(() => {
    if (!record) return;
    setDraft({ businessOwner: record.businessOwner, sensitivityLevel: record.sensitivityLevel, classification: record.classification, status: record.status, classificationScope: record.classificationScope || '', classificationRationale: record.classificationRationale || '', linkedPolicyIds: record.linkedPolicyIds.join(', '), linkedControlIds: record.linkedControlIds.join(', '), linkedEvidenceIds: record.linkedEvidenceIds.join(', ') });
    setError('');
  }, [record]);

  const save = async () => {
    if (saving) return;
    if (![draft.businessOwner, draft.sensitivityLevel, draft.classificationScope, draft.classificationRationale].every((value) => value.trim())) {
      setError('Owner, sensitivity, scope, and rationale are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...draft, linkedPolicyIds: split(draft.linkedPolicyIds), linkedControlIds: split(draft.linkedControlIds), linkedEvidenceIds: split(draft.linkedEvidenceIds) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Classification could not be revised.');
    } finally { setSaving(false); }
  };

  return <Modal accessibleDialog isOpen={Boolean(record)} onClose={() => { if (!saving) onClose(); }} title={record ? `Classify ${record.dataAssetName}` : 'Data classification'} width="820px" footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Close</Button><Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save classification'}</Button></>}>
    {record ? <fieldset disabled={saving} aria-busy={saving} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[4] }}>
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
      <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm }}>Stable record <strong>{record.dataAssetId}</strong>. This is reviewed inventory metadata, not a discovered dataset or monitoring result.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: theme.spacing[3] }}>
        <label style={labelStyle}>Business owner<input style={inputStyle} value={draft.businessOwner} onChange={(event) => setDraft({ ...draft, businessOwner: event.target.value })} /></label>
        <label style={labelStyle}>Sensitivity level<input style={inputStyle} value={draft.sensitivityLevel} onChange={(event) => setDraft({ ...draft, sensitivityLevel: event.target.value })} /></label>
        <label style={labelStyle}>Classification<select style={inputStyle} value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value as PrivacyClassification })}>{classifications.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label style={labelStyle}>Lifecycle<select style={inputStyle} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PrivacyStatus })}>{availableStatuses.map((value) => <option key={value} value={value}>{value === 'in_progress' ? 'In progress' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      </div>
      <label style={labelStyle}>Classification scope<textarea rows={2} style={inputStyle} value={draft.classificationScope} onChange={(event) => setDraft({ ...draft, classificationScope: event.target.value })} /></label>
      <label style={labelStyle}>Rationale<textarea rows={3} style={inputStyle} value={draft.classificationRationale} onChange={(event) => setDraft({ ...draft, classificationRationale: event.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: theme.spacing[3] }}>
        <label style={labelStyle}>Policy IDs<input style={inputStyle} value={draft.linkedPolicyIds} onChange={(event) => setDraft({ ...draft, linkedPolicyIds: event.target.value })} placeholder="Existing IDs, comma-separated" /></label>
        <label style={labelStyle}>Control IDs<input style={inputStyle} value={draft.linkedControlIds} onChange={(event) => setDraft({ ...draft, linkedControlIds: event.target.value })} placeholder="Existing IDs, comma-separated" /></label>
        <label style={labelStyle}>Evidence IDs<input style={inputStyle} value={draft.linkedEvidenceIds} onChange={(event) => setDraft({ ...draft, linkedEvidenceIds: event.target.value })} placeholder="Existing IDs, comma-separated" /></label>
      </div>
      <section aria-labelledby="classification-history-title">
        <h3 id="classification-history-title" style={{ margin: 0, fontSize: theme.typography.sizes.base }}>Classification history</h3>
        {loadingHistory ? <p>Loading recorded history...</p> : history.length === 0 ? <p style={{ color: theme.colors.text.muted }}>No classification history recorded.</p> : <ol style={{ display: 'grid', gap: theme.spacing[2], paddingLeft: theme.spacing[5] }}>{history.map((event) => <li key={event.id} style={{ fontSize: theme.typography.sizes.sm }}><strong>{event.eventType === 'created' ? 'Registered' : 'Revised'}</strong> to {event.newClassification} on {new Date(event.createdAt).toLocaleString()}<div style={{ color: theme.colors.text.secondary }}>{event.rationale}</div></li>)}</ol>}
      </section>
    </fieldset> : null}
  </Modal>;
}
