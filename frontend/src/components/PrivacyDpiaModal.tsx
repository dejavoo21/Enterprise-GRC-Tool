import { useState } from 'react';
import { theme } from '../theme';
import type { DpiaRecord, PrivacySeverity } from '../types/privacy';
import { Button } from './Button';
import { Modal } from './Modal';

type DpiaDraft = Partial<DpiaRecord> & Pick<DpiaRecord, 'assessmentName' | 'owner' | 'purpose'>;
const inputStyle: React.CSSProperties = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main };
const splitIds = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export function PrivacyDpiaModal({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (draft: DpiaDraft) => Promise<void> }) {
  const [form, setForm] = useState({ assessmentName: '', owner: '', purpose: '', riskRating: 'medium' as PrivacySeverity, likelihood: 1, impact: 1, residualRisk: 1, reviewDate: '', linkedRiskIds: '', linkedControlIds: '', linkedAssetIds: '', linkedAiSystemIds: '', linkedVendorIds: '', linkedEvidenceIds: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestClose = () => { if (!saving) onClose(); };
  const submit = async () => {
    if (!form.assessmentName.trim() || !form.owner.trim() || !form.purpose.trim()) return setError('Assessment name, owner, and purpose are required.');
    setSaving(true); setError('');
    try {
      await onSubmit({ assessmentName: form.assessmentName.trim(), owner: form.owner.trim(), purpose: form.purpose.trim(), riskRating: form.riskRating, likelihood: form.likelihood, impact: form.impact, residualRisk: form.residualRisk, reviewDate: form.reviewDate ? new Date(form.reviewDate).toISOString() : new Date().toISOString(), controls: [], evidence: [], linkedRiskIds: splitIds(form.linkedRiskIds), linkedControlIds: splitIds(form.linkedControlIds), linkedAssetIds: splitIds(form.linkedAssetIds), linkedAiSystemIds: splitIds(form.linkedAiSystemIds), linkedVendorIds: splitIds(form.linkedVendorIds), linkedEvidenceIds: splitIds(form.linkedEvidenceIds) });
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create DPIA.'); }
    finally { setSaving(false); }
  };
  return <Modal accessibleDialog isOpen={isOpen} onClose={requestClose} title="Create DPIA draft" width="760px" footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Save draft'}</Button></>}>
    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
      <label style={labelStyle}>Assessment name<input style={inputStyle} value={form.assessmentName} onChange={(event) => setForm({ ...form, assessmentName: event.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}><label style={labelStyle}>Owner<input style={inputStyle} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label><label style={labelStyle}>Review date<input type="date" style={inputStyle} value={form.reviewDate} onChange={(event) => setForm({ ...form, reviewDate: event.target.value })} /></label></div>
      <label style={labelStyle}>Purpose<textarea style={inputStyle} rows={3} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.spacing[3] }}><label style={labelStyle}>Risk rating<select style={inputStyle} value={form.riskRating} onChange={(event) => setForm({ ...form, riskRating: event.target.value as PrivacySeverity })}>{['low','medium','high','critical'].map((value) => <option key={value}>{value}</option>)}</select></label>{(['likelihood','impact','residualRisk'] as const).map((field) => <label key={field} style={labelStyle}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input type="number" min="0" max="100" style={inputStyle} value={form[field]} onChange={(event) => setForm({ ...form, [field]: Number(event.target.value) })} /></label>)}</div>
      <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Enter existing workspace record IDs only. Linked evidence is required before submission, but not while saving a draft.</div>
      {(['linkedRiskIds','linkedControlIds','linkedAssetIds','linkedAiSystemIds','linkedVendorIds','linkedEvidenceIds'] as const).map((field) => <label key={field} style={labelStyle}>{field.replace('linked','').replace('Ids',' IDs')}<input style={inputStyle} placeholder="Comma-separated existing IDs" value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></label>)}
    </div>
  </Modal>;
}
