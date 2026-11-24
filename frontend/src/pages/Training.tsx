import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { Card, PageHeader, Badge, Button, Modal, CheckCircleIcon, AlertCircleIcon, TargetIcon, ClockIcon } from '../components';
import { TrainingCourseModal } from '../components/TrainingCourseModal';
import { TrainingAssignmentModal } from '../components/TrainingAssignmentModal';
import { AwarenessCampaignModal } from '../components/AwarenessCampaignModal';
import type { TrainingDashboard, TrainingCourse, AwarenessCampaign } from '../types/training';
import { DELIVERY_FORMAT_LABELS, formatTrainingStatus } from '../types/training';
import { useWorkspace } from '../context/WorkspaceContext';
import { useFrameworks } from '../context/FrameworkContext';
import './Training.css';

const API_BASE = '/api/v1';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

function getChannelDisplay(channel: string): string {
  const channels: Record<string, string> = {
    email: 'Email',
    poster: 'Poster',
    event: 'Event',
    phishing_sim: 'Phishing Sim',
    video: 'Video',
    portal: 'Portal',
  };
  return channels[channel] || channel;
}

function campaignStatusVariant(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'active':
    case 'in_progress':
      return 'info';
    case 'cancelled':
      return 'default';
    default:
      return 'warning';
  }
}

function MetricCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="training-metric-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing[4] }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: theme.borderRadius.lg,
          backgroundColor: color + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
        }}>
          {icon}
        </div>
        <div>
          <p style={{
            margin: 0,
            fontSize: theme.typography.sizes.sm,
            color: theme.colors.text.muted,
            marginBottom: theme.spacing[1],
          }}>
            {title}
          </p>
          <p style={{
            margin: 0,
            fontSize: theme.typography.sizes['2xl'],
            fontWeight: theme.typography.weights.bold,
            color: theme.colors.text.main,
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{
              margin: 0,
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing[1],
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
        fontSize: theme.typography.sizes.sm,
        fontWeight: active ? theme.typography.weights.semibold : theme.typography.weights.medium,
        color: active ? theme.colors.primary : theme.colors.text.secondary,
        backgroundColor: active ? theme.colors.primaryLight : 'transparent',
        border: 'none',
        borderRadius: theme.borderRadius.lg,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

function TrainingTab({
  courses,
  getFrameworkName,
  onAddCourse,
  onAssignTraining,
  onEditCourse,
  onArchiveCourse,
}: {
  courses: TrainingCourse[];
  getFrameworkName: (code: string) => string;
  onAddCourse: () => void;
  onAssignTraining: () => void;
  onEditCourse: (course: TrainingCourse) => void;
  onArchiveCourse: (course: TrainingCourse) => void;
}) {
  return (
    <Card>
      <div className="training-section-heading">
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}>
          Training Courses
        </h3>
        <div className="training-section-actions">
          <Button variant="outline" onClick={onAssignTraining} disabled={courses.length === 0}>Assign Training</Button>
          <Button variant="primary" onClick={onAddCourse}>Add Training Module</Button>
        </div>
      </div>

      <div className="training-table-wrap">
        <table className="training-table">
          <thead>
            <tr>
              {['Course', 'Type', 'Mandatory', 'Frameworks', 'Duration', 'Completion Rate', 'Overdue', 'Actions'].map((header) => (
                <th key={header} style={{
                  textAlign: 'left',
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `2px solid ${theme.colors.border}`,
                  color: theme.colors.text.secondary,
                  fontWeight: theme.typography.weights.semibold,
                  whiteSpace: 'nowrap',
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                    <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>
                      {course.title}
                    </span>
                    {course.isCustom && (
                      <Badge variant="info" size="sm">Custom</Badge>
                    )}
                  </div>
                  {course.description && (
                    <div style={{
                      fontSize: theme.typography.sizes.xs,
                      color: theme.colors.text.muted,
                      marginTop: theme.spacing[1],
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {course.description}
                    </div>
                  )}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <Badge variant="default" size="sm">
                    {DELIVERY_FORMAT_LABELS[course.deliveryFormat] || course.deliveryFormat}
                  </Badge>
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  {course.mandatory ? (
                    <Badge variant="danger">Required</Badge>
                  ) : (
                    <Badge variant="default">Optional</Badge>
                  )}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }}>
                    {course.frameworkCodes.slice(0, 3).map((code) => (
                      <Badge key={code} variant="primary" size="sm">{getFrameworkName(code)}</Badge>
                    ))}
                    {course.frameworkCodes.length > 3 && (
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                        +{course.frameworkCodes.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                  color: theme.colors.text.secondary,
                }}>
                  {course.durationMinutes ? `${course.durationMinutes} min` : '-'}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                    <div style={{
                      width: '80px',
                      height: '6px',
                      backgroundColor: theme.colors.borderLight,
                      borderRadius: theme.borderRadius.full,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${course.completionRate || 0}%`,
                        backgroundColor: (course.completionRate || 0) >= 80 ? theme.colors.semantic.success :
                                        (course.completionRate || 0) >= 50 ? theme.colors.semantic.warning :
                                        theme.colors.semantic.danger,
                        borderRadius: theme.borderRadius.full,
                      }} />
                    </div>
                    <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                      {course.completionRate || 0}%
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  {(course.overdueAssignments || 0) > 0 ? (
                    <Badge variant="danger">{course.overdueAssignments}</Badge>
                  ) : (
                    <span style={{ color: theme.colors.text.muted }}>-</span>
                  )}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  {course.isCustom && (
                    <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                      <button
                        onClick={() => onEditCourse(course)}
                        style={{
                          padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.primary,
                          backgroundColor: 'transparent',
                          border: `1px solid ${theme.colors.primary}`,
                          borderRadius: theme.borderRadius.md,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onArchiveCourse(course)}
                        style={{
                          padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.semantic.danger,
                          backgroundColor: 'transparent',
                          border: `1px solid ${theme.colors.semantic.danger}`,
                          borderRadius: theme.borderRadius.md,
                          cursor: 'pointer',
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AwarenessTab({ campaigns, onCreate, onTransition }: { campaigns: AwarenessCampaign[]; onCreate: () => void; onTransition: (campaign: AwarenessCampaign, status: 'active' | 'completed' | 'cancelled') => Promise<void> }) {
  return (
    <Card>
      <div className="training-section-heading">
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}>
          Awareness Campaigns
        </h3>
        <Button variant="primary" onClick={onCreate}>New Campaign</Button>
      </div>

      <div className="training-table-wrap">
        <table className="training-table">
          <thead>
            <tr>
              {['Campaign', 'Topic', 'Channel', 'Status', 'Participants', 'Results'].map((header) => (
                <th key={header} style={{
                  textAlign: 'left',
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `2px solid ${theme.colors.border}`,
                  color: theme.colors.text.secondary,
                  fontWeight: theme.typography.weights.semibold,
                  whiteSpace: 'nowrap',
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.text.main,
                }}>
                  {campaign.title}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                  color: theme.colors.text.secondary,
                }}>
                  {campaign.topic}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <Badge variant="default">{getChannelDisplay(campaign.channel)}</Badge>
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <Badge
                    variant={campaignStatusVariant(campaign.status)}
                  >
                    {formatTrainingStatus(campaign.status)}
                  </Badge>
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                  color: theme.colors.text.secondary,
                }}>
                  {campaign.participants}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  {campaign.completionRate !== undefined ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[1] }}>
                      <span style={{ fontSize: theme.typography.sizes.sm }}>
                        {campaign.completionRate}% completion
                      </span>
                      {campaign.clickRate !== undefined && (
                        <span style={{
                          fontSize: theme.typography.sizes.xs,
                          color: campaign.clickRate <= 10 ? theme.colors.semantic.success : theme.colors.semantic.danger,
                        }}>
                          {campaign.clickRate}% click rate
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: theme.colors.text.muted }}>Pending</span>
                  )}
                  <div style={{ display: 'flex', gap: theme.spacing[2], marginTop: theme.spacing[2], flexWrap: 'wrap' }}>
                    {campaign.status === 'planned' ? <Button size="sm" variant="secondary" onClick={() => void onTransition(campaign, 'active')}>Activate</Button> : null}
                    {campaign.status === 'active' ? <Button size="sm" variant="primary" onClick={() => void onTransition(campaign, 'completed')}>Complete</Button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Training() {
  const { currentWorkspace } = useWorkspace();
  const { getFrameworkName } = useFrameworks();
  const [activeTab, setActiveTab] = useState<'training' | 'awareness'>('training');
  const [metrics, setMetrics] = useState<TrainingDashboard>({
    overallCompletionRate: 0,
    overdueAssignments: 0,
    activeCampaigns: 0,
    totalCourses: 0,
    totalAssignments: 0,
  });
  const [courseList, setCourseList] = useState<TrainingCourse[]>([]);
  const [campaignList, setCampaignList] = useState<AwarenessCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCourseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [isCampaignModalOpen, setCampaignModalOpen] = useState(false);
  const [archiveCourse, setArchiveCourse] = useState<TrainingCourse | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = { 'X-Workspace-Id': currentWorkspace.id };

      // Fetch dashboard metrics
      const dashboardRes = await fetch(`${API_BASE}/training/dashboard`, { headers });
      const dashboardData: ApiResponse<TrainingDashboard> = await dashboardRes.json();
      if (dashboardData.data) {
        setMetrics(dashboardData.data);
      }

      // Fetch courses
      const coursesRes = await fetch(`${API_BASE}/training/courses`, { headers });
      const coursesData: ApiResponse<TrainingCourse[]> = await coursesRes.json();
      if (coursesData.data) {
        setCourseList(coursesData.data);
      }

      // Fetch campaigns
      const campaignsRes = await fetch(`${API_BASE}/training/campaigns`, { headers });
      const campaignsData: ApiResponse<AwarenessCampaign[]> = await campaignsRes.json();
      if (campaignsData.data) {
        setCampaignList(campaignsData.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch training data');
      console.error('Error fetching training data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCourse = () => {
    setEditingCourse(null);
    setCourseModalOpen(true);
  };

  const handleEditCourse = (course: TrainingCourse) => {
    setEditingCourse(course);
    setCourseModalOpen(true);
  };

  const handleArchiveCourse = (course: TrainingCourse) => {
    setArchiveError('');
    setArchiveCourse(course);
  };

  const confirmArchiveCourse = async () => {
    if (!archiveCourse) return;
    try {
      setArchiveBusy(true);
      setArchiveError('');
      const response = await fetch(`${API_BASE}/training/courses/${archiveCourse.id}`, {
        method: 'DELETE',
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      const result: ApiResponse<{ archived: boolean }> = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to archive course');
      }

      await fetchData();
      setArchiveCourse(null);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive course');
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleCourseSaved = () => {
    fetchData();
  };

  const transitionCampaign = async (campaign: AwarenessCampaign, status: 'active' | 'completed' | 'cancelled') => {
    try {
      const response = await fetch(`${API_BASE}/training/campaigns/${campaign.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': currentWorkspace.id },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as ApiResponse<AwarenessCampaign>;
      if (!response.ok || result.error) throw new Error(result.error?.message || 'Unable to update awareness campaign.');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update awareness campaign.');
    }
  };

  return (
    <div className="training-page">
      <PageHeader
        title="Training & Awareness"
        description="Track completion of security training and awareness campaigns. Monitor compliance and identify gaps in employee education."
      />

      {error && (
        <Card style={{ backgroundColor: theme.colors.semantic.danger + '15', marginBottom: theme.spacing[4], border: `1px solid ${theme.colors.semantic.danger}` }}>
          <div style={{ color: theme.colors.semantic.danger }}>
            <strong>Error:</strong> {error}
          </div>
        </Card>
      )}

      {loading ? (
        <Card style={{ textAlign: 'center', padding: theme.spacing[8] }}>
          <p style={{ color: theme.colors.text.muted }}>Loading training data...</p>
        </Card>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="training-metrics">
            <MetricCard
              title="Overall Completion"
              value={`${metrics.overallCompletionRate}%`}
              subtitle="Training completion rate"
              icon={<CheckCircleIcon size={24} />}
              color={theme.colors.semantic.success}
            />
            <MetricCard
              title="Overdue Assignments"
              value={metrics.overdueAssignments}
              subtitle="Need immediate attention"
              icon={<AlertCircleIcon size={24} />}
              color={theme.colors.semantic.danger}
            />
            <MetricCard
              title="Active Campaigns"
              value={metrics.activeCampaigns}
              subtitle="Currently running"
              icon={<TargetIcon size={24} />}
              color={theme.colors.primary}
            />
            <MetricCard
              title="Last Campaign Result"
              value={metrics.lastCampaignSummary?.clickRate ? `${metrics.lastCampaignSummary.clickRate}%` : '-'}
              subtitle={metrics.lastCampaignSummary?.title ? `${metrics.lastCampaignSummary.title} click rate` : 'No campaigns'}
              icon={<ClockIcon size={24} />}
              color={theme.colors.semantic.warning}
            />
          </div>

          {/* Tabs */}
          <div className="training-tabs" role="tablist" aria-label="Training workspace views">
            <TabButton active={activeTab === 'training'} onClick={() => setActiveTab('training')}>
              Training
            </TabButton>
            <TabButton active={activeTab === 'awareness'} onClick={() => setActiveTab('awareness')}>
              Awareness
            </TabButton>
          </div>

          {/* Tab Content */}
          {activeTab === 'training' ? (
            <TrainingTab
              courses={courseList}
              getFrameworkName={getFrameworkName}
              onAddCourse={handleAddCourse}
              onAssignTraining={() => setAssignmentModalOpen(true)}
              onEditCourse={handleEditCourse}
              onArchiveCourse={handleArchiveCourse}
            />
          ) : (
            <AwarenessTab campaigns={campaignList} onCreate={() => setCampaignModalOpen(true)} onTransition={transitionCampaign} />
          )}
        </>
      )}

      <TrainingCourseModal
        isOpen={isCourseModalOpen}
        course={editingCourse || undefined}
        onClose={() => setCourseModalOpen(false)}
        onSaved={handleCourseSaved}
      />
      <TrainingAssignmentModal
        isOpen={isAssignmentModalOpen}
        courses={courseList}
        onClose={() => setAssignmentModalOpen(false)}
        onAssigned={fetchData}
      />
      <AwarenessCampaignModal isOpen={isCampaignModalOpen} onClose={() => setCampaignModalOpen(false)} onSaved={fetchData} />
      <Modal
        accessibleDialog
        isOpen={Boolean(archiveCourse)}
        onClose={() => {
          if (archiveBusy) return;
          setArchiveCourse(null);
          setArchiveError('');
        }}
        title="Archive training course"
        width="560px"
        footer={<><Button variant="secondary" disabled={archiveBusy} onClick={() => { setArchiveCourse(null); setArchiveError(''); }}>Cancel</Button><Button variant="danger" disabled={archiveBusy} onClick={() => void confirmArchiveCourse()}>{archiveBusy ? 'Archiving...' : 'Archive course'}</Button></>}
      >
        <div className="training-archive-confirmation">
          <p>Archive <strong>{archiveCourse?.title}</strong>?</p>
          <p>The course will no longer be available for new assignments. Existing assignment and audit history is preserved.</p>
          {archiveError ? <div className="training-inline-error" role="alert">{archiveError}</div> : null}
        </div>
      </Modal>
    </div>
  );
}
