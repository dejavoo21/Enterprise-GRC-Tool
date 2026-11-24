import { useState } from 'react';
import { theme } from '../theme';
import type { ConsentRecord, DataInventoryRecord, DataTransferRecord, DsarRecord, DsarRequestType, PrivacyBreachRecord, PrivacyClassification, PrivacySeverity, RetentionRecord, RopaRecord } from '../types/privacy';
import { Button } from './Button';
import { Modal } from './Modal';

export type PrivacyRegisterKind = 'inventory' | 'ropa' | 'dsar' | 'breach' | 'retention' | 'transfer' | 'consent';

const inputStyle: React.CSSProperties = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: theme.spacing[3] };
const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

const emptyInventory = { dataAssetId: '', dataAssetName: '', businessOwner: '', custodian: '', location: '', systemName: '', application: '', department: '', country: '', jurisdiction: '', dataCategory: '', sensitivityLevel: '', classification: 'Internal' as PrivacyClassification, retentionRequirement: '', legalBasis: '' };
const emptyRopa = { processingActivity: '', purpose: '', legalBasis: '', dataCategories: '', dataSubjects: '', recipients: '', crossBorderTransfers: '', retentionPeriod: '', securityMeasures: '', controllers: '', processors: '', reviewDate: '' };
const emptyDsar = { requestId: '', requestType: 'access' as DsarRequestType, dataSubject: '', owner: '', submissionDate: '', dueDate: '' };
const emptyBreach = { breachType: '', discoveryDate: '', affectedRecords: 0, affectedIndividuals: 0, rootCause: '', riskLevel: 'medium' as PrivacySeverity, regulatorNotificationStatus: 'not_required' as 'required' | 'not_required', customerNotificationStatus: 'not_required' as 'required' | 'not_required', remediation: '' };
const emptyRetention = { assetName: '', retentionPeriod: '', legalHold: false, deletionSchedule: '', reviewDate: '' };
const emptyTransfer = { transferName: '', transferType: 'cross_border' as DataTransferRecord['transferType'], transferMechanism: '', jurisdiction: '', sccInPlace: false, bcrInPlace: false, transferRiskRating: 'medium' as PrivacySeverity, reviewDate: '' };
const emptyConsent = { consentType: '', purpose: '', dataSubject: '', collectionMethod: '', dateCollected: '', expirationDate: '', evidence: '' };

export function PrivacyRegisterModal({ kind, onClose, onInventory, onRopa, onDsar, onBreach, onRetention, onTransfer, onConsent }: {
  kind: PrivacyRegisterKind | null;
  onClose: () => void;
  onInventory: (draft: Partial<DataInventoryRecord>) => Promise<void>;
  onRopa: (draft: Partial<RopaRecord>) => Promise<void>;
  onDsar: (draft: Partial<DsarRecord>) => Promise<void>;
  onBreach: (draft: Partial<PrivacyBreachRecord>) => Promise<void>;
  onRetention: (draft: Partial<RetentionRecord>) => Promise<void>;
  onTransfer: (draft: Partial<DataTransferRecord>) => Promise<void>;
  onConsent: (draft: Partial<ConsentRecord>) => Promise<void>;
}) {
  const [inventory, setInventory] = useState(emptyInventory);
  const [ropa, setRopa] = useState(emptyRopa);
  const [dsar, setDsar] = useState(emptyDsar);
  const [breach, setBreach] = useState(emptyBreach);
  const [retention, setRetention] = useState(emptyRetention);
  const [transfer, setTransfer] = useState(emptyTransfer);
  const [consent, setConsent] = useState(emptyConsent);
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
    } else if (kind === 'breach') {
      if (![breach.breachType, breach.discoveryDate, breach.rootCause, breach.remediation].every((value) => value.trim())) {
        setError('Breach type, discovery date, root cause, and remediation plan are required.');
        return;
      }
      if (breach.affectedRecords < 0 || breach.affectedIndividuals < 0) {
        setError('Affected record and individual counts cannot be negative.');
        return;
      }
    } else if (kind === 'retention') {
      if (![retention.assetName, retention.retentionPeriod, retention.deletionSchedule, retention.reviewDate].every((value) => value.trim())) {
        setError('Asset name, retention period, deletion schedule, and review date are required.');
        return;
      }
    } else if (kind === 'transfer') {
      if (![transfer.transferName, transfer.transferType, transfer.transferMechanism, transfer.jurisdiction, transfer.transferRiskRating, transfer.reviewDate].every((value) => value.trim())) {
        setError('Transfer name, type, mechanism, jurisdiction, risk rating, and review date are required.');
        return;
      }
    } else if (kind === 'consent') {
      if (![consent.consentType, consent.purpose, consent.dataSubject, consent.collectionMethod, consent.dateCollected, consent.evidence].every((value) => value.trim())) {
        setError('Consent type, purpose, data subject, collection method, collection date, and evidence reference are required.');
        return;
      }
    } else return;
    setSaving(true);
    try {
      if (kind === 'inventory') await onInventory({ ...inventory, status: 'planned' });
      else if (kind === 'ropa') await onRopa({ processingActivity: ropa.processingActivity.trim(), purpose: ropa.purpose.trim(), legalBasis: ropa.legalBasis.trim(), dataCategories: split(ropa.dataCategories), dataSubjects: split(ropa.dataSubjects), recipients: split(ropa.recipients), crossBorderTransfers: split(ropa.crossBorderTransfers), retentionPeriod: ropa.retentionPeriod.trim(), securityMeasures: split(ropa.securityMeasures), controllers: split(ropa.controllers), processors: split(ropa.processors), reviewDate: ropa.reviewDate ? new Date(ropa.reviewDate).toISOString() : new Date().toISOString(), status: 'planned' });
      else if (kind === 'dsar') await onDsar({ requestId: dsar.requestId.trim(), requestType: dsar.requestType, dataSubject: dsar.dataSubject.trim(), owner: dsar.owner.trim(), submissionDate: dsar.submissionDate ? new Date(dsar.submissionDate).toISOString() : new Date().toISOString(), dueDate: new Date(dsar.dueDate).toISOString(), status: 'submitted', evidence: [], slaCompliant: new Date(dsar.dueDate).getTime() >= Date.now() });
      else if (kind === 'breach') await onBreach({ ...breach, breachType: breach.breachType.trim(), discoveryDate: new Date(breach.discoveryDate).toISOString(), rootCause: breach.rootCause.trim(), remediation: breach.remediation.trim(), status: 'open' });
      else if (kind === 'retention') await onRetention({ assetName: retention.assetName.trim(), retentionPeriod: retention.retentionPeriod.trim(), legalHold: retention.legalHold, deletionSchedule: retention.deletionSchedule.trim(), archiveStatus: 'planned', disposalStatus: 'planned', reviewDate: new Date(retention.reviewDate).toISOString(), violationStatus: 'healthy' });
      else if (kind === 'transfer') await onTransfer({ ...transfer, transferName: transfer.transferName.trim(), transferMechanism: transfer.transferMechanism.trim(), jurisdiction: transfer.jurisdiction.trim(), reviewDate: new Date(transfer.reviewDate).toISOString() });
      else await onConsent({ consentType: consent.consentType.trim(), purpose: consent.purpose.trim(), dataSubject: consent.dataSubject.trim(), collectionMethod: consent.collectionMethod.trim(), dateCollected: new Date(consent.dateCollected).toISOString(), expirationDate: consent.expirationDate ? new Date(consent.expirationDate).toISOString() : null, status: 'granted', evidence: consent.evidence.trim(), consentHistory: [] });
      setInventory(emptyInventory);
      setRopa(emptyRopa);
      setDsar(emptyDsar);
      setBreach(emptyBreach);
      setRetention(emptyRetention);
      setTransfer(emptyTransfer);
      setConsent(emptyConsent);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create privacy register record.');
    } finally { setSaving(false); }
  };

  return <Modal isOpen={kind !== null} onClose={onClose} title={kind === 'ropa' ? 'Add processing activity' : kind === 'dsar' ? 'Open data subject request' : kind === 'breach' ? 'Log privacy breach' : kind === 'retention' ? 'Add retention schedule' : kind === 'transfer' ? 'Register data transfer' : kind === 'consent' ? 'Register consent record' : 'Add data inventory record'} width="780px" footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Save record'}</Button></>}>
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
      </> : kind === 'dsar' ? <div style={gridStyle}>
        <label style={labelStyle}>Request ID<input style={inputStyle} value={dsar.requestId} onChange={(event) => setDsar({ ...dsar, requestId: event.target.value })} /></label>
        <label style={labelStyle}>Request type<select style={inputStyle} value={dsar.requestType} onChange={(event) => setDsar({ ...dsar, requestType: event.target.value as DsarRequestType })}>{['access','correction','deletion','portability','restriction','objection'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label style={labelStyle}>Data subject<input style={inputStyle} value={dsar.dataSubject} onChange={(event) => setDsar({ ...dsar, dataSubject: event.target.value })} /></label>
        <label style={labelStyle}>Owner<input style={inputStyle} value={dsar.owner} onChange={(event) => setDsar({ ...dsar, owner: event.target.value })} /></label>
        <label style={labelStyle}>Submission date<input type="date" style={inputStyle} value={dsar.submissionDate} onChange={(event) => setDsar({ ...dsar, submissionDate: event.target.value })} /></label>
        <label style={labelStyle}>Due date<input type="date" style={inputStyle} value={dsar.dueDate} onChange={(event) => setDsar({ ...dsar, dueDate: event.target.value })} /></label>
      </div> : kind === 'breach' ? <>
        <div style={gridStyle}>
          <label style={labelStyle}>Breach type<input style={inputStyle} value={breach.breachType} onChange={(event) => setBreach({ ...breach, breachType: event.target.value })} /></label>
          <label style={labelStyle}>Discovery date<input type="date" style={inputStyle} value={breach.discoveryDate} onChange={(event) => setBreach({ ...breach, discoveryDate: event.target.value })} /></label>
          <label style={labelStyle}>Affected records<input type="number" min="0" style={inputStyle} value={breach.affectedRecords} onChange={(event) => setBreach({ ...breach, affectedRecords: Number(event.target.value) })} /></label>
          <label style={labelStyle}>Affected individuals<input type="number" min="0" style={inputStyle} value={breach.affectedIndividuals} onChange={(event) => setBreach({ ...breach, affectedIndividuals: Number(event.target.value) })} /></label>
          <label style={labelStyle}>Risk level<select style={inputStyle} value={breach.riskLevel} onChange={(event) => setBreach({ ...breach, riskLevel: event.target.value as PrivacySeverity })}>{['low','medium','high','critical'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label style={labelStyle}>Regulator notification<select style={inputStyle} value={breach.regulatorNotificationStatus} onChange={(event) => setBreach({ ...breach, regulatorNotificationStatus: event.target.value as 'required' | 'not_required' })}><option value="not_required">Not required</option><option value="required">Required</option></select></label>
          <label style={labelStyle}>Customer notification<select style={inputStyle} value={breach.customerNotificationStatus} onChange={(event) => setBreach({ ...breach, customerNotificationStatus: event.target.value as 'required' | 'not_required' })}><option value="not_required">Not required</option><option value="required">Required</option></select></label>
        </div>
        <label style={labelStyle}>Root cause<textarea rows={3} style={inputStyle} value={breach.rootCause} onChange={(event) => setBreach({ ...breach, rootCause: event.target.value })} /></label>
        <label style={labelStyle}>Remediation plan<textarea rows={3} style={inputStyle} value={breach.remediation} onChange={(event) => setBreach({ ...breach, remediation: event.target.value })} /></label>
        <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Recording a notification requirement does not send or confirm a regulator or customer notification.</div>
      </> : kind === 'retention' ? <>
        <div style={gridStyle}>
          <label style={labelStyle}>Asset name<input style={inputStyle} value={retention.assetName} onChange={(event) => setRetention({ ...retention, assetName: event.target.value })} /></label>
          <label style={labelStyle}>Retention period<input style={inputStyle} placeholder="For example, 7 years" value={retention.retentionPeriod} onChange={(event) => setRetention({ ...retention, retentionPeriod: event.target.value })} /></label>
          <label style={labelStyle}>Deletion schedule<input style={inputStyle} placeholder="Recorded schedule or trigger" value={retention.deletionSchedule} onChange={(event) => setRetention({ ...retention, deletionSchedule: event.target.value })} /></label>
          <label style={labelStyle}>Review date<input type="date" style={inputStyle} value={retention.reviewDate} onChange={(event) => setRetention({ ...retention, reviewDate: event.target.value })} /></label>
        </div>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gridTemplateColumns: 'auto 1fr' }}><input type="checkbox" checked={retention.legalHold} onChange={(event) => setRetention({ ...retention, legalHold: event.target.checked })} /> Legal hold applies</label>
        <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>This records a planned retention schedule. It does not archive, delete, or dispose of data automatically.</div>
      </> : kind === 'transfer' ? <>
        <div style={gridStyle}>
          <label style={labelStyle}>Transfer name<input style={inputStyle} value={transfer.transferName} onChange={(event) => setTransfer({ ...transfer, transferName: event.target.value })} /></label>
          <label style={labelStyle}>Transfer type<select style={inputStyle} value={transfer.transferType} onChange={(event) => setTransfer({ ...transfer, transferType: event.target.value as DataTransferRecord['transferType'] })}><option value="cross_border">Cross-border</option><option value="international">International</option></select></label>
          <label style={labelStyle}>Transfer mechanism<input style={inputStyle} value={transfer.transferMechanism} onChange={(event) => setTransfer({ ...transfer, transferMechanism: event.target.value })} /></label>
          <label style={labelStyle}>Jurisdiction<input style={inputStyle} value={transfer.jurisdiction} onChange={(event) => setTransfer({ ...transfer, jurisdiction: event.target.value })} /></label>
          <label style={labelStyle}>Risk rating<select style={inputStyle} value={transfer.transferRiskRating} onChange={(event) => setTransfer({ ...transfer, transferRiskRating: event.target.value as PrivacySeverity })}>{['low','medium','high','critical'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label style={labelStyle}>Review date<input type="date" style={inputStyle} value={transfer.reviewDate} onChange={(event) => setTransfer({ ...transfer, reviewDate: event.target.value })} /></label>
        </div>
        <div style={gridStyle}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={transfer.sccInPlace} onChange={(event) => setTransfer({ ...transfer, sccInPlace: event.target.checked })} /> Standard contractual clauses recorded</label>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={transfer.bcrInPlace} onChange={(event) => setTransfer({ ...transfer, bcrInPlace: event.target.checked })} /> Binding corporate rules recorded</label>
        </div>
        <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Recording a transfer mechanism or safeguard does not verify legal adequacy or approve the transfer.</div>
      </> : <>
        <div style={gridStyle}>
          <label style={labelStyle}>Consent type<input style={inputStyle} value={consent.consentType} onChange={(event) => setConsent({ ...consent, consentType: event.target.value })} /></label>
          <label style={labelStyle}>Data subject<input style={inputStyle} value={consent.dataSubject} onChange={(event) => setConsent({ ...consent, dataSubject: event.target.value })} /></label>
          <label style={labelStyle}>Collection method<input style={inputStyle} value={consent.collectionMethod} onChange={(event) => setConsent({ ...consent, collectionMethod: event.target.value })} /></label>
          <label style={labelStyle}>Collection date<input type="date" style={inputStyle} value={consent.dateCollected} onChange={(event) => setConsent({ ...consent, dateCollected: event.target.value })} /></label>
          <label style={labelStyle}>Expiration date<input type="date" style={inputStyle} value={consent.expirationDate} onChange={(event) => setConsent({ ...consent, expirationDate: event.target.value })} /></label>
          <label style={labelStyle}>Evidence reference<input style={inputStyle} placeholder="Recorded evidence ID or location" value={consent.evidence} onChange={(event) => setConsent({ ...consent, evidence: event.target.value })} /></label>
        </div>
        <label style={labelStyle}>Purpose<textarea rows={3} style={inputStyle} value={consent.purpose} onChange={(event) => setConsent({ ...consent, purpose: event.target.value })} /></label>
        <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>This stores a consent register entry and evidence reference only. It does not upload an attachment or independently verify that consent is valid.</div>
      </>}
    </div>
  </Modal>;
}
