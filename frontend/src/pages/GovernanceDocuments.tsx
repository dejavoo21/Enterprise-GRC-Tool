import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { DataTable } from '../components/DataTable';
import { Button } from '../components/Button';
import { CloseIcon } from '../components/icons';
import { useWorkspace } from '../context/WorkspaceContext';
import { useFrameworks } from '../context/FrameworkContext';
import { apiCall, fetchActivityLog } from '../lib/api';
import type { ActivityLogEntry } from '../types/activity';
import type {
  GovernanceDocument,
  CreateGovernanceDocumentInput,
  GovernanceDocumentType,
  GovernanceDocumentStatus,
} from '../types/governance';
import type { TrainingCourse } from '../types/training';
import type { ControlWithFrameworks } from '../types/control';
import type {
  ControlRelationType,
  DocumentTrainingRelationType,
} from '../types/links';
import {
  CONTROL_RELATION_LABELS,
  DOCUMENT_TRAINING_RELATION_LABELS,
  CONTROL_RELATION_OPTIONS,
  DOCUMENT_TRAINING_RELATION_OPTIONS,
} from '../types/links';
import { DELIVERY_FORMAT_LABELS } from '../types/training';
import { CONTROL_STATUS_LABELS, CONTROL_STATUS_COLORS } from '../types/control';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

const API_BASE = '/api/v1';

const DOC_TYPE_LABELS: Record<GovernanceDocumentType, string> = {
  policy: 'Policy',
  procedure: 'Procedure',
  standard: 'Standard',
  guideline: 'Guideline',
  manual: 'Manual',
  other: 'Other',
};

const DOC_STATUS_LABELS: Record<GovernanceDocumentStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  in_review: 'In Review',
  retired: 'Retired',
};

const DOC_STATUS_COLORS: Record<GovernanceDocumentStatus, { bg: string; text: string }> = {
  draft: { bg: '#FEF3C7', text: '#D97706' },
  approved: { bg: '#D1FAE5', text: '#059669' },
  in_review: { bg: '#DBEAFE', text: '#2563EB' },
  retired: { bg: '#F3F4F6', text: '#6B7280' },
};

// Extended types with relationType
type LinkedControl = ControlWithFrameworks & { relationType: ControlRelationType };
type LinkedTrainingCourse = TrainingCourse & { relationType: DocumentTrainingRelationType };

function DocumentModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateGovernanceDocumentInput) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CreateGovernanceDocumentInput>({
    title: '',
    docType: 'policy',
    owner: '',
    status: 'draft',
    currentVersion: '1.0',
    locationUrl: '',
    reviewFrequencyMonths: 12,
    nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'reviewFrequencyMonths' ? parseInt(value, 10) || undefined : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      setFormData({
        title: '',
        docType: 'policy',
        owner: '',
        status: 'draft',
        currentVersion: '1.0',
        locationUrl: '',
        reviewFrequencyMonths: 12,
        nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[6] }}>Create Governance Document</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Document Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Information Security Policy"
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Document Type *
              </label>
              <select
                name="docType"
                value={formData.docType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="policy">Policy</option>
                <option value="procedure">Procedure</option>
                <option value="standard">Standard</option>
                <option value="guideline">Guideline</option>
                <option value="manual">Manual</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="in_review">In Review</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Owner *
              </label>
              <input
                type="text"
                name="owner"
                value={formData.owner}
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
                Version
              </label>
              <input
                type="text"
                name="currentVersion"
                value={formData.currentVersion || ''}
                onChange={handleChange}
                placeholder="e.g., 1.0"
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

          <div>
            <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
              Document Location URL
            </label>
            <input
              type="url"
              name="locationUrl"
              value={formData.locationUrl || ''}
              onChange={handleChange}
              placeholder="https://sharepoint.company.com/docs/policy.pdf"
              style={{
                width: '100%',
                padding: theme.spacing[2],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Review Frequency (months)
              </label>
              <select
                name="reviewFrequencyMonths"
                value={formData.reviewFrequencyMonths || 12}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: theme.spacing[2],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              >
                <option value="3">Quarterly (3 months)</option>
                <option value="6">Semi-Annual (6 months)</option>
                <option value="12">Annual (12 months)</option>
                <option value="24">Biennial (24 months)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium }}>
                Next Review Date
              </label>
              <input
                type="date"
                name="nextReviewDate"
                value={formData.nextReviewDate || ''}
                onChange={handleChange}
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
              {isSubmitting ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Mini-modal for linking
function LinkModal({
  title,
  isOpen,
  onClose,
  children,
}: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[6],
          width: '400px',
          maxWidth: '90vw',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing[4],
          }}
        >
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.base, fontWeight: 600 }}>
            {title}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ padding: theme.spacing[1] }}>
            <CloseIcon size={16} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RelationBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: '3px',
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

// Document Detail Panel
function DocumentDetailPanel({
  document,
  onClose,
}: {
  document: GovernanceDocument | null;
  onClose: () => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const { getFrameworkName } = useFrameworks();

  // Linked controls state
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);
  const [allControls, setAllControls] = useState<ControlWithFrameworks[]>([]);
  const [showLinkControlModal, setShowLinkControlModal] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState('');
  const [selectedControlRelation, setSelectedControlRelation] = useState<ControlRelationType>('supports');

  // Linked training state
  const [linkedCourses, setLinkedCourses] = useState<LinkedTrainingCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [allCourses, setAllCourses] = useState<TrainingCourse[]>([]);
  const [showLinkCourseModal, setShowLinkCourseModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourseRelation, setSelectedCourseRelation] = useState<DocumentTrainingRelationType>('enforces');

  // Recent activity state
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const headers: Record<string, string> = currentWorkspace ? { 'X-Workspace-Id': currentWorkspace.id } : {};

  useEffect(() => {
    if (!document) return;

    const fetchLinkedControls = async () => {
      setLoadingControls(true);
      try {
        const response = await fetch(`${API_BASE}/links/documents/${document.id}/controls`, { headers });
        const result = await response.json();
        if (result.data) {
          setLinkedControls(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch linked controls:', err);
      } finally {
        setLoadingControls(false);
      }
    };

    const fetchLinkedCourses = async () => {
      setLoadingCourses(true);
      try {
        const response = await fetch(`${API_BASE}/links/documents/${document.id}/courses`, { headers });
        const result = await response.json();
        if (result.data) {
          setLinkedCourses(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch linked courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };

    const fetchRecentActivity = async () => {
      setLoadingActivity(true);
      try {
        const activities = await fetchActivityLog({
          entityType: 'governance_document',
          entityId: document.id,
          limit: 5,
        });
        setRecentActivity(activities);
      } catch (err) {
        console.error('Failed to fetch activity:', err);
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchLinkedControls();
    fetchLinkedCourses();
    fetchRecentActivity();
  }, [document, currentWorkspace]);

  const fetchAllControls = async () => {
    try {
      const response = await fetch(`${API_BASE}/controls`, { headers });
      const result = await response.json();
      if (result.data) {
        setAllControls(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch all controls:', err);
    }
  };

  const fetchAllCourses = async () => {
    try {
      const response = await fetch(`${API_BASE}/training/courses`, { headers });
      const result = await response.json();
      if (result.data) {
        setAllCourses(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch all courses:', err);
    }
  };

  const handleLinkControl = async () => {
    if (!document || !selectedControlId) return;
    try {
      // Link via control endpoint (control -> document)
      await fetch(`${API_BASE}/links/controls/${selectedControlId}/documents`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, relationType: selectedControlRelation }),
      });
      // Refresh linked controls
      const response = await fetch(`${API_BASE}/links/documents/${document.id}/controls`, { headers });
      const result = await response.json();
      if (result.data) {
        setLinkedControls(result.data);
      }
      setShowLinkControlModal(false);
      setSelectedControlId('');
      setSelectedControlRelation('supports');
    } catch (err) {
      console.error('Failed to link control:', err);
    }
  };

  const handleUnlinkControl = async (controlId: string) => {
    if (!document) return;
    try {
      await fetch(`${API_BASE}/links/controls/${controlId}/documents/${document.id}`, {
        method: 'DELETE',
        headers,
      });
      setLinkedControls((prev) => prev.filter((c) => c.id !== controlId));
    } catch (err) {
      console.error('Failed to unlink control:', err);
    }
  };

  const handleLinkCourse = async () => {
    if (!document || !selectedCourseId) return;
    try {
      await fetch(`${API_BASE}/links/documents/${document.id}/courses`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourseId, relationType: selectedCourseRelation }),
      });
      // Refresh linked courses
      const response = await fetch(`${API_BASE}/links/documents/${document.id}/courses`, { headers });
      const result = await response.json();
      if (result.data) {
        setLinkedCourses(result.data);
      }
      setShowLinkCourseModal(false);
      setSelectedCourseId('');
      setSelectedCourseRelation('enforces');
    } catch (err) {
      console.error('Failed to link course:', err);
    }
  };

  const handleUnlinkCourse = async (courseId: string) => {
    if (!document) return;
    try {
      await fetch(`${API_BASE}/links/documents/${document.id}/courses/${courseId}`, {
        method: 'DELETE',
        headers,
      });
      setLinkedCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      console.error('Failed to unlink course:', err);
    }
  };

  if (!document) return null;

  const linkedControlIds = new Set(linkedControls.map((c) => c.id));
  const availableControls = allControls.filter((c) => !linkedControlIds.has(c.id));

  const linkedCourseIds = new Set(linkedCourses.map((c) => c.id));
  const availableCourses = allCourses.filter((c) => !linkedCourseIds.has(c.id));

  const statusColors = DOC_STATUS_COLORS[document.status];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '520px',
        backgroundColor: theme.colors.surface,
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: theme.spacing[6],
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, marginRight: theme.spacing[4] }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              marginBottom: theme.spacing[2],
            }}
          >
            <span
              style={{
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: `${theme.colors.primary}15`,
                color: theme.colors.primary,
                borderRadius: '4px',
                textTransform: 'capitalize',
              }}
            >
              {DOC_TYPE_LABELS[document.docType]}
            </span>
            <span
              style={{
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor: statusColors.bg,
                color: statusColors.text,
                borderRadius: '4px',
              }}
            >
              {DOC_STATUS_LABELS[document.status]}
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: theme.typography.sizes.lg,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.text.main,
              lineHeight: 1.4,
            }}
          >
            {document.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} style={{ padding: theme.spacing[2] }}>
          <CloseIcon size={20} />
        </Button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: theme.spacing[6],
        }}
      >
        {/* Document Details */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Owner
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: 500 }}>{document.owner}</div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Version
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>{document.currentVersion || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Next Review
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.nextReviewDate
                  ? new Date(document.nextReviewDate).toLocaleDateString()
                  : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, marginBottom: theme.spacing[1] }}>
                Review Frequency
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm }}>
                {document.reviewFrequencyMonths
                  ? `${document.reviewFrequencyMonths} months`
                  : '-'}
              </div>
            </div>
          </div>
          {document.locationUrl && (
            <div style={{ marginTop: theme.spacing[4] }}>
              <a
                href={document.locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.colors.primary, fontSize: theme.typography.sizes.sm }}
              >
                View Document →
              </a>
            </div>
          )}
        </div>

        {/* Linked Controls */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing[3],
            }}
          >
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.medium,
                color: theme.colors.text.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Linked Controls ({linkedControls.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchAllControls();
                setShowLinkControlModal(true);
              }}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              + Link Control
            </Button>
          </div>
          {loadingControls ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Loading controls...
            </div>
          ) : linkedControls.length === 0 ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              No controls linked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {linkedControls.map((control) => (
                <div
                  key={control.id}
                  style={{
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.md,
                    borderLeft: `3px solid ${theme.colors.primary}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[1] }}>
                        <span
                          style={{
                            fontSize: theme.typography.sizes.xs,
                            fontWeight: 600,
                            color: theme.colors.primary,
                          }}
                        >
                          {control.id}
                        </span>
                        <span
                          style={{
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: `${CONTROL_STATUS_COLORS[control.status]}15`,
                            color: CONTROL_STATUS_COLORS[control.status],
                            borderRadius: '3px',
                          }}
                        >
                          {CONTROL_STATUS_LABELS[control.status]}
                        </span>
                        <RelationBadge label={CONTROL_RELATION_LABELS[control.relationType]} color="#6366f1" />
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.sm,
                          fontWeight: theme.typography.weights.medium,
                          color: theme.colors.text.main,
                        }}
                      >
                        {control.title}
                      </div>
                      {control.primaryFramework && (
                        <div
                          style={{
                            fontSize: theme.typography.sizes.xs,
                            color: theme.colors.text.muted,
                            marginTop: theme.spacing[1],
                          }}
                        >
                          Framework: {getFrameworkName(control.primaryFramework)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnlinkControl(control.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.text.muted,
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                      title="Unlink control"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Training Modules */}
        <div style={{ marginBottom: theme.spacing[6] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing[3],
            }}
          >
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.medium,
                color: theme.colors.text.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Linked Training Modules ({linkedCourses.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchAllCourses();
                setShowLinkCourseModal(true);
              }}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              + Link Training
            </Button>
          </div>
          {loadingCourses ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Loading courses...
            </div>
          ) : linkedCourses.length === 0 ? (
            <div
              style={{
                padding: theme.spacing[4],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              No training modules linked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {linkedCourses.map((course) => (
                <div
                  key={course.id}
                  style={{
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.md,
                    borderLeft: `3px solid #10b981`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[1] }}>
                        {course.mandatory && (
                          <span
                            style={{
                              padding: '1px 6px',
                              fontSize: '10px',
                              fontWeight: 500,
                              backgroundColor: '#ef444415',
                              color: '#ef4444',
                              borderRadius: '3px',
                            }}
                          >
                            Mandatory
                          </span>
                        )}
                        <span
                          style={{
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: '#10b98115',
                            color: '#10b981',
                            borderRadius: '3px',
                          }}
                        >
                          {DELIVERY_FORMAT_LABELS[course.deliveryFormat]}
                        </span>
                        <RelationBadge label={DOCUMENT_TRAINING_RELATION_LABELS[course.relationType]} color="#10b981" />
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.sm,
                          fontWeight: theme.typography.weights.medium,
                          color: theme.colors.text.main,
                        }}
                      >
                        {course.title}
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.text.muted,
                          marginTop: theme.spacing[1],
                        }}
                      >
                        {course.durationMinutes && <>{course.durationMinutes} min</>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkCourse(course.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.text.muted,
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                      title="Unlink training"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div
          style={{
            marginTop: theme.spacing[6],
            paddingTop: theme.spacing[4],
            borderTop: `1px solid ${theme.colors.borderLight}`,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
              color: theme.colors.text.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: theme.spacing[3],
            }}
          >
            Recent Activity
          </div>
          {loadingActivity ? (
            <div
              style={{
                padding: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              Loading activity...
            </div>
          ) : recentActivity.length === 0 ? (
            <div
              style={{
                padding: theme.spacing[3],
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.sm,
                textAlign: 'center',
              }}
            >
              No recent activity
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    padding: theme.spacing[2],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: theme.typography.sizes.xs,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: theme.colors.text.main, fontWeight: 500 }}>
                        {activity.userEmail}
                      </span>
                      <span style={{ color: theme.colors.text.secondary }}> {activity.action}d</span>
                    </div>
                    <span style={{ color: theme.colors.text.muted, fontSize: '10px' }}>
                      {new Date(activity.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={{ color: theme.colors.text.secondary, marginTop: theme.spacing[1] }}>
                    {activity.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Link Control Modal */}
      <LinkModal
        title="Link Control"
        isOpen={showLinkControlModal}
        onClose={() => setShowLinkControlModal(false)}
      >
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Control
          </label>
          <select
            value={selectedControlId}
            onChange={(e) => setSelectedControlId(e.target.value)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">Select a control...</option>
            {availableControls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.id} - {control.title}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Relation Type
          </label>
          <select
            value={selectedControlRelation}
            onChange={(e) => setSelectedControlRelation(e.target.value as ControlRelationType)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {CONTROL_RELATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}>
          <Button variant="secondary" onClick={() => setShowLinkControlModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLinkControl} disabled={!selectedControlId}>
            Link Control
          </Button>
        </div>
      </LinkModal>

      {/* Link Training Modal */}
      <LinkModal
        title="Link Training Module"
        isOpen={showLinkCourseModal}
        onClose={() => setShowLinkCourseModal(false)}
      >
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Training Course
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">Select a course...</option>
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} {course.mandatory ? '(Mandatory)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: theme.spacing[4] }}>
          <label
            style={{
              display: 'block',
              fontSize: theme.typography.sizes.sm,
              fontWeight: 500,
              marginBottom: theme.spacing[2],
            }}
          >
            Relation Type
          </label>
          <select
            value={selectedCourseRelation}
            onChange={(e) => setSelectedCourseRelation(e.target.value as DocumentTrainingRelationType)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {DOCUMENT_TRAINING_RELATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[2] }}>
          <Button variant="secondary" onClick={() => setShowLinkCourseModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLinkCourse} disabled={!selectedCourseId}>
            Link Training
          </Button>
        </div>
      </LinkModal>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

export function GovernanceDocuments() {
  const { currentWorkspace } = useWorkspace();
  const [documents, setDocuments] = useState<GovernanceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<GovernanceDocumentType | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<GovernanceDocumentStatus | ''>('');
  const [selectedDocument, setSelectedDocument] = useState<GovernanceDocument | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedType) params.append('docType', selectedType);
      if (selectedStatus) params.append('status', selectedStatus);

      const url = `${API_BASE}/governance-documents${params.toString() ? `?${params.toString()}` : ''}`;
      const result: ApiResponse<GovernanceDocument[]> = await apiCall(url, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      if (result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : result.error.message;
        throw new Error(errorMsg);
      }

      setDocuments(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id, selectedType, selectedStatus]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreateDocument = async (input: CreateGovernanceDocumentInput) => {
    const result: ApiResponse<GovernanceDocument> = await apiCall(`${API_BASE}/governance-documents`, {
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

    await fetchDocuments();
  };

  const summaryStats = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    inReview: documents.filter(d => d.status === 'in_review').length,
    dueForReview: documents.filter(d => {
      if (!d.nextReviewDate) return false;
      return new Date(d.nextReviewDate) <= new Date();
    }).length,
  };

  const columns = [
    { key: 'id', header: 'ID', width: '100px' },
    {
      key: 'title',
      header: 'Document Title',
      render: (item: GovernanceDocument) => (
        <div>
          <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.primary }}>
            {item.title}
          </span>
          {item.locationUrl && (
            <a
              href={item.locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: theme.spacing[2],
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.xs,
              }}
              onClick={e => e.stopPropagation()}
            >
              [Link]
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'docType',
      header: 'Type',
      render: (item: GovernanceDocument) => DOC_TYPE_LABELS[item.docType],
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'currentVersion',
      header: 'Version',
      render: (item: GovernanceDocument) => item.currentVersion || '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: GovernanceDocument) => {
        const colors = DOC_STATUS_COLORS[item.status];
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
            {DOC_STATUS_LABELS[item.status]}
          </span>
        );
      },
    },
    {
      key: 'nextReviewDate',
      header: 'Next Review',
      render: (item: GovernanceDocument) => {
        if (!item.nextReviewDate) return '-';
        const reviewDate = new Date(item.nextReviewDate);
        const today = new Date();
        const isOverdue = reviewDate < today;
        return (
          <span
            style={{
              color: isOverdue ? theme.colors.semantic.danger : theme.colors.text.main,
              fontWeight: isOverdue ? theme.typography.weights.medium : 'normal',
            }}
          >
            {reviewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {isOverdue ? ' (Overdue)' : ''}
          </span>
        );
      },
    },
    {
      key: 'lastReviewedAt',
      header: 'Last Reviewed',
      render: (item: GovernanceDocument) => {
        if (!item.lastReviewedAt) return 'Never';
        return new Date(item.lastReviewedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      },
    },
  ];

  const filterSection = (
    <div style={{ display: 'flex', gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
      <select
        value={selectedType}
        onChange={e => setSelectedType(e.target.value as GovernanceDocumentType | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Types</option>
        <option value="policy">Policy</option>
        <option value="procedure">Procedure</option>
        <option value="standard">Standard</option>
        <option value="guideline">Guideline</option>
        <option value="manual">Manual</option>
        <option value="other">Other</option>
      </select>

      <select
        value={selectedStatus}
        onChange={e => setSelectedStatus(e.target.value as GovernanceDocumentStatus | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="approved">Approved</option>
        <option value="in_review">In Review</option>
        <option value="retired">Retired</option>
      </select>
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Governance Documents"
          description="Manage policies, procedures, standards, and other governance documents."
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
          Loading documents...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Governance Documents"
          description="Manage policies, procedures, standards, and other governance documents."
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
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading documents</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchDocuments}
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
        title="Governance Documents"
        description="Manage policies, procedures, standards, and other governance documents."
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[8],
        }}
      >
        {[
          { label: 'Total Documents', value: summaryStats.total, color: theme.colors.primary },
          { label: 'Approved', value: summaryStats.approved, color: '#059669' },
          { label: 'In Review', value: summaryStats.inReview, color: '#2563EB' },
          { label: 'Due for Review', value: summaryStats.dueForReview, color: '#DC2626' },
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
        data={documents}
        columns={columns}
        searchPlaceholder="Search documents..."
        primaryAction={{
          label: 'New Document',
          onClick: () => setIsModalOpen(true),
        }}
        onRowClick={(doc) => setSelectedDocument(doc)}
      />

      <DocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateDocument} />
      <DocumentDetailPanel document={selectedDocument} onClose={() => setSelectedDocument(null)} />
    </div>
  );
}
