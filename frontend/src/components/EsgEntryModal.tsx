import { useRef, useState, type FormEvent } from 'react';
import {
  createCarbonRecordEntry,
  createEnvironmentalMetricRecord,
  createEsgIncidentRecord,
  createEsgKpiRecord,
  createEsgRiskRecord,
  createEsgTargetRecord,
  createGovernanceMetricRecord,
  createSocialMetricRecord,
  createSupplierEsgReview,
} from '../lib/api';
import { Button } from './Button';
import { Modal } from './Modal';
import './EsgEntryModal.css';

export type EsgEntryKind = 'environmental' | 'carbon' | 'social' | 'governance' | 'risk' | 'kpi' | 'target' | 'supplier' | 'incident';

type EntryField = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
};

const options = (values: string[]) => values.map((value) => ({ value, label: value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }));
const trendOptions = options(['up', 'down', 'flat']);
const statusOptions = options(['healthy', 'watch', 'critical', 'in_progress', 'planned', 'complete', 'open', 'closed']);
const severityOptions = options(['low', 'medium', 'high', 'critical']);

const configurations: Record<EsgEntryKind, { title: string; fields: EntryField[] }> = {
  environmental: { title: 'Add environmental metric', fields: [
    { name: 'metricName', label: 'Metric name', required: true, wide: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: options(['energy', 'water', 'waste', 'recycling', 'emissions', 'renewable', 'fuel', 'incident', 'objective', 'kpi']) },
    { name: 'unit', label: 'Unit', required: true },
    { name: 'currentValue', label: 'Current value', type: 'number', required: true },
    { name: 'targetValue', label: 'Target value', type: 'number', required: true },
    { name: 'trend', label: 'Trend', type: 'select', required: true, options: trendOptions },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'reportingFrequency', label: 'Reporting frequency', type: 'select', required: true, options: options(['monthly', 'quarterly', 'annual']) },
    { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
    { name: 'recordedAt', label: 'Recorded date', type: 'date', required: true },
  ] },
  carbon: { title: 'Capture carbon update', fields: [
    { name: 'scope', label: 'GHG scope', type: 'select', required: true, options: options(['scope_1', 'scope_2', 'scope_3']) },
    { name: 'sourceName', label: 'Source name', required: true, wide: true },
    { name: 'tonnesCo2e', label: 'Tonnes CO2e', type: 'number', required: true, min: 0, step: 0.01 },
    { name: 'intensity', label: 'Intensity', type: 'number', required: true, min: 0, step: 0.01 },
    { name: 'reportingYear', label: 'Reporting year', type: 'number', required: true, min: 1900, max: 2200 },
    { name: 'targetTonnesCo2e', label: 'Target tonnes CO2e', type: 'number', required: true, min: 0, step: 0.01 },
    { name: 'reductionTargetPercent', label: 'Reduction target (%)', type: 'number', required: true, min: 0, max: 100, step: 0.1 },
    { name: 'trend', label: 'Trend', type: 'select', required: true, options: trendOptions },
  ] },
  social: { title: 'Add social metric', fields: [
    { name: 'metricName', label: 'Metric name', required: true, wide: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: options(['dei', 'wellbeing', 'training', 'community', 'human_rights', 'labor', 'health_safety', 'engagement']) },
    { name: 'unit', label: 'Unit', required: true },
    { name: 'currentValue', label: 'Current value', type: 'number', required: true },
    { name: 'targetValue', label: 'Target value', type: 'number', required: true },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'businessUnit', label: 'Business unit', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
    { name: 'trend', label: 'Trend', type: 'select', required: true, options: trendOptions },
  ] },
  governance: { title: 'Add governance metric', fields: [
    { name: 'metricName', label: 'Metric name', required: true, wide: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: options(['board', 'ethics', 'conduct', 'whistleblowing', 'policy', 'accountability', 'compliance_culture']) },
    { name: 'unit', label: 'Unit', required: true },
    { name: 'currentValue', label: 'Current value', type: 'number', required: true },
    { name: 'targetValue', label: 'Target value', type: 'number', required: true },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
    { name: 'trend', label: 'Trend', type: 'select', required: true, options: trendOptions },
  ] },
  risk: { title: 'Add ESG risk', fields: [
    { name: 'title', label: 'Risk title', required: true, wide: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: options(['climate', 'environmental', 'human_rights', 'labor', 'reputation', 'ethics', 'governance', 'supply_chain', 'sustainability']) },
    { name: 'severity', label: 'Severity', type: 'select', required: true, options: severityOptions },
    { name: 'status', label: 'Status', type: 'select', required: true, options: options(['identified', 'assessed', 'mitigating', 'accepted', 'closed']) },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'riskScore', label: 'Risk score', type: 'number', required: true, min: 0, max: 100 },
    { name: 'linkedEnterpriseRiskId', label: 'Linked enterprise Risk ID (optional)', wide: true },
    { name: 'mitigation', label: 'Mitigation', type: 'textarea', required: true, wide: true },
  ] },
  kpi: { title: 'Add ESG KPI', fields: [
    { name: 'kpiName', label: 'KPI name', required: true, wide: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: options(['environmental', 'social', 'governance', 'carbon', 'supplier', 'compliance']) },
    { name: 'targetValue', label: 'Target value', type: 'number', required: true },
    { name: 'actualValue', label: 'Actual value', type: 'number', required: true },
    { name: 'variance', label: 'Variance', type: 'number', required: true },
    { name: 'trend', label: 'Trend', type: 'select', required: true, options: trendOptions },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'businessUnit', label: 'Business unit', required: true },
    { name: 'reportingFrequency', label: 'Reporting frequency', type: 'select', required: true, options: options(['monthly', 'quarterly', 'annual']) },
    { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
  ] },
  target: { title: 'Add ESG target', fields: [
    { name: 'targetName', label: 'Target name', required: true, wide: true },
    { name: 'category', label: 'Category', type: 'select', required: true, options: options(['net_zero', 'reduction', 'diversity', 'training', 'governance', 'community', 'sustainability']) },
    { name: 'unit', label: 'Unit', required: true },
    { name: 'targetValue', label: 'Target value', type: 'number', required: true },
    { name: 'currentValue', label: 'Current value', type: 'number', required: true },
    { name: 'dueDate', label: 'Due date', type: 'date', required: true },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: statusOptions },
  ] },
  supplier: { title: 'Add supplier ESG review', fields: [
    { name: 'supplierName', label: 'Supplier name', required: true, wide: true },
    { name: 'supplierEsgRating', label: 'ESG rating', type: 'number', required: true, min: 0, max: 100 },
    { name: 'supplierCarbonScore', label: 'Carbon score', type: 'number', required: true, min: 0, max: 100 },
    { name: 'humanRightsCompliance', label: 'Human-rights status', type: 'select', required: true, options: statusOptions },
    { name: 'sustainabilityPractices', label: 'Sustainability status', type: 'select', required: true, options: statusOptions },
    { name: 'environmentalPerformance', label: 'Environmental status', type: 'select', required: true, options: statusOptions },
    { name: 'assessmentStatus', label: 'Assessment status', type: 'select', required: true, options: statusOptions },
    { name: 'supplierRiskLevel', label: 'Supplier risk level', type: 'select', required: true, options: severityOptions },
  ] },
  incident: { title: 'Log ESG incident', fields: [
    { name: 'title', label: 'Incident title', required: true, wide: true },
    { name: 'incidentType', label: 'Incident type', type: 'select', required: true, options: options(['environmental', 'health_safety', 'human_rights', 'ethics', 'supplier', 'community', 'whistleblower']) },
    { name: 'severity', label: 'Severity', type: 'select', required: true, options: severityOptions },
    { name: 'status', label: 'Status', type: 'select', required: true, options: options(['open', 'investigating', 'remediating', 'closed']) },
    { name: 'owner', label: 'Owner', required: true },
    { name: 'linkedDomain', label: 'Linked domain', type: 'select', required: true, options: options(['risk', 'audit', 'compliance', 'activity_ledger']) },
    { name: 'occurredAt', label: 'Occurred date', type: 'date', required: true },
    { name: 'summary', label: 'Summary', type: 'textarea', required: true, wide: true },
  ] },
};

const numericFields = new Set(['currentValue', 'targetValue', 'tonnesCo2e', 'intensity', 'reportingYear', 'targetTonnesCo2e', 'reductionTargetPercent', 'riskScore', 'actualValue', 'variance', 'supplierEsgRating', 'supplierCarbonScore']);

async function persist(kind: EsgEntryKind, values: Record<string, string>) {
  const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, numericFields.has(key) ? Number(value) : value || null]));
  switch (kind) {
    case 'environmental': return createEnvironmentalMetricRecord(payload);
    case 'carbon': return createCarbonRecordEntry(payload);
    case 'social': return createSocialMetricRecord(payload);
    case 'governance': return createGovernanceMetricRecord(payload);
    case 'risk': return createEsgRiskRecord(payload);
    case 'kpi': return createEsgKpiRecord(payload);
    case 'target': return createEsgTargetRecord(payload);
    case 'supplier': return createSupplierEsgReview(payload);
    case 'incident': return createEsgIncidentRecord(payload);
  }
}

export function EsgEntryModal({ kind, onClose, onSaved }: { kind: EsgEntryKind | null; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const [error, setError] = useState('');
  if (!kind) return null;
  const configuration = configurations[kind];
  const requestClose = () => { if (!saving && !submitLock.current) onClose(); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    setError('');
    try {
      await persist(kind, values);
      await onSaved(`${configuration.title} recorded from reviewed user input.`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The ESG record could not be created.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={configuration.title} width="760px">
    <form className="esgEntryForm" onSubmit={(event) => void submit(event)}>
      <p className="esgEntryNotice">Only reviewed values entered here are persisted. No owner, score, assessment, relationship, or assurance result is inferred.</p>
      <fieldset className="esgEntryFields" disabled={saving} aria-busy={saving}>
        {configuration.fields.map((field) => <label key={field.name} className={field.wide ? 'esgEntryWide' : undefined} htmlFor={`esg-${kind}-${field.name}`}>
          {field.label}{field.required ? ' *' : ''}
          {field.type === 'textarea' ? <textarea id={`esg-${kind}-${field.name}`} rows={4} required={field.required} value={values[field.name] || ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} /> : field.type === 'select' ? <select id={`esg-${kind}-${field.name}`} required={field.required} value={values[field.name] || ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select...</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={`esg-${kind}-${field.name}`} type={field.type || 'text'} required={field.required} min={field.min} max={field.max} step={field.step} value={values[field.name] || ''} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}
        </label>)}
      </fieldset>
      {error ? <div className="esgEntryError" role="alert">{error}</div> : null}
      <div className="esgEntryActions"><Button type="button" variant="secondary" disabled={saving} onClick={requestClose}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save reviewed record'}</Button></div>
    </form>
  </Modal>;
}
