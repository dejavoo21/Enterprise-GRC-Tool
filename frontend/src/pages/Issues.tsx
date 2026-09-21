import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { ApiResponse, IssuePriority, IssueRecord, IssueSourceType, IssueStatus } from '../types/issues';
import './RiskWorkspaceShared.css';

const API_BASE = '/api/v1';

const priorityVariant: Record<IssuePriority, 'danger' | 'warning' | 'info' | 'success'> = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'success',
};

const statusVariant: Record<IssueStatus, 'danger' | 'info' | 'warning' | 'success'> = {
  Open: 'danger',
  'In Progress': 'info',
  Pending: 'warning',
  Resolved: 'success',
};

function formatDate(value?: string) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function renderLinkedValue(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
      <span style={{ color: theme.colors.text.secondary }}>{label}</span>
      <strong style={{ color: theme.colors.text.main, textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

export function Issues() {
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | IssueStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IssuePriority>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | IssueSourceType>('ALL');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall<ApiResponse<IssueRecord[]>>(`${API_BASE}/issues`);
      const data = result.data;
      if (!Array.isArray(data)) {
        throw new Error(result.error?.message || 'Unexpected issue response');
      }
      setIssues(data);
      setSelectedIssueId((current) => current && data.some((item) => item.id === current) ? current : data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issue register');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const filteredIssues = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (statusFilter !== 'ALL' && issue.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) return false;
      if (sourceFilter !== 'ALL' && issue.sourceType !== sourceFilter) return false;
      if (!searchTerm) return true;

      return [
        issue.id,
        issue.title,
        issue.owner,
        issue.domain,
        issue.sourceType,
        issue.description ?? '',
      ].some((value) => value.toLowerCase().includes(searchTerm));
    });
  }, [issues, priorityFilter, search, sourceFilter, statusFilter]);

  const selectedIssue = useMemo(
    () => filteredIssues.find((item) => item.id === selectedIssueId) ?? filteredIssues[0] ?? null,
    [filteredIssues, selectedIssueId],
  );

  const summaryMetrics = useMemo(() => {
    const openCount = issues.filter((item) => item.status !== 'Resolved').length;
    const criticalCount = issues.filter((item) => item.priority === 'Critical').length;
    const overdueCount = issues.filter((item) => item.isOverdue).length;
    const sourceCount = new Set(issues.map((item) => item.sourceType)).size;

    return [
      { label: 'Open Issues', value: openCount, detail: 'Current action queue', tone: openCount > 0 ? 'danger' as const : 'success' as const },
      { label: 'Critical Priority', value: criticalCount, detail: 'Immediate escalation items', tone: criticalCount > 0 ? 'warning' as const : 'success' as const },
      { label: 'Overdue Items', value: overdueCount, detail: 'Past due follow-up', tone: overdueCount > 0 ? 'danger' as const : 'default' as const },
      { label: 'Source Systems', value: sourceCount, detail: 'Risk, evidence, review, training', tone: 'primary' as const },
    ];
  }, [issues]);

  const sourceOptions = useMemo(
    () => ['ALL', ...Array.from(new Set(issues.map((item) => item.sourceType)))],
    [issues],
  );

  if (loading) {
    return (
      <div className="riskWorkspacePage riskOperationsPage">
        <PageHeader
          breadcrumb="Risk Workspace / Risk Operations"
          title="Risk Operations"
          description="Derived operational issue register linked to active risk, evidence, review, and training records."
        />
        <EmptyStatePanel eyebrow="Incident & Issue Management" title="Loading issue register" description="The platform is compiling live issue records from existing operational sources." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="riskWorkspacePage riskOperationsPage">
        <PageHeader
          breadcrumb="Risk Workspace / Risk Operations"
          title="Risk Operations"
          description="Derived operational issue register linked to active risk, evidence, review, and training records."
        />
        <EmptyStatePanel
          eyebrow="Incident & Issue Management"
          title="Unable to load issue register"
          description={error}
          actions={<Button variant="primary" onClick={() => void fetchIssues()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <main className="riskWorkspacePage riskOperationsPage">
      <PageHeader
        breadcrumb="Risk Workspace / Risk Operations"
        title="Risk Operations"
        description="Real issue register derived from active risks, evidence freshness, policy review tasks, and overdue training follow-up."
        action={
          <Button variant="outline" onClick={() => void fetchIssues()}>
            Refresh
          </Button>
        }
      />

      <SummaryMetricStrip metrics={summaryMetrics} />

      <PageToolbar
        actions={
          <Badge variant="default" size="sm">
            {filteredIssues.length} visible
          </Badge>
        }
      >
        <div className="riskOperationsFilters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search issue ID, title, owner, domain, or source"
            style={{
              width: '100%',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.main,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
            }}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | IssueStatus)}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.main,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as 'ALL' | IssuePriority)}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.main,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
            }}
          >
            <option value="ALL">All priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as 'ALL' | IssueSourceType)}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.main,
              fontFamily: theme.typography.fontFamily,
              backgroundColor: theme.colors.surface,
            }}
          >
            {sourceOptions.map((value) => (
              <option key={value} value={value}>
                {value === 'ALL' ? 'All sources' : value}
              </option>
            ))}
          </select>
        </div>
      </PageToolbar>

      {filteredIssues.length === 0 ? (
        <EmptyStatePanel
          eyebrow="Incident & Issue Management"
          title="No issues match the current filters"
          description="Change the search or filter criteria to review other operational issues derived from the platform data."
          actions={<Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('ALL'); setPriorityFilter('ALL'); setSourceFilter('ALL'); }}>Reset Filters</Button>}
        />
      ) : (
        <div className="riskOperationsGrid">
          <PageSectionCard
            title="Operational Issue Register"
            subtitle="Filtered live issue records across risk, evidence, review, and training data sources."
            action={<Badge variant="default" size="sm">{filteredIssues.length} records</Badge>}
          >
            <div className="riskWorkspaceTableScroll">
              <table className="riskWorkspaceTable">
                <thead>
                  <tr>
                    {['ID', 'Issue', 'Owner', 'Source', 'Status', 'Priority', 'Due'].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: 'left',
                          padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
                          color: theme.colors.text.secondary,
                          borderBottom: `1px solid ${theme.colors.border}`,
                          fontWeight: theme.typography.weights.semibold,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue) => {
                    const isSelected = selectedIssue?.id === issue.id;
                    return (
                      <tr
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? theme.colors.primaryLight : 'transparent',
                        }}
                      >
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, fontWeight: theme.typography.weights.semibold }}>
                          {issue.id.replace('issue-', '').slice(0, 16)}
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, minWidth: 280 }}>
                          <div style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{issue.title}</div>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{issue.domain}</div>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' }}>
                          {issue.owner}
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' }}>
                          {issue.sourceType}
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' }}>
                          <Badge variant={statusVariant[issue.status]}>{issue.status}</Badge>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap' }}>
                          <Badge variant={priorityVariant[issue.priority]}>{issue.priority}</Badge>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[3]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, whiteSpace: 'nowrap', color: issue.isOverdue ? theme.colors.semantic.danger : theme.colors.text.main }}>
                          {formatDate(issue.dueDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PageSectionCard>

          {selectedIssue ? (
            <PageSectionCard
              title="Issue Detail"
              subtitle="Current operational context and linked platform records."
              action={<Badge variant={priorityVariant[selectedIssue.priority]}>{selectedIssue.priority}</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[4] }}>
                <div>
                  <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                    {selectedIssue.title}
                  </div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    {selectedIssue.description || 'No additional narrative has been recorded for this derived issue yet.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Badge variant={statusVariant[selectedIssue.status]}>{selectedIssue.status}</Badge>
                  <Badge variant="default">{selectedIssue.sourceType}</Badge>
                  {selectedIssue.isOverdue ? <Badge variant="danger">Overdue</Badge> : null}
                </div>

                <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                  <DetailRow label="Owner" value={selectedIssue.owner} />
                  <DetailRow label="Domain" value={selectedIssue.domain} />
                  <DetailRow label="Due date" value={formatDate(selectedIssue.dueDate)} />
                  <DetailRow label="Source status" value={selectedIssue.sourceStatus || 'N/A'} />
                  <DetailRow label="Linked controls" value={renderLinkedValue(selectedIssue.linkedControlIds.length, 'control')} />
                  <DetailRow label="Linked evidence" value={renderLinkedValue(selectedIssue.linkedEvidenceIds.length, 'evidence item')} />
                  <DetailRow label="Linked reviews" value={renderLinkedValue(selectedIssue.linkedReviewTaskIds.length, 'review task')} />
                  <DetailRow label="Linked training" value={renderLinkedValue(selectedIssue.linkedTrainingAssignmentIds.length, 'training assignment')} />
                </div>

                <div
                  style={{
                    padding: theme.spacing[4],
                    borderRadius: theme.borderRadius.lg,
                    backgroundColor: theme.colors.surfaceHover,
                    border: `1px solid ${theme.colors.borderLight}`,
                  }}
                >
                  <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.colors.text.muted }}>
                    CIA impact linkage
                  </div>
                  <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    {selectedIssue.ciaImpacts.length > 0
                      ? selectedIssue.ciaImpacts.join(', ')
                      : 'No CIA impact values are currently supplied by the linked risk source. This remains a Risk Management data-model readiness gap rather than a page-level issue.'}
                  </div>
                </div>
              </div>
            </PageSectionCard>
          ) : null}
        </div>
      )}
    </main>
  );
}
