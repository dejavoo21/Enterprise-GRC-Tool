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
  fetchActivityLog,
  fetchBoardReportOverview,
  fetchTPRMSummary,
  generateBoardReportNarrative,
} from '../lib/api';
import { theme } from '../theme';
import type { ActivityLogEntry } from '../types/activity';
import { AUDIENCE_OPTIONS } from '../types/boardReport';
import type { BoardReportAudience, BoardReportData } from '../types/boardReport';
import type { TPRMSummary } from '../types/tprm';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ActivityRow({ activity }: { activity: ActivityLogEntry }) {
  return (
    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
      <div style={{ display: 'grid', gap: theme.spacing[1] }}>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{activity.summary}</div>
        <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
          {activity.userEmail || 'System'} · {formatTime(activity.createdAt)}
        </div>
      </div>
    </Card>
  );
}

export function ExecutiveOverview() {
  const [boardData, setBoardData] = useState<BoardReportData | null>(null);
  const [tprmData, setTprmData] = useState<TPRMSummary | null>(null);
  const [activityData, setActivityData] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<BoardReportAudience>('board');
  const [narrative, setNarrative] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<'md' | 'html' | 'pdf' | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [boardResult, tprmResult, activityResult] = await Promise.all([
          fetchBoardReportOverview(),
          fetchTPRMSummary().catch(() => null),
          fetchActivityLog({ limit: 8 }).catch(() => []),
        ]);
        setBoardData(boardResult);
        setTprmData(tprmResult);
        setActivityData(activityResult || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load executive overview');
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const handleGenerateReport = async () => {
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
        downloadBlob(new Blob([await downloadBoardReportMarkdown(audience)], { type: 'text/markdown' }), 'executive-overview.md');
      } else if (format === 'html') {
        downloadBlob(new Blob([await downloadBoardReportHtml(audience)], { type: 'text/html' }), 'executive-overview.html');
      } else {
        downloadBlob(await downloadBoardReportPdf(audience), 'executive-overview.pdf');
      }
    } finally {
      setDownloadLoading(null);
    }
  };

  const metrics = useMemo(() => {
    if (!boardData) return [];
    const totalControls = boardData.frameworks.reduce((sum, framework) => sum + framework.totalControls, 0);
    const totalImplemented = boardData.frameworks.reduce((sum, framework) => sum + framework.implemented, 0);
    const controlsImplRate = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0;
    return [
      { label: 'Open Risks', value: boardData.riskSummary.openRisks, detail: `${boardData.riskSummary.highRisks} high severity`, tone: 'warning' as const },
      { label: 'Control Coverage', value: `${controlsImplRate}%`, detail: `${totalImplemented} of ${totalControls} implemented`, tone: 'success' as const },
      { label: 'Overdue Reviews', value: boardData.policySummary.overdueReviews, detail: 'Policy review queue', tone: boardData.policySummary.overdueReviews > 0 ? 'danger' as const : 'default' as const },
      { label: 'Training Completion', value: `${boardData.trainingSummary.overallCompletionRate}%`, detail: `${boardData.trainingSummary.overdueAssignments} overdue assignments`, tone: 'primary' as const },
      { label: 'Vendors', value: tprmData?.totalVendors || 0, detail: `${tprmData?.overdueAssessments || 0} overdue assessments`, tone: 'default' as const },
    ];
  }, [boardData, tprmData]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Executive Overview" description="Board-ready view of operational risk, control execution, and program movement." />
        <PageSectionCard title="Loading Overview">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading board reporting view...</div>
        </PageSectionCard>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Executive Overview" description="Board-ready view of operational risk, control execution, and program movement." />
        <EmptyStatePanel title="Unable to load executive overview" description={error} actions={<Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>} />
      </div>
    );
  }

  if (!boardData) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Executive Overview" description="Board-ready view of operational risk, control execution, and program movement." />
        <EmptyStatePanel title="No executive data is available yet" description="Seed the operating modules with risks, controls, policy documents, and training activity to build the board summary." />
      </div>
    );
  }

  const attentionItems = [
    ...boardData.riskSummary.topRisks.slice(0, 3).map((risk) => ({
      title: risk.title,
      meta: `Risk score ${risk.severityScore}`,
      tone: risk.severityScore >= 12 ? 'danger' : 'warning',
    })),
    ...(boardData.policySummary.overdueReviews > 0 ? [{ title: `${boardData.policySummary.overdueReviews} policy reviews overdue`, meta: 'Governance follow-through needed', tone: 'warning' as const }] : []),
    ...((tprmData?.overdueAssessments || 0) > 0 ? [{ title: `${tprmData?.overdueAssessments || 0} vendor assessments overdue`, meta: 'Third-party review queue', tone: 'danger' as const }] : []),
  ];

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Executive Overview"
        description="Board-ready view of operational risk, control execution, and program movement."
        action={
          <>
            <Button variant="outline" onClick={() => handleDownload('pdf')} disabled={downloadLoading !== null}>{downloadLoading === 'pdf' ? 'Preparing PDF...' : 'Export PDF Pack'}</Button>
            <Button variant="primary" onClick={handleGenerateReport} disabled={narrativeLoading}>{narrativeLoading ? 'Generating Brief...' : 'Generate Board Narrative'}</Button>
          </>
        }
      />

      <SummaryMetricStrip metrics={metrics} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 1fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Board Signal" subtitle="What leadership should know now.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Badge variant="warning" size="sm">{boardData.riskSummary.highRisks} elevated risks</Badge>
              <Badge variant="success" size="sm">{boardData.frameworks.length} frameworks tracked</Badge>
              <Badge variant="default" size="sm">{tprmData?.totalVendors || 0} vendors in scope</Badge>
            </div>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
              The program is currently balancing risk treatment, control execution, policy review cadence, and overdue training obligations. This view is designed for a board or steering committee discussion rather than module-level administration.
            </div>
          </div>
        </PageSectionCard>

        <PageSectionCard title="Reporting Studio" subtitle="Generate the current stakeholder narrative and export pack.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <select value={audience} onChange={(event) => setAudience(event.target.value as BoardReportAudience)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={() => handleDownload('md')} disabled={downloadLoading !== null}>{downloadLoading === 'md' ? 'Downloading...' : 'Markdown'}</Button>
              <Button variant="outline" onClick={() => handleDownload('html')} disabled={downloadLoading !== null}>{downloadLoading === 'html' ? 'Downloading...' : 'HTML'}</Button>
              <Button variant="outline" onClick={() => handleDownload('pdf')} disabled={downloadLoading !== null}>{downloadLoading === 'pdf' ? 'Downloading...' : 'PDF'}</Button>
            </div>
          </div>
        </PageSectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[4] }}>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Risk Summary</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>{boardData.riskSummary.totalRisks} total risks</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{boardData.riskSummary.openRisks} open and {boardData.riskSummary.highRisks} high severity.</div>
        </Card>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Policy Posture</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>{boardData.policySummary.totalDocuments} governance documents</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{boardData.policySummary.dueNext30Days} due in 30 days and {boardData.policySummary.overdueReviews} overdue.</div>
        </Card>
        <Card style={{ padding: theme.spacing[4] }}>
          <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', color: theme.colors.text.muted }}>Training</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold }}>{boardData.trainingSummary.activeCampaigns} active campaigns</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{boardData.trainingSummary.overdueAssignments} overdue assignments remain open.</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: theme.spacing[4] }}>
        <PageSectionCard title="Items Needing Attention" subtitle="Operational issues likely to influence the next leadership meeting.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {attentionItems.length > 0 ? attentionItems.map((item) => (
              <Card key={item.title} style={{ padding: theme.spacing[4], backgroundColor: item.tone === 'danger' ? theme.colors.semantic.dangerLight : theme.colors.semantic.warningLight }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.title}</div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.meta}</div>
              </Card>
            )) : <div style={{ color: theme.colors.text.secondary }}>No urgent items need escalation.</div>}
          </div>
        </PageSectionCard>

        <ActivityFeed title="Recent Activity" subtitle="Latest cross-program movement and user activity." countLabel={`${activityData.length} items`}>
          {activityData.length > 0 ? activityData.map((activity) => <ActivityRow key={activity.id} activity={activity} />) : <Card style={{ padding: theme.spacing[4], color: theme.colors.text.secondary }}>No recent activity.</Card>}
        </ActivityFeed>
      </div>

      <PageSectionCard title="Generated Narrative" subtitle="Stakeholder-ready briefing content for the selected audience.">
        {narrative ? (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
            {narrative}
          </div>
        ) : (
          <div style={{ color: theme.colors.text.secondary }}>Generate the board narrative when you need a concise written brief for leadership or audit stakeholders.</div>
        )}
      </PageSectionCard>
    </div>
  );
}

export default ExecutiveOverview;
