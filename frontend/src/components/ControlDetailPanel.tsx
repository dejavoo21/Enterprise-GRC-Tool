import React, { useEffect, useState } from 'react';
import { theme } from '../theme';
import { Button } from './Button';
import { CloseIcon } from './icons';
import type { ControlWithFrameworks, ControlFrameworkMapping, ApiResponse } from '../types/control';
import type { EvidenceItem, ApiResponse as EvidenceApiResponse } from '../types/evidence';
import type { GovernanceDocument } from '../types/governance';
import type { TrainingCourse, ApiResponse as TrainingApiResponse } from '../types/training';
import type { ActivityLogEntry } from '../types/activity';
import { fetchActivityLog } from '../lib/api';
import {
  CONTROL_STATUS_LABELS,
  CONTROL_STATUS_COLORS,
  SOC_TYPE_LABELS,
} from '../types/control';
import { EVIDENCE_TYPE_LABELS, EVIDENCE_TYPE_COLORS } from '../types/evidence';
import type {
  ControlRelationType,
  ControlTrainingRelationType,
} from '../types/links';
import {
  CONTROL_RELATION_LABELS,
  CONTROL_TRAINING_RELATION_LABELS,
  CONTROL_RELATION_OPTIONS,
  CONTROL_TRAINING_RELATION_OPTIONS,
} from '../types/links';
import { DELIVERY_FORMAT_LABELS } from '../types/training';
import { useFrameworks } from '../context/FrameworkContext';
import { useWorkspace } from '../context/WorkspaceContext';

const API_BASE = '/api/v1';

interface ControlDetailPanelProps {
  control: ControlWithFrameworks | null;
  onClose: () => void;
}

// Extended types with relationType
type LinkedGovernanceDocument = GovernanceDocument & { relationType: ControlRelationType };
type LinkedTrainingCourse = TrainingCourse & { relationType: ControlTrainingRelationType };

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: theme.spacing[4] }}>
      <div
        style={{
          fontSize: theme.typography.sizes.xs,
          fontWeight: theme.typography.weights.medium,
          color: theme.colors.text.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: theme.spacing[1],
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
        {children}
      </div>
    </div>
  );
}

function FrameworkBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
        fontSize: theme.typography.sizes.xs,
        fontWeight: theme.typography.weights.medium,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${color}30`,
      }}
    >
      {name}
    </span>
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

function StatusBadge({ status }: { status: ControlWithFrameworks['status'] }) {
  const color = CONTROL_STATUS_COLORS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `2px 8px`,
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: '4px',
        border: `1px solid ${color}30`,
      }}
    >
      {CONTROL_STATUS_LABELS[status]}
    </span>
  );
}

// Mini-modal for linking documents or training
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

export function ControlDetailPanel({ control, onClose }: ControlDetailPanelProps) {
  const { getFrameworkName, getFrameworkColor } = useFrameworks();
  const { currentWorkspace } = useWorkspace();
  const [mappings, setMappings] = useState<ControlFrameworkMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  // Linked documents state
  const [linkedDocuments, setLinkedDocuments] = useState<LinkedGovernanceDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [allDocuments, setAllDocuments] = useState<GovernanceDocument[]>([]);
  const [showLinkDocModal, setShowLinkDocModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedDocRelation, setSelectedDocRelation] = useState<ControlRelationType>('supports');

  // Linked training state
  const [linkedCourses, setLinkedCourses] = useState<LinkedTrainingCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [allCourses, setAllCourses] = useState<TrainingCourse[]>([]);
  const [showLinkCourseModal, setShowLinkCourseModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourseRelation, setSelectedCourseRelation] = useState<ControlTrainingRelationType>('reinforces');

  // Recent activity state
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const headers: Record<string, string> = currentWorkspace ? { 'X-Workspace-Id': currentWorkspace.id } : {};

  useEffect(() => {
    if (!control) return;

    const fetchMappings = async () => {
      setLoadingMappings(true);
      try {
        const response = await fetch(`${API_BASE}/control-mappings?controlId=${control.id}`, { headers });
        const result: ApiResponse<ControlFrameworkMapping[]> = await response.json();
        if (result.data) {
          setMappings(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch mappings:', err);
      } finally {
        setLoadingMappings(false);
      }
    };

    const fetchEvidence = async () => {
      setLoadingEvidence(true);
      try {
        const response = await fetch(`${API_BASE}/evidence?controlId=${control.id}`, { headers });
        const result: EvidenceApiResponse<EvidenceItem[]> = await response.json();
        if (result.data) {
          setEvidence(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch evidence:', err);
      } finally {
        setLoadingEvidence(false);
      }
    };

    const fetchLinkedDocuments = async () => {
      setLoadingDocuments(true);
      try {
        const response = await fetch(`${API_BASE}/links/controls/${control.id}/documents`, { headers });
        const result = await response.json();
        if (result.data) {
          setLinkedDocuments(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch linked documents:', err);
      } finally {
        setLoadingDocuments(false);
      }
    };

    const fetchLinkedCourses = async () => {
      setLoadingCourses(true);
      try {
        const response = await fetch(`${API_BASE}/links/controls/${control.id}/courses`, { headers });
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
          entityType: 'control',
          entityId: control.id,
          limit: 5,
        });
        setRecentActivity(activities);
      } catch (err) {
        console.error('Failed to fetch activity:', err);
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchMappings();
    fetchEvidence();
    fetchLinkedDocuments();
    fetchLinkedCourses();
    fetchRecentActivity();
  }, [control, currentWorkspace]);

  // Fetch all documents for linking modal
  const fetchAllDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/governance-documents`, { headers });
      const result = await response.json();
      if (result.data) {
        setAllDocuments(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch all documents:', err);
    }
  };

  // Fetch all courses for linking modal
  const fetchAllCourses = async () => {
    try {
      const response = await fetch(`${API_BASE}/training/courses`, { headers });
      const result: TrainingApiResponse<TrainingCourse[]> = await response.json();
      if (result.data) {
        setAllCourses(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch all courses:', err);
    }
  };

  const handleLinkDocument = async () => {
    if (!control || !selectedDocId) return;
    try {
      await fetch(`${API_BASE}/links/controls/${control.id}/documents`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocId, relationType: selectedDocRelation }),
      });
      // Refresh linked documents
      const response = await fetch(`${API_BASE}/links/controls/${control.id}/documents`, { headers });
      const result = await response.json();
      if (result.data) {
        setLinkedDocuments(result.data);
      }
      setShowLinkDocModal(false);
      setSelectedDocId('');
      setSelectedDocRelation('supports');
    } catch (err) {
      console.error('Failed to link document:', err);
    }
  };

  const handleUnlinkDocument = async (documentId: string) => {
    if (!control) return;
    try {
      await fetch(`${API_BASE}/links/controls/${control.id}/documents/${documentId}`, {
        method: 'DELETE',
        headers,
      });
      setLinkedDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err) {
      console.error('Failed to unlink document:', err);
    }
  };

  const handleLinkCourse = async () => {
    if (!control || !selectedCourseId) return;
    try {
      await fetch(`${API_BASE}/links/controls/${control.id}/courses`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourseId, relationType: selectedCourseRelation }),
      });
      // Refresh linked courses
      const response = await fetch(`${API_BASE}/links/controls/${control.id}/courses`, { headers });
      const result = await response.json();
      if (result.data) {
        setLinkedCourses(result.data);
      }
      setShowLinkCourseModal(false);
      setSelectedCourseId('');
      setSelectedCourseRelation('reinforces');
    } catch (err) {
      console.error('Failed to link course:', err);
    }
  };

  const handleUnlinkCourse = async (courseId: string) => {
    if (!control) return;
    try {
      await fetch(`${API_BASE}/links/controls/${control.id}/courses/${courseId}`, {
        method: 'DELETE',
        headers,
      });
      setLinkedCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      console.error('Failed to unlink course:', err);
    }
  };

  if (!control) return null;

  // Group mappings by framework
  const mappingsByFramework = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.framework]) {
      acc[mapping.framework] = [];
    }
    acc[mapping.framework].push(mapping);
    return acc;
  }, {} as Record<string, ControlFrameworkMapping[]>);

  // Filter available documents/courses (exclude already linked)
  const linkedDocIds = new Set(linkedDocuments.map((d) => d.id));
  const availableDocuments = allDocuments.filter((d) => !linkedDocIds.has(d.id));

  const linkedCourseIds = new Set(linkedCourses.map((c) => c.id));
  const availableCourses = allCourses.filter((c) => !linkedCourseIds.has(c.id));

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
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.primary,
                backgroundColor: theme.colors.primaryLight,
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.sm,
              }}
            >
              {control.id}
            </span>
            <StatusBadge status={control.status} />
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
            {control.title}
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
        {/* Framework Mappings */}
        <div style={{ marginBottom: theme.spacing[6] }}>
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
            Framework Mappings ({mappings.length})
          </div>
          {loadingMappings ? (
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
              Loading mappings...
            </div>
          ) : mappings.length === 0 ? (
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
              No framework mappings yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
              {Object.entries(mappingsByFramework).map(([framework, fwMappings]) => (
                <div
                  key={framework}
                  style={{
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.md,
                    borderLeft: `3px solid ${getFrameworkColor(framework)}`,
                  }}
                >
                  <div style={{ marginBottom: theme.spacing[2] }}>
                    <FrameworkBadge name={getFrameworkName(framework)} color={getFrameworkColor(framework)} />
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: 'left',
                            fontSize: theme.typography.sizes.xs,
                            color: theme.colors.text.muted,
                            fontWeight: theme.typography.weights.medium,
                            paddingBottom: theme.spacing[1],
                          }}
                        >
                          Reference
                        </th>
                        {(framework === 'SOC1' || framework === 'SOC2') && (
                          <th
                            style={{
                              textAlign: 'left',
                              fontSize: theme.typography.sizes.xs,
                              color: theme.colors.text.muted,
                              fontWeight: theme.typography.weights.medium,
                              paddingBottom: theme.spacing[1],
                              width: '80px',
                            }}
                          >
                            Type
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {fwMappings.map((mapping) => (
                        <tr key={mapping.id}>
                          <td
                            style={{
                              fontSize: theme.typography.sizes.sm,
                              color: theme.colors.text.main,
                              fontWeight: theme.typography.weights.medium,
                              paddingTop: theme.spacing[1],
                              paddingBottom: theme.spacing[1],
                            }}
                          >
                            {mapping.reference}
                          </td>
                          {(framework === 'SOC1' || framework === 'SOC2') && (
                            <td
                              style={{
                                fontSize: theme.typography.sizes.sm,
                                color: theme.colors.text.secondary,
                                paddingTop: theme.spacing[1],
                                paddingBottom: theme.spacing[1],
                              }}
                            >
                              {mapping.type ? SOC_TYPE_LABELS[mapping.type] : '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Governance Documents */}
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
              Linked Governance Documents ({linkedDocuments.length})
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchAllDocuments();
                setShowLinkDocModal(true);
              }}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              + Link Document
            </Button>
          </div>
          {loadingDocuments ? (
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
              Loading documents...
            </div>
          ) : linkedDocuments.length === 0 ? (
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
              No governance documents linked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {linkedDocuments.map((doc) => (
                <div
                  key={doc.id}
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
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: `${theme.colors.primary}15`,
                            color: theme.colors.primary,
                            borderRadius: '3px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {doc.docType}
                        </span>
                        <RelationBadge label={CONTROL_RELATION_LABELS[doc.relationType]} color="#6366f1" />
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.sm,
                          fontWeight: theme.typography.weights.medium,
                          color: theme.colors.text.main,
                        }}
                      >
                        {doc.title}
                      </div>
                      <div
                        style={{
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.text.muted,
                          marginTop: theme.spacing[1],
                        }}
                      >
                        Owner: {doc.owner} • Status: {doc.status}
                        {doc.nextReviewDate && (
                          <> • Next review: {new Date(doc.nextReviewDate).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkDocument(doc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.text.muted,
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                      title="Unlink document"
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
                        <RelationBadge label={CONTROL_TRAINING_RELATION_LABELS[course.relationType]} color="#10b981" />
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
                        {course.frameworkCodes && course.frameworkCodes.length > 0 && (
                          <> • Frameworks: {course.frameworkCodes.join(', ')}</>
                        )}
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

        {/* Evidence Section */}
        <div style={{ marginBottom: theme.spacing[6] }}>
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
            Linked Evidence ({evidence.length})
          </div>
          {loadingEvidence ? (
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
              Loading evidence...
            </div>
          ) : evidence.length === 0 ? (
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
              No evidence linked to this control
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }}>
              {evidence.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: theme.spacing[3],
                    backgroundColor: theme.colors.surfaceHover,
                    borderRadius: theme.borderRadius.md,
                    borderLeft: `3px solid ${EVIDENCE_TYPE_COLORS[item.type]}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[1] }}>
                    <span
                      style={{
                        fontSize: theme.typography.sizes.xs,
                        fontWeight: theme.typography.weights.medium,
                        color: theme.colors.primary,
                      }}
                    >
                      {item.id}
                    </span>
                    <span
                      style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        fontWeight: 500,
                        backgroundColor: `${EVIDENCE_TYPE_COLORS[item.type]}15`,
                        color: EVIDENCE_TYPE_COLORS[item.type],
                        borderRadius: '3px',
                        border: `1px solid ${EVIDENCE_TYPE_COLORS[item.type]}30`,
                      }}
                    >
                      {EVIDENCE_TYPE_LABELS[item.type]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.medium,
                      color: theme.colors.text.main,
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontSize: theme.typography.sizes.xs,
                      color: theme.colors.text.muted,
                      marginTop: theme.spacing[1],
                    }}
                  >
                    Collected by {item.collectedBy} on{' '}
                    {new Date(item.collectedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DetailRow label="Domain">
          {control.domain || <span style={{ color: theme.colors.text.muted }}>—</span>}
        </DetailRow>

        {control.primaryFramework && (
          <DetailRow label="Primary Framework">
            <FrameworkBadge
              name={getFrameworkName(control.primaryFramework)}
              color={getFrameworkColor(control.primaryFramework)}
            />
          </DetailRow>
        )}

        <DetailRow label="Owner">{control.owner}</DetailRow>

        {control.description && (
          <DetailRow label="Description">
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
              }}
            >
              {control.description}
            </div>
          </DetailRow>
        )}

        <div
          style={{
            marginTop: theme.spacing[6],
            paddingTop: theme.spacing[4],
            borderTop: `1px solid ${theme.colors.borderLight}`,
          }}
        >
          <div style={{ display: 'flex', gap: theme.spacing[4] }}>
            <DetailRow label="Created">
              <span style={{ fontSize: theme.typography.sizes.xs }}>
                {new Date(control.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </DetailRow>
            <DetailRow label="Last Updated">
              <span style={{ fontSize: theme.typography.sizes.xs }}>
                {new Date(control.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </DetailRow>
          </div>
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

      {/* Link Document Modal */}
      <LinkModal
        title="Link Governance Document"
        isOpen={showLinkDocModal}
        onClose={() => setShowLinkDocModal(false)}
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
            Document
          </label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">Select a document...</option>
            {availableDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title} ({doc.docType})
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
            value={selectedDocRelation}
            onChange={(e) => setSelectedDocRelation(e.target.value as ControlRelationType)}
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
          <Button variant="secondary" onClick={() => setShowLinkDocModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLinkDocument} disabled={!selectedDocId}>
            Link Document
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
            onChange={(e) => setSelectedCourseRelation(e.target.value as ControlTrainingRelationType)}
            style={{
              width: '100%',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            {CONTROL_TRAINING_RELATION_OPTIONS.map((opt) => (
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
