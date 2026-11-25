import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, EmptyStatePanel, Modal, PageHeader } from '../components';
import { createSecurityIncident, createSecurityVulnerability, getIncidentManagementState, getSecurityCaseHistory, transitionSecurityCase } from '../lib/incidentManagement';
import type { CaseSeverity, IncidentManagementState, IncidentStatus, SecurityCaseEvent, SecurityIncident, SecurityVulnerability, VulnerabilityStatus } from '../types/incidentManagement';
import './IncidentManagement.css';

type Tab = 'incidents' | 'vulnerabilities';
type Selected = { kind: 'incident'; record: SecurityIncident } | { kind: 'vulnerability'; record: SecurityVulnerability };
const incidentNext: Record<IncidentStatus, IncidentStatus[]> = { open: ['triaged', 'cancelled'], triaged: ['investigating', 'cancelled'], investigating: ['contained', 'remediating', 'cancelled'], contained: ['remediating', 'resolved'], remediating: ['resolved'], resolved: ['closed', 'investigating'], closed: [], cancelled: [] };
const vulnerabilityNext: Record<VulnerabilityStatus, VulnerabilityStatus[]> = { identified: ['triaged', 'false_positive'], triaged: ['remediation_planned', 'accepted', 'false_positive'], remediation_planned: ['in_progress', 'accepted'], in_progress: ['mitigated', 'accepted'], mitigated: ['closed', 'in_progress'], accepted: ['closed', 'in_progress'], closed: [], false_positive: [] };
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const splitIds = (value: string) => value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
const badgeVariant = (severity: CaseSeverity) => severity === 'critical' || severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'default';

function CaseFormModal({ kind, onClose, onCreated }: { kind: Tab; onClose: () => void; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [severity, setSeverity] = useState<CaseSeverity>('medium');
  const [typeOrReference, setTypeOrReference] = useState('');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [source, setSource] = useState('manual');
  const [cvssScore, setCvssScore] = useState('');
  const [riskIds, setRiskIds] = useState('');
  const [incidentIds, setIncidentIds] = useState('');
  const [assetIds, setAssetIds] = useState('');
  const [controlIds, setControlIds] = useState('');
  const [evidenceIds, setEvidenceIds] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isIncident = kind === 'incidents';
  const requestClose = () => { if (!saving) onClose(); };

  const submit = async () => {
    if (saving) return;
    if (!title.trim() || !owner.trim() || (isIncident && !typeOrReference.trim())) { setError('Complete the required title, owner and incident type fields.'); return; }
    setSaving(true); setError('');
    try {
      const common = { title, description, owner, severity, source, linkedRiskIds: splitIds(riskIds), linkedAssetIds: splitIds(assetIds), linkedControlIds: splitIds(controlIds), linkedEvidenceIds: splitIds(evidenceIds) };
      if (isIncident) await createSecurityIncident({ ...common, incidentType: typeOrReference, detectedAt: `${recordDate}T00:00:00.000Z`, targetResolutionAt: dueDate ? `${dueDate}T23:59:59.000Z` : null });
      else await createSecurityVulnerability({ ...common, externalReference: typeOrReference || null, cvssScore: cvssScore || null, discoveredAt: `${recordDate}T00:00:00.000Z`, dueAt: dueDate ? `${dueDate}T23:59:59.000Z` : null, linkedIncidentIds: splitIds(incidentIds) });
      await onCreated(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Record could not be created.'); } finally { setSaving(false); }
  };

  return <Modal accessibleDialog isOpen onClose={requestClose} title={isIncident ? 'Record security incident' : 'Record vulnerability'} width="760px" footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Create record'}</Button></>}>
    <fieldset className="incidentForm" disabled={saving}>
      <div className="incidentNotice">Create only a reviewed record. Linked IDs are validated in this workspace. Evidence IDs reference metadata records; this form does not upload a file or claim an attachment exists.</div>
      <div className="incidentFormGrid">
        <label>Title *<input value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Owner *<input value={owner} onChange={event => setOwner(event.target.value)} /></label>
        <label>Severity *<select value={severity} onChange={event => setSeverity(event.target.value as CaseSeverity)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label>{isIncident ? 'Incident type *' : 'External reference (optional)'}<input value={typeOrReference} onChange={event => setTypeOrReference(event.target.value)} placeholder={isIncident ? 'Security event, data loss, malware...' : 'CVE or scanner reference'} /></label>
        {!isIncident && <label>CVSS score (optional)<input type="number" min="0" max="10" step="0.1" value={cvssScore} onChange={event => setCvssScore(event.target.value)} /></label>}
        <label>{isIncident ? 'Detected date' : 'Discovered date'} *<input type="date" value={recordDate} onChange={event => setRecordDate(event.target.value)} /></label>
        <label>Target date (optional)<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
        <label>Source<input value={source} onChange={event => setSource(event.target.value)} /></label>
      </div>
      <label>Description<textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <div className="incidentFormGrid">
        {!isIncident && <label>Existing Incident IDs (optional)<textarea rows={2} value={incidentIds} onChange={event => setIncidentIds(event.target.value)} /></label>}
        <label>Existing Risk IDs (optional)<textarea rows={2} value={riskIds} onChange={event => setRiskIds(event.target.value)} /></label>
        <label>Existing Asset IDs (optional)<textarea rows={2} value={assetIds} onChange={event => setAssetIds(event.target.value)} /></label>
        <label>Existing Control IDs (optional)<textarea rows={2} value={controlIds} onChange={event => setControlIds(event.target.value)} /></label>
        <label>Existing Evidence IDs (optional)<textarea rows={2} value={evidenceIds} onChange={event => setEvidenceIds(event.target.value)} /></label>
      </div>
      {error && <div className="incidentError" role="alert">{error}</div>}
    </fieldset>
  </Modal>;
}

function TransitionModal({ selection, status, onClose, onSaved }: { selection: Selected; status: IncidentStatus | VulnerabilityStatus; onClose: () => void; onSaved: () => Promise<void> }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestClose = () => { if (!saving) onClose(); };
  const requiresNotes = ['resolved', 'closed', 'mitigated', 'accepted', 'false_positive'].includes(status);
  const submit = async () => {
    if (saving) return;
    if (requiresNotes && !notes.trim()) { setError('Decision or resolution notes are required for this transition.'); return; }
    setSaving(true); setError('');
    try { await transitionSecurityCase(selection.kind, selection.record.id, status, notes); await onSaved(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Status could not be changed.'); }
    finally { setSaving(false); }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={`Move to ${titleCase(status)}`} footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Updating...' : 'Confirm transition'}</Button></>}>
    <fieldset className="incidentDecision" disabled={saving}><label>Decision / transition notes {requiresNotes ? '*' : '(optional)'}<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} /></label>{error && <div className="incidentError" role="alert">{error}</div>}</fieldset>
  </Modal>;
}

export function IncidentManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<IncidentManagementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(() => searchParams.get('tab') === 'vulnerabilities' ? 'vulnerabilities' : 'incidents');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'all' | 'active' | 'overdue'>('all');
  const [selected, setSelected] = useState<Selected | null>(null);
  const [history, setHistory] = useState<SecurityCaseEvent[]>([]);
  const [form, setForm] = useState<Tab | null>(null);
  const [transition, setTransition] = useState<IncidentStatus | VulnerabilityStatus | null>(null);
  const [viewTimestamp] = useState(() => Date.now());

  const load = useCallback(async () => {
    try { setLoading(true); setError(''); setState(await getIncidentManagementState()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Incident management could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => {
    const items = tab === 'incidents' ? state?.incidents || [] : state?.vulnerabilities || [];
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      const terminal = 'incidentRef' in item ? ['closed', 'cancelled'].includes(item.status) : ['closed', 'false_positive'].includes(item.status);
      const due = 'targetResolutionAt' in item ? item.targetResolutionAt : item.dueAt;
      const inScope = scope === 'all' || (scope === 'active' && !terminal) || (scope === 'overdue' && !terminal && Boolean(due) && new Date(due as string).getTime() < viewTimestamp);
      return inScope && (!severity || item.severity === severity) && (!status || item.status === status) && (!needle || `${'incidentRef' in item ? item.incidentRef : item.vulnerabilityRef} ${item.title} ${item.description} ${item.owner}`.toLowerCase().includes(needle));
    });
  }, [scope, search, severity, state, status, tab, viewTimestamp]);

  const choose = async (selection: Selected) => {
    setSelected(selection); setHistory([]);
    try { setHistory(await getSecurityCaseHistory(selection.kind, selection.record.id)); } catch { setHistory([]); }
  };
  const refreshSelection = async () => {
    await load();
    if (selected) {
      const refreshed = await getIncidentManagementState();
      const match = selected.kind === 'incident' ? refreshed.incidents.find(item => item.id === selected.record.id) : refreshed.vulnerabilities.find(item => item.id === selected.record.id);
      if (match) await choose({ kind: selected.kind, record: match } as Selected); else setSelected(null);
    }
  };
  const switchTab = (next: Tab) => { setTab(next); setStatus(''); setSeverity(''); setScope('all'); setSearch(''); setSelected(null); setHistory([]); };

  if (loading && !state) return <div className="incidentWorkspace"><EmptyStatePanel eyebrow="Incident & Vulnerability Management" title="Loading operational records" description="The platform is loading workspace-scoped incident and vulnerability records." /></div>;
  if (error && !state) return <div className="incidentWorkspace"><EmptyStatePanel eyebrow="Incident & Vulnerability Management" title="Unable to load records" description={error} actions={<Button variant="primary" onClick={() => void load()}>Retry</Button>} /></div>;
  const summary = state?.summary || { openIncidents: 0, criticalIncidents: 0, openVulnerabilities: 0, overdueVulnerabilities: 0 };
  const currentStatuses = tab === 'incidents' ? Object.keys(incidentNext) : Object.keys(vulnerabilityNext);
  const nextStatuses = selected ? selected.kind === 'incident' ? incidentNext[selected.record.status] : vulnerabilityNext[selected.record.status] : [];

  return <div className="incidentWorkspace">
    <div className="incidentHero"><PageHeader breadcrumb="Operations / Incident & Vulnerability Management" title="Incident & Vulnerability Management" description="Record, triage and resolve security incidents and vulnerabilities without replacing specialist vendor, privacy or AI workflows." action={<Button variant="primary" onClick={() => setForm(tab)}>{tab === 'incidents' ? 'Record incident' : 'Record vulnerability'}</Button>} /></div>
    <div className="incidentTabs" role="tablist" aria-label="Incident management views"><Button role="tab" aria-selected={tab === 'incidents'} variant={tab === 'incidents' ? 'primary' : 'ghost'} onClick={() => switchTab('incidents')}>Incidents</Button><Button role="tab" aria-selected={tab === 'vulnerabilities'} variant={tab === 'vulnerabilities' ? 'primary' : 'ghost'} onClick={() => switchTab('vulnerabilities')}>Vulnerabilities</Button><Button variant="ghost" onClick={() => navigate('/issues')}>Operational actions</Button></div>
    <div className="incidentMetrics">
      <button className="incidentMetric" onClick={() => { switchTab('incidents'); setScope('active'); }}><span>Open incidents</span><strong>{summary.openIncidents}</strong><span>Active response records</span></button>
      <button className="incidentMetric" onClick={() => { switchTab('incidents'); setSeverity('critical'); }}><span>Critical incidents</span><strong>{summary.criticalIncidents}</strong><span>Immediate management attention</span></button>
      <button className="incidentMetric" onClick={() => { switchTab('vulnerabilities'); setScope('active'); }}><span>Open vulnerabilities</span><strong>{summary.openVulnerabilities}</strong><span>Active remediation records</span></button>
      <button className="incidentMetric" onClick={() => { switchTab('vulnerabilities'); setScope('overdue'); }}><span>Overdue vulnerabilities</span><strong>{summary.overdueVulnerabilities}</strong><span>Past target date</span></button>
    </div>
    <div className="incidentToolbar"><input aria-label="Search records" placeholder="Search reference, title, owner or description" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter by view" value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="all">All records</option><option value="active">Active records</option><option value="overdue">Overdue records</option></select><select aria-label="Filter by severity" value={severity} onChange={event => setSeverity(event.target.value)}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{currentStatuses.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}</select></div>
    <div className={`incidentContent${selected ? ' incidentContent--selected' : ''}`}>
      <section className="incidentRegister"><header><strong>{tab === 'incidents' ? 'Incident register' : 'Vulnerability register'}</strong><div>{rows.length} recorded in this view</div></header>
        {rows.length === 0 ? <EmptyStatePanel eyebrow="Current workspace" title={`No ${tab} match this view`} description="Create a reviewed record or clear the current filters. No sample records are generated." /> : <div className="incidentTableScroll"><table className="incidentTable"><thead><tr><th>Reference</th><th>Title</th><th>Severity</th><th>Status</th><th>Owner</th><th>Target</th></tr></thead><tbody>{rows.map(item => { const kind = tab === 'incidents' ? 'incident' : 'vulnerability'; const reference = 'incidentRef' in item ? item.incidentRef : item.vulnerabilityRef; const target = 'targetResolutionAt' in item ? item.targetResolutionAt : item.dueAt; const isSelected = selected?.record.id === item.id; return <tr key={item.id} tabIndex={0} role="button" aria-selected={isSelected} onClick={() => void choose({ kind, record: item } as Selected)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void choose({ kind, record: item } as Selected); } }}><td><strong>{reference}</strong></td><td>{item.title}</td><td><Badge variant={badgeVariant(item.severity)} size="sm">{titleCase(item.severity)}</Badge></td><td><Badge variant={['closed', 'resolved', 'mitigated'].includes(item.status) ? 'success' : 'default'} size="sm">{titleCase(item.status)}</Badge></td><td>{item.owner}</td><td>{formatDate(target)}</td></tr>; })}</tbody></table></div>}
      </section>
      {selected && <aside className="incidentDetail"><header><div><small>{selected.kind === 'incident' ? selected.record.incidentRef : selected.record.vulnerabilityRef}</small><h2>{selected.record.title}</h2></div><Button aria-label="Close details" variant="ghost" onClick={() => setSelected(null)}>Close</Button></header><div className="incidentDetailBody">
        <p>{selected.record.description || 'No description recorded.'}</p>
        <dl className="incidentFacts"><div><dt>Status</dt><dd>{titleCase(selected.record.status)}</dd></div><div><dt>Severity</dt><dd>{titleCase(selected.record.severity)}</dd></div><div><dt>Owner</dt><dd>{selected.record.owner}</dd></div><div><dt>Source</dt><dd>{selected.record.source}</dd></div>{selected.kind === 'incident' ? <><div><dt>Type</dt><dd>{selected.record.incidentType}</dd></div><div><dt>Detected</dt><dd>{formatDate(selected.record.detectedAt)}</dd></div></> : <><div><dt>External reference</dt><dd>{selected.record.externalReference || 'Not recorded'}</dd></div><div><dt>CVSS</dt><dd>{selected.record.cvssScore ?? 'Not recorded'}</dd></div></>}</dl>
        <div><strong>Valid next actions</strong><div className="incidentActions">{nextStatuses.length ? nextStatuses.map(next => <Button key={next} variant="outline" size="sm" onClick={() => setTransition(next)}>{titleCase(next)}</Button>) : <span>No further lifecycle actions are available.</span>}</div></div>
        <div className="incidentLinks"><strong>Linked records</strong>{[...(selected.kind === 'vulnerability' ? [['Incidents', selected.record.linkedIncidentIds] as [string, string[]]] : []), ['Risks', selected.record.linkedRiskIds] as [string, string[]], ['Assets', selected.record.linkedAssetIds] as [string, string[]], ['Controls', selected.record.linkedControlIds] as [string, string[]], ['Evidence metadata', selected.record.linkedEvidenceIds] as [string, string[]]].map(([label, values]) => <div className="incidentLinkRow" key={label}><strong>{label}:</strong> {values.join(', ') || 'None recorded'}</div>)}</div>
        <div className="incidentHistory"><strong>Audit history</strong>{history.length ? history.map(event => <div className="incidentHistoryItem" key={event.id}><strong>{titleCase(event.action)}</strong><div>{event.previousStatus ? `${titleCase(event.previousStatus)} → ` : ''}{event.newStatus ? titleCase(event.newStatus) : ''}</div><small>{formatDate(event.createdAt)} · {event.actorId}</small>{event.notes && <div>{event.notes}</div>}</div>) : <div className="incidentHistoryItem">No history entries returned.</div>}</div>
      </div></aside>}
    </div>
    {form && <CaseFormModal kind={form} onClose={() => setForm(null)} onCreated={async () => { await load(); }} />}
    {selected && transition && <TransitionModal selection={selected} status={transition} onClose={() => setTransition(null)} onSaved={refreshSelection} />}
  </div>;
}
