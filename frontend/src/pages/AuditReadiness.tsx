import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { theme } from '../theme';
import { Card, PageHeader, Badge, Button } from '../components';
import type { ReadinessSummary, ReadinessArea, EnrichedReadinessItem } from '../types/readiness';
import { useFrameworks } from '../context/FrameworkContext';
import { apiCall } from '../lib/api';

const API_BASE = '/api/v1';

function getReadinessColor(percent: number): string {
  if (percent >= 75) return theme.colors.semantic.success;
  if (percent >= 50) return theme.colors.semantic.warning;
  return theme.colors.semantic.danger;
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'success' | 'warning' | 'default'> = {
    ready: 'success',
    in_progress: 'warning',
    not_started: 'default',
  };

  const labels: Record<string, string> = {
    ready: 'Ready',
    in_progress: 'In Progress',
    not_started: 'Not Started',
  };

  return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
}

function FrameworkCard({
  summary,
  active,
  onSelect,
  label,
}: {
  summary: ReadinessSummary;
  active: boolean;
  onSelect: () => void;
  label: string;
}) {
  const color = getReadinessColor(summary.readinessPercent);

  return (
    <Card
      hover
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        minWidth: '220px',
        border: active ? `1px solid ${color}` : undefined,
        boxShadow: active ? `0 0 0 1px ${color} inset` : undefined,
      }}
    >
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
          <Badge variant="primary">{label}</Badge>
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
            {summary.totalAreas} domains
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: theme.typography.sizes['3xl'], fontWeight: theme.typography.weights.bold, color }}>
            {summary.readinessPercent}%
          </span>
          <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            readiness
          </span>
        </div>
        <div
          style={{
            height: '8px',
            backgroundColor: theme.colors.borderLight,
            borderRadius: theme.borderRadius.full,
            overflow: 'hidden',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${summary.readinessPercent}%`,
              backgroundColor: color,
              borderRadius: theme.borderRadius.full,
            }}
          />
        </div>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, lineHeight: 1.6 }}>
          {summary.readyAreas}/{summary.totalAreas} domains ready with {summary.openItems} open item{summary.openItems !== 1 ? 's' : ''}.
        </div>
      </div>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  detail,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <Card>
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '13px', color: theme.colors.text.secondary, marginBottom: '10px' }}>{title}</div>
        <div style={{ fontSize: '30px', fontWeight: 700, color: accent, marginBottom: '8px' }}>{value}</div>
        <div style={{ fontSize: '13px', color: theme.colors.text.secondary, lineHeight: 1.6 }}>{detail}</div>
      </div>
    </Card>
  );
}

function TableShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: theme.typography.sizes.lg }}>{title}</h3>
          <p style={{ margin: 0, fontSize: '13px', color: theme.colors.text.secondary }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </Card>
  );
}

export function AuditReadiness() {
  const { getFrameworkName } = useFrameworks();
  const [summary, setSummary] = useState<ReadinessSummary[]>([]);
  const [areas, setAreas] = useState<ReadinessArea[]>([]);
  const [gaps, setGaps] = useState<EnrichedReadinessItem[]>([]);
  const [activeFramework, setActiveFramework] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true);
        setError(null);
        const json = await apiCall<{ data: ReadinessSummary[]; error: null }>(
          `${API_BASE}/audit-readiness/summary`
        );
        const nextSummary = json.data || [];
        setSummary(nextSummary);
        if (!activeFramework && nextSummary[0]) {
          setActiveFramework(nextSummary[0].framework);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch readiness summary');
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, []);

  useEffect(() => {
    if (!activeFramework) return;

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        setError(null);

        const [areasJson, gapsJson] = await Promise.all([
          apiCall<{ data: ReadinessArea[]; error: null }>(
            `${API_BASE}/audit-readiness/areas?framework=${encodeURIComponent(activeFramework)}`
          ),
          apiCall<{ data: EnrichedReadinessItem[]; error: null }>(
            `${API_BASE}/audit-readiness/gaps?framework=${encodeURIComponent(activeFramework)}`
          ),
        ]);

        setAreas(areasJson.data || []);
        setGaps(gapsJson.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch readiness details');
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [activeFramework]);

  const selectedSummary = useMemo(
    () => summary.find((item) => item.framework === activeFramework) || null,
    [summary, activeFramework]
  );

  const highestGapOwners = useMemo(() => {
    const counts = new Map<string, number>();
    for (const gap of gaps) {
      counts.set(gap.owner, (counts.get(gap.owner) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [gaps]);

  const weakestAreas = useMemo(
    () => [...areas].sort((a, b) => a.score - b.score).slice(0, 5),
    [areas]
  );

  const strongestAreas = useMemo(
    () => [...areas].sort((a, b) => b.score - a.score).slice(0, 3),
    [areas]
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Audit Readiness"
        description="A readiness cockpit for tracking framework posture, open audit items, and the domains that need attention first."
        action={
          <Button variant="outline" onClick={() => window.print()}>
            Print Readiness View
          </Button>
        }
      />

      <Card
        style={{
          marginBottom: theme.spacing[6],
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #111827 0%, #0f766e 55%, #2dd4bf 100%)',
        }}
      >
        <div style={{ padding: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.72)', marginBottom: '12px' }}>
            AUDIT READINESS COCKPIT
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: 'white', lineHeight: 1.15, maxWidth: '860px', marginBottom: '12px' }}>
            Keep every framework in view without losing the domains and owners that still need follow-through.
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.7, color: 'rgba(226,232,240,0.9)', maxWidth: '840px' }}>
            Use this page to compare framework readiness, pinpoint weak domains, and turn open audit items into a clear operating queue.
          </div>
        </div>
      </Card>

      {error && (
        <Card style={{ marginBottom: theme.spacing[4], borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
          <div style={{ padding: '16px', color: theme.colors.semantic.danger }}>{error}</div>
        </Card>
      )}

      {loadingSummary ? (
        <Card style={{ marginBottom: theme.spacing[6] }}>
          <div style={{ padding: '20px', color: theme.colors.text.secondary }}>Loading readiness frameworks...</div>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: theme.spacing[4],
            marginBottom: theme.spacing[6],
          }}
        >
          {summary.map((item) => (
            <FrameworkCard
              key={item.framework}
              summary={item}
              active={item.framework === activeFramework}
              onSelect={() => setActiveFramework(item.framework)}
              label={getFrameworkName(item.framework)}
            />
          ))}
        </div>
      )}

      {selectedSummary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: theme.spacing[4],
            marginBottom: theme.spacing[6],
          }}
        >
          <MetricCard
            title="Selected Framework"
            value={getFrameworkName(selectedSummary.framework)}
            detail={`${selectedSummary.totalAreas} domains are tracked in this audit scope.`}
            accent={theme.colors.text.main}
          />
          <MetricCard
            title="Readiness Score"
            value={`${selectedSummary.readinessPercent}%`}
            detail={`${selectedSummary.readyAreas} domains are currently marked ready.`}
            accent={getReadinessColor(selectedSummary.readinessPercent)}
          />
          <MetricCard
            title="Open Audit Items"
            value={`${selectedSummary.openItems}`}
            detail="These gaps still need evidence, remediation, or owner follow-through."
            accent={selectedSummary.openItems > 0 ? theme.colors.semantic.danger : theme.colors.semantic.success}
          />
          <MetricCard
            title="Top Gap Owners"
            value={highestGapOwners.length > 0 ? highestGapOwners.map(([owner]) => owner).join(', ') : 'None'}
            detail={highestGapOwners.length > 0 ? highestGapOwners.map(([owner, count]) => `${owner}: ${count}`).join(' | ') : 'No outstanding owners in this framework.'}
            accent={theme.colors.primary}
          />
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: theme.spacing[6],
          marginBottom: theme.spacing[6],
        }}
      >
        <TableShell
          title="Domain Readiness"
          subtitle="How each domain inside the selected framework is trending right now."
        >
          {loadingDetails ? (
            <div style={{ color: theme.colors.text.secondary }}>Loading domain readiness...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
                <thead>
                  <tr>
                    {['Domain', 'Score', 'Status', 'Updated'].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: 'left',
                          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                          borderBottom: `2px solid ${theme.colors.border}`,
                          color: theme.colors.text.secondary,
                          fontWeight: theme.typography.weights.semibold,
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {areas.map((area) => (
                    <tr key={area.id}>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.main, fontWeight: theme.typography.weights.medium }}>
                        {area.domain}
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '72px', height: '6px', backgroundColor: theme.colors.borderLight, borderRadius: theme.borderRadius.full, overflow: 'hidden' }}>
                            <div style={{ width: `${area.score}%`, height: '100%', backgroundColor: getReadinessColor(area.score) }} />
                          </div>
                          <span style={{ color: getReadinessColor(area.score), fontWeight: theme.typography.weights.medium }}>{area.score}%</span>
                        </div>
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                        {getStatusBadge(area.status)}
                      </td>
                      <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                        {new Date(area.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>

        <TableShell
          title="Readiness Signals"
          subtitle="Weak and strong domains that should shape the next audit working session."
        >
          {loadingDetails ? (
            <div style={{ color: theme.colors.text.secondary }}>Loading readiness signals...</div>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: theme.colors.text.muted, marginBottom: '10px' }}>
                  LOWEST SCORING DOMAINS
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {weakestAreas.map((area) => (
                    <div key={area.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: theme.borderRadius.lg, backgroundColor: '#f8fafc' }}>
                      <div>
                        <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{area.domain}</div>
                        <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>{area.status.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{ color: getReadinessColor(area.score), fontWeight: 700 }}>{area.score}%</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: theme.colors.text.muted, marginBottom: '10px' }}>
                  STRONGEST DOMAINS
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {strongestAreas.map((area) => (
                    <div key={area.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: theme.borderRadius.lg, backgroundColor: '#f8fafc' }}>
                      <div>
                        <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{area.domain}</div>
                        <div style={{ fontSize: '12px', color: theme.colors.text.secondary }}>{area.status.replace(/_/g, ' ')}</div>
                      </div>
                      <div style={{ color: getReadinessColor(area.score), fontWeight: 700 }}>{area.score}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TableShell>
      </div>

      <TableShell
        title={`Open Audit Items${activeFramework ? ` for ${getFrameworkName(activeFramework)}` : ''}`}
        subtitle="These are the gaps that still need evidence, remediation, or a status move before the audit story is clean."
      >
        {loadingDetails ? (
          <div style={{ color: theme.colors.text.secondary }}>Loading open audit items...</div>
        ) : gaps.length === 0 ? (
          <div style={{ padding: '24px 0', color: theme.colors.semantic.success }}>No open audit items remain in the selected framework.</div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
              <thead>
                <tr>
                  {['Question', 'Domain', 'Owner', 'Due Date', 'Status'].map((header) => (
                    <th
                      key={header}
                      style={{
                        textAlign: 'left',
                        padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                        borderBottom: `2px solid ${theme.colors.border}`,
                        color: theme.colors.text.secondary,
                        fontWeight: theme.typography.weights.semibold,
                        backgroundColor: theme.colors.surface,
                        position: 'sticky',
                        top: 0,
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gaps.map((gap) => (
                  <tr key={gap.id}>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.main, maxWidth: '380px' }}>
                      {gap.question}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                      {gap.domain || 'General'}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                      {gap.owner}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.text.secondary }}>
                      {gap.dueDate ? new Date(gap.dueDate).toLocaleDateString() : 'No due date'}
                    </td>
                    <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[4]}`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                      {getStatusBadge(gap.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableShell>
    </div>
  );
}
