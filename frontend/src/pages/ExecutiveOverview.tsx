import { useEffect, useMemo, useState } from 'react';
import {
  ActivityFeed,
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
} from '../components';
import {
  downloadBoardReportHtml,
  downloadBoardReportMarkdown,
  downloadBoardReportPdf,
  fetchActivityLedger,
  fetchReportingCenterState,
  generateBoardReportNarrative,
} from '../lib/api';
import { theme } from '../theme';
import type { ActivityLedgerEntry } from '../types/activityLedger';
import { AUDIENCE_OPTIONS } from '../types/boardReport';
import type { BoardReportAudience } from '../types/boardReport';
import type { ReportingCenterState } from '../types/reportingCenter';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unscheduled';
}

function ActivityCard({ activity }: { activity: ActivityLedgerEntry }) {
  return (
    <Card style={{ padding: theme.spacing[3], minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
        <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
          {activity.action.replace(/_/g, ' ')}
        </div>
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          <Badge variant={activity.category === 'auth' || activity.category === 'rbac' ? 'warning' : 'default'} size="sm">{activity.category}</Badge>
          <Badge variant={activity.outcome === 'failed' || activity.outcome === 'blocked' ? 'danger' : 'success'} size="sm">{activity.outcome}</Badge>
        </div>
      </div>
      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
        {activity.actorName} · {activity.targetName || activity.targetType}
      </div>
      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
        {formatDate(activity.timestamp)}
      </div>
    </Card>
  );
}

export function ExecutiveOverview() {
  const [state, setState] = useState<ReportingCenterState | null>(null);
  const [ledger, setLedger] = useState<ActivityLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<BoardReportAudience>('board');
  const [narrative, setNarrative] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<'md' | 'html' | 'pdf' | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [reportingState, ledgerState] = await Promise.all([
        fetchReportingCenterState(),
        fetchActivityLedger({ limit: 8 }).catch(() => ({ entries: [], summary: { totalEvents: 0, criticalEvents: 0, failedOrBlockedEvents: 0, authSecurityEvents: 0, changesThisWeek: 0 } })),
      ]);
      setState(reportingState);
      setLedger(ledgerState.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executive overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleGenerateNarrative = async () => {
    try {
      setNarrativeLoading(true);
      const result = await generateBoardReportNarrative(audience);
      setNarrative(result.narrative);
    } finally {
      setNarrativeLoading(false);
    }
  };

  const handleDownload = async (format: 'md' | 'html' | 'pdf') => {
    try {
      setDownloadLoading(format);
      if (format === 'md') {
        downloadBlob(new Blob([await downloadBoardReportMarkdown(audience)], { type: 'text/markdown' }), 'board-intelligence.md');
      } else if (format === 'html') {
        downloadBlob(new Blob([await downloadBoardReportHtml(audience)], { type: 'text/html' }), 'board-intelligence.html');
      } else {
        downloadBlob(await downloadBoardReportPdf(audience), 'board-intelligence.pdf');
      }
    } finally {
      setDownloadLoading(null);
    }
  };

  const metrics = useMemo(() => {
    if (!state) return [];
    return [
      { label: 'Enterprise Score', value: state.boardDashboard.enterpriseScore, detail: state.boardDashboard.riskPosture, tone: 'primary' as const },
      { label: 'Appetite Breaches', value: state.boardDashboard.appetiteBreaches, detail: `${state.boardDashboard.capacityUtilization.length} capacity profiles tracked`, tone: state.boardDashboard.appetiteBreaches > 0 ? 'warning' as const : 'success' as const },
      { label: 'Compliance Coverage', value: `${state.boardDashboard.complianceCoverage}%`, detail: `${state.summary.awaitingAttestation} reports awaiting sign-off`, tone: 'success' as const },
      { label: 'Audit Readiness', value: `${state.boardDashboard.auditReadiness}%`, detail: state.boardDashboard.boardPackStatus, tone: 'default' as const },
      { label: 'Changes This Week', value: ledger.length, detail: 'Recent enterprise activity', tone: 'default' as const },
    ];
  }, [ledger.length, state]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Board Intelligence Dashboard" description="Strategic reporting view of risk, assurance, compliance, and executive decision pressure." />
        <PageSectionCard title="Loading Board Intelligence">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
            Loading reporting metrics, board status, and recent enterprise activity...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Board Intelligence Dashboard" description="Strategic reporting view of risk, assurance, compliance, and executive decision pressure." />
        <EmptyStatePanel
          title="Unable to load board intelligence"
          description={error || 'No board reporting data is available yet.'}
          actions={<Button variant="primary" onClick={() => void loadData()}>Retry</Button>}
        />
      </div>
    );
  }

  const boardPack = state.templates.find((template) => template.templateKey === 'board_pack');
  const latestBoardPack = state.generatedReports.find((report) => report.templateKey === 'board_pack');

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Board Intelligence Dashboard"
        description="Strategic reporting view of risk, assurance, compliance, and executive decision pressure."
        action={
          <>
            <Button variant="outline" onClick={() => handleDownload('pdf')} disabled={downloadLoading !== null}>
              {downloadLoading === 'pdf' ? 'Preparing PDF...' : 'Export PDF Pack'}
            </Button>
            <Button variant="primary" onClick={handleGenerateNarrative} disabled={narrativeLoading}>
              {narrativeLoading ? 'Generating Brief...' : 'Generate Board Brief'}
            </Button>
          </>
        }
      />

      <SummaryMetricStrip metrics={metrics} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.85fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Board Signal" subtitle="What leadership should see first in the next committee cycle.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Badge variant="warning" size="sm">{state.boardDashboard.appetiteBreaches} appetite breaches</Badge>
              <Badge variant="default" size="sm">{state.boardDashboard.vendorExposure}</Badge>
              <Badge variant="success" size="sm">{state.boardDashboard.auditReadiness}% audit readiness</Badge>
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
              {state.boardDashboard.riskPosture}. The current board pack status is <strong>{state.boardDashboard.boardPackStatus}</strong>, with
              {' '}compliance coverage at {state.boardDashboard.complianceCoverage}% and the latest enterprise score at {state.boardDashboard.enterpriseScore}.
            </div>
            {latestBoardPack ? (
              <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                  Latest Board Pack
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {latestBoardPack.title} · {formatDate(latestBoardPack.createdAt)}
                </div>
              </Card>
            ) : null}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Reporting Controls" subtitle="Generate board-ready exports or briefing narratives for the selected audience.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as BoardReportAudience)}
              style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={() => handleDownload('md')} disabled={downloadLoading !== null}>{downloadLoading === 'md' ? 'Downloading...' : 'Markdown'}</Button>
              <Button variant="outline" onClick={() => handleDownload('html')} disabled={downloadLoading !== null}>{downloadLoading === 'html' ? 'Downloading...' : 'HTML'}</Button>
              <Button variant="outline" onClick={() => handleDownload('pdf')} disabled={downloadLoading !== null}>{downloadLoading === 'pdf' ? 'Downloading...' : 'PDF'}</Button>
            </div>
            {boardPack ? (
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                Primary board template: <strong>{boardPack.title}</strong> with {boardPack.sections.length} configured sections.
              </div>
            ) : null}
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[4] }}>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Top Risk</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>
            {state.boardDashboard.topRisks[0]?.title || 'No risk data'}
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Score {state.boardDashboard.topRisks[0]?.score || 0} · {state.boardDashboard.topRisks[0]?.status || 'n/a'}
          </div>
        </Card>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Top KRI</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>
            {state.boardDashboard.topKris[0]?.name || 'No KRI data'}
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {state.boardDashboard.topKris[0]?.status || 'n/a'} · value {state.boardDashboard.topKris[0]?.value || 0}
          </div>
        </Card>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Forecast Watch</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>
            {state.boardDashboard.forecastedIssues[0]?.label || 'No forecasted issue'}
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Predicted score {Math.round(state.boardDashboard.forecastedIssues[0]?.forecastScore || 0)}
          </div>
        </Card>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Emerging Risk</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>
            {state.boardDashboard.emergingRisks[0]?.title || 'No emerging risk'}
          </div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {state.boardDashboard.emergingRisks[0]?.status || 'n/a'}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Recent Reporting Packs" subtitle="Latest generated reports that support the next board, committee, and executive conversations.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {state.recentReports.length > 0 ? state.recentReports.map((report) => (
              <Card key={report.id} style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                      {report.title}
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                      {report.scopeValue} · {report.generatedByName} · {formatDate(report.createdAt)}
                    </div>
                  </div>
                  <Badge variant={report.status === 'approved' ? 'success' : report.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                    {report.status}
                  </Badge>
                </div>
              </Card>
            )) : (
              <EmptyStatePanel
                title="No recent reporting packs"
                description="Generate the first board or executive pack from the reporting center."
              />
            )}
          </div>
        </PageSectionCard>

        <PageSectionCard title="Upcoming Reporting Cycle" subtitle="Next scheduled reporting obligations across board, committee, and operating packs.">
          <div style={{ display: 'grid', gap: theme.spacing[2] }}>
            {state.upcomingReports.length > 0 ? state.upcomingReports.map((schedule) => (
              <Card key={schedule.id} style={{ padding: theme.spacing[3] }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                  {schedule.name}
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {schedule.frequency} · {schedule.scopeValue}
                </div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  Next run: {formatDate(schedule.nextRunAt)}
                </div>
              </Card>
            )) : (
              <EmptyStatePanel
                title="No reporting cadence configured"
                description="Create recurring board and committee schedules from the Executive Reporting Center."
              />
            )}
          </div>
        </PageSectionCard>
      </div>

      <ActivityFeed
        title="Recent Enterprise Activity"
        subtitle="Latest significant activity from the unified ledger to support board briefings and executive oversight."
        countLabel={`${ledger.length} events`}
      >
        {ledger.length > 0 ? ledger.map((activity) => <ActivityCard key={activity.id} activity={activity} />) : (
          <Card style={{ padding: theme.spacing[4], color: theme.colors.text.secondary }}>
            No recent activity entries are available.
          </Card>
        )}
      </ActivityFeed>

      <PageSectionCard title="Generated Narrative" subtitle="Leadership-ready narrative for the selected audience.">
        {narrative ? (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
            {narrative}
          </div>
        ) : (
          <div style={{ color: theme.colors.text.secondary }}>
            Generate the board brief to produce a concise narrative for executive leadership, the board, or the audit committee.
          </div>
        )}
      </PageSectionCard>
    </div>
  );
}

export default ExecutiveOverview;
