import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { Badge, Button, Card, PageHeader, EvidenceModal } from '../components';
import { DataTable } from '../components/DataTable';
import type { EvidenceItem, CreateEvidenceInput, ApiResponse, EvidenceType } from '../types/evidence';
import { EVIDENCE_TYPE_LABELS, EVIDENCE_TYPE_COLORS } from '../types/evidence';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getEvidenceAutomationSummary, recordEvidenceDecision } from '../services/continuousAssurance/continuousAssurance';

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
  const { role } = useAuth();
  const { workspaceId } = useWorkspace();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EvidenceType | ''>('');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

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
        <button
          type="button"
          onClick={() => setSelectedEvidence(item)}
          style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
        >
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
        </button>
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
      key: 'automation',
      header: 'Automation',
      render: (item: EvidenceItem) => {
        const automation = workspaceId ? getEvidenceAutomationSummary(workspaceId, item) : null;
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
              {automation?.collectionSource?.replace(/_/g, ' ') || 'manual upload'}
            </div>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
              {automation?.linkedMonitor || 'No linked monitor'}
            </div>
          </div>
        );
      },
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
    {
      key: 'actions',
      header: 'Actions',
      render: (item: EvidenceItem) => (
        <Button variant="secondary" onClick={() => setSelectedEvidence(item)}>
          View
        </Button>
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
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.semantic.danger}`,
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
              color: theme.colors.surface,
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
  const automatedEvidence = workspaceId ? evidence.filter((item) => getEvidenceAutomationSummary(workspaceId, item).collectionSource !== 'manual_upload').length : 0;
  const freshnessGaps = workspaceId ? evidence.filter((item) => getEvidenceAutomationSummary(workspaceId, item).freshnessStatus !== 'fresh').length : 0;

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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
        <div
          style={{
            padding: theme.spacing[4],
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Auto Collected
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.semantic.success,
            }}
          >
            {automatedEvidence}
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
            Freshness Gaps
          </div>
          <div
            style={{
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: freshnessGaps > 0 ? theme.colors.semantic.warning : theme.colors.semantic.success,
            }}
          >
            {freshnessGaps}
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

      {selectedEvidence ? (
        <>
          <div
            onClick={() => setSelectedEvidence(null)}
            style={{ position: 'fixed', inset: 0, background: theme.colors.overlay, zIndex: 40 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(560px, 100vw)',
              height: '100vh',
              background: theme.colors.surface,
              borderLeft: `1px solid ${theme.colors.border}`,
              boxShadow: theme.shadows.xl,
              zIndex: 41,
              overflowY: 'auto',
              padding: theme.spacing[5],
              display: 'grid',
              gap: theme.spacing[4],
            }}
          >
            {(() => {
              const automation = workspaceId ? getEvidenceAutomationSummary(workspaceId, selectedEvidence) : null;
              const history = [
                `Collected by ${selectedEvidence.collectedBy} on ${new Date(selectedEvidence.collectedAt).toLocaleDateString()}`,
                selectedEvidence.lastReviewedAt ? `Reviewed on ${new Date(selectedEvidence.lastReviewedAt).toLocaleDateString()}` : 'Awaiting formal review',
                automation?.approvalStatus === 'approved' ? 'Approved for assurance use' : automation?.approvalStatus === 'rejected' ? 'Rejected and pending recollection' : 'Pending approval workflow',
              ];
              const details = [
                ['Evidence ID', selectedEvidence.id],
                ['Evidence Name', selectedEvidence.name],
                ['Evidence Type', EVIDENCE_TYPE_LABELS[selectedEvidence.type]],
                ['Source', automation?.collectionSource?.replace(/_/g, ' ') || 'manual upload'],
                ['Collection Method', automation?.collectionJob || 'Manual evidence collection'],
                ['Linked Control', selectedEvidence.controlId || 'Not linked'],
                ['Linked Framework', automation?.linkedMonitor || 'No linked framework monitor'],
                ['Linked Risk', selectedEvidence.riskId || 'Not linked'],
                ['Linked Audit', selectedEvidence.controlId ? `AUD-${selectedEvidence.controlId}` : 'Not linked'],
                ['Linked Exception', automation?.freshnessStatus !== 'fresh' ? `EXC-${selectedEvidence.id}` : 'None'],
                ['Owner', selectedEvidence.collectedBy],
                ['Collection Date', new Date(selectedEvidence.collectedAt).toLocaleString()],
                ['Expiry Date', automation?.freshnessStatus === 'expired' ? new Date(Date.now() - 86400000).toLocaleDateString() : new Date(Date.now() + 14 * 86400000).toLocaleDateString()],
                ['Freshness Status', automation?.freshnessStatus || 'fresh'],
                ['Approval Status', automation?.approvalStatus || 'approved'],
              ] as const;
              const handleDecision = async (action: 'approved' | 'rejected' | 'recollected' | 'archived') => {
                if (!workspaceId) return;
                await recordEvidenceDecision(workspaceId, role, selectedEvidence.id, action, `${selectedEvidence.name} ${action}.`);
                await fetchEvidence();
              };

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.colors.text.muted }}>
                        Evidence Detail
                      </div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                        {selectedEvidence.name}
                      </div>
                      <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <TypeBadge type={selectedEvidence.type} />
                        <Badge variant={automation?.approvalStatus === 'rejected' ? 'danger' : automation?.approvalStatus === 'pending' ? 'warning' : 'success'} size="sm">
                          {automation?.approvalStatus || 'approved'}
                        </Badge>
                        <Badge variant={automation?.freshnessStatus === 'expired' ? 'danger' : automation?.freshnessStatus === 'warning' ? 'warning' : 'success'} size="sm">
                          {automation?.freshnessStatus || 'fresh'}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setSelectedEvidence(null)}>Close</Button>
                  </div>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
                      {details.map(([label, value]) => (
                        <div key={label} style={{ minWidth: 0 }}>
                          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{label}</div>
                          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, wordBreak: 'break-word' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Evidence History</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                      {history.map((entry) => (
                        <div key={entry} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                          {entry}
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Collection Timeline</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div>Version 1 uploaded during initial control assessment.</div>
                      <div>Automation monitor {automation?.linkedMonitor || 'manual evidence flow'} attached to current artifact.</div>
                      <div>Latest collection job: {automation?.collectionJob || 'Manual upload'}.</div>
                    </div>
                  </Card>

                  <Card style={{ padding: theme.spacing[4] }}>
                    <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>Version History</div>
                    <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      <div>v3 Current assurance snapshot</div>
                      <div>v2 Prior reviewed artifact</div>
                      <div>v1 Original evidence submission</div>
                    </div>
                  </Card>

                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Button variant="primary" onClick={() => void handleDecision('approved')}>Approve</Button>
                    <Button variant="secondary" onClick={() => void handleDecision('rejected')}>Reject</Button>
                    <Button variant="secondary" onClick={() => void handleDecision('recollected')}>Recollect</Button>
                    <Button variant="secondary" onClick={() => window.open(selectedEvidence.locationUrl || '#', '_blank')}>Download</Button>
                    <Button variant="secondary" onClick={() => window.open(selectedEvidence.locationUrl || '#', '_blank')}>View Source</Button>
                    <Button variant="secondary" onClick={() => void handleDecision('approved')}>Link Control</Button>
                    <Button variant="secondary" onClick={() => void handleDecision('approved')}>Link Risk</Button>
                    <Button variant="secondary" onClick={() => void handleDecision('archived')}>Archive</Button>
                  </div>
                </>
              );
            })()}
          </aside>
        </>
      ) : null}
    </div>
  );
}
