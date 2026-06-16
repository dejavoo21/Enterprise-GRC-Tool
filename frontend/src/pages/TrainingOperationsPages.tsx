import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
} from '../components';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { AwarenessCampaign, TrainingAssignment } from '../types/training';

interface ApiResponse<T> {
  data: T | null;
  error?: { code?: string; message?: string } | null;
}

const pageStyle = {
  maxWidth: 1400,
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
};

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'active':
    case 'in_progress':
      return 'primary';
    case 'overdue':
      return 'danger';
    default:
      return 'warning';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Not scheduled'
    : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatChannel(channel: AwarenessCampaign['channel']) {
  switch (channel) {
    case 'phishing_sim':
      return 'Phishing Simulation';
    case 'email':
      return 'Email';
    case 'poster':
      return 'Poster';
    case 'event':
      return 'Event';
    case 'video':
      return 'Video';
    default:
      return channel;
  }
}

function TrainingAssignmentsTable({
  title,
  subtitle,
  assignments,
}: {
  title: string;
  subtitle: string;
  assignments: TrainingAssignment[];
}) {
  return (
    <PageSectionCard title={title} subtitle={subtitle} action={<Badge variant="default" size="sm">{assignments.length} records</Badge>}>
      <div style={{ overflowX: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Course</th>
              <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>User</th>
              <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Status</th>
              <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Assigned</th>
              <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Due</th>
              <th style={{ padding: `${theme.spacing[2]} 0` }}>Completed</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
                  {assignment.courseTitle || 'Training module'}
                </td>
                <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {assignment.userName}
                </td>
                <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}>
                  <Badge variant={statusVariant(assignment.status)} size="sm">{assignment.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {formatDate(assignment.assignedAt)}
                </td>
                <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {formatDate(assignment.dueAt)}
                </td>
                <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {formatDate(assignment.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageSectionCard>
  );
}

export function TrainingAssignmentsPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall<ApiResponse<TrainingAssignment[]>>('/api/v1/training/assignments');
      setAssignments(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const metrics = useMemo(() => {
    const completed = assignments.filter((assignment) => assignment.status === 'completed').length;
    const overdue = assignments.filter((assignment) => assignment.status === 'overdue').length;
    const inProgress = assignments.filter((assignment) => assignment.status === 'in_progress').length;
    return [
      { label: 'Assignments', value: assignments.length, detail: 'Total active learner assignments', tone: 'primary' as const },
      { label: 'Completed', value: completed, detail: 'Closed successfully', tone: 'success' as const },
      { label: 'In Progress', value: inProgress, detail: 'Currently underway', tone: 'default' as const },
      { label: 'Overdue', value: overdue, detail: 'Need follow-up', tone: overdue > 0 ? 'danger' as const : 'success' as const },
    ];
  }, [assignments]);

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Training Assignments"
        description="Monitor learner assignments, due dates, and completion status across the active workspace."
        action={<Button variant="primary" onClick={() => void loadAssignments()}>Refresh</Button>}
      />
      <SummaryMetricStrip metrics={metrics} />
      {error ? (
        <EmptyStatePanel
          eyebrow="Training Error"
          title="Unable to load training assignments"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadAssignments()}>Retry</Button>}
        />
      ) : null}
      {!error && loading ? (
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Loading training assignments...
        </Card>
      ) : null}
      {!error && !loading && assignments.length === 0 ? (
        <EmptyStatePanel
          eyebrow="No Assignments"
          title="No training assignments are active"
          description="Assignments will appear here as courses and campaigns are issued to users."
        />
      ) : null}
      {!error && !loading && assignments.length > 0 ? (
        <TrainingAssignmentsTable
          title="Assignment Queue"
          subtitle="Compact operational view of mandatory learning, due dates, and completion ownership."
          assignments={assignments}
        />
      ) : null}
    </div>
  );
}

export function TrainingRecordsPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall<ApiResponse<TrainingAssignment[]>>('/api/v1/training/assignments');
      setAssignments(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const completedRecords = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'completed'),
    [assignments],
  );

  const metrics = useMemo(() => [
    { label: 'Completed Records', value: completedRecords.length, detail: 'Training completions captured', tone: 'success' as const },
    { label: 'Mandatory Records', value: completedRecords.filter((assignment) => assignment.mandatory).length, detail: 'Mandatory modules completed', tone: 'primary' as const },
    { label: 'Learners Covered', value: new Set(completedRecords.map((assignment) => assignment.userId)).size, detail: 'Unique users with recorded completions', tone: 'default' as const },
  ], [completedRecords]);

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Training Records"
        description="Review completion records, mandatory coverage, and historical training evidence for the active workspace."
        action={<Button variant="primary" onClick={() => void loadRecords()}>Refresh</Button>}
      />
      <SummaryMetricStrip metrics={metrics} />
      {error ? (
        <EmptyStatePanel
          eyebrow="Training Error"
          title="Unable to load training records"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadRecords()}>Retry</Button>}
        />
      ) : null}
      {!error && loading ? (
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Loading training records...
        </Card>
      ) : null}
      {!error && !loading && completedRecords.length === 0 ? (
        <EmptyStatePanel
          eyebrow="No Records"
          title="No completed training records are available"
          description="Completion records will be captured here once assignments are finished."
        />
      ) : null}
      {!error && !loading && completedRecords.length > 0 ? (
        <TrainingAssignmentsTable
          title="Completion Records"
          subtitle="Historical learner records suitable for audit evidence and compliance attestation."
          assignments={completedRecords}
        />
      ) : null}
    </div>
  );
}

export function TrainingPhishingSimulationsPage() {
  const [campaigns, setCampaigns] = useState<AwarenessCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall<ApiResponse<AwarenessCampaign[]>>('/api/v1/training/campaigns');
      setCampaigns((result.data || []).filter((campaign) => campaign.channel === 'phishing_sim'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phishing simulations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const metrics = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.status === 'active').length;
    const completed = campaigns.filter((campaign) => campaign.status === 'completed').length;
    const avgClickRate = campaigns.length
      ? Math.round(campaigns.reduce((total, campaign) => total + Number(campaign.clickRate || 0), 0) / campaigns.length)
      : 0;
    return [
      { label: 'Simulations', value: campaigns.length, detail: 'Phishing exercises in scope', tone: 'primary' as const },
      { label: 'Active', value: active, detail: 'Currently running', tone: active > 0 ? 'warning' as const : 'default' as const },
      { label: 'Completed', value: completed, detail: 'Closed campaigns', tone: 'success' as const },
      { label: 'Avg Click Rate', value: `${avgClickRate}%`, detail: 'Measured susceptibility', tone: avgClickRate > 10 ? 'danger' as const : 'success' as const },
    ];
  }, [campaigns]);

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Phishing Simulations"
        description="Track phishing exercises, completion, click-rate outcomes, and learner susceptibility trends."
        action={<Button variant="primary" onClick={() => void loadCampaigns()}>Refresh</Button>}
      />
      <SummaryMetricStrip metrics={metrics} />
      {error ? (
        <EmptyStatePanel
          eyebrow="Campaign Error"
          title="Unable to load phishing simulations"
          description={error}
          actions={<Button variant="primary" onClick={() => void loadCampaigns()}>Retry</Button>}
        />
      ) : null}
      {!error && loading ? (
        <Card style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
          Loading phishing simulations...
        </Card>
      ) : null}
      {!error && !loading && campaigns.length === 0 ? (
        <EmptyStatePanel
          eyebrow="No Simulations"
          title="No phishing simulations are available"
          description="Simulation campaigns will appear here once phishing exercises are launched."
        />
      ) : null}
      {!error && !loading && campaigns.length > 0 ? (
        <PageSectionCard title="Simulation Campaigns" subtitle="Campaign-level outcome tracking for phishing awareness exercises." action={<Badge variant="default" size="sm">{campaigns.length} campaigns</Badge>}>
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {campaigns.map((campaign) => (
              <Card key={campaign.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: theme.colors.text.main }}>{campaign.title}</strong>
                      <Badge variant={statusVariant(campaign.status)} size="sm">{campaign.status}</Badge>
                      <Badge variant="default" size="sm">{formatChannel(campaign.channel)}</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {campaign.topic} · {campaign.participants} participants · {formatDate(campaign.startDate)} to {formatDate(campaign.endDate)}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 180 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                      <span style={{ color: theme.colors.text.secondary }}>Completion</span>
                      <strong>{campaign.completionRate ?? 0}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm }}>
                      <span style={{ color: theme.colors.text.secondary }}>Click rate</span>
                      <strong>{campaign.clickRate ?? 0}%</strong>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      ) : null}
    </div>
  );
}
