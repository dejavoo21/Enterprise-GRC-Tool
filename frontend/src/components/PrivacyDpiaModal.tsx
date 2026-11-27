import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import type { DpiaRecord, PrivacySeverity } from '../types/privacy';
import type { Risk } from '../types/risk';
import type { Control } from '../types/control';
import type { Asset } from '../types/asset';
import type { AiGovernanceState } from '../types/aiGovernance';
import type { Vendor } from '../types/vendor';
import type { EvidenceItem } from '../types/evidence';
import { apiCall } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button } from './Button';
import { Modal } from './Modal';

type DpiaDraft = Partial<DpiaRecord> & Pick<DpiaRecord, 'assessmentName' | 'owner' | 'purpose'>;
const inputStyle: React.CSSProperties = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main };
const splitIds = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
type LinkField = 'linkedRiskIds' | 'linkedControlIds' | 'linkedAssetIds' | 'linkedAiSystemIds' | 'linkedVendorIds' | 'linkedEvidenceIds';
type LinkOption = { id: string; label: string; detail: string };
const linkLabels: Record<LinkField, string> = { linkedRiskIds: 'Enterprise risks', linkedControlIds: 'Controls', linkedAssetIds: 'Assets', linkedAiSystemIds: 'AI systems', linkedVendorIds: 'Suppliers / vendors', linkedEvidenceIds: 'Evidence metadata' };
const emptyLinks = (): Record<LinkField, LinkOption[]> => ({ linkedRiskIds: [], linkedControlIds: [], linkedAssetIds: [], linkedAiSystemIds: [], linkedVendorIds: [], linkedEvidenceIds: [] });

export function PrivacyDpiaModal({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (draft: DpiaDraft) => Promise<void> }) {
  const { currentWorkspace } = useWorkspace();
  const [form, setForm] = useState({ assessmentName: '', owner: '', purpose: '', riskRating: 'medium' as PrivacySeverity, likelihood: 1, impact: 1, residualRisk: 1, reviewDate: '', linkedRiskIds: '', linkedControlIds: '', linkedAssetIds: '', linkedAiSystemIds: '', linkedVendorIds: '', linkedEvidenceIds: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkOptions, setLinkOptions] = useState<Record<LinkField, LinkOption[]>>(emptyLinks);
  const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkField, string>>>({});
  const [linkSearch, setLinkSearch] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);
  const linkSequence = useRef(0);
  const submitLock = useRef(false);
  const requestClose = () => { if (!saving && !submitLock.current) onClose(); };
  useEffect(() => {
    if (!isOpen) return;
    const sequence = ++linkSequence.current;
    const workspaceId = currentWorkspace.id;
    setLinksLoading(true); setLinkErrors({}); setLinkOptions(emptyLinks()); setLinkSearch('');
    const requests = [
      apiCall<{ data: Risk[] }>('/api/v1/risks'),
      apiCall<{ data: Control[] }>('/api/v1/controls'),
      apiCall<{ data: Asset[] }>('/api/v1/assets'),
      apiCall<{ data: AiGovernanceState }>('/api/v1/ai-governance/state'),
      apiCall<{ data: Vendor[] }>('/api/v1/vendors'),
      apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
    ] as const;
    void Promise.allSettled(requests).then(results => {
      if (sequence !== linkSequence.current || workspaceId !== currentWorkspace.id) return;
      const next = emptyLinks();
      const errors: Partial<Record<LinkField, string>> = {};
      const fields: LinkField[] = ['linkedRiskIds','linkedControlIds','linkedAssetIds','linkedAiSystemIds','linkedVendorIds','linkedEvidenceIds'];
      results.forEach((result, index) => { if (result.status === 'rejected') errors[fields[index]] = 'Unavailable with current access.'; });
      if (results[0].status === 'fulfilled') next.linkedRiskIds = results[0].value.data.map(item => ({ id: item.id, label: `${item.riskRef || item.id} · ${item.title}`, detail: `${item.owner} · ${item.category}` }));
      if (results[1].status === 'fulfilled') next.linkedControlIds = results[1].value.data.map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` }));
      if (results[2].status === 'fulfilled') next.linkedAssetIds = results[2].value.data.map(item => ({ id: item.id, label: `${item.assetTag} · ${item.name}`, detail: `${item.owner} · ${item.status}` }));
      if (results[3].status === 'fulfilled') next.linkedAiSystemIds = results[3].value.data.inventory.map(item => ({ id: item.id, label: item.systemName, detail: `${item.owner} · ${item.lifecycleStatus}` }));
      if (results[4].status === 'fulfilled') next.linkedVendorIds = results[4].value.data.map(item => ({ id: item.id, label: `${item.supplierRef || item.id} · ${item.name}`, detail: `${item.owner} · ${item.status}` }));
      if (results[5].status === 'fulfilled') next.linkedEvidenceIds = results[5].value.data.map(item => ({ id: item.id, label: item.name, detail: `${item.type} · ${item.reviewStatus || 'status not recorded'} · attachment ${item.attachmentStatus || 'not recorded'}` }));
      setLinkOptions(next); setLinkErrors(errors);
    }).finally(() => { if (sequence === linkSequence.current && workspaceId === currentWorkspace.id) setLinksLoading(false); });
    return () => { linkSequence.current += 1; };
  }, [currentWorkspace.id, isOpen]);
  const toggleLink = (field: LinkField, id: string) => setForm(current => { const selected = splitIds(current[field]); return { ...current, [field]: (selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]).join(',') }; });
  const submit = async () => {
    if (submitLock.current) return;
    if (!form.assessmentName.trim() || !form.owner.trim() || !form.purpose.trim()) return setError('Assessment name, owner, and purpose are required.');
    submitLock.current = true; setSaving(true); setError('');
    try {
      await onSubmit({ assessmentName: form.assessmentName.trim(), owner: form.owner.trim(), purpose: form.purpose.trim(), riskRating: form.riskRating, likelihood: form.likelihood, impact: form.impact, residualRisk: form.residualRisk, reviewDate: form.reviewDate ? new Date(form.reviewDate).toISOString() : new Date().toISOString(), controls: [], evidence: [], linkedRiskIds: splitIds(form.linkedRiskIds), linkedControlIds: splitIds(form.linkedControlIds), linkedAssetIds: splitIds(form.linkedAssetIds), linkedAiSystemIds: splitIds(form.linkedAiSystemIds), linkedVendorIds: splitIds(form.linkedVendorIds), linkedEvidenceIds: splitIds(form.linkedEvidenceIds) });
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create DPIA.'); }
    finally { submitLock.current = false; setSaving(false); }
  };
  return <Modal accessibleDialog isOpen={isOpen} onClose={requestClose} title="Create DPIA draft" width="760px" footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Save draft'}</Button></>}>
    <fieldset disabled={saving} aria-busy={saving} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: theme.spacing[3] }}>
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
      <label style={labelStyle}>Assessment name<input style={inputStyle} value={form.assessmentName} onChange={(event) => setForm({ ...form, assessmentName: event.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}><label style={labelStyle}>Owner<input style={inputStyle} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label><label style={labelStyle}>Review date<input type="date" style={inputStyle} value={form.reviewDate} onChange={(event) => setForm({ ...form, reviewDate: event.target.value })} /></label></div>
      <label style={labelStyle}>Purpose<textarea style={inputStyle} rows={3} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.spacing[3] }}><label style={labelStyle}>Risk rating<select style={inputStyle} value={form.riskRating} onChange={(event) => setForm({ ...form, riskRating: event.target.value as PrivacySeverity })}>{['low','medium','high','critical'].map((value) => <option key={value}>{value}</option>)}</select></label>{(['likelihood','impact','residualRisk'] as const).map((field) => <label key={field} style={labelStyle}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input type="number" min="0" max="100" style={inputStyle} value={form[field]} onChange={(event) => setForm({ ...form, [field]: Number(event.target.value) })} /></label>)}</div>
      <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Select canonical records already available in this workspace. Linked evidence is required before submission, but not while saving a draft. Evidence metadata does not prove that a binary attachment is stored.</div>
      <label style={labelStyle}>Search linked records<input style={inputStyle} value={linkSearch} onChange={event=>setLinkSearch(event.target.value)} disabled={linksLoading} placeholder="Search reference, name, owner, category or status" /></label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:theme.spacing[3]}}>{(Object.keys(linkLabels) as LinkField[]).map(field=>{const query=linkSearch.trim().toLowerCase();const options=linkOptions[field].filter(item=>!query||`${item.label} ${item.detail}`.toLowerCase().includes(query));const selected=splitIds(form[field]);return <section key={field} style={{display:'grid',gap:theme.spacing[2],alignContent:'start',padding:theme.spacing[3],border:`1px solid ${theme.colors.border}`,borderRadius:theme.borderRadius.md}}><strong style={{fontSize:theme.typography.sizes.sm}}>{linkLabels[field]}</strong>{linksLoading?<span role="status">Loading...</span>:linkErrors[field]?<span role="alert" style={{color:theme.colors.semantic.danger,fontSize:theme.typography.sizes.xs}}>{linkErrors[field]}</span>:options.length?<div style={{display:'grid',gap:theme.spacing[2],maxHeight:190,overflowY:'auto'}}>{options.map(item=><label key={item.id} style={{display:'flex',gap:theme.spacing[2],alignItems:'flex-start',fontSize:theme.typography.sizes.sm}}><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggleLink(field,item.id)}/><span><strong>{item.label}</strong><br/><small>{item.detail}</small></span></label>)}</div>:<span style={{fontSize:theme.typography.sizes.xs,color:theme.colors.text.secondary}}>No matching records available.</span>}</section>;})}</div>
    </fieldset>
  </Modal>;
}
