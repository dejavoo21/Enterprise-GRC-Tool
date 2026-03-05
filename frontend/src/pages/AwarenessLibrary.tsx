import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, Card, Button, Modal } from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { useFrameworks } from '../context/FrameworkContext';
import { apiCall } from '../lib/api';
import type {
  AwarenessContent,
  CreateAwarenessContentInput,
  AwarenessContentType,
  AwarenessContentSource,
} from '../types/trainingPractice';
import {
  CONTENT_TYPE_LABELS,
  SOURCE_LABELS,
} from '../types/trainingPractice';

const API_BASE = '/api/v1';

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

// Content type colors
const CONTENT_TYPE_COLORS: Record<AwarenessContentType, string> = {
  proposal_template: '#4F46E5',
  sow_template: '#7C3AED',
  breach_report: '#DC2626',
  regulatory_case: '#EA580C',
  incident_summary: '#D97706',
  risk_assessment: '#CA8A04',
  audit_finding_template: '#16A34A',
  statistic: '#0891B2',
  board_expectation: '#2563EB',
  training_deck: '#9333EA',
  outline: '#6B7280',
};

function TypeBadge({ type }: { type: AwarenessContentType }) {
  const color = CONTENT_TYPE_COLORS[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: '4px',
        border: `1px solid ${color}30`,
      }}
    >
      {CONTENT_TYPE_LABELS[type]}
    </span>
  );
}

function FrameworkTag({ code, color, name }: { code: string; color: string; name: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        fontSize: '10px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
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

function SourceBadge({ source }: { source: AwarenessContentSource }) {
  const colors: Record<AwarenessContentSource, string> = {
    internal: '#059669',
    external: '#2563EB',
    regulator: '#DC2626',
    news: '#7C3AED',
  };
  const color = colors[source];
  return (
    <span
      style={{
        fontSize: '11px',
        color: color,
        fontWeight: 500,
      }}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

function ContentModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAwarenessContentInput) => Promise<void>;
}) {
  const { frameworks, getFrameworkColor } = useFrameworks();
  const [formData, setFormData] = useState<CreateAwarenessContentInput>({
    type: 'breach_report',
    title: '',
    summary: '',
    source: undefined,
    linkUrl: '',
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
        frameworkCodes: formData.frameworkCodes?.length ? formData.frameworkCodes : undefined,
        source: formData.source || undefined,
        linkUrl: formData.linkUrl || undefined,
        summary: formData.summary || undefined,
      });
      setFormData({
        type: 'breach_report',
        title: '',
        summary: '',
        source: undefined,
        linkUrl: '',
        frameworkCodes: [],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create content');
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
      title="Add Content"
      width="640px"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Content'}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>
              Type <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as AwarenessContentType })}
              style={inputStyle}
            >
              {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <select
              value={formData.source || ''}
              onChange={(e) => setFormData({ ...formData, source: e.target.value as AwarenessContentSource || undefined })}
              style={inputStyle}
            >
              <option value="">Select source...</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>
            Title <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Content title"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>Summary</label>
          <textarea
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            placeholder="Brief summary..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>Link URL</label>
          <input
            type="url"
            value={formData.linkUrl}
            onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Framework Tags</label>
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
      </form>
    </Modal>
  );
}

export function AwarenessLibrary() {
  const { currentWorkspace } = useWorkspace();
  const { frameworks, getFrameworkName, getFrameworkColor } = useFrameworks();
  const [content, setContent] = useState<AwarenessContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AwarenessContentType | ''>('');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (frameworkFilter) params.append('frameworkCode', frameworkFilter);
      if (searchQuery) params.append('search', searchQuery);

      const url = `${API_BASE}/awareness-content${params.toString() ? `?${params.toString()}` : ''}`;
      const result = await apiCall<ApiResponse<AwarenessContent[]>>(url, {
        headers: { 'X-Workspace-Id': currentWorkspace.id },
      });

      if (result.data) setContent(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch content');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id, typeFilter, frameworkFilter, searchQuery]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleCreateContent = async (input: CreateAwarenessContentInput) => {
    const result = await apiCall<ApiResponse<AwarenessContent>>(`${API_BASE}/awareness-content`, {
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

    await fetchContent();
  };

  // Count by type for summary cards
  const typeCounts = content.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Awareness Library"
          description="Browse and manage awareness content, breach reports, templates, and training materials."
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
          Loading content...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Awareness Library"
        description="Browse and manage awareness content, breach reports, templates, and training materials."
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: theme.spacing[3],
          marginBottom: theme.spacing[6],
        }}
      >
        <Card>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Breach Reports</div>
          <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: '#DC2626' }}>
            {typeCounts['breach_report'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Regulatory Cases</div>
          <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: '#EA580C' }}>
            {typeCounts['regulatory_case'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Templates</div>
          <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: '#4F46E5' }}>
            {(typeCounts['proposal_template'] || 0) + (typeCounts['sow_template'] || 0) + (typeCounts['audit_finding_template'] || 0)}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Training Decks</div>
          <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: '#9333EA' }}>
            {typeCounts['training_deck'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Statistics</div>
          <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: '#0891B2' }}>
            {typeCounts['statistic'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>Total Content</div>
          <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.primary }}>
            {content.length}
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search content..."
          style={{
            padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
            borderRadius: theme.borderRadius.md,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.surface,
            fontSize: theme.typography.sizes.sm,
            width: '200px',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <label style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AwarenessContentType | '')}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">All Types</option>
            {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <label style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Framework:</label>
          <select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value)}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">All Frameworks</option>
            {frameworks.map((fw) => (
              <option key={fw.code} value={fw.code}>
                {fw.name}
              </option>
            ))}
          </select>
        </div>

        {(typeFilter || frameworkFilter || searchQuery) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTypeFilter('');
              setFrameworkFilter('');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </Button>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            Add Content
          </Button>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: theme.spacing[4], borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
          <div style={{ color: theme.colors.semantic.danger }}>{error}</div>
        </Card>
      )}

      {content.length === 0 ? (
        <Card>
          <div
            style={{
              textAlign: 'center',
              padding: theme.spacing[8],
              color: theme.colors.text.muted,
            }}
          >
            <p style={{ margin: 0 }}>No content found.</p>
            <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>
              Add awareness content to build your library.
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: theme.spacing[4] }}>
          {content.map((item) => (
            <Card key={item.id} hover>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing[3] }}>
                <TypeBadge type={item.type} />
                {item.source && <SourceBadge source={item.source} />}
              </div>

              <h3
                style={{
                  margin: 0,
                  marginBottom: theme.spacing[2],
                  fontSize: theme.typography.sizes.base,
                  fontWeight: theme.typography.weights.semibold,
                  color: theme.colors.text.main,
                }}
              >
                {item.title}
              </h3>

              {item.summary && (
                <p
                  style={{
                    margin: 0,
                    marginBottom: theme.spacing[3],
                    fontSize: theme.typography.sizes.sm,
                    color: theme.colors.text.secondary,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.summary}
                </p>
              )}

              {/* Framework Tags */}
              {item.frameworkCodes && item.frameworkCodes.length > 0 && (
                <div style={{ marginBottom: theme.spacing[3] }}>
                  {item.frameworkCodes.map((code) => (
                    <FrameworkTag
                      key={code}
                      code={code}
                      color={getFrameworkColor(code)}
                      name={getFrameworkName(code)}
                    />
                  ))}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: theme.spacing[3],
                  borderTop: `1px solid ${theme.colors.borderLight}`,
                }}
              >
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
                {item.linkUrl && (
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: theme.typography.sizes.sm,
                      color: theme.colors.primary,
                      textDecoration: 'none',
                    }}
                  >
                    Open Link
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateContent} />
    </div>
  );
}
