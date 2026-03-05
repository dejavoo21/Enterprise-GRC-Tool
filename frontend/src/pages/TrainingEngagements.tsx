import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, Card, Badge, Button, Modal } from '../components';
import { DataTable } from '../components/DataTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { useFrameworks } from '../context/FrameworkContext';
import { apiCall } from '../lib/api';
import type {
  TrainingEngagement,
  CreateTrainingEngagementInput,
  PricingModel,
  EngagementType,
  EngagementStatus,
  TrainingEngagementSummary,
  AIProposalResponse,
  AIQAResponse,
} from '../types/trainingPractice';
import {
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_STATUS_LABELS,
  ENGAGEMENT_STATUS_COLORS,
  BILLING_BASIS_LABELS,
} from '../types/trainingPractice';

const API_BASE = '/api/v1';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

function StatusBadge({ status }: { status: EngagementStatus }) {
  const colors = ENGAGEMENT_STATUS_COLORS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: '4px',
      }}
    >
      {ENGAGEMENT_STATUS_LABELS[status]}
    </span>
  );
}

function FrameworkBadge({ code, color, name }: { code: string; color: string; name: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: `${color}20`,
        color: color,
        borderRadius: '3px',
        marginRight: '4px',
        marginBottom: '2px',
      }}
      title={name}
    >
      {code}
    </span>
  );
}

function EngagementModal({
  isOpen,
  onClose,
  onSubmit,
  pricingModels,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTrainingEngagementInput) => Promise<void>;
  pricingModels: PricingModel[];
}) {
  const { frameworks, getFrameworkColor } = useFrameworks();
  const [formData, setFormData] = useState<CreateTrainingEngagementInput>({
    title: '',
    clientName: '',
    engagementType: 'one_off',
    status: 'draft',
    pricingModelId: '',
    estimatedUsers: undefined,
    startDate: '',
    endDate: '',
    primaryContact: '',
    proposalUrl: '',
    sowUrl: '',
    frameworkCodes: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        pricingModelId: formData.pricingModelId || undefined,
        estimatedUsers: formData.estimatedUsers || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        frameworkCodes: formData.frameworkCodes?.length ? formData.frameworkCodes : undefined,
      });
      setFormData({
        title: '',
        clientName: '',
        engagementType: 'one_off',
        status: 'draft',
        pricingModelId: '',
        estimatedUsers: undefined,
        startDate: '',
        endDate: '',
        primaryContact: '',
        proposalUrl: '',
        sowUrl: '',
        frameworkCodes: [],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement');
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
      title="New Engagement"
      width="700px"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Engagement'}
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
            placeholder="Engagement title"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Client Name</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              placeholder="Client name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Primary Contact</label>
            <input
              type="text"
              value={formData.primaryContact}
              onChange={(e) => setFormData({ ...formData, primaryContact: e.target.value })}
              placeholder="Contact person"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Engagement Type</label>
            <select
              value={formData.engagementType}
              onChange={(e) => setFormData({ ...formData, engagementType: e.target.value as EngagementType })}
              style={inputStyle}
            >
              {Object.entries(ENGAGEMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as EngagementStatus })}
              style={inputStyle}
            >
              {Object.entries(ENGAGEMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Pricing Model</label>
            <select
              value={formData.pricingModelId}
              onChange={(e) => setFormData({ ...formData, pricingModelId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select pricing model...</option>
              {pricingModels.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name} ({BILLING_BASIS_LABELS[pm.billingBasis]} - {pm.currency} {pm.unitPrice})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Estimated Users</label>
            <input
              type="number"
              value={formData.estimatedUsers || ''}
              onChange={(e) => setFormData({ ...formData, estimatedUsers: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              placeholder="Number of users"
              min="1"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>Frameworks Covered</label>
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
            Click to toggle frameworks. Selected: {formData.frameworkCodes?.length || 0}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>Proposal URL</label>
            <input
              type="url"
              value={formData.proposalUrl}
              onChange={(e) => setFormData({ ...formData, proposalUrl: e.target.value })}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>SOW URL</label>
            <input
              type="url"
              value={formData.sowUrl}
              onChange={(e) => setFormData({ ...formData, sowUrl: e.target.value })}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function EngagementDetailPanel({
  engagement,
  pricingModels,
  onClose,
}: {
  engagement: TrainingEngagement;
  pricingModels: PricingModel[];
  onClose: () => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const { getFrameworkName, getFrameworkColor } = useFrameworks();
  const [activeTab, setActiveTab] = useState<'details' | 'ai'>('details');
  const [proposal, setProposal] = useState<string | null>(null);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AIQAResponse | null>(null);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricingModel = pricingModels.find((pm) => pm.id === engagement.pricingModelId);

  const generateProposal = async () => {
    setLoadingProposal(true);
    setError(null);
    try {
      const result = await apiCall<ApiResponse<AIProposalResponse>>(
        `${API_BASE}/ai/training-engagements/${engagement.id}/proposal`,
        {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }
      );
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (result.data) {
        setProposal(result.data.proposal);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
    } finally {
      setLoadingProposal(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoadingAnswer(true);
    setError(null);
    try {
      const result = await apiCall<ApiResponse<AIQAResponse>>(
        `${API_BASE}/ai/training-engagements/${engagement.id}/ask`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': currentWorkspace.id,
          },
          body: JSON.stringify({ question }),
        }
      );
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (result.data) {
        setAnswer(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
    } finally {
      setLoadingAnswer(false);
    }
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
    fontSize: theme.typography.sizes.sm,
    fontWeight: isActive ? theme.typography.weights.semibold : theme.typography.weights.medium,
    color: isActive ? theme.colors.primary : theme.colors.text.secondary,
    backgroundColor: isActive ? `${theme.colors.primary}10` : 'transparent',
    border: 'none',
    borderBottom: isActive ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing[1],
  };

  const valueStyle: React.CSSProperties = {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.main,
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '600px',
        height: '100vh',
        backgroundColor: theme.colors.background,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: theme.spacing[4],
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold }}>
            {engagement.title}
          </h2>
          {engagement.clientName && (
            <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm, marginTop: theme.spacing[1] }}>
              {engagement.clientName}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: theme.spacing[2],
            color: theme.colors.text.muted,
            fontSize: '20px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.border}` }}>
        <button style={tabStyle(activeTab === 'details')} onClick={() => setActiveTab('details')}>
          Details
        </button>
        <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
          AI Assistant
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: theme.spacing[4] }}>
        {activeTab === 'details' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
              <div>
                <div style={labelStyle}>Status</div>
                <StatusBadge status={engagement.status} />
              </div>
              <div>
                <div style={labelStyle}>Engagement Type</div>
                <div style={valueStyle}>{ENGAGEMENT_TYPE_LABELS[engagement.engagementType]}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
              <div>
                <div style={labelStyle}>Start Date</div>
                <div style={valueStyle}>
                  {engagement.startDate
                    ? new Date(engagement.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>End Date</div>
                <div style={valueStyle}>
                  {engagement.endDate
                    ? new Date(engagement.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: theme.spacing[4] }}>
              <div style={labelStyle}>Pricing Model</div>
              <div style={valueStyle}>
                {pricingModel ? (
                  <>
                    {pricingModel.name} ({BILLING_BASIS_LABELS[pricingModel.billingBasis]} - {pricingModel.currency} {pricingModel.unitPrice})
                  </>
                ) : (
                  '—'
                )}
              </div>
            </div>

            <div style={{ marginBottom: theme.spacing[4] }}>
              <div style={labelStyle}>Estimated Users</div>
              <div style={valueStyle}>{engagement.estimatedUsers?.toLocaleString() || '—'}</div>
            </div>

            <div style={{ marginBottom: theme.spacing[4] }}>
              <div style={labelStyle}>Primary Contact</div>
              <div style={valueStyle}>{engagement.primaryContact || '—'}</div>
            </div>

            <div style={{ marginBottom: theme.spacing[4] }}>
              <div style={labelStyle}>Frameworks Covered</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }}>
                {engagement.frameworkCodes && engagement.frameworkCodes.length > 0 ? (
                  engagement.frameworkCodes.map((code) => (
                    <FrameworkBadge key={code} code={code} color={getFrameworkColor(code)} name={getFrameworkName(code)} />
                  ))
                ) : (
                  <span style={{ color: theme.colors.text.muted }}>—</span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
              <div>
                <div style={labelStyle}>Proposal URL</div>
                {engagement.proposalUrl ? (
                  <a href={engagement.proposalUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary }}>
                    View Proposal
                  </a>
                ) : (
                  <span style={{ color: theme.colors.text.muted }}>—</span>
                )}
              </div>
              <div>
                <div style={labelStyle}>SOW URL</div>
                {engagement.sowUrl ? (
                  <a href={engagement.sowUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary }}>
                    View SOW
                  </a>
                ) : (
                  <span style={{ color: theme.colors.text.muted }}>—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div>
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

            {/* Proposal Generation */}
            <div style={{ marginBottom: theme.spacing[6] }}>
              <h3 style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, marginBottom: theme.spacing[2] }}>
                Generate Proposal
              </h3>
              <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
                Generate a draft training proposal based on the engagement details, pricing, and selected frameworks.
              </p>
              <Button variant="primary" onClick={generateProposal} disabled={loadingProposal}>
                {loadingProposal ? 'Generating...' : 'Generate Proposal'}
              </Button>
              {proposal && (
                <div
                  style={{
                    marginTop: theme.spacing[4],
                    padding: theme.spacing[4],
                    backgroundColor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    whiteSpace: 'pre-wrap',
                    fontSize: theme.typography.sizes.sm,
                    lineHeight: 1.6,
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  {proposal}
                </div>
              )}
            </div>

            {/* Q&A */}
            <div>
              <h3 style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, marginBottom: theme.spacing[2] }}>
                Ask a Question
              </h3>
              <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
                Ask questions about this engagement, pricing, timelines, or any other details.
              </p>
              <div style={{ display: 'flex', gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., What is the estimated cost for this engagement?"
                  onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                  style={{
                    flex: 1,
                    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                    fontSize: theme.typography.sizes.sm,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                  }}
                />
                <Button variant="primary" onClick={askQuestion} disabled={loadingAnswer || !question.trim()}>
                  {loadingAnswer ? 'Thinking...' : 'Ask'}
                </Button>
              </div>
              {answer && (
                <div
                  style={{
                    padding: theme.spacing[4],
                    backgroundColor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                  }}
                >
                  <div style={{ fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing[2] }}>{answer.answer}</div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
                    <Badge
                      variant={answer.confidence === 'high' ? 'success' : answer.confidence === 'medium' ? 'warning' : 'danger'}
                    >
                      {answer.confidence} confidence
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TrainingEngagements() {
  const { currentWorkspace } = useWorkspace();
  const { getFrameworkName, getFrameworkColor } = useFrameworks();
  const [engagements, setEngagements] = useState<TrainingEngagement[]>([]);
  const [pricingModels, setPricingModels] = useState<PricingModel[]>([]);
  const [summary, setSummary] = useState<TrainingEngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<TrainingEngagement | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [engagementsRes, pricingModelsRes, summaryRes] = await Promise.all([
        apiCall<ApiResponse<TrainingEngagement[]>>(`${API_BASE}/training-engagements`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }),
        apiCall<ApiResponse<PricingModel[]>>(`${API_BASE}/pricing-models`),
        apiCall<ApiResponse<TrainingEngagementSummary>>(`${API_BASE}/training-engagements/summary`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }),
      ]);

      if (engagementsRes.data) setEngagements(engagementsRes.data);
      if (pricingModelsRes.data) setPricingModels(pricingModelsRes.data);
      if (summaryRes.data) setSummary(summaryRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateEngagement = async (input: CreateTrainingEngagementInput) => {
    const result = await apiCall<ApiResponse<TrainingEngagement>>(`${API_BASE}/training-engagements`, {
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

    await fetchData();
  };

  const getPricingModelName = (id?: string) => {
    if (!id) return '—';
    const pm = pricingModels.find((p) => p.id === id);
    return pm ? pm.name : '—';
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (item: TrainingEngagement) => (
        <div>
          <button
            onClick={() => setSelectedEngagement(item)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.primary }}>{item.title}</span>
          </button>
          {item.clientName && (
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{item.clientName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'engagementType',
      header: 'Type',
      render: (item: TrainingEngagement) => <Badge variant="default">{ENGAGEMENT_TYPE_LABELS[item.engagementType]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: TrainingEngagement) => <StatusBadge status={item.status} />,
    },
    {
      key: 'frameworkCodes',
      header: 'Frameworks',
      render: (item: TrainingEngagement) => (
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {item.frameworkCodes && item.frameworkCodes.length > 0 ? (
            item.frameworkCodes.slice(0, 3).map((code) => (
              <FrameworkBadge key={code} code={code} color={getFrameworkColor(code)} name={getFrameworkName(code)} />
            ))
          ) : (
            <span style={{ color: theme.colors.text.muted }}>—</span>
          )}
          {item.frameworkCodes && item.frameworkCodes.length > 3 && (
            <span style={{ fontSize: '11px', color: theme.colors.text.muted }}>+{item.frameworkCodes.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'pricingModelId',
      header: 'Pricing',
      render: (item: TrainingEngagement) => getPricingModelName(item.pricingModelId),
    },
    {
      key: 'estimatedUsers',
      header: 'Est. Users',
      render: (item: TrainingEngagement) => (item.estimatedUsers ? item.estimatedUsers.toLocaleString() : '—'),
    },
    {
      key: 'startDate',
      header: 'Start',
      render: (item: TrainingEngagement) =>
        item.startDate
          ? new Date(item.startDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—',
    },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader title="Training Engagements" description="Manage training engagements, proposals, and SOWs." />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[12],
            color: theme.colors.text.secondary,
          }}
        >
          Loading engagements...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader title="Training Engagements" description="Manage training engagements, proposals, and SOWs." />
        <Card style={{ borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
          <div style={{ color: theme.colors.semantic.danger }}>{error}</div>
          <Button variant="outline" onClick={fetchData} style={{ marginTop: theme.spacing[4] }}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader title="Training Engagements" description="Manage training engagements, proposals, and SOWs." />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
        }}
      >
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Active Engagements</div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.semantic.success,
            }}
          >
            {summary?.active || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Proposals Out</div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: '#D97706',
            }}
          >
            {summary?.proposed || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Completed This Year</div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.primary,
            }}
          >
            {summary?.completedThisYear || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Drafts</div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.text.muted,
            }}
          >
            {summary?.draft || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Total Est. Users</div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.primary,
            }}
          >
            {summary?.totalEstimatedUsers?.toLocaleString() || 0}
          </div>
        </Card>
      </div>

      <DataTable
        data={engagements}
        columns={columns}
        searchPlaceholder="Search engagements..."
        primaryAction={{
          label: 'New Engagement',
          onClick: () => setIsModalOpen(true),
        }}
      />

      <EngagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateEngagement}
        pricingModels={pricingModels}
      />

      {selectedEngagement && (
        <EngagementDetailPanel
          engagement={selectedEngagement}
          pricingModels={pricingModels}
          onClose={() => setSelectedEngagement(null)}
        />
      )}
    </div>
  );
}
