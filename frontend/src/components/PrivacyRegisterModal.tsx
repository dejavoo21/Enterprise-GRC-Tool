import { useState } from 'react';
import { theme } from '../theme';
import type { DataInventoryRecord, DsarRecord, DsarRequestType, PrivacyClassification, RopaRecord } from '../types/privacy';
import { Button } from './Button';
import { Modal } from './Modal';

export type PrivacyRegisterKind = 'inventory' | 'ropa' | 'dsar';

const inputStyle: React.CSSProperties = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: theme.spacing[3] };
const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

const emptyInventory = { dataAssetId: '', dataAssetName: '', businessOwner: '', custodian: '', location: '', systemName: '', application: '', department: '', country: '', jurisdiction: '', dataCategory: '', sensitivityLevel: '', classification: 'Internal' as PrivacyClassification, retentionRequirement: '', legalBasis: '' };
const emptyRopa = { processingActivity: '', purpose: '', legalBasis: '', dataCategories: '', dataSubjects: '', recipients: '', crossBorderTransfers: '', retentionPeriod: '', securityMeasures: '', controllers: '', processors: '', reviewDate: '' };
const emptyDsar = { requestId: '', requestType: 'access' as DsarRequestType, dataSubject: '', owner: '', submissionDate: '', dueDate: '' };

export function PrivacyRegisterModal({ kind, onClose, onInventory, onRopa, onDsar }: {
  kind: PrivacyRegisterKind | null;
  onClose: () => void;
  onInventory: (draft: Partial<DataInventoryRecord>) => Promise<void>;
  onRopa: (draft: Partial<RopaRecord>) => Promise<void>;
  onDsar: (draft: Partial<DsarRecord>) => Promise<void>;
}) {
  const [inventory, setInventory] = useState(emptyInventory);
  const [ropa, setRopa] = useState(emptyRopa);
  const [dsar, setDsar] = useState(emptyDsar);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    if (kind === 'inventory') {
      if (![inventory.dataAssetId, inventory.dataAssetName, inventory.businessOwner, inventory.systemName, inventory.dataCategory, inventory.classification, inventory.retentionRequirement, inventory.legalBasis].every((value) => value.trim())) {
        setError('Asset ID, name, owner, system, data category, classification, retention requirement, and legal basis are required.');
        return;
      }
    } else if (kind === 'ropa') {
      if (![ropa.processingActivity, ropa.purpose, ropa.legalBasis, ropa.retentionPeriod].every((value) => value.trim())) {
        setError('Processing activity, purpose, legal basis, and retention period are required.');
        return;
      }
    } else if (kind === 'dsar') {
      if (![dsar.requestId, dsar.requestType, dsar.dataSubject, dsar.owner, dsar.dueDate].every((value) => value.trim())) {
        setError('Request ID, request type, data subject, owner, and due date are required.');
        return;
      }
    } else return;
    setSaving(true);
    try {
      if (kind === 'inventory') await onInventory({ ...inventory, status: 'planned' });
      else if (kind === 'ropa') await onRopa({ processingActivity: ropa.processingActivity.trim(), purpose: ropa.purpose.trim(), legalBasis: ropa.legalBasis.trim(), dataCategories: split(ropa.dataCategories), dataSubjects: split(ropa.dataSubjects), recipients: split(ropa.recipients), crossBorderTransfers: split(ropa.crossBorderTransfers), retentionPeriod: ropa.retentionPeriod.trim(), securityMeasures: split(ropa.securityMeasures), controllers: split(ropa.controllers), processors: split(ropa.processors), reviewDate: ropa.reviewDate ? new Date(ropa.reviewDate).toISOString() : new Date().toISOString(), status: 'planned' });
      else await onDsar({ requestId: dsar.requestId.trim(), requestType: dsar.requestType, dataSubject: dsar.dataSubject.trim(), owner: dsar.owner.trim(), submissionDate: dsar.submissionDate ? new Date(dsar.submissionDate).toISOString() : new Date().toISOString(), dueDate: new Date(dsar.dueDate).toISOString(), status: 'submitted', evidence: [], slaCompliant: new Date(dsar.dueDate).getTime() >= Date.now() });
      setInventory(emptyInventory);
      setRopa(emptyRopa);
      setDsar(emptyDsar);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create privacy register record.');
    } finally { setSaving(false); }
  };

  return <Modal isOpen={kind !== null} onClose={onClose} title={kind === 'ropa' ? 'Add processing activity' : kind === 'dsar' ? 'Open data subject request' : 'Add data inventory record'} width="780px" footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Save record'}</Button></>}>
    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
      {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
      {kind === 'inventory' ? <>
        <div style={gridStyle}>
          <label style={labelStyle}>Asset ID<input style={inputStyle} value={inventory.dataAssetId} onChange={(event) => setInventory({ ...inventory, dataAssetId: event.target.value })} /></label>
          <label style={labelStyle}>Asset name<input style={inputStyle} value={inventory.dataAssetName} onChange={(event) => setInventory({ ...inventory, dataAssetName: event.target.value })} /></label>
          <label style={labelStyle}>Business owner<input style={inputStyle} value={inventory.businessOwner} onChange={(event) => setInventory({ ...inventory, businessOwner: event.target.value })} /></label>
          <label style={labelStyle}>Custodian<input style={inputStyle} value={inventory.custodian} onChange={(event) => setInventory({ ...inventory, custodian: event.target.value })} /></label>
          <label style={labelStyle}>System<input style={inputStyle} value={inventory.systemName} onChange={(event) => setInventory({ ...inventory, systemName: event.target.value })} /></label>
          <label style={labelStyle}>Application<input style={inputStyle} value={inventory.application} onChange={(event) => setInventory({ ...inventory, application: event.target.value })} /></label>
          <label style={labelStyle}>Department<input style={inputStyle} value={inventory.department} onChange={(event) => setInventory({ ...inventory, department: event.target.value })} /></label>
          <label style={labelStyle}>Location<input style={inputStyle} value={inventory.location} onChange={(event) => setInventory({ ...inventory, location: event.target.value })} /></label>
          <label style={labelStyle}>Country<input style={inputStyle} value={inventory.country} onChange={(event) => setInventory({ ...inventory, country: event.target.value })} /></label>
          <label style={labelStyle}>Jurisdiction<input style={inputStyle} value={inventory.jurisdiction} onChange={(event) => setInventory({ ...inventory, jurisdiction: event.target.value })} /></label>
          <label style={labelStyle}>Data category<input style={inputStyle} value={inventory.dataCategory} onChange={(event) => setInventory({ ...inventory, dataCategory: event.target.value })} /></label>
          <label style={labelStyle}>Sensitivity level<input style={inputStyle} value={inventory.sensitivityLevel} onChange={(event) => setInventory({ ...inventory, sensitivityLevel: event.target.value })} /></label>
          <label style={labelStyle}>Classification<select style={inputStyle} value={inventory.classification} onChange={(event) => setInventory({ ...inventory, classification: event.target.value as PrivacyClassification })}>{['Public','Internal','Confidential','Restricted','Personal Data','Sensitive Personal Data','Special Category Data','Payment Card Data','Protected Health Information','Highly Restricted'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label style={labelStyle}>Retention requirement<input style={inputStyle} value={inventory.retentionRequirement} onChange={(event) => setInventory({ ...inventory, retentionRequirement: event.target.value })} /></label>
          <label style={labelStyle}>Legal basis<input style={inputStyle} value={inventory.legalBasis} onChange={(event) => setInventory({ ...inventory, legalBasis: event.target.value })} /></label>
        </div>
      </> : kind === 'ropa' ? <>
        <label style={labelStyle}>Processing activity<input style={inputStyle} value={ropa.processingActivity} onChange={(event) => setRopa({ ...ropa, processingActivity: event.target.value })} /></label>
        <label style={labelStyle}>Purpose<textarea rows={3} style={inputStyle} value={ropa.purpose} onChange={(event) => setRopa({ ...ropa, purpose: event.target.value })} /></label>
        <div style={gridStyle}>
          <label style={labelStyle}>Legal basis<input style={inputStyle} value={ropa.legalBasis} onChange={(event) => setRopa({ ...ropa, legalBasis: event.target.value })} /></label>
          <label style={labelStyle}>Retention period<input style={inputStyle} value={ropa.retentionPeriod} onChange={(event) => setRopa({ ...ropa, retentionPeriod: event.target.value })} /></label>
          <label style={labelStyle}>Review date<input type="date" style={inputStyle} value={ropa.reviewDate} onChange={(event) => setRopa({ ...ropa, reviewDate: event.target.value })} /></label>
        </div>
        <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Enter multiple values as comma-separated recorded facts. Leave a field empty when no value is available.</div>
        <div style={gridStyle}>{(['dataCategories','dataSubjects','recipients','crossBorderTransfers','securityMeasures','controllers','processors'] as const).map((field) => <label key={field} style={labelStyle}>{field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<input style={inputStyle} value={ropa[field]} onChange={(event) => setRopa({ ...ropa, [field]: event.target.value })} /></label>)}</div>
      </> : <div style={gridStyle}>
        <label style={labelStyle}>Request ID<input style={inputStyle} value={dsar.requestId} onChange={(event) => setDsar({ ...dsar, requestId: event.target.value })} /></label>
        <label style={labelStyle}>Request type<select style={inputStyle} value={dsar.requestType} onChange={(event) => setDsar({ ...dsar, requestType: event.target.value as DsarRequestType })}>{['access','correction','deletion','portability','restriction','objection'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label style={labelStyle}>Data subject<input style={inputStyle} value={dsar.dataSubject} onChange={(event) => setDsar({ ...dsar, dataSubject: event.target.value })} /></label>
        <label style={labelStyle}>Owner<input style={inputStyle} value={dsar.owner} onChange={(event) => setDsar({ ...dsar, owner: event.target.value })} /></label>
        <label style={labelStyle}>Submission date<input type="date" style={inputStyle} value={dsar.submissionDate} onChange={(event) => setDsar({ ...dsar, submissionDate: event.target.value })} /></label>
        <label style={labelStyle}>Due date<input type="date" style={inputStyle} value={dsar.dueDate} onChange={(event) => setDsar({ ...dsar, dueDate: event.target.value })} /></label>
      </div>}
    </div>
  </Modal>;
}
