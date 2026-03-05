import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, Badge, RiskModal, RiskDetailPanel } from '../components';
import { DataTable } from '../components/DataTable';
import type { Risk, CreateRiskInput, ApiResponse } from '../types/risk';
import { RISK_STATUS_LABELS, RISK_CATEGORY_LABELS } from '../types/risk';

const API_BASE = '/api/v1';

export function Risks() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  const fetchRisks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/risks`);
      const result: ApiResponse<Risk[]> = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      setRisks(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch risks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  const handleCreateRisk = async (input: CreateRiskInput) => {
    const response = await fetch(`${API_BASE}/risks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const result: ApiResponse<Risk> = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Refresh the risks list
    await fetchRisks();
  };

  const handleRowClick = (risk: Risk) => {
    setSelectedRisk(risk);
  };

  const columns = [
    { key: 'id', header: 'ID', width: '100px' },
    {
      key: 'title',
      header: 'Title',
      render: (item: Risk) => (
        <span
          style={{
            fontWeight: theme.typography.weights.medium,
            cursor: 'pointer',
            color: theme.colors.primary,
          }}
          onClick={() => handleRowClick(item)}
        >
          {item.title}
        </span>
      ),
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'category',
      header: 'Category',
      render: (item: Risk) => (
        <Badge variant="default">{RISK_CATEGORY_LABELS[item.category]}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Risk) => {
        const variant = {
          identified: 'warning',
          assessed: 'info',
          treated: 'primary',
          accepted: 'success',
          closed: 'default',
        }[item.status] as 'warning' | 'info' | 'primary' | 'success' | 'default';
        return <Badge variant={variant}>{RISK_STATUS_LABELS[item.status]}</Badge>;
      },
    },
    {
      key: 'residualRating',
      header: 'Residual Rating',
      render: (item: Risk) => (
        <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          {item.residualLikelihood} × {item.residualImpact}
        </span>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (item: Risk) => (
        <Badge variant={item.severity}>{item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}</Badge>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (item: Risk) =>
        item.dueDate
          ? new Date(item.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '-',
    },
  ];

  const statusFilterOptions = ['Identified', 'Assessed', 'Treated', 'Accepted', 'Closed'];

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Risks"
          description="Identify, assess, and track risks across your organization. Manage risk treatments and monitor mitigation progress."
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
          Loading risks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Risks"
          description="Identify, assess, and track risks across your organization. Manage risk treatments and monitor mitigation progress."
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
            Error loading risks
          </p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>
            {error}
          </p>
          <button
            onClick={fetchRisks}
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
        title="Risks"
        description="Identify, assess, and track risks across your organization. Manage risk treatments and monitor mitigation progress."
      />

      <DataTable
        data={risks}
        columns={columns}
        searchPlaceholder="Search risks..."
        primaryAction={{
          label: 'New Risk',
          onClick: () => setIsModalOpen(true),
        }}
        filterOptions={statusFilterOptions}
      />

      <RiskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateRisk}
      />

      {selectedRisk && (
        <RiskDetailPanel
          risk={selectedRisk}
          onClose={() => setSelectedRisk(null)}
        />
      )}
    </div>
  );
}
