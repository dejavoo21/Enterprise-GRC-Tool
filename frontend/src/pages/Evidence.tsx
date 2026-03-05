import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, EvidenceModal } from '../components';
import { DataTable } from '../components/DataTable';
import type { EvidenceItem, CreateEvidenceInput, ApiResponse, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPE_LABELS, EVIDENCE_TYPE_COLORS } from '../types/evidence';

const API_BASE = '/api/v1';

function TypeBadge({ type }: { type: EvidenceType }) {
  const color = EVIDENCE_TYPE_COLORS[type];
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
      {EVIDENCE_TYPE_LABELS[type]}
    </span>
  );
}

export function Evidence() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EvidenceType | ''>('');

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const url = `${API_BASE}/evidence${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const result: ApiResponse<EvidenceItem[]> = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      setEvidence(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch evidence');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchEvidence();
  }, [fetchEvidence]);

  const handleCreateEvidence = async (input: CreateEvidenceInput) => {
    const response = await fetch(`${API_BASE}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const result: ApiResponse<EvidenceItem> = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    await fetchEvidence();
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      width: '100px',
      render: (item: EvidenceItem) => (
        <span style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.primary }}>
          {item.id}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item: EvidenceItem) => (
        <div>
          <span style={{ fontWeight: theme.typography.weights.medium }}>
            {item.name}
          </span>
          {item.description && (
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.text.secondary,
                marginTop: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '300px',
              }}
            >
              {item.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: EvidenceItem) => <TypeBadge type={item.type} />,
    },
    {
      key: 'controlId',
      header: 'Control',
      render: (item: EvidenceItem) => (
        <span style={{ color: item.controlId ? theme.colors.primary : theme.colors.text.muted }}>
          {item.controlId || '—'}
        </span>
      ),
    },
    {
      key: 'riskId',
      header: 'Risk',
      render: (item: EvidenceItem) => (
        <span style={{ color: item.riskId ? theme.colors.semantic.warning : theme.colors.text.muted }}>
          {item.riskId || '—'}
        </span>
      ),
    },
    {
      key: 'collectedBy',
      header: 'Collected By',
    },
    {
      key: 'collectedAt',
      header: 'Collected',
      render: (item: EvidenceItem) => (
        <span style={{ fontSize: theme.typography.sizes.sm }}>
          {new Date(item.collectedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
  ];

  if (loading && evidence.length === 0) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Evidence"
          description="Manage compliance evidence and artifacts. Link evidence to controls and risks for comprehensive audit trails."
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
          Loading evidence...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Evidence"
          description="Manage compliance evidence and artifacts. Link evidence to controls and risks for comprehensive audit trails."
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
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>
            Error loading evidence
          </p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>
            {error}
          </p>
          <button
            onClick={fetchEvidence}
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

  // Calculate summary stats
  const totalEvidence = evidence.length;
  const policiesCount = evidence.filter(e => e.type === 'policy').length;
  const linkedToControls = evidence.filter(e => e.controlId).length;
  const linkedToRisks = evidence.filter(e => e.riskId).length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Evidence"
        description="Manage compliance evidence and artifacts. Link evidence to controls and risks for comprehensive audit trails."
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
        }}
      >
        <div
          style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Total Evidence
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.text.main,
            }}
          >
            {totalEvidence}
          </div>
        </div>
        <div
          style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Policies
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: EVIDENCE_TYPE_COLORS.policy,
            }}
          >
            {policiesCount}
          </div>
        </div>
        <div
          style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Linked to Controls
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.primary,
            }}
          >
            {linkedToControls}
          </div>
        </div>
        <div
          style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Linked to Risks
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.semantic.warning,
            }}
          >
            {linkedToRisks}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[4],
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <label style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Type:
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as EvidenceType | '')}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.main,
              cursor: 'pointer',
            }}
          >
            <option value="">All Types</option>
            <option value="policy">Policy</option>
            <option value="configuration">Configuration</option>
            <option value="log">Log</option>
            <option value="screenshot">Screenshot</option>
            <option value="report">Report</option>
            <option value="other">Other</option>
          </select>
        </div>

        {typeFilter && (
          <button
            onClick={() => setTypeFilter('')}
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            Clear Filter
          </button>
        )}
      </div>

      <DataTable
        data={evidence}
        columns={columns}
        searchPlaceholder="Search evidence..."
        primaryAction={{
          label: 'Add Evidence',
          onClick: () => setIsModalOpen(true),
        }}
      />

      <EvidenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateEvidence}
      />
    </div>
  );
}
