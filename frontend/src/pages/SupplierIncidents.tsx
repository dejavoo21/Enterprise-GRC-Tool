import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE, apiCall, fetchVendorIncidents } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { Modal } from '../components/Modal';
import type { Vendor } from '../types/vendor';
import type { IncidentStatus, VendorIncident } from '../types/tprm';
import './SupplierIncidents.css';

type Api<T> = { data: T; error: null };
const transitions: Record<IncidentStatus, IncidentStatus[]> = { open: ['investigating'], investigating: ['mitigating'], mitigating: ['resolved'], resolved: ['closed', 'investigating'], closed: [] };
const clean = (value: string) => value.replace(/_/g, ' ');
const message = (error: unknown) => error instanceof Error ? error.message : 'The supplier incident operation could not be completed.';

export function SupplierIncidents() {
  const { workspaceId } = useWorkspace();
  const [searchParams] = useSearchParams();
  const incidentFilter = searchParams.get('incident');
  const [incidents, setIncidents] = useState<VendorIncident[]>([]), [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<VendorIncident | null>(null), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [severity, setSeverity] = useState('');
  const [metricView, setMetricView] = useState<'all' | 'open' | 'critical' | 'data' | 'resolved'>('all');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [createOpen, setCreateOpen] = useState(false), [resolutionOpen, setResolutionOpen] = useState(false);
  const workspaceRef = useRef(workspaceId); workspaceRef.current = workspaceId;
  const loadSequence = useRef(0), actionSequence = useRef(0), actionLock = useRef(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const sequence = ++loadSequence.current, capturedWorkspace = workspaceId;
    setLoading(true); setError('');
    try {
      const [records, vendorResult] = await Promise.all([fetchVendorIncidents(), apiCall<Api<Vendor[]>>(`${API_BASE}/vendors`)]);
      if (sequence !== loadSequence.current || capturedWorkspace !== workspaceRef.current) return;
      setIncidents(records); setVendors(vendorResult.data.filter(vendor => !vendor.archivedAt));
      setSelected(current => records.find(record => record.id === (incidentFilter || current?.id)) || null);
    } catch (cause) { if (sequence === loadSequence.current && capturedWorkspace === workspaceRef.current) setError(message(cause)); }
    finally { if (sequence === loadSequence.current && capturedWorkspace === workspaceRef.current) setLoading(false); }
  }, [incidentFilter, workspaceId]);

  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);
  useEffect(() => { actionSequence.current += 1; actionLock.current = false; setBusy(false); setSelected(null); setCreateOpen(false); setResolutionOpen(false); setError(''); }, [workspaceId]);

  const runAction = async (work: () => Promise<void>) => {
    if (actionLock.current || !workspaceId) return;
    const sequence = ++actionSequence.current, capturedWorkspace = workspaceId;
    actionLock.current = true; setBusy(true); setError('');
    try { await work(); }
    catch (cause) { if (sequence === actionSequence.current && capturedWorkspace === workspaceRef.current) setError(message(cause)); }
    finally { if (sequence === actionSequence.current) { actionLock.current = false; setBusy(false); } }
  };

  const transition = (next: IncidentStatus, evidence: Record<string, string> = {}) => runAction(async () => {
    const id = selected?.id; if (!id) return;
    const result = await apiCall<Api<VendorIncident>>(`${API_BASE}/tprm/incidents/${encodeURIComponent(id)}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next, ...evidence }) });
    if (workspaceRef.current !== workspaceId) return;
    setSelected(result.data); setResolutionOpen(false); await load();
  });

  const filtered = useMemo(() => incidents.filter(incident => {
    const text = `${incident.title} ${incident.vendorName || ''} ${incident.incidentType} ${incident.description || ''}`.toLowerCase();
    const metricMatches = metricView === 'all'
      || (metricView === 'open' && !['resolved', 'closed'].includes(incident.status))
      || (metricView === 'critical' && incident.severity === 'critical' && !['resolved', 'closed'].includes(incident.status))
      || (metricView === 'data' && incident.dataAffected && !['resolved', 'closed'].includes(incident.status))
      || (metricView === 'resolved' && ['resolved', 'closed'].includes(incident.status));
    return metricMatches && (!search || text.includes(search.toLowerCase())) && (!status || incident.status === status) && (!severity || incident.severity === severity);
  }), [incidents, metricView, search, severity, status]);
  const metrics = useMemo(() => ({ open: incidents.filter(item => !['resolved', 'closed'].includes(item.status)).length, critical: incidents.filter(item => item.severity === 'critical' && !['resolved', 'closed'].includes(item.status)).length, data: incidents.filter(item => item.dataAffected && !['resolved', 'closed'].includes(item.status)).length, resolved: incidents.filter(item => ['resolved', 'closed'].includes(item.status)).length }), [incidents]);

  return <div className="supplierIncidentPage"><header className="supplierIncidentHero"><div><span>SUPPLIER & CONTRACT MANAGEMENT / OPERATIONS</span><h1>Supplier Incidents</h1><p>Investigate supplier security, availability, compliance and data events through a governed, auditable lifecycle.</p></div><button className="supplierIncidentButton primary" disabled={busy} onClick={() => setCreateOpen(true)}>Report incident</button></header>
    <section className="supplierIncidentMetrics"><button onClick={() => { setMetricView('open'); setStatus(''); setSeverity(''); }}><span>Open incidents</span><strong>{metrics.open}</strong><small>Requires operational follow-up</small></button><button onClick={() => { setMetricView('critical'); setStatus(''); setSeverity(''); }}><span>Critical open</span><strong>{metrics.critical}</strong><small>Immediate management attention</small></button><button onClick={() => { setMetricView('data'); setStatus(''); setSeverity(''); }}><span>Data affected</span><strong>{metrics.data}</strong><small>Recorded supplier data impact</small></button><button onClick={() => { setMetricView('resolved'); setStatus(''); setSeverity(''); }}><span>Resolved</span><strong>{metrics.resolved}</strong><small>Resolution or closure recorded</small></button></section>
    {error ? <div className="supplierIncidentError" role="alert">{error}</div> : null}
    <section className="supplierIncidentToolbar"><input aria-label="Search supplier incidents" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search incident, supplier or type..."/><select aria-label="Incident status" value={status} onChange={event => { setMetricView('all'); setStatus(event.target.value); }}><option value="">All statuses</option>{Object.keys(transitions).map(value => <option key={value}>{clean(value)}</option>)}</select><select aria-label="Incident severity" value={severity} onChange={event => { setMetricView('all'); setSeverity(event.target.value); }}><option value="">All severities</option>{['critical', 'high', 'medium', 'low'].map(value => <option key={value}>{value}</option>)}</select><button className="supplierIncidentButton" onClick={() => { setSearch(''); setStatus(''); setSeverity(''); setMetricView('all'); }}>Clear filters</button></section>
    <div className="supplierIncidentWorkspace"><section className="supplierIncidentTable" aria-busy={loading}>{loading ? <div className="supplierIncidentEmpty">Loading persisted supplier incidents...</div> : filtered.length ? <table><thead><tr><th>Incident</th><th>Supplier</th><th>Type</th><th>Severity</th><th>Status</th><th>Detected</th></tr></thead><tbody>{filtered.map(incident => <tr key={incident.id} tabIndex={0} className={selected?.id === incident.id ? 'selected' : ''} onClick={() => { if (!actionLock.current) setSelected(incident); }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !actionLock.current) { event.preventDefault(); setSelected(incident); } }}><td><strong>{incident.title}</strong><small>{incident.id.slice(0, 8)}</small></td><td>{incident.vendorName || incident.vendorId}</td><td>{clean(incident.incidentType)}</td><td><span className={`supplierIncidentBadge ${incident.severity}`}>{incident.severity}</span></td><td><span className={`supplierIncidentBadge ${incident.status}`}>{clean(incident.status)}</span></td><td>{incident.detectedAt ? new Date(incident.detectedAt).toLocaleDateString() : 'Not recorded'}</td></tr>)}</tbody></table> : <div className="supplierIncidentEmpty">No persisted supplier incidents match the selected filters.</div>}</section>
      {selected ? <aside className="supplierIncidentDetail" aria-busy={busy}><button className="supplierIncidentClose" aria-label="Close incident detail" disabled={busy} onClick={() => setSelected(null)}>×</button><span>{selected.vendorName || 'SUPPLIER INCIDENT'}</span><h2>{selected.title}</h2><p>{selected.description || 'No description recorded.'}</p><div className="supplierIncidentFacts"><div><span>Impact</span><strong>{selected.impact || 'Not recorded'}</strong></div><div><span>Data affected</span><strong>{selected.dataAffected ? 'Yes' : 'No'}</strong></div><div><span>Records affected</span><strong>{selected.recordsAffected ?? 'Not recorded'}</strong></div><div><span>Assigned to</span><strong>{selected.assignedToName || 'Unassigned'}</strong></div><div><span>Root cause</span><strong>{selected.rootCause || 'Not recorded'}</strong></div><div><span>Remediation</span><strong>{selected.remediation || 'Not recorded'}</strong></div></div><div className="supplierIncidentActions">{transitions[selected.status].map(next => <button key={next} className="supplierIncidentButton primary" disabled={busy} onClick={() => next === 'resolved' ? setResolutionOpen(true) : void transition(next)}>{next === 'closed' ? 'Close incident' : `Move to ${clean(next)}`}</button>)}</div></aside> : <aside className="supplierIncidentDetail supplierIncidentEmpty">Select an incident to review recorded impact, ownership and authorised lifecycle actions.</aside>}
    </div>
    {createOpen ? <IncidentForm vendors={vendors} busy={busy} onClose={() => { if (!busy) setCreateOpen(false); }} onSubmit={payload => runAction(async () => { await apiCall(`${API_BASE}/tprm/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (workspaceRef.current === workspaceId) { setCreateOpen(false); await load(); } })}/> : null}
    {resolutionOpen ? <ResolutionForm busy={busy} onClose={() => { if (!busy) setResolutionOpen(false); }} onSubmit={payload => transition('resolved', payload)}/> : null}
  </div>;
}

function IncidentForm({ vendors, busy, onClose, onSubmit }: { vendors: Vendor[]; busy: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => void }) {
  return <Modal accessibleDialog isOpen onClose={onClose} title="Report supplier incident" width="720px"><form className="supplierIncidentForm" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ vendorId: data.get('vendorId'), title: data.get('title'), incidentType: data.get('incidentType'), severity: data.get('severity'), description: data.get('description'), impact: data.get('impact'), detectedAt: data.get('detectedAt') || undefined, occurredAt: data.get('occurredAt') || undefined, dataAffected: data.get('dataAffected') === 'on', recordsAffected: data.get('recordsAffected') ? Number(data.get('recordsAffected')) : undefined }); }}><fieldset disabled={busy}><label>Supplier<select name="vendorId" required><option value="">Select supplier</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label>Incident type<select name="incidentType">{['security_breach', 'service_outage', 'compliance_violation', 'data_loss'].map(value => <option key={value} value={value}>{clean(value)}</option>)}</select></label><label className="wide">Title<input name="title" required maxLength={200}/></label><label>Severity<select name="severity">{['critical', 'high', 'medium', 'low'].map(value => <option key={value}>{value}</option>)}</select></label><label>Detected at<input name="detectedAt" type="datetime-local"/></label><label>Occurred at<input name="occurredAt" type="datetime-local"/></label><label>Records affected<input name="recordsAffected" type="number" min="0"/></label><label className="wide">Description<textarea name="description" required maxLength={4000}/></label><label className="wide">Business impact<textarea name="impact" maxLength={4000}/></label><label className="check wide"><input name="dataAffected" type="checkbox"/> Supplier reported that data was affected</label><div className="supplierIncidentActions wide"><button type="button" className="supplierIncidentButton" onClick={onClose}>Cancel</button><button type="submit" className="supplierIncidentButton primary">{busy ? 'Saving...' : 'Report incident'}</button></div></fieldset></form></Modal>;
}

function ResolutionForm({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (payload: Record<string, string>) => void }) {
  return <Modal accessibleDialog isOpen onClose={onClose} title="Record supplier incident resolution" width="660px"><form className="supplierIncidentForm" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ rootCause: String(data.get('rootCause') || ''), remediation: String(data.get('remediation') || ''), lessonsLearned: String(data.get('lessonsLearned') || '') }); }}><fieldset disabled={busy}><label className="wide">Root cause<textarea name="rootCause" required maxLength={4000}/></label><label className="wide">Remediation completed<textarea name="remediation" required maxLength={4000}/></label><label className="wide">Lessons learned<textarea name="lessonsLearned" maxLength={4000}/></label><div className="supplierIncidentActions wide"><button type="button" className="supplierIncidentButton" onClick={onClose}>Cancel</button><button type="submit" className="supplierIncidentButton primary">{busy ? 'Resolving...' : 'Record resolution'}</button></div></fieldset></form></Modal>;
}
