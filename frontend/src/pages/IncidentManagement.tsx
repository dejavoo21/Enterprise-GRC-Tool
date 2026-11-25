import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, EmptyStatePanel, Modal, PageHeader } from '../components';
import { assignSecurityCase, commentOnSecurityCase, createSecurityIncident, createSecurityVulnerability, getIncidentManagementState, getSecurityCaseHistory, transitionSecurityCase, updateIncidentCaseContext } from '../lib/incidentManagement';
import type { CaseSeverity, IncidentManagementState, IncidentStatus, SecurityCaseEvent, SecurityIncident, SecurityVulnerability, VulnerabilityStatus } from '../types/incidentManagement';
import './IncidentManagement.css';

type Tab = 'incidents' | 'insider-risk' | 'vulnerabilities';
type Selected = { kind: 'incident'; record: SecurityIncident } | { kind: 'vulnerability'; record: SecurityVulnerability };
const incidentNext: Record<IncidentStatus, IncidentStatus[]> = { open: ['triaged', 'cancelled'], triaged: ['investigating', 'cancelled'], investigating: ['contained', 'remediating', 'cancelled'], contained: ['remediating', 'resolved'], remediating: ['resolved'], resolved: ['closed', 'investigating'], closed: [], cancelled: [] };
const vulnerabilityNext: Record<VulnerabilityStatus, VulnerabilityStatus[]> = { identified: ['triaged', 'false_positive'], triaged: ['remediation_planned', 'accepted', 'false_positive'], remediation_planned: ['in_progress', 'accepted'], in_progress: ['mitigated', 'accepted'], mitigated: ['closed', 'in_progress'], accepted: ['closed', 'in_progress'], closed: [], false_positive: [] };
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set';
const splitIds = (value: string) => value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
const badgeVariant = (severity: CaseSeverity) => severity === 'critical' || severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'default';

function validateReviewedContext(riskGroups: string, indicatorSummary: string, handlingBasis: string, notes?: string) {
  const labels = splitIds(riskGroups);
  if (labels.length > 20 || labels.some(label => label.length > 100)) return 'Use no more than 20 risk group labels, with no label longer than 100 characters.';
  if (indicatorSummary.trim().length > 4000 || handlingBasis.trim().length > 4000) return 'Indicator summary and handling basis must not exceed 4,000 characters.';
  if (notes !== undefined && notes.trim().length > 4000) return 'Change rationale must not exceed 4,000 characters.';
  return null;
}

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
  const [subjectUserId, setSubjectUserId] = useState('');
  const [riskGroups, setRiskGroups] = useState('');
  const [indicatorSummary, setIndicatorSummary] = useState('');
  const [handlingBasis, setHandlingBasis] = useState('');
  const [reviewDueAt, setReviewDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isIncident = kind !== 'vulnerabilities';
  const isInsiderCase = kind === 'insider-risk';
  const requestClose = () => { if (!saving) onClose(); };

  const submit = async () => {
    if (saving) return;
    if (!title.trim() || !owner.trim() || (isIncident && !typeOrReference.trim()) || (isInsiderCase && (!subjectUserId.trim() || !indicatorSummary.trim() || !handlingBasis.trim()))) { setError(isInsiderCase ? 'Complete the title, owner, incident type, subject member ID, indicator summary and handling basis.' : 'Complete the required title, owner and incident type fields.'); return; }
    const contextError = isInsiderCase ? validateReviewedContext(riskGroups, indicatorSummary, handlingBasis) : null;
    if (contextError) { setError(contextError); return; }
    setSaving(true); setError('');
    try {
      const common = { title, description, owner, severity, source, linkedRiskIds: splitIds(riskIds), linkedAssetIds: splitIds(assetIds), linkedControlIds: splitIds(controlIds), linkedEvidenceIds: splitIds(evidenceIds) };
      if (isIncident) await createSecurityIncident({ ...common, incidentType: typeOrReference, detectedAt: `${recordDate}T00:00:00.000Z`, targetResolutionAt: dueDate ? `${dueDate}T23:59:59.000Z` : null, caseCategory: isInsiderCase ? 'insider_risk' : 'security_incident', subjectUserId: subjectUserId || null, riskGroupLabels: splitIds(riskGroups), indicatorSummary: indicatorSummary || null, handlingBasis: handlingBasis || null, reviewDueAt: reviewDueAt ? `${reviewDueAt}T23:59:59.000Z` : null });
      else await createSecurityVulnerability({ ...common, externalReference: typeOrReference || null, cvssScore: cvssScore || null, discoveredAt: `${recordDate}T00:00:00.000Z`, dueAt: dueDate ? `${dueDate}T23:59:59.000Z` : null, linkedIncidentIds: splitIds(incidentIds) });
      await onCreated(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Record could not be created.'); } finally { setSaving(false); }
  };

  return <Modal accessibleDialog isOpen onClose={requestClose} title={isInsiderCase ? 'Record reviewed insider-risk case' : isIncident ? 'Record security incident' : 'Record vulnerability'} width="760px" footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Create record'}</Button></>}>
    <fieldset className="incidentForm" disabled={saving} aria-busy={saving}>
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
      {isInsiderCase && <><div className="incidentNotice">Case management only. Record the minimum reviewed context necessary for investigation. LAFLO does not calculate employee risk scores, monitor behaviour or collect endpoint telemetry.</div><div className="incidentFormGrid"><label>Subject workspace member ID *<input value={subjectUserId} onChange={event => setSubjectUserId(event.target.value)} placeholder="Authorised workspace user UUID" /></label><label>Review due date<input type="date" value={reviewDueAt} onChange={event => setReviewDueAt(event.target.value)} /></label><label>Risk group labels (maximum 20)<textarea rows={2} value={riskGroups} onChange={event => setRiskGroups(event.target.value)} placeholder="Reviewed categories, comma separated" /></label><label>Handling basis *<textarea rows={2} maxLength={4000} value={handlingBasis} onChange={event => setHandlingBasis(event.target.value)} placeholder="Purpose, authority and minimisation rationale" /></label></div><label>Reviewed indicator summary *<textarea rows={3} maxLength={4000} value={indicatorSummary} onChange={event => setIndicatorSummary(event.target.value)} /></label></>}
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

function CaseContextModal({ incident, onClose, onSaved }: { incident: SecurityIncident; onClose: () => void; onSaved: () => Promise<void> }) {
  const [caseCategory, setCaseCategory] = useState(incident.caseCategory);
  const [subjectUserId, setSubjectUserId] = useState(incident.subjectUserId || '');
  const [riskGroups, setRiskGroups] = useState(incident.riskGroupLabels.join(', '));
  const [indicatorSummary, setIndicatorSummary] = useState(incident.indicatorSummary || '');
  const [handlingBasis, setHandlingBasis] = useState(incident.handlingBasis || '');
  const [reviewDueAt, setReviewDueAt] = useState(incident.reviewDueAt?.slice(0, 10) || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const insiderCase = caseCategory === 'insider_risk';
  const changeCaseCategory = (next: SecurityIncident['caseCategory']) => {
    setCaseCategory(next);
    if (next === 'security_incident') {
      setSubjectUserId(''); setRiskGroups(''); setIndicatorSummary(''); setHandlingBasis(''); setReviewDueAt('');
    }
  };
  const submit = async () => {
    if (saving) return;
    if (!notes.trim() || (insiderCase && (!subjectUserId.trim() || !indicatorSummary.trim() || !handlingBasis.trim()))) { setError('Change rationale is required. Insider-risk cases also require subject member ID, indicator summary and handling basis.'); return; }
    const contextError = validateReviewedContext(riskGroups, indicatorSummary, handlingBasis, notes);
    if (contextError) { setError(contextError); return; }
    setSaving(true); setError('');
    try { await updateIncidentCaseContext(incident.id, { caseCategory, subjectUserId: subjectUserId || null, riskGroupLabels: splitIds(riskGroups), indicatorSummary: indicatorSummary || null, handlingBasis: handlingBasis || null, reviewDueAt: reviewDueAt ? `${reviewDueAt}T23:59:59.000Z` : null, notes }); await onSaved(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Case context could not be updated.'); }
    finally { setSaving(false); }
  };
  return <Modal accessibleDialog isOpen onClose={() => { if (!saving) onClose(); }} title="Review case context" width="720px" footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : 'Save reviewed context'}</Button></>}><fieldset className="incidentForm" disabled={saving} aria-busy={saving}><div className="incidentNotice">Use insider-risk classification only for an authorised, reviewed case. Labels are human-reviewed categories, not employee scores. Reclassifying as a security incident removes this context when saved.</div><div className="incidentFormGrid"><label>Case category<select value={caseCategory} onChange={event => changeCaseCategory(event.target.value as SecurityIncident['caseCategory'])}><option value="security_incident">Security incident</option><option value="insider_risk">Insider risk case</option></select></label>{insiderCase && <><label>Subject workspace member ID *<input value={subjectUserId} onChange={event => setSubjectUserId(event.target.value)} /></label><label>Risk group labels (maximum 20)<textarea rows={2} value={riskGroups} onChange={event => setRiskGroups(event.target.value)} /></label><label>Review due date<input type="date" value={reviewDueAt} onChange={event => setReviewDueAt(event.target.value)} /></label></>}</div>{insiderCase && <><label>Reviewed indicator summary *<textarea rows={3} maxLength={4000} value={indicatorSummary} onChange={event => setIndicatorSummary(event.target.value)} /></label><label>Handling basis *<textarea rows={3} maxLength={4000} value={handlingBasis} onChange={event => setHandlingBasis(event.target.value)} /></label></>}<label>Change rationale *<textarea rows={3} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} /></label>{error && <div className="incidentError" role="alert">{error}</div>}</fieldset></Modal>;
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
    <fieldset className="incidentDecision" disabled={saving} aria-busy={saving}><label>Decision / transition notes {requiresNotes ? '*' : '(optional)'}<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} /></label>{error && <div className="incidentError" role="alert">{error}</div>}</fieldset>
  </Modal>;
}

function CaseActivityModal({ selection, mode, onClose, onSaved }: { selection: Selected; mode: 'assign' | 'comment'; onClose: () => void; onSaved: () => Promise<void> }) {
  const [owner, setOwner] = useState(selection.record.owner);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const assigning = mode === 'assign';
  const requestClose = () => { if (!saving) onClose(); };
  const submit = async () => {
    if (saving) return;
    if ((assigning && !owner.trim()) || !notes.trim()) { setError(assigning ? 'Owner and assignment rationale are required.' : 'Enter an investigation comment.'); return; }
    setSaving(true); setError('');
    try {
      if (assigning) await assignSecurityCase(selection.kind, selection.record.id, owner.trim(), notes.trim());
      else await commentOnSecurityCase(selection.kind, selection.record.id, notes.trim());
      await onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : assigning ? 'Case could not be assigned.' : 'Comment could not be added.'); }
    finally { setSaving(false); }
  };
  return <Modal accessibleDialog isOpen onClose={requestClose} title={assigning ? 'Assign case owner' : 'Add investigation comment'} footer={<><Button variant="outline" onClick={requestClose} disabled={saving}>Cancel</Button><Button variant="primary" onClick={() => void submit()} disabled={saving}>{saving ? 'Saving...' : assigning ? 'Save assignment' : 'Add comment'}</Button></>}>
    <fieldset className="incidentDecision" disabled={saving} aria-busy={saving}>
      {assigning && <label>Owner *<input value={owner} onChange={event => setOwner(event.target.value)} /></label>}
      <label>{assigning ? 'Assignment rationale *' : 'Investigation comment *'}<textarea rows={5} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      <div className="incidentNotice">This entry is recorded in the immutable case history with your authenticated identity. It does not notify an external system.</div>
      {error && <div className="incidentError" role="alert">{error}</div>}
    </fieldset>
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
  const [owner, setOwner] = useState('');
  const [source, setSource] = useState('');
  const [scope, setScope] = useState<'all' | 'active' | 'overdue'>('all');
  const [selected, setSelected] = useState<Selected | null>(null);
  const [history, setHistory] = useState<SecurityCaseEvent[]>([]);
  const [form, setForm] = useState<Tab | null>(null);
  const [transition, setTransition] = useState<IncidentStatus | VulnerabilityStatus | null>(null);
  const [caseActivity, setCaseActivity] = useState<'assign' | 'comment' | null>(null);
  const [editingContext, setEditingContext] = useState(false);
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
    const items = tab === 'vulnerabilities' ? state?.vulnerabilities || [] : (state?.incidents || []).filter(item => tab === 'insider-risk' ? item.caseCategory === 'insider_risk' : item.caseCategory !== 'insider_risk');
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      const terminal = 'incidentRef' in item ? ['closed', 'cancelled'].includes(item.status) : ['closed', 'false_positive'].includes(item.status);
      const due = 'targetResolutionAt' in item ? item.targetResolutionAt : item.dueAt;
      const inScope = scope === 'all' || (scope === 'active' && !terminal) || (scope === 'overdue' && !terminal && Boolean(due) && new Date(due as string).getTime() < viewTimestamp);
      return inScope && (!severity || item.severity === severity) && (!status || item.status === status) && (!owner || item.owner === owner) && (!source || item.source === source) && (!needle || `${'incidentRef' in item ? item.incidentRef : item.vulnerabilityRef} ${item.title} ${item.description} ${item.owner}`.toLowerCase().includes(needle));
    });
  }, [owner, scope, search, severity, source, state, status, tab, viewTimestamp]);

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
  const clearFilters = () => { setStatus(''); setSeverity(''); setOwner(''); setSource(''); setScope('all'); setSearch(''); };
  const switchTab = (next: Tab) => { setTab(next); clearFilters(); setSelected(null); setHistory([]); };

  if (loading && !state) return <div className="incidentWorkspace"><EmptyStatePanel eyebrow="Incident & Vulnerability Management" title="Loading operational records" description="The platform is loading workspace-scoped incident and vulnerability records." /></div>;
  if (error && !state) return <div className="incidentWorkspace"><EmptyStatePanel eyebrow="Incident & Vulnerability Management" title="Unable to load records" description={error} actions={<Button variant="primary" onClick={() => void load()}>Retry</Button>} /></div>;
  const summary = state?.summary || { openIncidents: 0, criticalIncidents: 0, openVulnerabilities: 0, overdueVulnerabilities: 0 };
  const currentStatuses = tab === 'vulnerabilities' ? Object.keys(vulnerabilityNext) : Object.keys(incidentNext);
  const currentRecords = tab === 'vulnerabilities' ? state?.vulnerabilities || [] : (state?.incidents || []).filter(item => tab === 'insider-risk' ? item.caseCategory === 'insider_risk' : item.caseCategory !== 'insider_risk');
  const owners = [...new Set(currentRecords.map(item => item.owner).filter(Boolean))].sort();
  const sources = [...new Set(currentRecords.map(item => item.source).filter(Boolean))].sort();
  const hasFilters = Boolean(search || severity || status || owner || source || scope !== 'all');
  const nextStatuses = selected ? selected.kind === 'incident' ? incidentNext[selected.record.status] : vulnerabilityNext[selected.record.status] : [];
  const openLinkedRecord = (type: 'incident' | 'risk' | 'asset' | 'control' | 'evidence', id: string) => {
    const destinations = {
      incident: `/incidents?tab=incidents&search=${encodeURIComponent(id)}`,
      risk: `/risks?search=${encodeURIComponent(id)}`,
      asset: `/assets?search=${encodeURIComponent(id)}`,
      control: `/controls?search=${encodeURIComponent(id)}`,
      evidence: `/evidence?search=${encodeURIComponent(id)}`,
    };
    navigate(destinations[type]);
  };

  return <div className="incidentWorkspace">
    <div className="incidentHero"><PageHeader breadcrumb="Operations / Incident & Vulnerability Management" title="Incident & Vulnerability Management" description="Record, triage and resolve security incidents, reviewed insider-risk cases and vulnerabilities without replacing specialist vendor, privacy or AI workflows." action={<Button variant="primary" onClick={() => setForm(tab)}>{tab === 'insider-risk' ? 'Record insider-risk case' : tab === 'incidents' ? 'Record incident' : 'Record vulnerability'}</Button>} /></div>
    <div className="incidentTabs" role="tablist" aria-label="Incident management views"><Button role="tab" aria-selected={tab === 'incidents'} variant={tab === 'incidents' ? 'primary' : 'ghost'} onClick={() => switchTab('incidents')}>Incidents</Button><Button role="tab" aria-selected={tab === 'insider-risk'} variant={tab === 'insider-risk' ? 'primary' : 'ghost'} onClick={() => switchTab('insider-risk')}>Insider risk cases</Button><Button role="tab" aria-selected={tab === 'vulnerabilities'} variant={tab === 'vulnerabilities' ? 'primary' : 'ghost'} onClick={() => switchTab('vulnerabilities')}>Vulnerabilities</Button><Button variant="ghost" onClick={() => navigate('/issues')}>Operational actions</Button></div>
    <div className="incidentMetrics">
      <button className="incidentMetric" onClick={() => { switchTab('incidents'); setScope('active'); }}><span>Open incidents</span><strong>{summary.openIncidents}</strong><span>Active response records</span></button>
      <button className="incidentMetric" onClick={() => { switchTab('incidents'); setSeverity('critical'); }}><span>Critical incidents</span><strong>{summary.criticalIncidents}</strong><span>Immediate management attention</span></button>
      <button className="incidentMetric" onClick={() => { switchTab('vulnerabilities'); setScope('active'); }}><span>Open vulnerabilities</span><strong>{summary.openVulnerabilities}</strong><span>Active remediation records</span></button>
      <button className="incidentMetric" onClick={() => { switchTab('vulnerabilities'); setScope('overdue'); }}><span>Overdue vulnerabilities</span><strong>{summary.overdueVulnerabilities}</strong><span>Past target date</span></button>
      <button className="incidentMetric" onClick={() => switchTab('insider-risk')}><span>Insider risk cases</span><strong>{state?.incidents.filter(item => item.caseCategory === 'insider_risk').length || 0}</strong><span>Reviewed case records, not user scores</span></button>
    </div>
    <div className="incidentToolbar"><input aria-label="Search records" placeholder="Search reference, title, owner or description" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter by view" value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="all">All records</option><option value="active">Active records</option><option value="overdue">Overdue records</option></select><select aria-label="Filter by severity" value={severity} onChange={event => setSeverity(event.target.value)}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{currentStatuses.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}</select><select aria-label="Filter by owner" value={owner} onChange={event => setOwner(event.target.value)}><option value="">All owners</option>{owners.map(item => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filter by source" value={source} onChange={event => setSource(event.target.value)}><option value="">All sources</option>{sources.map(item => <option key={item} value={item}>{titleCase(item)}</option>)}</select>{hasFilters && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}</div>
    {hasFilters && <div className="incidentFilterSummary" role="status"><strong>Filters applied:</strong>{search && <span>Search: {search}</span>}{scope !== 'all' && <span>View: {titleCase(scope)}</span>}{severity && <span>Severity: {titleCase(severity)}</span>}{status && <span>Status: {titleCase(status)}</span>}{owner && <span>Owner: {owner}</span>}{source && <span>Source: {titleCase(source)}</span>}<span>{rows.length} matching record{rows.length === 1 ? '' : 's'}</span></div>}
    <div className={`incidentContent${selected ? ' incidentContent--selected' : ''}`}>
      <section className="incidentRegister"><header><strong>{tab === 'insider-risk' ? 'Insider risk case register' : tab === 'incidents' ? 'Incident register' : 'Vulnerability register'}</strong><div>{rows.length} recorded in this view</div></header>
        {rows.length === 0 ? <EmptyStatePanel eyebrow="Current workspace" title={`No ${tab} match this view`} description="Create a reviewed record or clear the current filters. No sample records are generated." /> : <div className="incidentTableScroll"><table className="incidentTable"><thead><tr><th>Reference</th><th>Title</th><th>Severity</th><th>Status</th><th>Owner</th><th>Target</th></tr></thead><tbody>{rows.map(item => { const kind = tab === 'vulnerabilities' ? 'vulnerability' : 'incident'; const reference = 'incidentRef' in item ? item.incidentRef : item.vulnerabilityRef; const target = 'targetResolutionAt' in item ? item.targetResolutionAt : item.dueAt; const isSelected = selected?.record.id === item.id; return <tr key={item.id} tabIndex={0} role="button" aria-selected={isSelected} onClick={() => void choose({ kind, record: item } as Selected)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void choose({ kind, record: item } as Selected); } }}><td><strong>{reference}</strong></td><td>{item.title}</td><td><Badge variant={badgeVariant(item.severity)} size="sm">{titleCase(item.severity)}</Badge></td><td><Badge variant={['closed', 'resolved', 'mitigated'].includes(item.status) ? 'success' : 'default'} size="sm">{titleCase(item.status)}</Badge></td><td>{item.owner}</td><td>{formatDate(target)}</td></tr>; })}</tbody></table></div>}
      </section>
      {selected && <aside className="incidentDetail"><header><div><small>{selected.kind === 'incident' ? selected.record.incidentRef : selected.record.vulnerabilityRef}</small><h2>{selected.record.title}</h2></div><Button aria-label="Close details" variant="ghost" onClick={() => setSelected(null)}>Close</Button></header><div className="incidentDetailBody">
        <p>{selected.record.description || 'No description recorded.'}</p>
        <dl className="incidentFacts"><div><dt>Status</dt><dd>{titleCase(selected.record.status)}</dd></div><div><dt>Severity</dt><dd>{titleCase(selected.record.severity)}</dd></div><div><dt>Owner</dt><dd>{selected.record.owner}</dd></div><div><dt>Source</dt><dd>{selected.record.source}</dd></div>{selected.kind === 'incident' ? <><div><dt>Type</dt><dd>{selected.record.incidentType}</dd></div><div><dt>Detected</dt><dd>{formatDate(selected.record.detectedAt)}</dd></div></> : <><div><dt>External reference</dt><dd>{selected.record.externalReference || 'Not recorded'}</dd></div><div><dt>CVSS</dt><dd>{selected.record.cvssScore ?? 'Not recorded'}</dd></div></>}</dl>
        {selected.kind === 'incident' && selected.record.caseCategory === 'insider_risk' && <div className="incidentContext"><strong>Governed insider-risk context</strong><dl className="incidentFacts"><div><dt>Subject member ID</dt><dd>{selected.record.subjectUserId || 'Not recorded'}</dd></div><div><dt>Review due</dt><dd>{formatDate(selected.record.reviewDueAt)}</dd></div><div><dt>Risk groups</dt><dd>{selected.record.riskGroupLabels.join(', ') || 'None recorded'}</dd></div><div><dt>Handling basis</dt><dd>{selected.record.handlingBasis || 'Not recorded'}</dd></div></dl><p><strong>Reviewed indicator:</strong> {selected.record.indicatorSummary || 'Not recorded'}</p><small>No employee risk score, behaviour trend or endpoint telemetry is generated by LAFLO.</small></div>}
        <div><strong>Case actions</strong><div className="incidentActions"><Button variant="outline" size="sm" onClick={() => setCaseActivity('assign')}>Assign owner</Button><Button variant="outline" size="sm" onClick={() => setCaseActivity('comment')}>Add comment</Button>{selected.kind === 'incident' && <Button variant="outline" size="sm" onClick={() => setEditingContext(true)}>Review case context</Button>}</div></div>
        <div><strong>Valid next actions</strong><div className="incidentActions">{nextStatuses.length ? nextStatuses.map(next => <Button key={next} variant="outline" size="sm" onClick={() => setTransition(next)}>{titleCase(next)}</Button>) : <span>No further lifecycle actions are available.</span>}</div></div>
        <div className="incidentLinks"><strong>Linked records</strong>{[...(selected.kind === 'vulnerability' ? [['Incidents', 'incident', selected.record.linkedIncidentIds] as const] : []), ['Risks', 'risk', selected.record.linkedRiskIds] as const, ['Assets', 'asset', selected.record.linkedAssetIds] as const, ['Controls', 'control', selected.record.linkedControlIds] as const, ['Evidence metadata', 'evidence', selected.record.linkedEvidenceIds] as const].map(([label, type, values]) => <div className="incidentLinkRow" key={label}><strong>{label}:</strong>{values.length ? <div className="incidentLinkedButtons">{values.map(id => <button type="button" key={id} onClick={() => openLinkedRecord(type, id)}>{id}</button>)}</div> : <span>None recorded</span>}</div>)}</div>
        <div className="incidentHistory"><strong>Audit history</strong>{history.length ? history.map(event => <div className="incidentHistoryItem" key={event.id}><strong>{titleCase(event.action)}</strong><div>{event.previousStatus ? `${titleCase(event.previousStatus)} → ` : ''}{event.newStatus ? titleCase(event.newStatus) : ''}</div><small>{formatDate(event.createdAt)} · {event.actorId}</small>{event.notes && <div>{event.notes}</div>}</div>) : <div className="incidentHistoryItem">No history entries returned.</div>}</div>
      </div></aside>}
    </div>
    {form && <CaseFormModal kind={form} onClose={() => setForm(null)} onCreated={async () => { await load(); }} />}
    {selected && transition && <TransitionModal selection={selected} status={transition} onClose={() => setTransition(null)} onSaved={refreshSelection} />}
    {selected && caseActivity && <CaseActivityModal selection={selected} mode={caseActivity} onClose={() => setCaseActivity(null)} onSaved={refreshSelection} />}
    {selected?.kind === 'incident' && editingContext && <CaseContextModal incident={selected.record} onClose={() => setEditingContext(false)} onSaved={refreshSelection} />}
  </div>;
}
