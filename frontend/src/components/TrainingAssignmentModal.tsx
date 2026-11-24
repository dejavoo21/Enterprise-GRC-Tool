import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { TrainingCourse } from '../types/training';
import { Button } from './Button';
import { Modal } from './Modal';
import './TrainingAssignmentModal.css';

interface WorkspaceMember {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface ApiResponse<T> {
  data: T | null;
  error?: { message?: string } | null;
}

export function TrainingAssignmentModal({
  isOpen,
  courses,
  onClose,
  onAssigned,
}: {
  isOpen: boolean;
  courses: TrainingCourse[];
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
}) {
  const { currentWorkspace } = useWorkspace();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [courseId, setCourseId] = useState('');
  const [userId, setUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCourses = useMemo(() => courses.filter((course) => course.isActive !== false), [courses]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const response = await fetch(`/api/v1/workspaces/${currentWorkspace.id}/members`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        });
        const result = await response.json() as ApiResponse<WorkspaceMember[]>;
        if (!response.ok || result.error) throw new Error(result.error?.message || 'Unable to load workspace learners.');
        if (!cancelled) setMembers(result.data || []);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load workspace learners.');
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    };
    void loadMembers();
    return () => { cancelled = true; };
  }, [currentWorkspace.id, isOpen]);

  const closeAndReset = () => {
    setCourseId('');
    setUserId('');
    setDueDate('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!courseId || !userId) {
      setError('Select a course and learner before assigning training.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const response = await fetch('/api/v1/training/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': currentWorkspace.id },
        body: JSON.stringify({ courseId, userId, dueAt: dueDate ? `${dueDate}T23:59:59.000Z` : null }),
      });
      const result = await response.json() as ApiResponse<unknown>;
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Unable to assign training.');
      await onAssigned();
      closeAndReset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to assign training.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      accessibleDialog
      isOpen={isOpen}
      onClose={() => { if (!saving) closeAndReset(); }}
      title="Assign training"
      width="620px"
      footer={(
        <>
          <Button variant="outline" onClick={closeAndReset} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving || loadingMembers || !courseId || !userId}>
            {saving ? 'Assigning...' : 'Review and assign'}
          </Button>
        </>
      )}
    >
      <div className="training-assignment-form">
        <p className="training-assignment-form__notice">This creates a live learner assignment in the current workspace. It does not send external notifications.</p>
        <label className="training-assignment-form__field">
          <span>Course</span>
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
            <option value="">Select course</option>
            {activeCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <label className="training-assignment-form__field">
          <span>Learner</span>
          <select value={userId} onChange={(event) => setUserId(event.target.value)} required disabled={loadingMembers}>
            <option value="">{loadingMembers ? 'Loading learners...' : 'Select learner'}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.fullName} · {member.email}</option>)}
          </select>
        </label>
        <label className="training-assignment-form__field">
          <span>Due date (optional)</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        {error ? <div className="training-assignment-form__error" role="alert">{error}</div> : null}
      </div>
    </Modal>
  );
}
