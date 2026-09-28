import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { Badge, Button, EmptyStatePanel, PageHeader, PageSectionCard, PageToolbar } from '../components';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import { apiCall } from '../lib/api';
import { sortIssues } from '../lib/issueSort';
import { readAllowedFilter, updateQueryFilters } from '../lib/queryFilters';
import type { ApiResponse, IssuePriority, IssueRecord, IssueSourceType, IssueStatus } from '../types/issues';
import type { ActivityLedgerEntry } from '../types/activityLedger';
import './RiskWorkspaceShared.css';
import './RiskOperations.css';
import './RiskVisualSystem.css';
import { ActivityIcon, RefreshIcon } from '../components/icons';
import { RiskOperationsOverview } from './RiskOperationsOverview';
import { RiskOperationalQueue } from './RiskOperationalQueue';

const API_BASE = '/api/v1';

const OPERATIONS_TABS = ['overview', 'tracker', 'treatments', 'controls', 'evidence', 'overdue', 'reports'] as const;
type OperationsTab = typeof OPERATIONS_TABS[number];

const TAB_LABELS: Record<OperationsTab, string> = {
  overview: 'Overview', tracker: 'Action Tracker', treatments: 'Treatment Actions', controls: 'Control Actions', evidence: 'Evidence Requests', overdue: 'Overdue Items', reports: 'Reports',
};
const priorityVariant: Record<IssuePriority, 'danger' | 'warning' | 'info' | 'success'> = {
  Critical: 'danger', High: 'warning', Medium: 'info', Low: 'success',
};
const statusVariant: Record<IssueStatus, 'danger' | 'info' | 'warning' | 'success'> = {
  Open:'danger','In Progress':'info',Blocked:'danger','Awaiting Evidence':'warning','Awaiting Review':'warning',Completed:'success',Deferred:'warning',Cancelled:'success',Pending:'warning',Resolved:'success',
};
const SOURCE_OPTIONS: ('ALL' | IssueSourceType)[] = ['ALL', 'Risk', 'Treatment', 'Control', 'Evidence', 'Audit Readiness', 'Access Review', 'Asset Review', 'Vendor', 'Review Task', 'Training', 'Manual'];
const ISSUE_STATUSES: IssueStatus[] = ['Open', 'In Progress', 'Blocked', 'Awaiting Evidence', 'Awaiting Review', 'Completed', 'Deferred', 'Cancelled', 'Pending', 'Resolved'];

function formatDate(value?: string) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="riskOperationsDetailRow"><span>{label}</span><strong>{value}</strong></div>;
}

type SummaryItem = { label: string; value: number; tone?: 'danger' | 'warning' | 'info' | 'success' | 'default' };

function SummaryRows({ items }: { items: SummaryItem[] }) {
  const max = Math.max(1, ...items.map(item => item.value));
  return <div className="riskOperationsSummaryRows">{items.map((item) => <div key={item.label} className="riskOperationsSummaryRow"><span>{item.label}</span><strong>{item.value.toLocaleString()}</strong><small>{Math.round(item.value / max * 100)}%</small><i aria-hidden="true"><b style={{width:`${item.value / max * 100}%`}} /></i></div>)}</div>;
}

function IntegrationReadyState({ kind }: { kind: 'control' | 'evidence' }) {
  const isControl = kind === 'control';
  return <section className="riskOperationsIntegration" aria-labelledby={`${kind}-integration-title`}>
    <div className="riskOperationsIntegrationIntro"><span className="roHeroIcon" aria-hidden="true"><ActivityIcon size={24}/></span><div><Badge variant="info">Integration ready</Badge><h2 id={`${kind}-integration-title`}>{isControl ? 'Connect a control action source' : 'No evidence requests are currently available'}</h2><p>{isControl ? 'No control actions are fabricated. This view is ready for a tenant-scoped control action source when one is connected.' : 'Evidence requests will appear here only when a persisted evidence action source is available.'}</p></div></div>
    <div className="riskOperationsIntegrationGrid"><article><h3>Source readiness</h3><ul><li>Tenant-scoped authentication</li><li>Stable source identifiers</li><li>Owner and due-date mapping</li><li>Status synchronization</li></ul></article><article><h3>Potential sources</h3><div className="riskOperationsSourceChips">{(isControl ? ['ServiceNow','Jira','Microsoft Defender','SAP','Microsoft Excel','GRC Platform'] : ['Evidence Workspace','Audit Readiness','Control Testing']).map(source=><span key={source}>{source}</span>)}</div></article><article><h3>Data preview</h3><p>{isControl ? 'Action ID · Control ID · Risk Ref ID · Owner · Status · Priority · Due date' : 'Evidence ID · Control ID · Risk Ref ID · Owner · Review state · Expiry date'}</p></article></div>
  </section>;
}

export function Issues() {
  const { currentWorkspace } = useWorkspace();
  return <WorkspaceIssues key={currentWorkspace.id} />;
}

function WorkspaceIssues() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OperationsTab>(() => {
    const requested = searchParams.get('tab');
    if (requested && OPERATIONS_TABS.includes(requested as OperationsTab)) return requested as OperationsTab;
    return searchParams.has('type') || searchParams.has('status') || searchParams.has('priority') || searchParams.has('source') ? 'tracker' : 'overview';
  });
  const [search, setSearch] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dueFilter, setDueFilter] = useState<'ALL'|'OVERDUE'|'WEEK'|'NO_DATE'>('ALL');
  const [sort, setSort] = useState('source');
  const [savingAction, setSavingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<ActivityLedgerEntry[]>([]);
  const tabListRef = useRef<HTMLDivElement>(null);
  const issuePriorities: IssuePriority[] = ['Critical', 'High', 'Medium', 'Low'];
  const queryType = searchParams.get('type');
  const statusFilter: 'ALL' | IssueStatus = readAllowedFilter(searchParams, 'status', ISSUE_STATUSES) ?? 'ALL';
  const priorityFilter: 'ALL' | IssuePriority = readAllowedFilter(searchParams, 'priority', issuePriorities) ?? 'ALL';
  const setQueryFilter = (key: string, value: string | null) => setSearchParams(updateQueryFilters(searchParams, { [key]: value }));
  const setStatusFilter = (value: 'ALL' | IssueStatus) => setQueryFilter('status', value === 'ALL' ? null : value);
  const setPriorityFilter = (value: 'ALL' | IssuePriority) => setQueryFilter('priority', value === 'ALL' ? null : value);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const result = await apiCall<ApiResponse<IssueRecord[]>>(`${API_BASE}/issues`);
      const data = result.data;
      if (!Array.isArray(data)) throw new Error(result.error?.message || 'Unexpected issue response');
      setIssues(data);
      setSelectedIssueId((current) => current && data.some((item) => item.id === current) ? current : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issue register');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchIssues(); }, [fetchIssues]);

  useEffect(() => {
    const requested = searchParams.get('tab');
    if (requested && OPERATIONS_TABS.includes(requested as OperationsTab) && requested !== activeTab) setActiveTab(requested as OperationsTab);
  }, [activeTab, searchParams]);

  const sourceOptions = SOURCE_OPTIONS;
  const tabSource: 'ALL' | IssueSourceType = activeTab === 'treatments' ? 'Treatment' : activeTab === 'controls' ? 'Control' : activeTab === 'evidence' ? 'Evidence' : 'ALL';
  const sourceFilter: 'ALL' | IssueSourceType = readAllowedFilter(searchParams, 'source', sourceOptions.filter((value): value is IssueSourceType => value !== 'ALL')) ?? (queryType === 'treatment' ? 'Treatment' : tabSource);
  const setSourceFilter = (value: 'ALL' | IssueSourceType) => setQueryFilter('source', value === 'ALL' ? null : value);

  const filteredIssues = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return sortIssues(issues.filter((issue) => {
      if (ownerFilter && issue.owner !== ownerFilter) return false;
      if (statusFilter !== 'ALL' && issue.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) return false;
      if (sourceFilter !== 'ALL' && issue.sourceType !== sourceFilter) return false;
      if (dueFilter === 'OVERDUE' && !issue.isOverdue) return false;
      if (dueFilter === 'NO_DATE' && issue.dueDate) return false;
      if (dueFilter === 'WEEK') { const due = issue.dueDate ? new Date(issue.dueDate).getTime() : 0; const now = Date.now(); if (!due || due < now || due > now + 7 * 86400000) return false; }
      if (!searchTerm) return true;
      return [issue.id, issue.actionRef ?? '', issue.linkedRiskRef ?? '', issue.linkedTreatmentPlanId ?? '', issue.title, issue.owner, issue.domain, issue.sourceType, issue.description ?? ''].some((value) => value.toLowerCase().includes(searchTerm));
    }), sort);
  }, [issues, priorityFilter, search, sourceFilter, statusFilter, ownerFilter, dueFilter, sort]);

  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter, sourceFilter, ownerFilter, dueFilter, pageSize, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedIssues = filteredIssues.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedIssue = issues.find((item) => item.id === selectedIssueId) ?? null;
  const openIssues = useMemo(() => issues.filter((item) => !['Resolved','Completed','Cancelled'].includes(item.status)), [issues]);
  const escalations = useMemo(() => issues.filter((item) => !['Resolved','Completed','Cancelled'].includes(item.status) && (item.priority === 'Critical' || item.priority === 'High')).sort((a, b) => Number(b.priority === 'Critical') - Number(a.priority === 'Critical') || Number(b.isOverdue) - Number(a.isOverdue)), [issues]);
  const overdueIssues = useMemo(() => issues.filter((item) => item.isOverdue).sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()), [issues]);
  const dueThisWeek = useMemo(() => { const now = new Date(); const limit = new Date(now); limit.setDate(now.getDate() + 7); return issues.filter((item) => item.dueDate && !item.isOverdue && new Date(item.dueDate).getTime() <= limit.getTime()).length; }, [issues]);

  const summaryMetrics = useMemo(() => [
    { label: 'Open actions', value: openIssues.length, detail: 'Active action signals across linked sources', tone: openIssues.length > 0 ? 'danger' as const : 'success' as const },
    { label: 'Due this week', value: dueThisWeek, detail: 'Actions due within seven days', tone: dueThisWeek > 0 ? 'warning' as const : 'default' as const },
    { label: 'Overdue Items', value: overdueIssues.length, detail: 'Past due follow-up', tone: overdueIssues.length > 0 ? 'danger' as const : 'default' as const },
    { label: 'Critical actions', value: issues.filter((item) => item.priority === 'Critical').length, detail: 'Immediate escalation items', tone: 'warning' as const },
    { label: 'Blocked actions', value: issues.filter((item) => item.status === 'Blocked').length, detail: 'Actions unable to progress', tone: 'danger' as const },
    { label: 'Outside appetite', value: issues.filter((item) => item.outsideAppetite).length, detail: 'Actions linked to methodology breaches', tone: 'danger' as const },
    { label: 'Source Systems', value: new Set(issues.map((item) => item.sourceType)).size, detail: 'Live operational sources', tone: 'primary' as const },
  ], [dueThisWeek, issues, openIssues.length, overdueIssues.length]);
  const overviewMetrics = useMemo(() => [summaryMetrics[0], summaryMetrics[3], summaryMetrics[2], summaryMetrics[6]], [summaryMetrics]);
  const domainSummary = useMemo(() => Array.from(new Set(issues.map((item) => item.domain))).map((domain) => ({ label: domain, value: issues.filter((item) => item.domain === domain).length })).sort((a, b) => b.value - a.value).slice(0, 8), [issues]);
  const sourceSummary = useMemo<SummaryItem[]>(() => sourceOptions.filter((item) => item !== 'ALL').map((source) => ({ label: source, value: issues.filter((item) => item.sourceType === source).length })), [issues, sourceOptions]);
  const ownerSummary = useMemo<SummaryItem[]>(() => Array.from(new Set(issues.map((item) => item.owner).filter(Boolean))).map((owner) => ({ label: owner, value: issues.filter((item) => item.owner === owner).length })).sort((a, b) => b.value - a.value), [issues]);
  const prioritySummary = useMemo<SummaryItem[]>(() => (['Critical', 'High', 'Medium', 'Low'] as IssuePriority[]).map((priority) => ({ label: priority, value: issues.filter((item) => item.priority === priority).length, tone: priorityVariant[priority] })), [issues]);
  const statusSummary = useMemo<SummaryItem[]>(() => ISSUE_STATUSES.map((status) => ({ label: status, value: issues.filter((item) => item.status === status).length, tone: statusVariant[status] })), [issues]);
  const overdueOwnerSummary = useMemo<SummaryItem[]>(() => Array.from(new Set(overdueIssues.map(item => item.owner))).map(owner => ({ label: owner, value: overdueIssues.filter(item => item.owner === owner).length })).sort((a,b)=>b.value-a.value), [overdueIssues]);
  const assuranceSummary = useMemo<SummaryItem[]>(() => [
    { label:'Awaiting evidence', value:issues.filter(item=>item.status==='Awaiting Evidence').length, tone:'warning' },
    { label:'Evidence linked', value:issues.filter(item=>item.linkedEvidenceIds.length>0).length, tone:'success' },
    { label:'Controls linked', value:issues.filter(item=>item.linkedControlIds.length>0).length, tone:'info' },
    { label:'Blocked', value:issues.filter(item=>item.status==='Blocked').length, tone:'danger' },
  ] as SummaryItem[], [issues]);

  useEffect(() => {
    setActionFeedback(null);
    if (!selectedIssueId) { setActionHistory([]); return; }
    void apiCall<ApiResponse<IssueRecord>>(`${API_BASE}/issues/${encodeURIComponent(selectedIssueId)}`)
      .then(result => setActionHistory(result.data?.activityHistory || []))
      .catch(historyError => {
        setActionHistory([]);
        setActionFeedback(historyError instanceof Error ? `Audit history unavailable: ${historyError.message}` : 'Audit history unavailable.');
      });
  }, [selectedIssueId]);

  const refreshActionHistory = async (id: string) => {
    const result = await apiCall<ApiResponse<IssueRecord>>(`${API_BASE}/issues/${encodeURIComponent(id)}`);
    setActionHistory(result.data?.activityHistory || []);
  };

  const resetFilters = () => { setOwnerFilter(''); setDueFilter('ALL'); setSearch(''); setSearchParams(updateQueryFilters(searchParams, { status: null, priority: null, source: null, type: null })); };
  const updateSelectedAction = async (updates: Partial<IssueRecord>) => {
    if (!selectedIssue) return;
    try {
      setSavingAction(true); setActionFeedback(null);
      const result = await apiCall<ApiResponse<IssueRecord>>(`${API_BASE}/issues/${encodeURIComponent(selectedIssue.id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(updates) });
      if (!result.data) throw new Error(result.error?.message || 'Action update failed');
      setIssues(current => current.map(item => item.id === result.data!.id ? result.data! : item));
      await refreshActionHistory(result.data.id);
      setActionFeedback('Action updated and recorded in the activity ledger.');
    } catch (updateError) { setActionFeedback(updateError instanceof Error ? updateError.message : 'Action update failed'); }
    finally { setSavingAction(false); }
  };
  const selectTab = (tab: OperationsTab) => {
    const source = tab === 'treatments' ? 'Treatment' : tab === 'controls' ? 'Control' : tab === 'evidence' ? 'Evidence' : null;
    setActiveTab(tab);
    setSearchParams(current => updateQueryFilters(current, { tab: tab === 'overview' ? null : tab, source }));
  };
  const openOverviewTab = (tab: OperationsTab) => {
    selectTab(tab);
    requestAnimationFrame(() => tabListRef.current?.querySelector<HTMLButtonElement>(`#risk-operations-tab-${tab}`)?.focus());
  };
  const changePage = (nextPage: number) => {
    const boundedPage = Math.min(totalPages, Math.max(1, nextPage));
    setPage(boundedPage);
    setSelectedIssueId(null);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % OPERATIONS_TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + OPERATIONS_TABS.length) % OPERATIONS_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = OPERATIONS_TABS.length - 1;
    else return;
    event.preventDefault(); selectTab(OPERATIONS_TABS[next]);
    tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  if (loading || error) return <div className="riskWorkspacePage riskOperationsPage"><PageHeader breadcrumb="Risk Management / Risk Operations" title="Risk Operations" description="Derived operational issue register linked to active platform records." /><EmptyStatePanel eyebrow="Incident & Issue Management" title={loading ? 'Loading issue register' : 'Unable to load issue register'} description={loading ? 'The platform is compiling live issue records from existing operational sources.' : error || 'Unable to load issues.'} actions={error ? <Button variant="primary" onClick={() => void fetchIssues()}>Retry</Button> : undefined} /></div>;

  return <section className="riskWorkspacePage riskOperationsPage" aria-label="Risk Operations">
    <header className="roHero">
      <div className="roHeroIntro"><span className="roHeroIcon" aria-hidden="true"><ActivityIcon size={27} /></span><div><p className="roEyebrow">Risk Management / Risk Operations</p><h1>Risk Operations</h1><p>Enterprise action tracker for risk treatment, evidence, review, and operational follow-up.</p></div></div>
      <div className="roHeroRight"><div className="roHeroActions"><Button variant="outline" onClick={() => void fetchIssues()}><RefreshIcon size={16} /> Refresh</Button><span>Detect. Escalate. Resolve. Evidence.</span></div><dl className="roHeroSummary" aria-label="Current operational status">{overviewMetrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value.toLocaleString()}</dd></div>)}</dl></div>
    </header>

    {queryType || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || sourceFilter !== 'ALL' ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Applied Risk Operations filters">
      {queryType && queryType !== 'treatment' ? <AppliedQueryFilter label={queryType === 'audit-blocker' ? 'Audit blockers' : queryType} routeReady description="This action source is route-ready but does not yet expose a reliable record-level integration." onRemove={() => setQueryFilter('type', null)} /> : null}
      {statusFilter !== 'ALL' ? <AppliedQueryFilter label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('ALL')} /> : null}
      {priorityFilter !== 'ALL' ? <AppliedQueryFilter label={`Priority: ${priorityFilter}`} onRemove={() => setPriorityFilter('ALL')} /> : null}
      {sourceFilter !== 'ALL' ? <AppliedQueryFilter label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('ALL')} /> : null}
    </div> : null}

    <div className="riskOperationsTabs" role="tablist" aria-label="Risk Operations views" ref={tabListRef}>
      {OPERATIONS_TABS.map((tab, index) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`risk-operations-panel-${tab}`} id={`risk-operations-tab-${tab}`} tabIndex={activeTab === tab ? 0 : -1} className={activeTab === tab ? 'riskOperationsTab riskOperationsTabActive' : 'riskOperationsTab'} onClick={() => selectTab(tab)} onKeyDown={(event) => handleTabKeyDown(event, index)}>{TAB_LABELS[tab]}</button>)}
    </div>

    <section id={`risk-operations-panel-${activeTab}`} role="tabpanel" aria-labelledby={`risk-operations-tab-${activeTab}`} className="riskOperationsPanel">
      {activeTab === 'overview' ? <RiskOperationsOverview metrics={overviewMetrics} domains={domainSummary} statuses={statusSummary} total={issues.length} escalations={escalations} overdueCount={overdueIssues.length} openCount={openIssues.length} onTab={openOverviewTab} formatDate={formatDate} onIssue={(issue) => { resetFilters(); setSearch(issue.linkedRiskRef || issue.id); setSelectedIssueId(issue.id); setPage(1); openOverviewTab('tracker'); }} /> : null}
      {(['tracker','treatments','controls','evidence'] as OperationsTab[]).includes(activeTab) ? <><PageToolbar actions={<div className="riskOperationsToolbarActions"><Badge variant="default" size="sm">{filteredIssues.length} records</Badge><Button variant="ghost" onClick={resetFilters}>Reset filters</Button></div>}><div className="riskOperationsFilters">
        <input aria-label="Search actions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Action ID, Risk Ref ID, title, owner, or source" />
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | IssueStatus)}><option value="ALL">All statuses</option>{ISSUE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'ALL' | IssuePriority)}><option value="ALL">All priorities</option>{(['Critical', 'High', 'Medium', 'Low'] as IssuePriority[]).map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'ALL' | IssueSourceType)}>{sourceOptions.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All sources' : value}</option>)}</select>
      <select aria-label="Filter by owner" value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">All owners</option>{[...new Set(issues.map(issue => issue.owner).filter(Boolean))].sort().map(owner => <option key={owner} value={owner}>{owner}</option>)}</select>
      <select aria-label="Filter by due state" value={dueFilter} onChange={event=>setDueFilter(event.target.value as typeof dueFilter)}><option value="ALL">All due states</option><option value="OVERDUE">Overdue</option><option value="WEEK">Due this week</option><option value="NO_DATE">No due date</option></select></div></PageToolbar>
      {activeTab === 'treatments' && filteredIssues.length ? <section className="riskOperationsFocusMetrics" aria-label="Treatment action summary">{[['Total treatment actions',filteredIssues.length],['In progress',filteredIssues.filter(i=>i.status==='In Progress').length],['Awaiting review',filteredIssues.filter(i=>i.status==='Awaiting Review').length],['Overdue',filteredIssues.filter(i=>i.isOverdue).length],['Completed',filteredIssues.filter(i=>i.status==='Completed').length]].map(([metric,value])=><article key={metric}><span>{metric}</span><strong>{value}</strong></article>)}</section> : null}
      {filteredIssues.length === 0 ? activeTab === 'controls' ? <IntegrationReadyState kind="control"/> : activeTab === 'evidence' ? <IntegrationReadyState kind="evidence"/> : <EmptyStatePanel eyebrow="Risk Management / Risk Operations" title={`No ${TAB_LABELS[activeTab].toLowerCase()} match the current filters`} description="Change or reset the filters to review other operational actions." actions={<Button variant="secondary" onClick={resetFilters}>Reset Filters</Button>} /> : <div className="riskOperationsGrid">
        <PageSectionCard title="Enterprise Action Tracker" subtitle={`Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredIssues.length)} of ${filteredIssues.length} records.`} action={<label className="riskOperationsSort">Sort by <select aria-label="Sort action tracker" value={sort} onChange={event => setSort(event.target.value)}><option value="source">Source order</option><option value="due">Due date (earliest)</option><option value="priority">Highest priority</option><option value="title">Issue title</option></select></label>}>
          <div className="riskWorkspaceTableScroll riskOperationsTableViewport" tabIndex={0} aria-label="Enterprise action tracker, scroll for more records"><table className="riskWorkspaceTable"><thead><tr><th><span className="srOnly">Select</span></th>{['Action ID', 'Action', 'Risk Ref ID', 'Owner', 'Source', 'Status', 'Priority', 'Due Date'].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{pagedIssues.map((issue) => { const isSelected = selectedIssue?.id === issue.id; return <tr key={issue.id} className={isSelected ? 'riskOperationsSelectedRow' : ''} onClick={() => setSelectedIssueId(issue.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedIssueId(issue.id);}}} tabIndex={0}><td><input type="checkbox" aria-label={`Select ${issue.actionRef || issue.title}`} checked={isSelected} readOnly /></td><td><span className="riskOperationsReference" title={issue.actionRef || issue.id}>{issue.actionRef || 'Pending reference'}</span></td><td><button type="button" className="riskOperationsIssueTitle" aria-pressed={isSelected} onClick={() => setSelectedIssueId(issue.id)}>{issue.title}</button><span>{issue.domain}</span></td><td>{issue.linkedRiskRef || 'Not linked'}</td><td>{issue.owner}</td><td>{issue.sourceType}</td><td><Badge variant={statusVariant[issue.status]}>{issue.status}</Badge></td><td><Badge variant={priorityVariant[issue.priority]}>{issue.priority}</Badge></td><td className={issue.isOverdue ? 'riskOperationsOverdueText' : ''}>{formatDate(issue.dueDate)}</td></tr>; })}</tbody></table></div>
          <div className="riskOperationsPagination" aria-label="Action tracker pagination"><Button variant="outline" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Previous</Button><label>Rows per page <select aria-label="Action rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10,25,50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><span>{filteredIssues.length} records · Page {currentPage} of {totalPages}</span><Button variant="outline" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}>Next</Button></div>
        </PageSectionCard>
        {selectedIssue ? <PageSectionCard title="Selected Action" subtitle="Selected action and linked enterprise context." action={<Badge variant={priorityVariant[selectedIssue.priority]}>{selectedIssue.priority}</Badge>}><div className="riskOperationsDetail"><div><h3>{selectedIssue.title}</h3><p>{selectedIssue.description || 'No additional action description has been recorded.'}</p></div><div className="riskOperationsBadgeRow"><Badge variant={statusVariant[selectedIssue.status]}>{selectedIssue.status}</Badge><Badge variant="default">{selectedIssue.sourceType}</Badge>{selectedIssue.isOverdue ? <Badge variant="danger">Overdue</Badge> : null}</div><div className="riskOperationsDetailRows"><DetailRow label="Action ID" value={selectedIssue.actionRef || 'Pending reference'} /><DetailRow label="Source reference" value={selectedIssue.sourceReference || 'Not available'} /><DetailRow label="Risk Ref ID" value={selectedIssue.linkedRiskRef || 'Not linked'} /><DetailRow label="Library Risk ID" value={selectedIssue.linkedLibraryRiskId || 'Not linked'} /><DetailRow label="Treatment Plan ID" value={selectedIssue.linkedTreatmentPlanId || 'Not linked'} /><DetailRow label="Owner" value={selectedIssue.owner} /><DetailRow label="Domain" value={selectedIssue.domain} /><DetailRow label="Due date" value={formatDate(selectedIssue.dueDate)} /><DetailRow label="Source status" value={selectedIssue.sourceStatus || 'N/A'} /><DetailRow label="Last updated" value={formatDate(selectedIssue.updatedAt)} /><DetailRow label="Completion date" value={selectedIssue.completedAt ? formatDate(selectedIssue.completedAt) : 'Not completed'} /><DetailRow label="Linked controls" value={selectedIssue.linkedControlIds.join(', ') || 'None linked'} /><DetailRow label="Linked evidence" value={selectedIssue.linkedEvidenceIds.join(', ') || 'None linked'} />{selectedIssue.sourceType === 'Treatment' ? <><DetailRow label="Treatment progress" value={`${selectedIssue.treatmentProgress ?? 0}%`} /><DetailRow label="Target risk" value={selectedIssue.targetRiskScore == null ? 'Not set' : `${selectedIssue.targetRiskScore} · ${selectedIssue.targetRiskRating || 'Rating not set'}`} /><DetailRow label="Expected residual after treatment" value={selectedIssue.expectedResidualScore == null ? 'Not set' : `${selectedIssue.expectedResidualScore} · ${selectedIssue.expectedResidualRating || 'Rating not set'}`} /></> : null}</div><div className="riskOperationsCiaNote"><strong>Blocker reason</strong><span>{selectedIssue.blockerReason || 'No blocker recorded.'}</span></div><div className="riskOperationsCiaNote"><strong>Evidence required</strong><span>{selectedIssue.evidenceRequired || 'No evidence requirement recorded.'}</span></div><form key={selectedIssue.id} className="riskOperationsActionEditor" onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);void updateSelectedAction({status:String(form.get('status')) as IssueStatus,blockerReason:String(form.get('blockerReason')||''),evidenceRequired:String(form.get('evidenceRequired')||''),notes:String(form.get('notes')||'')});}}><label>Status<select name="status" defaultValue={selectedIssue.status} key={`${selectedIssue.id}-status`}>{ISSUE_STATUSES.filter(value=>!['Pending','Resolved'].includes(value)).map(value=><option key={value}>{value}</option>)}</select></label><label>Blocker reason<input name="blockerReason" defaultValue={selectedIssue.blockerReason||''} /></label><label>Evidence required<input name="evidenceRequired" defaultValue={selectedIssue.evidenceRequired||''} /></label><label>Notes<textarea name="notes" defaultValue={selectedIssue.notes||''} rows={3}/></label><Button type="submit" variant="primary" disabled={savingAction}>{savingAction?'Saving...':'Update action'}</Button>{actionFeedback?<span role="status">{actionFeedback}</span>:null}</form><div className="riskOperationsCiaNote"><strong>Audit history</strong>{actionHistory.length ? <ul>{actionHistory.slice(0, 5).map(entry => <li key={entry.id}>{entry.action.replaceAll('_',' ')} · {entry.actorName} · {formatDate(entry.timestamp)}</li>)}</ul> : <span>No action changes have been recorded yet.</span>}</div><div className="riskOperationsCiaNote"><strong>CIA impact linkage</strong><span>{selectedIssue.ciaImpacts.length > 0 ? selectedIssue.ciaImpacts.join(', ') : 'CIA Impact values will appear when linked risk source data is available.'}</span></div></div></PageSectionCard> : <PageSectionCard title="Select an action" subtitle="Choose a row to review its source, ownership, links, notes, and audit context."><p className="riskOperationsEmptyDetail">No action is selected.</p></PageSectionCard>}
      </div>}</> : null}

      {activeTab === 'overdue' ? <RiskOperationalQueue key={activeTab} kind="overdue" issues={overdueIssues} onIssue={issue => {resetFilters();setSearch(issue.linkedRiskRef || issue.id);setSelectedIssueId(issue.id);setPage(1);openOverviewTab('tracker');}}/> : null}
      {activeTab === 'reports' ? <><section className="riskOperationsReportHeader"><div><span className="roEyebrow">Operational reporting</span><h2>Reports</h2><p>Live insight into action volume, accountability, priority, and assurance readiness.</p></div><label>Report period<select aria-label="Report period"><option>Current live snapshot</option><option>Current quarter</option><option>Previous quarter</option></select></label><Button variant="outline" disabled title="Export workflow is not connected">Export · Route ready</Button></section><div className="riskOperationsReportsGrid"><PageSectionCard title="Actions by Source" subtitle="Live action distribution by originating system."><SummaryRows items={sourceSummary} /></PageSectionCard><PageSectionCard title="Actions by Owner" subtitle="Current accountable owner distribution."><SummaryRows items={ownerSummary} /></PageSectionCard><PageSectionCard title="Actions by Priority" subtitle="Current operational priority profile."><SummaryRows items={prioritySummary} /></PageSectionCard><PageSectionCard title="Actions by Status" subtitle="Current workflow state across all action records."><SummaryRows items={statusSummary} /></PageSectionCard><PageSectionCard title="Overdue by Owner" subtitle="Accountability for actions already past due.">{overdueOwnerSummary.length ? <SummaryRows items={overdueOwnerSummary} /> : <p>No overdue actions.</p>}</PageSectionCard><PageSectionCard title="Blocked vs Awaiting Evidence" subtitle="Current assurance constraints."><SummaryRows items={assuranceSummary.filter(item=>item.label==='Blocked'||item.label==='Awaiting evidence')} /></PageSectionCard><PageSectionCard title="Completion Position" subtitle="Completed and cancelled actions retained for reporting."><SummaryRows items={[{label:'Completed',value:issues.filter(item=>item.status==='Completed').length},{label:'Cancelled',value:issues.filter(item=>item.status==='Cancelled').length}]} /></PageSectionCard><PageSectionCard title="Operational Commentary" subtitle="Data-backed focus for management review."><div className="riskOperationsReportReady"><Badge variant="info">Live commentary</Badge><p>{overdueIssues.length.toLocaleString()} actions are overdue. {escalations.length.toLocaleString()} critical or high-priority actions require focused follow-up.</p><p>Review the highest-volume owners and evidence constraints before agreeing revised delivery dates.</p></div></PageSectionCard></div></> : null}
    </section>
  </section>;
}
