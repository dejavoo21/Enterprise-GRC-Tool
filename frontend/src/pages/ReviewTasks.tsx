import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { DataTable } from '../components/DataTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import type {
  ReviewTask,
  CreateReviewTaskInput,
  ReviewTaskStatus,
  GovernanceDocument,
  DocumentReviewDecision,
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
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reminderDaysBefore: [30, 7, 1],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-populate title when document is selected
    if (name === 'documentId' && value) {
      const doc = documents.find(d => d.id === value);
      if (doc) {
        setFormData(prev => ({
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
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
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
              {documents.filter(d => d.status !== 'retired').map(doc => (
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
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
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                backgroundColor: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
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
        onClick={e => e.stopPropagation()}
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
              onChange={e => setDecision(e.target.value as DocumentReviewDecision)}
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

          {decision === 'update_required' && (
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                New Version
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={e => setNewVersion(e.target.value)}
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
          )}

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Comments
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
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
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: theme.borderRadius.md,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Completing...' : 'Complete Review'}
            </button>
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
        const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
        throw new Error(errorMsg);
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

      if (result.error) {
        return;
      }

      setDocuments(result.data || []);
    } catch {
      // Silently fail for documents fetch
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
      const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
      throw new Error(errorMsg);
    }

    await fetchTasks();
  };

  const handleCompleteTask = async (decision: DocumentReviewDecision, comments?: string, newVersion?: string) => {
    if (!selectedTask) return;

    // First complete the task
    const completeResult: ApiResponse<ReviewTask> = await apiCall(`${API_BASE}/review-tasks/${selectedTask.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': currentWorkspace.id,
      },
      body: JSON.stringify({ updateDocumentReviewDates: true }),
    });

    if (completeResult.error) {
      const errorMsg = typeof completeResult.error === 'string' ? completeResult.error : completeResult.error.message;
      throw new Error(errorMsg);
    }

    // Then create a review log entry
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
      const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
      alert(`Error: ${errorMsg}`);
      return;
    }

    await fetchTasks();
  };

  const getDocumentTitle = (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    return doc?.title || documentId;
  };

  const summaryStats = {
    total: tasks.length,
    open: tasks.filter(t => t.status === 'open').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

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
    { key: 'assignee', header: 'Assignee' },
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
            {(item.status === 'open' || item.status === 'overdue') && (
              <button
                onClick={(e) => { e.stopPropagation(); handleStartTask(item); }}
                style={{
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  backgroundColor: '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.typography.sizes.xs,
                  fontWeight: theme.typography.weights.medium,
                }}
              >
                Start
              </button>
            )}
            {item.status === 'in_progress' && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedTask(item); setIsCompleteModalOpen(true); }}
                style={{
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                  fontSize: theme.typography.sizes.xs,
                  fontWeight: theme.typography.weights.medium,
                }}
              >
                Complete
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const filterSection = (
    <div style={{ display: 'flex', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
      <select
        value={selectedStatus}
        onChange={e => setSelectedStatus(e.target.value as ReviewTaskStatus | '')}
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
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Review Tasks"
          description="Track and manage document review assignments and deadlines."
        />
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
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Review Tasks"
          description="Track and manage document review assignments and deadlines."
        />
        <div
          style={{
            padding: theme.spacing[6],
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: theme.borderRadius.lg,
            color: theme.colors.semantic.danger,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading tasks</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchTasks}
            style={{
              marginTop: theme.spacing[4],
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              backgroundColor: theme.colors.semantic.danger,
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Review Tasks"
        description="Track and manage document review assignments and deadlines."
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[8],
        }}
      >
        {[
          { label: 'Total Tasks', value: summaryStats.total, color: theme.colors.primary },
          { label: 'Open', value: summaryStats.open, color: '#2563EB' },
          { label: 'In Progress', value: summaryStats.inProgress, color: '#D97706' },
          { label: 'Overdue', value: summaryStats.overdue, color: '#DC2626' },
          { label: 'Completed', value: summaryStats.completed, color: '#059669' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: theme.spacing[6],
              backgroundColor: 'white',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: theme.spacing[2] }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '32px', fontWeight: theme.typography.weights.bold, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {filterSection}

      <DataTable
        data={tasks}
        columns={columns}
        searchPlaceholder="Search tasks..."
        primaryAction={{
          label: 'New Task',
          onClick: () => setIsCreateModalOpen(true),
        }}
      />

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        documents={documents}
      />

      <CompleteTaskModal
        isOpen={isCompleteModalOpen}
        onClose={() => { setIsCompleteModalOpen(false); setSelectedTask(null); }}
        onSubmit={handleCompleteTask}
        task={selectedTask}
      />
    </div>
  );
}
