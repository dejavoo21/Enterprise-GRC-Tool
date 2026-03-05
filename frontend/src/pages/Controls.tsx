import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader, ControlModal, ControlDetailPanel } from '../components';
import { DataTable } from '../components/DataTable';
import type { ControlWithFrameworks, CreateControlInput, ApiResponse, ControlFramework, ControlStatus } from '../types/control';
import {
  CONTROL_STATUS_LABELS,
  CONTROL_STATUS_COLORS,
  FRAMEWORK_LABELS,
  FRAMEWORK_COLORS,
} from '../types/control';

const API_BASE = '/api/v1';

function FrameworkBadge({ framework }: { framework: ControlFramework }) {
  const color = FRAMEWORK_COLORS[framework];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `2px 6px`,
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: '4px',
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      {FRAMEWORK_LABELS[framework]}
    </span>
  );
}

function StatusBadge({ status }: { status: ControlStatus }) {
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

export function Controls() {
  const [controls, setControls] = useState<ControlWithFrameworks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedControl, setSelectedControl] = useState<ControlWithFrameworks | null>(null);
  const [frameworkFilter, setFrameworkFilter] = useState<ControlFramework | ''>('');
  const [statusFilter, setStatusFilter] = useState<ControlStatus | ''>('');
  const [availableFrameworks, setAvailableFrameworks] = useState<ControlFramework[]>([]);

  const fetchControls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      if (frameworkFilter) {
        params.append('framework', frameworkFilter);
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const url = `${API_BASE}/controls${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const result: ApiResponse<ControlWithFrameworks[]> = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      setControls(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch controls');
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, statusFilter]);

  const fetchFrameworks = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/control-mappings/frameworks`);
      const result: ApiResponse<{ id: ControlFramework; name: string; controlCount: number }[]> = await response.json();

      if (result.data) {
        setAvailableFrameworks(result.data.map(f => f.id));
      }
    } catch (err) {
      console.error('Failed to fetch frameworks:', err);
    }
  }, []);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const handleCreateControl = async (input: CreateControlInput) => {
    const response = await fetch(`${API_BASE}/controls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const result: ApiResponse<ControlWithFrameworks> = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Refresh the controls list
    await fetchControls();
  };

  const handleRowClick = (control: ControlWithFrameworks) => {
    setSelectedControl(control);
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      width: '100px',
      render: (item: ControlWithFrameworks) => (
        <span
          style={{
            fontWeight: theme.typography.weights.semibold,
            color: theme.colors.primary,
            cursor: 'pointer',
          }}
          onClick={() => handleRowClick(item)}
        >
          {item.id}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (item: ControlWithFrameworks) => (
        <span
          style={{
            fontWeight: theme.typography.weights.medium,
            cursor: 'pointer',
          }}
          onClick={() => handleRowClick(item)}
        >
          {item.title}
        </span>
      ),
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'domain',
      header: 'Domain',
      render: (item: ControlWithFrameworks) => (
        <span style={{ color: item.domain ? theme.colors.text.main : theme.colors.text.muted }}>
          {item.domain || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ControlWithFrameworks) => <StatusBadge status={item.status} />,
    },
    {
      key: 'frameworks',
      header: 'Frameworks',
      render: (item: ControlWithFrameworks) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '280px' }}>
          {item.frameworks.length === 0 ? (
            <span style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.sm }}>
              No mappings
            </span>
          ) : (
            item.frameworks.slice(0, 4).map((fw) => (
              <FrameworkBadge key={fw} framework={fw} />
            ))
          )}
          {item.frameworks.length > 4 && (
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.text.secondary,
                padding: '2px 6px',
                backgroundColor: theme.colors.surfaceHover,
                borderRadius: '4px',
              }}
            >
              +{item.frameworks.length - 4}
            </span>
          )}
        </div>
      ),
    },
  ];

  if (loading && controls.length === 0) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Control Library"
          description="Multi-framework control library. Manage controls and view their mappings to ISO 27001, SOC 2, NIST, PCI DSS, CIS, and more."
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
          Loading controls...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Control Library"
          description="Multi-framework control library. Manage controls and view their mappings to ISO 27001, SOC 2, NIST, PCI DSS, CIS, and more."
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
            Error loading controls
          </p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>
            {error}
          </p>
          <button
            onClick={fetchControls}
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
  const totalControls = controls.length;
  const implemented = controls.filter(c => c.status === 'implemented').length;
  const uniqueFrameworks = [...new Set(controls.flatMap(c => c.frameworks))].length;
  const inProgress = controls.filter(c => c.status === 'in_progress').length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Control Library"
        description="Multi-framework control library. Manage controls and view their mappings to ISO 27001, SOC 2, NIST, PCI DSS, CIS, and more."
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
            Total Controls
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.text.main,
            }}
          >
            {totalControls}
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
            Implemented
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.semantic.success,
            }}
          >
            {implemented}
            <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: 400, color: theme.colors.text.muted }}>
              {' '}/ {totalControls}
            </span>
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
            In Progress
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.semantic.warning,
            }}
          >
            {inProgress}
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
            Frameworks Covered
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.primary,
            }}
          >
            {uniqueFrameworks}
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
            Framework:
          </label>
          <select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value as ControlFramework | '')}
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
            <option value="">All Frameworks</option>
            {availableFrameworks.map(fw => (
              <option key={fw} value={fw}>{FRAMEWORK_LABELS[fw]}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
          <label style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ControlStatus | '')}
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
            <option value="">All Statuses</option>
            <option value="implemented">Implemented</option>
            <option value="in_progress">In Progress</option>
            <option value="not_implemented">Not Implemented</option>
            <option value="not_applicable">Not Applicable</option>
          </select>
        </div>

        {(frameworkFilter || statusFilter) && (
          <button
            onClick={() => {
              setFrameworkFilter('');
              setStatusFilter('');
            }}
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
            Clear Filters
          </button>
        )}
      </div>

      <DataTable
        data={controls}
        columns={columns}
        searchPlaceholder="Search controls..."
        primaryAction={{
          label: 'New Control',
          onClick: () => setIsModalOpen(true),
        }}
      />

      <ControlModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateControl}
      />

      {selectedControl && (
        <ControlDetailPanel
          control={selectedControl}
          onClose={() => setSelectedControl(null)}
        />
      )}
    </div>
  );
}
