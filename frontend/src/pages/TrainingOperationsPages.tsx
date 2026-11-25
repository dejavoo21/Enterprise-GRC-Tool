import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  formatTrainingStatus,
  isCompletedTrainingStatus,
  isOverdueTrainingStatus,
  type AwarenessCampaign,
  type TrainingAssignment,
} from '../types/training';
import './TrainingOperationsPages.css';

interface ApiResponse<T> {
  data: T | null;
  error?: { code?: string; message?: string } | null;
}

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'passed':
    case 'exempted':
      return 'success';
    case 'active':
    case 'assigned':
    case 'awaiting_acknowledgement':
    case 'in_progress':
      return 'primary';
    case 'failed':
    case 'overdue':
    case 'expired':
    case 'refresher_required':
      return 'danger';
    case 'cancelled':
      return 'default';
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
  onTransition,
  transitioningAssignmentId,
}: {
  title: string;
  subtitle: string;
  assignments: TrainingAssignment[];
  onTransition?: (assignment: TrainingAssignment, status: TrainingAssignment['status']) => Promise<void>;
  transitioningAssignmentId?: string | null;
}) {
  return (
    <PageSectionCard title={title} subtitle={subtitle} action={<Badge variant="default" size="sm">{assignments.length} records</Badge>}>
      <div className="training-operations__table-wrap">
        <table className="training-operations__table">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
            {onTransition ? <col style={{ width: '14%' }} /> : null}
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
              {onTransition ? <th style={{ padding: `${theme.spacing[2]} 0` }}>Actions</th> : null}
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
                  <Badge variant={statusVariant(assignment.status)} size="sm">{formatTrainingStatus(assignment.status)}</Badge>
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
                {onTransition ? (
                  <td style={{ padding: `${theme.spacing[3]} 0` }}>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      {(['assigned', 'not_started', 'awaiting_acknowledgement', 'overdue', 'refresher_required'].includes(assignment.status)) ? (
                        <Button size="sm" variant="secondary" disabled={transitioningAssignmentId != null} onClick={() => void onTransition(assignment, 'in_progress')}>{transitioningAssignmentId === assignment.id ? 'Starting...' : 'Start'}</Button>
                      ) : null}
                      {assignment.status === 'in_progress' ? (
                        <Button size="sm" variant="primary" disabled={transitioningAssignmentId != null} onClick={() => void onTransition(assignment, 'completed')}>{transitioningAssignmentId === assignment.id ? 'Completing...' : 'Complete'}</Button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
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
  const transitionLock = useRef(false);
  const [transitioningAssignmentId, setTransitioningAssignmentId] = useState<string | null>(null);

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

  const transitionAssignment = async (assignment: TrainingAssignment, status: TrainingAssignment['status']) => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    const assignmentId = assignment.id;
    try {
      setError(null);
      setTransitioningAssignmentId(assignmentId);
      const response = await apiCall<ApiResponse<TrainingAssignment>>(`/api/v1/training/assignments/${assignmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.data) throw new Error(response.error?.message || 'Unable to update training assignment.');
      await loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update training assignment.');
    } finally {
      transitionLock.current = false;
      setTransitioningAssignmentId(null);
    }
  };

  const metrics = useMemo(() => {
    const completed = assignments.filter((assignment) => isCompletedTrainingStatus(assignment.status)).length;
    const overdue = assignments.filter((assignment) => isOverdueTrainingStatus(assignment.status)).length;
    const inProgress = assignments.filter((assignment) => assignment.status === 'in_progress').length;
    return [
      { label: 'Assignments', value: assignments.length, detail: 'Total active learner assignments', tone: 'primary' as const },
      { label: 'Completed', value: completed, detail: 'Closed successfully', tone: 'success' as const },
      { label: 'In Progress', value: inProgress, detail: 'Currently underway', tone: 'default' as const },
      { label: 'Overdue', value: overdue, detail: 'Need follow-up', tone: overdue > 0 ? 'danger' as const : 'success' as const },
    ];
  }, [assignments]);

  return (
    <div className="training-operations">
      <PageHeader
        title="Training Assignments"
        description="Monitor learner assignments, due dates, and completion status across the active workspace."
        action={<Button variant="primary" disabled={transitioningAssignmentId !== null} onClick={() => void loadAssignments()}>Refresh</Button>}
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
          onTransition={transitionAssignment}
          transitioningAssignmentId={transitioningAssignmentId}
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
    () => assignments.filter((assignment) => isCompletedTrainingStatus(assignment.status)),
    [assignments],
  );

  const metrics = useMemo(() => [
    { label: 'Completed Records', value: completedRecords.length, detail: 'Training completions captured', tone: 'success' as const },
    { label: 'Mandatory Records', value: completedRecords.filter((assignment) => assignment.mandatory).length, detail: 'Mandatory modules completed', tone: 'primary' as const },
    { label: 'Learners Covered', value: new Set(completedRecords.map((assignment) => assignment.userId)).size, detail: 'Unique users with recorded completions', tone: 'default' as const },
  ], [completedRecords]);

  return (
    <div className="training-operations">
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
    <div className="training-operations">
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
                      <Badge variant={statusVariant(campaign.status)} size="sm">{formatTrainingStatus(campaign.status)}</Badge>
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
