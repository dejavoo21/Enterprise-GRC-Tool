import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { Modal, Button } from './index';
import { useWorkspace } from '../context/WorkspaceContext';
import { useFrameworks } from '../context/FrameworkContext';
import type {
  TrainingCourse,
  CreateTrainingCourseInput,
  TrainingDeliveryFormat,
} from '../types/training';
import { DELIVERY_FORMAT_OPTIONS } from '../types/training';

const API_BASE = '/api/v1';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

interface TrainingCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  course?: TrainingCourse;  // If provided, we're editing
}

export function TrainingCourseModal({
  isOpen,
  onClose,
  onSaved,
  course,
}: TrainingCourseModalProps) {
  const { currentWorkspace } = useWorkspace();
  const { frameworks, getFrameworkColor } = useFrameworks();

  const [formData, setFormData] = useState<CreateTrainingCourseInput>({
    title: '',
    description: '',
    durationMinutes: undefined,
    mandatory: false,
    deliveryFormat: 'document',
    contentUrl: '',
    frameworkCodes: [],
    category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or course changes
  useEffect(() => {
    if (isOpen) {
      if (course) {
        setFormData({
          title: course.title,
          description: course.description || '',
          durationMinutes: course.durationMinutes,
          mandatory: course.mandatory,
          deliveryFormat: course.deliveryFormat,
          contentUrl: course.contentUrl || '',
          frameworkCodes: course.frameworkCodes || [],
          category: course.category || '',
        });
      } else {
        setFormData({
          title: '',
          description: '',
          durationMinutes: undefined,
          mandatory: false,
          deliveryFormat: 'document',
          contentUrl: '',
          frameworkCodes: [],
          category: '',
        });
      }
      setError(null);
    }
  }, [isOpen, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        contentUrl: formData.contentUrl?.trim() || undefined,
        category: formData.category?.trim() || undefined,
        durationMinutes: formData.durationMinutes || undefined,
        frameworkCodes: formData.frameworkCodes?.length ? formData.frameworkCodes : undefined,
      };

      const url = course
        ? `${API_BASE}/training/courses/${course.id}`
        : `${API_BASE}/training/courses`;

      const method = course ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': currentWorkspace.id,
        },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse<TrainingCourse> = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFramework = (code: string) => {
    const current = formData.frameworkCodes || [];
    if (current.includes(code)) {
      setFormData({ ...formData, frameworkCodes: current.filter((c) => c !== code) });
    } else {
      setFormData({ ...formData, frameworkCodes: [...current, code] });
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    fontSize: theme.typography.sizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: theme.spacing[1],
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={course ? 'Edit Training Module' : 'Add Training Module'}
      width="640px"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : course ? 'Save Changes' : 'Create Module'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              padding: theme.spacing[3],
              marginBottom: theme.spacing[4],
              backgroundColor: '#FEE2E2',
              border: '1px solid #FECACA',
              borderRadius: theme.borderRadius.md,
              color: theme.colors.semantic.danger,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>
            Title <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Security Awareness Training"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the training module..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Delivery Format</label>
            <select
              value={formData.deliveryFormat}
              onChange={(e) => setFormData({ ...formData, deliveryFormat: e.target.value as TrainingDeliveryFormat })}
              style={inputStyle}
            >
              {DELIVERY_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duration (minutes)</label>
            <input
              type="number"
              value={formData.durationMinutes || ''}
              onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              placeholder="e.g., 45"
              min="1"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Category</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Security Awareness"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Content URL</label>
            <input
              type="url"
              value={formData.contentUrl}
              onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
            <input
              type="checkbox"
              checked={formData.mandatory}
              onChange={(e) => setFormData({ ...formData, mandatory: e.target.checked })}
              style={{ width: '16px', height: '16px' }}
            />
            <span>Mandatory Training</span>
          </label>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: theme.spacing[1], marginLeft: theme.spacing[6] }}>
            If checked, this training will be required for compliance
          </div>
        </div>

        <div>
          <label style={labelStyle}>Frameworks</label>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: theme.spacing[2],
              padding: theme.spacing[3],
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.colors.surface,
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          >
            {frameworks.map((fw) => {
              const isSelected = formData.frameworkCodes?.includes(fw.code);
              return (
                <button
                  key={fw.code}
                  type="button"
                  onClick={() => toggleFramework(fw.code)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: `1px solid ${isSelected ? getFrameworkColor(fw.code) : theme.colors.border}`,
                    borderRadius: '4px',
                    backgroundColor: isSelected ? `${getFrameworkColor(fw.code)}15` : 'transparent',
                    color: isSelected ? getFrameworkColor(fw.code) : theme.colors.text.secondary,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {fw.code}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginTop: theme.spacing[1] }}>
            Select frameworks this training supports. Selected: {formData.frameworkCodes?.length || 0}
          </div>
        </div>
      </form>
    </Modal>
  );
}
