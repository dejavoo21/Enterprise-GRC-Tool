import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  ControlDetailPanel,
  ControlModal,
  DataTable,
  DataTableShell,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  PageToolbar,
  SummaryMetricStrip,
} from '../components';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type {
  ApiResponse,
  ControlFramework,
  ControlStatus,
  ControlWithFrameworks,
  CreateControlInput,
} from '../types/control';
import {
  CONTROL_STATUS_COLORS,
  CONTROL_STATUS_LABELS,
  FRAMEWORK_COLORS,
  FRAMEWORK_LABELS,
} from '../types/control';

const API_BASE = '/api/v1';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function FrameworkBadge({ framework }: { framework: ControlFramework }) {
  const color = FRAMEWORK_COLORS[framework];
  return (
    <span style={{ display: 'inline-flex', padding: `2px 8px`, borderRadius: theme.borderRadius.full, backgroundColor: `${color}15`, color, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium }}>
      {FRAMEWORK_LABELS[framework]}
    </span>
  );
}

function StatusBadge({ status }: { status: ControlStatus }) {
  const color = CONTROL_STATUS_COLORS[status];
  return (
    <span style={{ display: 'inline-flex', padding: `2px 8px`, borderRadius: theme.borderRadius.full, backgroundColor: `${color}15`, color, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium }}>
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
      const params = new URLSearchParams();
      if (frameworkFilter) params.append('framework', frameworkFilter);
      if (statusFilter) params.append('status', statusFilter);
      const result = await apiCall<ApiResponse<ControlWithFrameworks[]>>(`${API_BASE}/controls${params.toString() ? `?${params.toString()}` : ''}`);
      setControls(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch controls');
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, statusFilter]);

  const fetchFrameworks = useCallback(async () => {
    try {
      const result = await apiCall<ApiResponse<{ id: ControlFramework; name: string; controlCount: number }[]>>(`${API_BASE}/control-mappings/frameworks`);
      if (result.data) {
        setAvailableFrameworks(result.data.map((framework) => framework.id));
      }
    } catch {
      setAvailableFrameworks([]);
    }
  }, []);

  useEffect(() => {
    void fetchFrameworks();
  }, [fetchFrameworks]);

  useEffect(() => {
    void fetchControls();
  }, [fetchControls]);

  const handleCreateControl = async (input: CreateControlInput) => {
    await apiCall<ApiResponse<ControlWithFrameworks>>(`${API_BASE}/controls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await fetchControls();
  };

  const metrics = useMemo(() => {
    const totalControls = controls.length;
    const implemented = controls.filter((control) => control.status === 'implemented').length;
    const inProgress = controls.filter((control) => control.status === 'in_progress').length;
    const designQueue = controls.filter((control) => control.status === 'not_implemented').length;
    const frameworkCoverage = [...new Set(controls.flatMap((control) => control.frameworks))].length;

    return [
      { label: 'Controls', value: totalControls, detail: 'Catalogued control records', tone: 'primary' as const },
      { label: 'Implemented', value: implemented, detail: 'Execution-ready controls', tone: 'success' as const },
      { label: 'In Progress', value: inProgress, detail: 'Active build and remediation', tone: 'warning' as const },
      { label: 'Needs Design', value: designQueue, detail: 'Controls still being defined', tone: 'danger' as const },
      { label: 'Frameworks', value: frameworkCoverage, detail: 'Mapped compliance sets', tone: 'default' as const },
    ];
  }, [controls]);

  const domainBreakdown = useMemo(() => {
    const counts = controls.reduce<Record<string, number>>((accumulator, control) => {
      const key = control.domain || 'Unassigned';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
    return Object.entries(counts).sort((left, right) => right[1] - left[1]).slice(0, 5);
  }, [controls]);

  const columns = [
    {
      key: 'id',
      header: 'ID',
      width: '90px',
      render: (item: ControlWithFrameworks) => <span style={{ color: theme.colors.primary, fontWeight: theme.typography.weights.semibold }}>{item.id}</span>,
    },
    {
      key: 'title',
      header: 'Control',
      render: (item: ControlWithFrameworks) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{item.title}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{item.owner}</div>
        </div>
      ),
    },
    { key: 'domain', header: 'Domain' },
    {
      key: 'status',
      header: 'Status',
      render: (item: ControlWithFrameworks) => <StatusBadge status={item.status} />,
    },
    {
      key: 'frameworks',
      header: 'Frameworks',
      render: (item: ControlWithFrameworks) => (
        <div style={{ display: 'flex', gap: theme.spacing[1], flexWrap: 'wrap', minWidth: 0 }}>
          {item.frameworks.length === 0 ? <span style={{ color: theme.colors.text.muted }}>Unmapped</span> : item.frameworks.slice(0, 3).map((framework) => <FrameworkBadge key={framework} framework={framework} />)}
        </div>
      ),
    },
  ];

  if (loading && controls.length === 0) {
    return (
      <div style={pageStyle}>
        <PageHeader title="Control Register" description="Manage the operating control catalog, implementation maturity, and framework alignment." />
        <PageSectionCard title="Loading Controls">
          <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>Loading control register...</div>
        </PageSectionCard>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Control Register"
        description="Manage the operating control catalog, implementation maturity, and framework alignment."
        action={<Button variant="primary" onClick={() => setIsModalOpen(true)}>New Control</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      {error ? (
        <EmptyStatePanel
          eyebrow="Control Register"
          title="Unable to load controls"
          description={error}
          actions={<Button variant="primary" onClick={fetchControls}>Retry</Button>}
        />
      ) : (
        <>
          <PageSectionCard title="Coverage Snapshot" subtitle="Compact view of where the current control estate is concentrated.">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 1fr)', gap: theme.spacing[4] }}>
              <div style={{ display: 'grid', gap: theme.spacing[3], minWidth: 0 }}>
                {domainBreakdown.length === 0 ? (
                  <div style={{ color: theme.colors.text.secondary }}>No control domains are available yet.</div>
                ) : (
                  domainBreakdown.map(([domain, count]) => (
                    <div key={domain}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>
                        <span>{domain}</span>
                        <strong>{count}</strong>
                      </div>
                      <div style={{ height: 8, backgroundColor: theme.colors.borderLight, borderRadius: theme.borderRadius.full, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(count / Math.max(domainBreakdown[0]?.[1] || 1, 1)) * 100}%`, backgroundColor: theme.colors.primary }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ minWidth: 0, padding: theme.spacing[4], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                  Register guidance
                </div>
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
                  Keep the library compact, assign explicit owners, and map controls to frameworks only after the control objective and evidence pattern are stable.
                </div>
              </div>
            </div>
          </PageSectionCard>

          <PageToolbar>
            <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Framework</span>
              <select value={frameworkFilter} onChange={(event) => setFrameworkFilter(event.target.value as ControlFramework | '')} style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}`, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
                <option value="">All Frameworks</option>
                {availableFrameworks.map((framework) => (
                  <option key={framework} value={framework}>{FRAMEWORK_LABELS[framework]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center' }}>
              <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ControlStatus | '')} style={{ padding: `${theme.spacing[2]} ${theme.spacing[3]}`, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
                <option value="">All Statuses</option>
                <option value="implemented">Implemented</option>
                <option value="in_progress">In Progress</option>
                <option value="not_implemented">Not Implemented</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
            </div>
            {(frameworkFilter || statusFilter) ? <Button variant="outline" onClick={() => { setFrameworkFilter(''); setStatusFilter(''); }}>Clear Filters</Button> : null}
          </PageToolbar>

          {controls.length === 0 ? (
            <EmptyStatePanel
              eyebrow="Control Register"
              title="No controls are registered yet"
              description="Start the library with core governance, access, change, and recovery controls so the program has an implementation baseline to manage."
              actions={<Button variant="primary" onClick={() => setIsModalOpen(true)}>Create First Control</Button>}
            />
          ) : (
            <DataTableShell title="Control Library" subtitle="Compact operational register of controls in scope.">
              <DataTable
                data={controls}
                columns={columns}
                searchPlaceholder="Search controls..."
                primaryAction={{ label: 'New Control', onClick: () => setIsModalOpen(true) }}
                onRowClick={(item) => setSelectedControl(item)}
              />
            </DataTableShell>
          )}
        </>
      )}

      <ControlModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateControl} />
      {selectedControl ? <ControlDetailPanel control={selectedControl} onClose={() => setSelectedControl(null)} /> : null}
    </div>
  );
}
