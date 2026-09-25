import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { Badge, Button, EmptyStatePanel, PageHeader, PageSectionCard, PageToolbar } from '../components';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import { apiCall } from '../lib/api';
import { sortIssues } from '../lib/issueSort';
import { readAllowedFilter, updateQueryFilters } from '../lib/queryFilters';
import type { ApiResponse, IssuePriority, IssueRecord, IssueSourceType, IssueStatus } from '../types/issues';
import './RiskWorkspaceShared.css';
import './RiskOperations.css';
import './RiskVisualSystem.css';
import { ActivityIcon, RefreshIcon } from '../components/icons';
import { RiskOperationsOverview } from './RiskOperationsOverview';
import { RiskOperationalQueue } from './RiskOperationalQueue';

const API_BASE = '/api/v1';

const OPERATIONS_TABS = ['overview', 'queue', 'escalations', 'overdue', 'reports'] as const;
type OperationsTab = typeof OPERATIONS_TABS[number];

const TAB_LABELS: Record<OperationsTab, string> = {
  overview: 'Overview', queue: 'Issue Queue', escalations: 'Escalations', overdue: 'Overdue Items', reports: 'Reports',
};
const priorityVariant: Record<IssuePriority, 'danger' | 'warning' | 'info' | 'success'> = {
  Critical: 'danger', High: 'warning', Medium: 'info', Low: 'success',
};
const statusVariant: Record<IssueStatus, 'danger' | 'info' | 'warning' | 'success'> = {
  Open: 'danger', 'In Progress': 'info', Pending: 'warning', Resolved: 'success',
};

function formatDate(value?: string) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderLinkedValue(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="riskOperationsDetailRow"><span>{label}</span><strong>{value}</strong></div>;
}

type SummaryItem = { label: string; value: number; tone?: 'danger' | 'warning' | 'info' | 'success' | 'default' };

function SummaryRows({ items }: { items: SummaryItem[] }) {
  return <div className="riskOperationsSummaryRows">{items.map((item) => <div key={item.label} className="riskOperationsSummaryRow"><span>{item.label}</span><Badge variant={item.tone || 'default'} size="sm">{item.value}</Badge></div>)}</div>;
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
  const [activeTab, setActiveTab] = useState<OperationsTab>(() => searchParams.has('type') || searchParams.has('status') || searchParams.has('priority') || searchParams.has('source') ? 'queue' : 'overview');
  const [search, setSearch] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [sort, setSort] = useState('source');
  const tabListRef = useRef<HTMLDivElement>(null);
  const issueStatuses: IssueStatus[] = ['Open', 'In Progress', 'Pending', 'Resolved'];
  const issuePriorities: IssuePriority[] = ['Critical', 'High', 'Medium', 'Low'];
  const queryType = searchParams.get('type');
  const statusFilter: 'ALL' | IssueStatus = readAllowedFilter(searchParams, 'status', issueStatuses) ?? 'ALL';
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
      setSelectedIssueId((current) => current && data.some((item) => item.id === current) ? current : data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issue register');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchIssues(); }, [fetchIssues]);

  const sourceOptions = useMemo(() => ['ALL', ...Array.from(new Set(issues.map((item) => item.sourceType)))], [issues]);
  const sourceFilter: 'ALL' | IssueSourceType = readAllowedFilter(searchParams, 'source', sourceOptions.filter((value): value is IssueSourceType => value !== 'ALL')) ?? 'ALL';
  const setSourceFilter = (value: 'ALL' | IssueSourceType) => setQueryFilter('source', value === 'ALL' ? null : value);

  const filteredIssues = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return sortIssues(issues.filter((issue) => {
      if (ownerFilter && issue.owner !== ownerFilter) return false;
      if (statusFilter !== 'ALL' && issue.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) return false;
      if (sourceFilter !== 'ALL' && issue.sourceType !== sourceFilter) return false;
      if (!searchTerm) return true;
      return [issue.id, issue.linkedRiskRef ?? '', issue.title, issue.owner, issue.domain, issue.sourceType, issue.description ?? ''].some((value) => value.toLowerCase().includes(searchTerm));
    }), sort);
  }, [issues, priorityFilter, search, sourceFilter, statusFilter, ownerFilter, sort]);

  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter, sourceFilter, ownerFilter, pageSize, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedIssues = filteredIssues.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedIssue = pagedIssues.find((item) => item.id === selectedIssueId) ?? pagedIssues[0] ?? null;
  const openIssues = useMemo(() => issues.filter((item) => item.status !== 'Resolved'), [issues]);
  const escalations = useMemo(() => issues.filter((item) => item.status !== 'Resolved' && (item.priority === 'Critical' || item.priority === 'High')).sort((a, b) => Number(b.priority === 'Critical') - Number(a.priority === 'Critical') || Number(b.isOverdue) - Number(a.isOverdue)), [issues]);
  const overdueIssues = useMemo(() => issues.filter((item) => item.isOverdue).sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime()), [issues]);

  const summaryMetrics = useMemo(() => [
    { label: 'Operational issue signals', value: openIssues.length, detail: 'Derived open action signals across linked sources', tone: openIssues.length > 0 ? 'danger' as const : 'success' as const },
    { label: 'Critical Priority', value: issues.filter((item) => item.priority === 'Critical').length, detail: 'Immediate escalation items', tone: 'warning' as const },
    { label: 'Overdue Items', value: overdueIssues.length, detail: 'Past due follow-up', tone: overdueIssues.length > 0 ? 'danger' as const : 'default' as const },
    { label: 'Source Systems', value: new Set(issues.map((item) => item.sourceType)).size, detail: 'Live operational sources', tone: 'primary' as const },
  ], [issues, openIssues.length, overdueIssues.length]);
  const domainSummary = useMemo(() => Array.from(new Set(issues.map((item) => item.domain))).map((domain) => ({ label: domain, value: issues.filter((item) => item.domain === domain).length })).sort((a, b) => b.value - a.value).slice(0, 8), [issues]);
  const sourceSummary = useMemo<SummaryItem[]>(() => sourceOptions.filter((item) => item !== 'ALL').map((source) => ({ label: source, value: issues.filter((item) => item.sourceType === source).length })), [issues, sourceOptions]);
  const prioritySummary = useMemo<SummaryItem[]>(() => (['Critical', 'High', 'Medium', 'Low'] as IssuePriority[]).map((priority) => ({ label: priority, value: issues.filter((item) => item.priority === priority).length, tone: priorityVariant[priority] })), [issues]);
  const statusSummary = useMemo<SummaryItem[]>(() => (['Open', 'In Progress', 'Pending', 'Resolved'] as IssueStatus[]).map((status) => ({ label: status, value: issues.filter((item) => item.status === status).length, tone: statusVariant[status] })), [issues]);

  const resetFilters = () => { setOwnerFilter(''); setSearch(''); setSearchParams(updateQueryFilters(searchParams, { status: null, priority: null, source: null, type: null })); };
  const openOverviewTab = (tab: OperationsTab) => {
    setActiveTab(tab);
    requestAnimationFrame(() => tabListRef.current?.querySelector<HTMLButtonElement>(`#risk-operations-tab-${tab}`)?.focus());
  };
  const changePage = (nextPage: number) => {
    const boundedPage = Math.min(totalPages, Math.max(1, nextPage));
    setPage(boundedPage);
    setSelectedIssueId(filteredIssues[(boundedPage - 1) * pageSize]?.id ?? null);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % OPERATIONS_TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + OPERATIONS_TABS.length) % OPERATIONS_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = OPERATIONS_TABS.length - 1;
    else return;
    event.preventDefault(); setActiveTab(OPERATIONS_TABS[next]);
    tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  if (loading || error) return <div className="riskWorkspacePage riskOperationsPage"><PageHeader breadcrumb="Risk Management / Risk Operations" title="Risk Operations" description="Derived operational issue register linked to active platform records." /><EmptyStatePanel eyebrow="Incident & Issue Management" title={loading ? 'Loading issue register' : 'Unable to load issue register'} description={loading ? 'The platform is compiling live issue records from existing operational sources.' : error || 'Unable to load issues.'} actions={error ? <Button variant="primary" onClick={() => void fetchIssues()}>Retry</Button> : undefined} /></div>;

  return <section className="riskWorkspacePage riskOperationsPage" aria-label="Risk Operations">
    <header className="roHero">
      <div className="roHeroIntro"><span className="roHeroIcon" aria-hidden="true"><ActivityIcon size={27} /></span><div><p className="roEyebrow">Risk Management / Risk Operations</p><h1>Risk Operations</h1><p>Focused operational queues for issue follow-up, escalation, overdue work, and reporting readiness.</p></div></div>
      <div className="roHeroActions"><Button variant="outline" onClick={() => void fetchIssues()}><RefreshIcon size={16} /> Refresh</Button><span>Detect. Escalate. Resolve. Evidence.</span></div>
    </header>

    {queryType || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || sourceFilter !== 'ALL' ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Applied Risk Operations filters">
      {queryType ? <AppliedQueryFilter label={queryType === 'treatment' ? 'Treatment items' : queryType === 'audit-blocker' ? 'Audit blockers' : queryType} routeReady description="The issue model does not yet expose this type as a reliable record-level filter. The Issue Queue remains unfiltered." onRemove={() => setQueryFilter('type', null)} /> : null}
      {statusFilter !== 'ALL' ? <AppliedQueryFilter label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('ALL')} /> : null}
      {priorityFilter !== 'ALL' ? <AppliedQueryFilter label={`Priority: ${priorityFilter}`} onRemove={() => setPriorityFilter('ALL')} /> : null}
      {sourceFilter !== 'ALL' ? <AppliedQueryFilter label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('ALL')} /> : null}
    </div> : null}

    <div className="riskOperationsTabs" role="tablist" aria-label="Risk Operations views" ref={tabListRef}>
      {OPERATIONS_TABS.map((tab, index) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`risk-operations-panel-${tab}`} id={`risk-operations-tab-${tab}`} tabIndex={activeTab === tab ? 0 : -1} className={activeTab === tab ? 'riskOperationsTab riskOperationsTabActive' : 'riskOperationsTab'} onClick={() => setActiveTab(tab)} onKeyDown={(event) => handleTabKeyDown(event, index)}>{TAB_LABELS[tab]}</button>)}
    </div>

    <section id={`risk-operations-panel-${activeTab}`} role="tabpanel" aria-labelledby={`risk-operations-tab-${activeTab}`} className="riskOperationsPanel">
      {activeTab === 'overview' ? <RiskOperationsOverview metrics={summaryMetrics} domains={domainSummary} statuses={statusSummary} total={issues.length} escalations={escalations} overdueCount={overdueIssues.length} openCount={openIssues.length} onTab={openOverviewTab} formatDate={formatDate} onIssue={(issue) => { resetFilters(); setSearch(issue.linkedRiskRef || issue.id); setSelectedIssueId(issue.id); setPage(1); openOverviewTab('queue'); }} /> : null}
      {activeTab === 'queue' ? <><PageToolbar actions={<div className="riskOperationsToolbarActions"><Badge variant="default" size="sm">{filteredIssues.length} records</Badge><Button variant="ghost" onClick={resetFilters}>Reset filters</Button></div>}><div className="riskOperationsFilters">
        <input aria-label="Search issues" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search issue ID, title, owner, domain, or source" />
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | IssueStatus)}><option value="ALL">All statuses</option>{(['Open', 'In Progress', 'Pending', 'Resolved'] as IssueStatus[]).map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'ALL' | IssuePriority)}><option value="ALL">All priorities</option>{(['Critical', 'High', 'Medium', 'Low'] as IssuePriority[]).map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'ALL' | IssueSourceType)}>{sourceOptions.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All sources' : value}</option>)}</select>
      <select aria-label="Filter by owner" value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">All owners</option>{[...new Set(issues.map(issue => issue.owner).filter(Boolean))].sort().map(owner => <option key={owner} value={owner}>{owner}</option>)}</select></div></PageToolbar>
      {filteredIssues.length === 0 ? <EmptyStatePanel eyebrow="Incident & Issue Management" title="No issues match the current filters" description="Change or reset the filters to review other operational issues." actions={<Button variant="secondary" onClick={resetFilters}>Reset Filters</Button>} /> : <div className="riskOperationsGrid">
        <PageSectionCard title="Operational Issue Register" subtitle={`Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredIssues.length)} of ${filteredIssues.length} records.`} action={<label className="riskOperationsSort">Sort by <select aria-label="Sort issue queue" value={sort} onChange={event => setSort(event.target.value)}><option value="source">Source order</option><option value="due">Due date (earliest)</option><option value="priority">Highest priority</option><option value="title">Issue title</option></select></label>}>
          <div className="riskWorkspaceTableScroll riskOperationsTableViewport" tabIndex={0} aria-label="Operational issue register, scroll for more records"><table className="riskWorkspaceTable"><thead><tr>{['ID', 'Issue', 'Owner', 'Source', 'Status', 'Priority', 'Due Date'].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{pagedIssues.map((issue) => { const isSelected = selectedIssue?.id === issue.id; return <tr key={issue.id} className={isSelected ? 'riskOperationsSelectedRow' : ''} onClick={() => setSelectedIssueId(issue.id)}><td><span className="riskOperationsReference" title={issue.linkedRiskRef || issue.id}>{issue.linkedRiskRef || issue.id}</span></td><td><button type="button" className="riskOperationsIssueTitle" aria-pressed={isSelected} onClick={() => setSelectedIssueId(issue.id)}>{issue.title}</button><span>{issue.domain}</span></td><td>{issue.owner}</td><td>{issue.sourceType}</td><td><Badge variant={statusVariant[issue.status]}>{issue.status}</Badge></td><td><Badge variant={priorityVariant[issue.priority]}>{issue.priority}</Badge></td><td className={issue.isOverdue ? 'riskOperationsOverdueText' : ''}>{formatDate(issue.dueDate)}</td></tr>; })}</tbody></table></div>
          <div className="riskOperationsPagination" aria-label="Issue queue pagination"><Button variant="outline" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Previous</Button><label>Rows per page <select aria-label="Issue rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10,25,50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><span>{filteredIssues.length} records · Page {currentPage} of {totalPages}</span><Button variant="outline" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}>Next</Button></div>
        </PageSectionCard>
        {selectedIssue ? <PageSectionCard title="Issue Detail" subtitle="Selected issue and linked platform context." action={<Badge variant={priorityVariant[selectedIssue.priority]}>{selectedIssue.priority}</Badge>}><div className="riskOperationsDetail"><div><h3>{selectedIssue.title}</h3><p>{selectedIssue.description || 'No additional narrative has been recorded for this derived issue yet.'}</p></div><div className="riskOperationsBadgeRow"><Badge variant={statusVariant[selectedIssue.status]}>{selectedIssue.status}</Badge><Badge variant="default">{selectedIssue.sourceType}</Badge>{selectedIssue.isOverdue ? <Badge variant="danger">Overdue</Badge> : null}</div><div className="riskOperationsDetailRows"><DetailRow label="Risk reference" value={selectedIssue.linkedRiskRef || 'Not linked'} /><DetailRow label="Owner" value={selectedIssue.owner} /><DetailRow label="Domain" value={selectedIssue.domain} /><DetailRow label="Due date" value={formatDate(selectedIssue.dueDate)} /><DetailRow label="Source status" value={selectedIssue.sourceStatus || 'N/A'} /><DetailRow label="Linked controls" value={renderLinkedValue(selectedIssue.linkedControlIds.length, 'control')} /><DetailRow label="Linked evidence" value={renderLinkedValue(selectedIssue.linkedEvidenceIds.length, 'evidence item')} /><DetailRow label="Linked reviews" value={renderLinkedValue(selectedIssue.linkedReviewTaskIds.length, 'review task')} /><DetailRow label="Linked training" value={renderLinkedValue(selectedIssue.linkedTrainingAssignmentIds.length, 'training assignment')} /></div><div className="riskOperationsCiaNote"><strong>CIA impact linkage</strong><span>{selectedIssue.ciaImpacts.length > 0 ? selectedIssue.ciaImpacts.join(', ') : 'CIA Impact values will appear when linked risk source data is available.'}</span></div></div></PageSectionCard> : null}
      </div>}</> : null}

      {activeTab === 'escalations' || activeTab === 'overdue' ? <RiskOperationalQueue key={activeTab} kind={activeTab} issues={activeTab === 'escalations' ? escalations : overdueIssues} onIssue={issue => {resetFilters();setSearch(issue.linkedRiskRef || issue.id);setSelectedIssueId(issue.id);setPage(1);openOverviewTab('queue');}}/> : null}
      {activeTab === 'reports' ? <div className="riskOperationsReportsGrid"><PageSectionCard title="Issues by Source" subtitle="Live issue distribution by originating system."><SummaryRows items={sourceSummary} /></PageSectionCard><PageSectionCard title="Issues by Priority" subtitle="Current operational priority profile."><SummaryRows items={prioritySummary} /></PageSectionCard><PageSectionCard title="Issues by Status" subtitle="Current workflow state across all issue records."><SummaryRows items={statusSummary} /></PageSectionCard><PageSectionCard title="Report Readiness" subtitle="Operational reporting uses the current linked issue data."><div className="riskOperationsReportReady"><Badge variant="info">Route ready</Badge><p>Issue reporting summaries are available here. Export remains disabled until an approved Risk Operations report workflow is connected.</p><Button variant="outline" disabled>Export Issue Report</Button></div></PageSectionCard></div> : null}
    </section>
  </section>;
}
