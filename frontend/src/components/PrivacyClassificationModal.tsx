import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { Control } from '../types/control';
import type { EvidenceItem } from '../types/evidence';
import type { GovernanceDocument } from '../types/governance';
import type { DataClassificationEvent, DataInventoryRecord, PrivacyClassification, PrivacyStatus } from '../types/privacy';
import { Button } from './Button';
import { Modal } from './Modal';
import { RelationshipExplorer } from './RelationshipExplorer';

const classifications: PrivacyClassification[] = ['Public', 'Internal', 'Confidential', 'Restricted', 'Highly Restricted', 'Personal Data', 'Sensitive Personal Data', 'Special Category Data', 'Regulated Data', 'Protected Health Information', 'Payment Card Data'];
const inputStyle = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
const labelStyle = { display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm };
type LinkField = 'linkedPolicyIds' | 'linkedControlIds' | 'linkedEvidenceIds';
type LinkOption = { id: string; label: string; detail: string };
const linkLabels: Record<LinkField, string> = { linkedPolicyIds: 'Policies', linkedControlIds: 'Controls', linkedEvidenceIds: 'Evidence metadata' };
const emptyOptions = (): Record<LinkField, LinkOption[]> => ({ linkedPolicyIds: [], linkedControlIds: [], linkedEvidenceIds: [] });
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
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [draft, setDraft] = useState({ businessOwner: '', sensitivityLevel: '', classification: 'Internal' as PrivacyClassification, status: 'planned' as PrivacyStatus, classificationScope: '', classificationRationale: '', linkedPolicyIds: [] as string[], linkedControlIds: [] as string[], linkedEvidenceIds: [] as string[] });
  const [linkOptions, setLinkOptions] = useState<Record<LinkField, LinkOption[]>>(emptyOptions);
  const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkField, string>>>({});
  const [linkSearch, setLinkSearch] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);
  const linkSequence = useRef(0);
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState('');
  const availableStatuses = record && record.status in lifecycleOptions
    ? lifecycleOptions[record.status as keyof typeof lifecycleOptions]
    : ['planned', 'in_progress', 'complete'] as const;

  useEffect(() => {
    if (!record) return;
    setDraft({ businessOwner: record.businessOwner, sensitivityLevel: record.sensitivityLevel, classification: record.classification, status: record.status, classificationScope: record.classificationScope || '', classificationRationale: record.classificationRationale || '', linkedPolicyIds: [...record.linkedPolicyIds], linkedControlIds: [...record.linkedControlIds], linkedEvidenceIds: [...record.linkedEvidenceIds] });
    setError('');
  }, [record]);

  useEffect(() => {
    if (!record) return;
    const sequence = ++linkSequence.current;
    const workspaceId = currentWorkspace.id;
    setLinksLoading(true); setLinkErrors({}); setLinkOptions(emptyOptions()); setLinkSearch('');
    void Promise.allSettled([
      apiCall<{ data: GovernanceDocument[] }>('/api/v1/governance-documents?docType=policy'),
      apiCall<{ data: Control[] }>('/api/v1/controls'),
      apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
    ]).then(results => {
      if (sequence !== linkSequence.current || workspaceId !== currentWorkspace.id) return;
      const next = emptyOptions();
      const errors: Partial<Record<LinkField, string>> = {};
      const fields: LinkField[] = ['linkedPolicyIds', 'linkedControlIds', 'linkedEvidenceIds'];
      results.forEach((result, index) => { if (result.status === 'rejected') errors[fields[index]] = 'Unavailable with current access.'; });
      if (results[0].status === 'fulfilled') next.linkedPolicyIds = results[0].value.data.filter(item => item.docType === 'policy').map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` }));
      if (results[1].status === 'fulfilled') next.linkedControlIds = results[1].value.data.map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` }));
      if (results[2].status === 'fulfilled') next.linkedEvidenceIds = results[2].value.data.map(item => ({ id: item.id, label: item.name, detail: `${item.type} · ${item.reviewStatus || 'not reviewed'} · ${item.attachmentStatus === 'stored' ? 'stored attachment' : 'metadata/reference only'}` }));
      setLinkOptions(next); setLinkErrors(errors);
    }).finally(() => { if (sequence === linkSequence.current && workspaceId === currentWorkspace.id) setLinksLoading(false); });
    return () => { linkSequence.current += 1; };
  }, [currentWorkspace.id, record]);

  const toggleLink = (field: LinkField, id: string) => setDraft(current => ({ ...current, [field]: current[field].includes(id) ? current[field].filter(item => item !== id) : [...current[field], id] }));

  const requestClose = () => { if (!saving && !submitLock.current) onClose(); };

  const save = async () => {
    if (submitLock.current) return;
    if (![draft.businessOwner, draft.sensitivityLevel, draft.classificationScope, draft.classificationRationale].every((value) => value.trim())) {
      setError('Owner, sensitivity, scope, and rationale are required.');
      return;
    }
    submitLock.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave({ ...draft, linkedPolicyIds: [...draft.linkedPolicyIds], linkedControlIds: [...draft.linkedControlIds], linkedEvidenceIds: [...draft.linkedEvidenceIds] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Classification could not be revised.');
    } finally { submitLock.current = false; setSaving(false); }
  };

  return <Modal accessibleDialog isOpen={Boolean(record)} onClose={requestClose} title={record ? `Classify ${record.dataAssetName}` : 'Data classification'} width="820px" footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Close</Button><Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save classification'}</Button></>}>
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
      <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Select canonical records already available in this workspace. Evidence metadata does not prove that a binary attachment is stored.</div>
      <label style={labelStyle}>Search linked records<input style={inputStyle} value={linkSearch} onChange={event => setLinkSearch(event.target.value)} disabled={linksLoading} placeholder="Search title, owner, type or status" /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: theme.spacing[3] }}>{(Object.keys(linkLabels) as LinkField[]).map(field => { const query = linkSearch.trim().toLowerCase(); const options = linkOptions[field].filter(item => !query || `${item.label} ${item.detail}`.toLowerCase().includes(query)); return <section key={field} style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}><strong>{linkLabels[field]}</strong>{linksLoading ? <span role="status">Loading...</span> : linkErrors[field] ? <span role="alert" style={{ color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>{linkErrors[field]}</span> : options.length ? <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 190, overflowY: 'auto' }}>{options.map(item => <label key={item.id} style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'flex-start' }}><input type="checkbox" checked={draft[field].includes(item.id)} onChange={() => toggleLink(field, item.id)} /><span><strong>{item.label}</strong><br/><small>{item.detail}</small></span></label>)}</div> : <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>No matching records available.</span>}</section>; })}</div>
      <section aria-labelledby="classification-history-title">
        <h3 id="classification-history-title" style={{ margin: 0, fontSize: theme.typography.sizes.base }}>Classification history</h3>
        {loadingHistory ? <p>Loading recorded history...</p> : history.length === 0 ? <p style={{ color: theme.colors.text.muted }}>No classification history recorded.</p> : <ol style={{ display: 'grid', gap: theme.spacing[2], paddingLeft: theme.spacing[5] }}>{history.map((event) => <li key={event.id} style={{ fontSize: theme.typography.sizes.sm }}><strong>{event.eventType === 'created' ? 'Registered' : 'Revised'}</strong> to {event.newClassification} on {new Date(event.createdAt).toLocaleString()}<div style={{ color: theme.colors.text.secondary }}>{event.rationale}</div></li>)}</ol>}
      </section>
      <RelationshipExplorer entityType="data_asset" entityId={record.id} onNavigate={(key) => navigate(`/${key}`)} />
    </fieldset> : null}
  </Modal>;
}
