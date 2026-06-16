import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import {
  formatActivityAction,
  formatActivityTimestamp,
  formatRelativeActivityTimestamp,
} from '../lib/activityLedgerUtils';
import { listActivities, exportActivities } from '../services/activityLedger/activityLedger';
import { theme } from '../theme';
import type {
  ActivityLedgerCategory,
  ActivityLedgerEntry,
  ActivityLedgerFilters,
  ActivityLedgerOutcome,
  ActivityLedgerSeverity,
  ActivityLedgerSummary,
} from '../types/activityLedger';

const CATEGORY_OPTIONS: Array<{ value: ActivityLedgerCategory; label: string }> = [
  { value: 'audit', label: 'Audit' },
  { value: 'ai', label: 'AI Governance' },
  { value: 'risk', label: 'Risk' },
  { value: 'control', label: 'Control' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'issue', label: 'Issue' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'asset', label: 'Asset' },
  { value: 'policy', label: 'Policy' },
  { value: 'training', label: 'Training' },
  { value: 'report', label: 'Report' },
  { value: 'resilience', label: 'Resilience' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'user', label: 'User' },
  { value: 'rbac', label: 'RBAC' },
  { value: 'auth', label: 'Auth' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'framework', label: 'Framework' },
  { value: 'system', label: 'System' },
];

const OUTCOME_VARIANTS: Record<ActivityLedgerOutcome, 'success' | 'warning' | 'danger' | 'default'> = {
  success: 'success',
  failed: 'danger',
  blocked: 'danger',
  pending: 'warning',
};

const SEVERITY_VARIANTS: Record<ActivityLedgerSeverity, 'success' | 'warning' | 'danger' | 'default'> = {
  info: 'default',
  low: 'default',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

const CATEGORY_VARIANTS: Record<ActivityLedgerCategory, 'success' | 'warning' | 'danger' | 'default'> = {
  audit: 'warning',
  ai: 'warning',
  risk: 'danger',
  control: 'default',
  evidence: 'warning',
  issue: 'danger',
  vendor: 'warning',
  asset: 'default',
  policy: 'default',
  training: 'success',
  report: 'default',
  resilience: 'warning',
  regulatory: 'warning',
  user: 'default',
  rbac: 'warning',
  auth: 'danger',
  workspace: 'default',
  framework: 'default',
  system: 'warning',
};

const pageStyle = {
  maxWidth: 1400,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
};

const cellClampStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

function stringifyValue(value: unknown) {
  return value == null ? 'Not recorded' : JSON.stringify(value, null, 2);
}

function DownloadExportButton({ filters }: { filters: ActivityLedgerFilters }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const payload = await exportActivities(filters);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enterprise-activity-ledger-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleExport} disabled={exporting}>
      {exporting ? 'Exporting...' : 'Export'}
    </Button>
  );
}

function ActivityDetailsDrawer({
  entry,
  onClose,
}: {
  entry: ActivityLedgerEntry | null;
  onClose: () => void;
}) {
  if (!entry) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.32)',
        zIndex: 60,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(520px, 100vw)',
          height: '100%',
          backgroundColor: theme.colors.surface,
          boxShadow: theme.shadows.xl,
          padding: theme.spacing[6],
          overflowY: 'auto',
          display: 'grid',
          gap: theme.spacing[4],
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Badge variant={CATEGORY_VARIANTS[entry.category]} size="sm">{entry.category}</Badge>
              <Badge variant={OUTCOME_VARIANTS[entry.outcome]} size="sm">{entry.outcome}</Badge>
              <Badge variant={SEVERITY_VARIANTS[entry.severity]} size="sm">{entry.severity}</Badge>
            </div>
            <h3 style={{ margin: `${theme.spacing[3]} 0 ${theme.spacing[1]} 0`, fontSize: theme.typography.sizes.xl, color: theme.colors.text.main }}>
              {formatActivityAction(entry.action)}
            </h3>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {formatActivityTimestamp(entry.timestamp)}
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>

        <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
          <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
            <div><strong>Actor:</strong> {entry.actorName || 'System'}{entry.actorRole ? ` · ${entry.actorRole}` : ''}</div>
            <div><strong>Target:</strong> {entry.targetName || entry.targetType || 'Record'}{entry.targetId ? ` (${entry.targetId})` : ''}</div>
            <div><strong>Source:</strong> {entry.source}</div>
            <div><strong>Correlation ID:</strong> {entry.correlationId || 'Not recorded'}</div>
            <div><strong>IP address:</strong> {entry.ipAddress || 'Not recorded'}</div>
            <div><strong>Device:</strong> {entry.device || 'Not recorded'}</div>
            <div><strong>User agent:</strong> {entry.userAgent || 'Not recorded'}</div>
            <div><strong>Location:</strong> {entry.location || 'Not recorded'}</div>
          </div>
        </Card>

        <PageSectionCard title="Previous Value">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            {stringifyValue(entry.previousValue)}
          </pre>
        </PageSectionCard>

        <PageSectionCard title="New Value">
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            {stringifyValue(entry.newValue)}
          </pre>
        </PageSectionCard>

        <PageSectionCard title="Notes">
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {entry.notes || 'No notes recorded.'}
          </div>
        </PageSectionCard>
      </div>
    </div>
  );
}

export function ActivityLedger() {
  const [entries, setEntries] = useState<ActivityLedgerEntry[]>([]);
  const [summary, setSummary] = useState<ActivityLedgerSummary>({
    totalEvents: 0,
    criticalEvents: 0,
    failedOrBlockedEvents: 0,
    authSecurityEvents: 0,
    changesThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ActivityLedgerEntry | null>(null);
  const [filters, setFilters] = useState<ActivityLedgerFilters>({
    limit: 100,
    category: '',
    severity: '',
    outcome: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listActivities(filters);
      setEntries(result.entries);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity ledger');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const significantEvents = useMemo(
    () => entries.filter((entry) => entry.severity === 'high' || entry.severity === 'critical' || entry.outcome !== 'success').slice(0, 5),
    [entries],
  );

  const metrics = useMemo(() => ([
    { label: 'Total Events', value: summary.totalEvents, detail: 'Filtered result set', tone: 'primary' as const },
    { label: 'Critical Events', value: summary.criticalEvents, detail: 'High priority activity', tone: 'danger' as const },
    { label: 'Failed / Blocked', value: summary.failedOrBlockedEvents, detail: 'Security and process failures', tone: 'warning' as const },
    { label: 'Auth / Security', value: summary.authSecurityEvents, detail: 'Authentication and privilege events', tone: 'default' as const },
    { label: 'Changes This Week', value: summary.changesThisWeek, detail: 'Recent ledger movement', tone: 'success' as const },
  ]), [summary]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Enterprise Activity Ledger" description="Unified audit and activity record across governance, risk, security, and platform administration." />
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Loading enterprise activity...
        </Card>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Enterprise Activity Ledger"
        description="Unified event history across risks, controls, evidence, assets, training, users, and platform security."
        action={<DownloadExportButton filters={filters} />}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageToolbar
        actions={
          <>
            <Button variant="secondary" onClick={() => setFilters({ limit: 100, category: '', severity: '', outcome: '' })}>Reset Filters</Button>
            <Button variant="primary" onClick={fetchData}>Refresh</Button>
          </>
        }
      >
        <input
          type="search"
          placeholder="Search action or actor"
          value={filters.action || ''}
          onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 200 }}
        />
        <input
          type="search"
          placeholder="Actor name"
          value={filters.actor || ''}
          onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 180 }}
        />
        <select
          value={filters.category || ''}
          onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as ActivityLedgerCategory | '' }))}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select
          value={filters.outcome || ''}
          onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as ActivityLedgerOutcome | '' }))}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}
        >
          <option value="">All outcomes</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={filters.severity || ''}
          onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value as ActivityLedgerSeverity | '' }))}
          style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </PageToolbar>

      {error ? (
        <EmptyStatePanel
          eyebrow="Activity Error"
          title="Unable to load the activity ledger"
          description={error}
          actions={<Button variant="primary" onClick={fetchData}>Retry</Button>}
        />
      ) : null}

      {!error && entries.length === 0 ? (
        <EmptyStatePanel
          eyebrow="No Events"
          title="No activity matched the current filters"
          description="Try clearing the filters or broaden the date and category scope to review more platform activity."
          actions={<Button variant="primary" onClick={() => setFilters({ limit: 100, category: '', severity: '', outcome: '' })}>Clear Filters</Button>}
        />
      ) : null}

      {!error && entries.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.4fr)', gap: theme.spacing[4] }}>
            <PageSectionCard
              title="Activity Timeline"
              subtitle="Latest significant business and security events."
              action={<Badge variant="default" size="sm">{significantEvents.length} significant</Badge>}
            >
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                {significantEvents.map((entry) => (
                  <Card key={entry.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                          <Badge variant={CATEGORY_VARIANTS[entry.category]} size="sm">{entry.category}</Badge>
                          <Badge variant={OUTCOME_VARIANTS[entry.outcome]} size="sm">{entry.outcome}</Badge>
                          <Badge variant={SEVERITY_VARIANTS[entry.severity]} size="sm">{entry.severity}</Badge>
                        </div>
                        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{formatRelativeActivityTimestamp(entry.timestamp)}</div>
                      </div>
                      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                        <strong>{entry.actorName || 'System'}</strong> performed <strong>{formatActivityAction(entry.action)}</strong> on{' '}
                        <strong>{entry.targetName || entry.targetType || 'record'}</strong>
                      </div>
                      <div style={{ ...cellClampStyle, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                        {entry.notes || 'No additional notes recorded.'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                          {formatActivityTimestamp(entry.timestamp)}
                        </span>
                        <Button variant="secondary" onClick={() => setSelectedEntry(entry)}>View Details</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </PageSectionCard>

            <PageSectionCard
              title="Activity Table"
              subtitle="Structured view for rapid monitoring and investigations."
              action={<Badge variant="default" size="sm">{entries.length} events</Badge>}
            >
              <div style={{ overflowX: 'hidden' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                      <th style={{ padding: `${theme.spacing[2]} 0` }}>Timestamp</th>
                      <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Actor</th>
                      <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Action</th>
                      <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Target</th>
                      <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Category</th>
                      <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Outcome</th>
                      <th style={{ padding: `${theme.spacing[2]} 0` }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.slice(0, 25).map((entry) => (
                      <tr key={entry.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                        <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                          <div style={cellClampStyle} title={formatActivityTimestamp(entry.timestamp)}>{formatActivityTimestamp(entry.timestamp)}</div>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0 }}>
                          <div style={cellClampStyle} title={entry.actorName || 'System'}>{entry.actorName || 'System'}</div>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0 }}>
                          <div style={cellClampStyle} title={formatActivityAction(entry.action)}>{formatActivityAction(entry.action)}</div>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0 }}>
                          <div style={cellClampStyle} title={entry.targetName || entry.targetType || 'Record'}>{entry.targetName || entry.targetType || 'Record'}</div>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                          <Badge variant={CATEGORY_VARIANTS[entry.category]} size="sm">{entry.category}</Badge>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                          <Badge variant={OUTCOME_VARIANTS[entry.outcome]} size="sm">{entry.outcome}</Badge>
                        </td>
                        <td style={{ padding: `${theme.spacing[3]} 0` }}>
                          <Button variant="secondary" onClick={() => setSelectedEntry(entry)}>View Details</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageSectionCard>
          </div>
          <ActivityDetailsDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        </>
      ) : null}
    </div>
  );
}

export default ActivityLedger;
