import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyStatePanel, PageHeader, PageSectionCard, PageToolbar, SummaryMetricStrip } from '../components';
import { DataTable } from '../components/DataTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type {
  CreateReviewTaskInput,
  DocumentReviewDecision,
  GovernanceDocument,
  ReviewTask,
  ReviewTaskStatus,
} from '../types/governance';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

const API_BASE = '/api/v1';

const TASK_STATUS_LABELS: Record<ReviewTaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

const TASK_STATUS_COLORS: Record<ReviewTaskStatus, { bg: string; text: string }> = {
  open: { bg: '#DBEAFE', text: '#2563EB' },
  in_progress: { bg: '#FEF3C7', text: '#D97706' },
  completed: { bg: '#D1FAE5', text: '#059669' },
  overdue: { bg: '#FEE2E2', text: '#DC2626' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280' },
};

function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  documents,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateReviewTaskInput) => Promise<void>;
  documents: GovernanceDocument[];
}) {
  const [formData, setFormData] = useState<CreateReviewTaskInput>({
    documentId: '',
    title: '',
    description: '',
    assignee: '',
    assigneeEmail: '',
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reminderDaysBefore: [30, 7, 1],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'documentId' && value) {
      const doc = documents.find((item) => item.id === value);
      if (doc) {
        setFormData((prev) => ({
          ...prev,
          documentId: value,
          title: `Review: ${doc.title}`,
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      setFormData({
        documentId: '',
        title: '',
        description: '',
        assignee: '',
        assigneeEmail: '',
        dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        reminderDaysBefore: [30, 7, 1],
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[8],
          maxWidth: '560px',
          width: '92%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[6] }}>Create Review Task</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Document *
            </label>
            <select
              name="documentId"
              value={formData.documentId}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              <option value="">Select a document...</option>
              {documents.filter((doc) => doc.status !== 'retired').map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.docType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Task Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Annual Policy Review"
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Description
            </label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes about this review task..."
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Assignee *
              </label>
              <input
                type="text"
                name="assignee"
                value={formData.assignee}
                onChange={handleChange}
                required
                placeholder="e.g., John Smith"
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Assignee Email *
              </label>
              <input
                type="email"
                name="assigneeEmail"
                value={formData.assigneeEmail || ''}
                onChange={handleChange}
                required
                placeholder="e.g., john.smith@company.com"
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Due Date *
              </label>
              <input
                type="date"
                name="dueAt"
                value={formData.dueAt}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'flex-end', marginTop: theme.spacing[4] }}>
            <Button type="button" onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} variant="primary">
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteTaskModal({
  isOpen,
  onClose,
  onSubmit,
  task,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (decision: DocumentReviewDecision, comments?: string, newVersion?: string) => Promise<void>;
  task: ReviewTask | null;
}) {
  const [decision, setDecision] = useState<DocumentReviewDecision>('no_change');
  const [comments, setComments] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(decision, comments || undefined, newVersion || undefined);
      setDecision('no_change');
      setComments('');
      setNewVersion('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[8],
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[4] }}>Complete Review Task</h2>
        <p style={{ margin: `0 0 ${theme.spacing[6]}`, color: theme.colors.text.secondary }}>
          {task.title}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Review Decision *
            </label>
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as DocumentReviewDecision)}
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              <option value="no_change">No Change Required</option>
              <option value="update_required">Update Required</option>
              <option value="retire">Retire Document</option>
            </select>
          </div>

          {decision === 'update_required' ? (
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                New Version
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="e.g., 2.0"
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>
          ) : null}

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Add any review comments or notes..."
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'flex-end', marginTop: theme.spacing[4] }}>
            <Button type="button" onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} variant="primary">
              {isSubmitting ? 'Completing...' : 'Complete Review'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReviewTasks() {
  const { currentWorkspace } = useWorkspace();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [documents, setDocuments] = useState<GovernanceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReviewTaskStatus | ''>('');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);

      const url = `${API_BASE}/review-tasks${params.toString() ? `?${params.toString()}` : ''}`;
      const result: ApiResponse<ReviewTask[]> = await apiCall(url, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setTasks(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id, selectedStatus]);

  const fetchDocuments = useCallback(async () => {
    try {
      const result: ApiResponse<GovernanceDocument[]> = await apiCall(`${API_BASE}/governance-documents`, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      if (!result.error) {
        setDocuments(result.data || []);
      }
    } catch {
      // Non-blocking for the main review workflow
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    fetchTasks();
    fetchDocuments();
  }, [fetchTasks, fetchDocuments]);

  const handleCreateTask = async (input: CreateReviewTaskInput) => {
    const result: ApiResponse<ReviewTask> = await apiCall(`${API_BASE}/review-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': currentWorkspace.id,
      },
      body: JSON.stringify(input),
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    await fetchTasks();
  };

  const handleCompleteTask = async (decision: DocumentReviewDecision, comments?: string, newVersion?: string) => {
    if (!selectedTask) return;

    const completeResult: ApiResponse<ReviewTask> = await apiCall(`${API_BASE}/review-tasks/${selectedTask.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': currentWorkspace.id,
      },
      body: JSON.stringify({ updateDocumentReviewDates: true }),
    });

    if (completeResult.error) {
      throw new Error(completeResult.error.message);
    }

    await apiCall(`${API_BASE}/document-review-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': currentWorkspace.id,
      },
      body: JSON.stringify({
        documentId: selectedTask.documentId,
        reviewTaskId: selectedTask.id,
        reviewedBy: selectedTask.assignee,
        decision,
        comments,
        newVersion,
      }),
    });

    await fetchTasks();
    await fetchDocuments();
  };

  const handleStartTask = async (task: ReviewTask) => {
    const result: ApiResponse<ReviewTask> = await apiCall(`${API_BASE}/review-tasks/${task.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': currentWorkspace.id,
      },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    if (result.error) {
      window.alert(`Error: ${result.error.message}`);
      return;
    }

    await fetchTasks();
  };

  const getDocumentTitle = (documentId: string) => {
    const doc = documents.find((item) => item.id === documentId);
    return doc?.title || documentId;
  };

  const summaryStats = {
    total: tasks.length,
    open: tasks.filter((task) => task.status === 'open').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    overdue: tasks.filter((task) => task.status === 'overdue').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
  };

  const cadenceStats = [
    { label: 'Open Queue', value: summaryStats.open, color: '#2563EB' },
    { label: 'In Motion', value: summaryStats.inProgress, color: '#D97706' },
    { label: 'Overdue', value: summaryStats.overdue, color: '#DC2626' },
    { label: 'Closed', value: summaryStats.completed, color: '#059669' },
  ];

  const metrics = [
    { label: 'Open Queue', value: summaryStats.open, detail: 'Awaiting assignment or kickoff', tone: 'primary' as const },
    { label: 'In Progress', value: summaryStats.inProgress, detail: 'Actively under review', tone: 'warning' as const },
    { label: 'Overdue', value: summaryStats.overdue, detail: 'Escalate reviewer attention', tone: 'danger' as const },
    { label: 'Completed', value: summaryStats.completed, detail: 'Closed with review decision', tone: 'success' as const },
    { label: 'Active Documents', value: documents.filter((document) => document.status !== 'retired').length, detail: 'Current governance inventory', tone: 'default' as const },
  ];

  const upcomingTasks = [...tasks]
    .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
    .slice(0, 4);

  const columns = [
    { key: 'id', header: 'ID', width: '100px' },
    {
      key: 'title',
      header: 'Task',
      render: (item: ReviewTask) => (
        <div>
          <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.primary }}>
            {item.title}
          </span>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginTop: theme.spacing[1] }}>
            Document: {getDocumentTitle(item.documentId)}
          </div>
        </div>
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (item: ReviewTask) => (
        <div>
          <div>{item.assignee}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginTop: theme.spacing[1] }}>
            {item.assigneeEmail || 'No email on file'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ReviewTask) => {
        const colors = TASK_STATUS_COLORS[item.status];
        return (
          <span
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              backgroundColor: colors.bg,
              color: colors.text,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            {TASK_STATUS_LABELS[item.status]}
          </span>
        );
      },
    },
    {
      key: 'dueAt',
      header: 'Due Date',
      render: (item: ReviewTask) => {
        const dueDate = new Date(item.dueAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && item.status !== 'completed' && item.status !== 'cancelled';
        return (
          <span
            style={{
              color: isOverdue ? theme.colors.semantic.danger : theme.colors.text.main,
              fontWeight: isOverdue ? theme.typography.weights.medium : 'normal',
            }}
          >
            {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: ReviewTask) => {
        if (item.status === 'completed' || item.status === 'cancelled') {
          return <span style={{ color: theme.colors.text.secondary }}>-</span>;
        }

        return (
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            {(item.status === 'open' || item.status === 'overdue') ? (
              <Button variant="primary" onClick={(e) => { e.stopPropagation(); handleStartTask(item); }}>
                Start
              </Button>
            ) : null}
            {item.status === 'in_progress' ? (
              <Button variant="primary" onClick={(e) => { e.stopPropagation(); setSelectedTask(item); setIsCompleteModalOpen(true); }}>
                Complete
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const filterSection = (
    <PageToolbar actions={<Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>New Task</Button>}>
      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value as ReviewTaskStatus | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="overdue">Overdue</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </PageToolbar>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Review Workflow Center"
          description="Manage policy review assignments, due dates, and completion decisions across the governance cycle."
        />
        <PageSectionCard title="Loading Review Tasks">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: theme.spacing[12],
              color: theme.colors.text.secondary,
            }}
          >
            Loading tasks...
          </div>
        </PageSectionCard>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Review Workflow Center"
          description="Manage policy review assignments, due dates, and completion decisions across the governance cycle."
        />
        <EmptyStatePanel
          title="Unable to load review tasks"
          description={error}
          actions={<Button variant="primary" onClick={fetchTasks}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: theme.spacing[6] }}>
      <PageHeader
        title="Review Workflow Center"
        description="Manage policy review assignments, due dates, and completion decisions across the governance cycle."
      />

      <SummaryMetricStrip metrics={metrics} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: theme.spacing[5],
        }}
      >
        <PageSectionCard
          title="Review Status Distribution"
          subtitle="Snapshot of the current workflow mix across the active review queue."
        >
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {cadenceStats.map((stat) => {
              const width = summaryStats.total > 0 ? `${(stat.value / summaryStats.total) * 100}%` : '0%';
              return (
                <div key={stat.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                  <div style={{ height: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight, overflow: 'hidden' }}>
                    <div style={{ width, height: '100%', backgroundColor: stat.color, borderRadius: theme.borderRadius.full }} />
                  </div>
                </div>
              );
            })}
          </div>
        </PageSectionCard>

        <PageSectionCard
          title="Next Due Reviews"
          subtitle="Upcoming assignments that need ownership attention."
        >
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {upcomingTasks.length === 0 ? (
              <div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>
                No active review assignments are currently queued.
              </div>
            ) : (
              upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: theme.spacing[3],
                    borderRadius: theme.borderRadius.lg,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], marginBottom: theme.spacing[2] }}>
                    <strong style={{ fontSize: theme.typography.sizes.sm }}>{task.title}</strong>
                    <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                      {new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                    {task.assignee} • {TASK_STATUS_LABELS[task.status]}
                  </div>
                </div>
              ))
            )}
          </div>
        </PageSectionCard>
      </div>

      {filterSection}

      {tasks.length === 0 ? (
        <EmptyStatePanel
          title="No review tasks are in the queue"
          description="Create the first review assignment to start tracking document owners, due dates, and completion decisions."
          actions={<Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>Create Review Task</Button>}
        />
      ) : (
        <PageSectionCard
          title="Review Task Queue"
          subtitle="Compact operational view of document review assignments, assignees, and due dates."
        >
          <DataTable
            data={tasks}
            columns={columns}
            searchPlaceholder="Search tasks..."
          />
        </PageSectionCard>
      )}

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        documents={documents}
      />

      <CompleteTaskModal
        isOpen={isCompleteModalOpen}
        onClose={() => {
          setIsCompleteModalOpen(false);
          setSelectedTask(null);
        }}
        onSubmit={handleCompleteTask}
        task={selectedTask}
      />
    </div>
  );
}
