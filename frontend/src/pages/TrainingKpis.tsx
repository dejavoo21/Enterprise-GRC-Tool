import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, Card, Badge, Button, Modal } from '../components';
import { DataTable } from '../components/DataTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import type {
  KpiDefinition,
  KpiSnapshot,
  CreateKpiSnapshotInput,
  KpiSummary,
  KpiCategory,
  TrainingEngagement,
} from '../types/trainingPractice';
import { KPI_CATEGORY_LABELS } from '../types/trainingPractice';

const API_BASE = '/api/v1';

// Extended summary type with id for DataTable
interface KpiSummaryRow extends KpiSummary {
  id: string;
}

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

const CATEGORY_COLORS: Record<KpiCategory, string> = {
  training: '#4F46E5',
  phishing: '#DC2626',
  behavior: '#059669',
  audit: '#D97706',
};

function CategoryBadge({ category }: { category: KpiCategory }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: '4px',
      }}
    >
      {KPI_CATEGORY_LABELS[category]}
    </span>
  );
}

function TrendIndicator({ isImproving, change }: { isImproving?: boolean; change?: number }) {
  if (change === undefined || isImproving === undefined) return null;
  const color = isImproving ? '#059669' : '#DC2626';
  const arrow = isImproving ? (change >= 0 ? '+' : '') : change >= 0 ? '+' : '';
  return (
    <span style={{ color, fontWeight: 500, fontSize: '12px' }}>
      {arrow}
      {change.toFixed(1)}%
    </span>
  );
}

function SnapshotModal({
  isOpen,
  onClose,
  onSubmit,
  kpiDefinitions,
  engagements,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateKpiSnapshotInput) => Promise<void>;
  kpiDefinitions: KpiDefinition[];
  engagements: TrainingEngagement[];
}) {
  const [formData, setFormData] = useState<CreateKpiSnapshotInput>({
    kpiId: '',
    engagementId: undefined,
    periodStart: '',
    periodEnd: '',
    value: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.kpiId) {
      setError('KPI is required');
      return;
    }
    if (!formData.periodStart || !formData.periodEnd) {
      setError('Period start and end dates are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        engagementId: formData.engagementId || undefined,
      });
      setFormData({
        kpiId: '',
        engagementId: undefined,
        periodStart: '',
        periodEnd: '',
        value: 0,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record snapshot');
    } finally {
      setIsSubmitting(false);
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
      title="Record KPI Snapshot"
      width="500px"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Recording...' : 'Record Snapshot'}
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
            KPI <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <select
            value={formData.kpiId}
            onChange={(e) => setFormData({ ...formData, kpiId: e.target.value })}
            style={inputStyle}
          >
            <option value="">Select KPI...</option>
            {kpiDefinitions.map((kpi) => (
              <option key={kpi.id} value={kpi.id}>
                {kpi.name} ({KPI_CATEGORY_LABELS[kpi.category]})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: theme.spacing[4] }}>
          <label style={labelStyle}>Engagement (Optional)</label>
          <select
            value={formData.engagementId || ''}
            onChange={(e) => setFormData({ ...formData, engagementId: e.target.value || undefined })}
            style={inputStyle}
          >
            <option value="">Workspace-wide KPI</option>
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4], marginBottom: theme.spacing[4] }}>
          <div>
            <label style={labelStyle}>
              Period Start <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <input
              type="date"
              value={formData.periodStart}
              onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Period End <span style={{ color: theme.colors.semantic.danger }}>*</span>
            </label>
            <input
              type="date"
              value={formData.periodEnd}
              onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>
            Value (%) <span style={{ color: theme.colors.semantic.danger }}>*</span>
          </label>
          <input
            type="number"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
            step="0.1"
            min="0"
            max="100"
            style={inputStyle}
          />
        </div>
      </form>
    </Modal>
  );
}

export function TrainingKpis() {
  const { currentWorkspace } = useWorkspace();
  const [kpiDefinitions, setKpiDefinitions] = useState<KpiDefinition[]>([]);
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [engagements, setEngagements] = useState<TrainingEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<KpiCategory | ''>('');
  const [selectedEngagementId, setSelectedEngagementId] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedEngagementId) params.append('engagementId', selectedEngagementId);

      const [definitionsRes, snapshotsRes, engagementsRes] = await Promise.all([
        apiCall<ApiResponse<KpiDefinition[]>>(`${API_BASE}/kpi/definitions`),
        apiCall<ApiResponse<KpiSnapshot[]>>(`${API_BASE}/kpi/snapshots${params.toString() ? `?${params.toString()}` : ''}`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }),
        apiCall<ApiResponse<TrainingEngagement[]>>(`${API_BASE}/training-engagements`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }),
      ]);

      if (definitionsRes.data) setKpiDefinitions(definitionsRes.data);
      if (snapshotsRes.data) setSnapshots(snapshotsRes.data);
      if (engagementsRes.data) setEngagements(engagementsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KPI data');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id, selectedEngagementId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSnapshot = async (input: CreateKpiSnapshotInput) => {
    const result = await apiCall<ApiResponse<KpiSnapshot>>(`${API_BASE}/kpi/snapshots`, {
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

  // Calculate KPI summaries
  const kpiSummaries: KpiSummaryRow[] = kpiDefinitions
    .filter((kpi) => !categoryFilter || kpi.category === categoryFilter)
    .map((kpi) => {
      const kpiSnapshots = snapshots
        .filter((s) => s.kpiId === kpi.id)
        .sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime());

      const latestValue = kpiSnapshots[0]?.value ?? 0;
      const previousValue = kpiSnapshots[1]?.value;
      const change = previousValue !== undefined ? latestValue - previousValue : undefined;
      const changePercent = previousValue !== undefined && previousValue !== 0 ? (change! / previousValue) * 100 : undefined;

      // Determine if improving based on target direction
      let isImproving: boolean | undefined;
      if (change !== undefined) {
        if (kpi.targetDirection === 'up') {
          isImproving = change >= 0;
        } else {
          isImproving = change <= 0;
        }
      }

      return {
        id: kpi.id,
        kpiId: kpi.id,
        kpiCode: kpi.code,
        kpiName: kpi.name,
        category: kpi.category,
        targetDirection: kpi.targetDirection,
        latestValue,
        previousValue,
        change,
        changePercent,
        isImproving,
      };
    });

  // Count by category
  const categoryCounts = kpiDefinitions.reduce((acc, kpi) => {
    acc[kpi.category] = (acc[kpi.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const columns = [
    {
      key: 'kpiName',
      header: 'KPI',
      render: (item: KpiSummaryRow) => (
        <div>
          <span style={{ fontWeight: theme.typography.weights.medium }}>{item.kpiName}</span>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{item.kpiCode}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: KpiSummaryRow) => <CategoryBadge category={item.category as KpiCategory} />,
    },
    {
      key: 'latestValue',
      header: 'Latest Value',
      render: (item: KpiSummaryRow) => (
        <span style={{ fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.base }}>
          {item.latestValue.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'previousValue',
      header: 'Previous',
      render: (item: KpiSummaryRow) => (item.previousValue !== undefined ? `${item.previousValue.toFixed(1)}%` : '—'),
    },
    {
      key: 'change',
      header: 'Change',
      render: (item: KpiSummaryRow) => <TrendIndicator isImproving={item.isImproving} change={item.change} />,
    },
    {
      key: 'targetDirection',
      header: 'Target',
      render: (item: KpiSummaryRow) => (
        <Badge variant={item.targetDirection === 'up' ? 'success' : 'warning'}>
          {item.targetDirection === 'up' ? 'Increase' : 'Decrease'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: KpiSummaryRow) => {
        if (item.isImproving === undefined) {
          return <Badge variant="default">No Data</Badge>;
        }
        return item.isImproving ? <Badge variant="success">Improving</Badge> : <Badge variant="danger">Declining</Badge>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader title="Training KPIs" description="Track before/after metrics for security awareness and behavior." />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[12],
            color: theme.colors.text.secondary,
          }}
        >
          Loading KPI data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader title="Training KPIs" description="Track before/after metrics for security awareness and behavior." />
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
      <PageHeader title="Training KPIs" description="Track before/after metrics for security awareness and behavior." />

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
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Training KPIs</div>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: '#4F46E5' }}>
            {categoryCounts['training'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Phishing KPIs</div>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: '#DC2626' }}>
            {categoryCounts['phishing'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Behavior KPIs</div>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: '#059669' }}>
            {categoryCounts['behavior'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Audit KPIs</div>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: '#D97706' }}>
            {categoryCounts['audit'] || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Total Snapshots</div>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.primary }}>
            {snapshots.length}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <label style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as KpiCategory | '')}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">All Categories</option>
            {Object.entries(KPI_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <label style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Engagement:</label>
          <select
            value={selectedEngagementId}
            onChange={(e) => setSelectedEngagementId(e.target.value)}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <option value="">Workspace-wide</option>
            {engagements.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.title}
              </option>
            ))}
          </select>
        </div>

        {(categoryFilter || selectedEngagementId) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCategoryFilter('');
              setSelectedEngagementId('');
            }}
          >
            Clear Filters
          </Button>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            Record Snapshot
          </Button>
        </div>
      </div>

      <DataTable data={kpiSummaries} columns={columns} searchPlaceholder="Search KPIs..." />

      <SnapshotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSnapshot}
        kpiDefinitions={kpiDefinitions}
        engagements={engagements}
      />
    </div>
  );
}
