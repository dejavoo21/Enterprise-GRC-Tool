import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { Card, PageHeader, Badge, Button } from '../components';
import type { ReadinessSummary, ReadinessArea, EnrichedReadinessItem } from '../types/readiness';
import { useFrameworks } from '../context/FrameworkContext';

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

function FrameworkReadinessCard({ data, onClick, getFrameworkName }: { data: ReadinessSummary; onClick: () => void; getFrameworkName: (code: string) => string }) {
  const color = getReadinessColor(data.readinessPercent);

  return (
    <Card hover onClick={onClick} style={{ flex: 1, minWidth: '200px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing[3] }}>
        <Badge variant="primary">{getFrameworkName(data.framework)}</Badge>
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
          {data.totalAreas} areas
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing[1], marginBottom: theme.spacing[2] }}>
        <span style={{ fontSize: theme.typography.sizes['3xl'], fontWeight: theme.typography.weights.bold, color }}>
          {data.readinessPercent}%
        </span>
        <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          Ready
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '8px',
        backgroundColor: theme.colors.borderLight,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
        marginBottom: theme.spacing[3],
      }}>
        <div style={{
          height: '100%',
          width: `${data.readinessPercent}%`,
          backgroundColor: color,
          borderRadius: theme.borderRadius.full,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
        <span style={{
          fontSize: theme.typography.sizes.sm,
          color: data.openItems > 0 ? theme.colors.semantic.danger : theme.colors.semantic.success,
          fontWeight: theme.typography.weights.medium,
        }}>
          {data.readyAreas}/{data.totalAreas} areas ready · {data.openItems} item{data.openItems !== 1 ? 's' : ''} open
        </span>
      </div>
    </Card>
  );
}

interface ReadinessByDomainProps {
  areas: ReadinessArea[];
  loading: boolean;
  error: string | null;
}

function ReadinessByDomainTable({ areas, loading, error }: ReadinessByDomainProps) {
  if (loading) {
    return (
      <Card style={{ flex: 1 }}>
        <div style={{ padding: theme.spacing[4], color: theme.colors.text.muted }}>
          Loading domains...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ flex: 1, borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
        <div style={{ padding: theme.spacing[4], color: theme.colors.semantic.danger }}>
          {error}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ flex: 1 }}>
      <h3 style={{
        margin: 0,
        marginBottom: theme.spacing[4],
        fontSize: theme.typography.sizes.lg,
        fontWeight: theme.typography.weights.semibold,
        color: theme.colors.text.main,
      }}>
        Readiness by Domain
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
          <thead>
            <tr>
              {['Domain', 'Score', 'Status', 'Last Updated'].map((header) => (
                <th key={header} style={{
                  textAlign: 'left',
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `2px solid ${theme.colors.border}`,
                  color: theme.colors.text.secondary,
                  fontWeight: theme.typography.weights.semibold,
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.id}>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.text.main,
                }}>
                  {area.domain}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                    <div style={{
                      width: '60px',
                      height: '6px',
                      backgroundColor: theme.colors.borderLight,
                      borderRadius: theme.borderRadius.full,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${area.score}%`,
                        backgroundColor: getReadinessColor(area.score),
                        borderRadius: theme.borderRadius.full,
                      }} />
                    </div>
                    <span style={{
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.medium,
                      color: getReadinessColor(area.score),
                    }}>
                      {area.score}%
                    </span>
                  </div>
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                }}>
                  {getStatusBadge(area.status)}
                </td>
                <td style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.borderLight}`,
                  fontSize: theme.typography.sizes.xs,
                  color: theme.colors.text.secondary,
                }}>
                  {new Date(area.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface GapsTableProps {
  gaps: EnrichedReadinessItem[];
  loading: boolean;
  error: string | null;
}

function GapsTable({ gaps, loading, error }: GapsTableProps) {
  if (loading) {
    return (
      <Card style={{ flex: 1 }}>
        <div style={{ padding: theme.spacing[4], color: theme.colors.text.muted }}>
          Loading gaps...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ flex: 1, borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
        <div style={{ padding: theme.spacing[4], color: theme.colors.semantic.danger }}>
          {error}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ flex: 1 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing[4],
      }}>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text.main,
        }}>
          Open Items ({gaps.length})
        </h3>
        <Button variant="outline" size="sm">Export</Button>
      </div>

      {gaps.length === 0 ? (
        <div style={{
          padding: theme.spacing[6],
          textAlign: 'center',
          color: theme.colors.text.muted,
        }}>
          No open items – great work!
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}>
            <thead>
              <tr>
                {['Question', 'Domain', 'Owner', 'Due Date', 'Status'].map((header) => (
                  <th key={header} style={{
                    textAlign: 'left',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: theme.colors.surface,
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={gap.id}>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `1px solid ${theme.colors.borderLight}`,
                    color: theme.colors.text.main,
                    maxWidth: '300px',
                  }}>
                    {gap.question}
                  </td>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `1px solid ${theme.colors.borderLight}`,
                    fontSize: theme.typography.sizes.xs,
                    color: theme.colors.text.muted,
                  }}>
                    {gap.domain}
                  </td>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `1px solid ${theme.colors.borderLight}`,
                    color: theme.colors.text.secondary,
                    whiteSpace: 'nowrap',
                  }}>
                    {gap.owner}
                  </td>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `1px solid ${theme.colors.borderLight}`,
                    color: theme.colors.text.secondary,
                    whiteSpace: 'nowrap',
                  }}>
                    {gap.dueDate ? new Date(gap.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td style={{
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `1px solid ${theme.colors.borderLight}`,
                  }}>
                    {getStatusBadge(gap.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function AuditReadiness() {
  const { getFrameworkName } = useFrameworks();
  const [summary, setSummary] = useState<ReadinessSummary[]>([]);
  const [areas, setAreas] = useState<ReadinessArea[]>([]);
  const [gaps, setGaps] = useState<EnrichedReadinessItem[]>([]);
  const [activeFramework, setActiveFramework] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch summary on mount
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/audit-readiness/summary`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        setSummary(json.data || []);
        // Set first framework as active
        if (json.data?.[0]) {
          setActiveFramework(json.data[0].framework);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch summary');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  // Fetch areas when active framework changes
  useEffect(() => {
    if (!activeFramework) return;

    const fetchAreas = async () => {
      try {
        setLoading(true);
        const url = new URL(`${API_BASE}/audit-readiness/areas`);
        url.searchParams.set('framework', activeFramework);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        setAreas(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch areas');
      } finally {
        setLoading(false);
      }
    };

    fetchAreas();
  }, [activeFramework]);

  // Fetch gaps when active framework changes
  useEffect(() => {
    if (!activeFramework) return;

    const fetchGaps = async () => {
      try {
        const url = new URL(`${API_BASE}/audit-readiness/gaps`);
        url.searchParams.set('framework', activeFramework);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        setGaps(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch gaps');
      }
    };

    fetchGaps();
  }, [activeFramework]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Audit Readiness"
        description="Snapshot of how prepared you are for external audits across your frameworks."
      />

      {/* Framework readiness cards */}
      {error && (
        <Card style={{ marginBottom: theme.spacing[4], borderLeft: `3px solid ${theme.colors.semantic.danger}` }}>
          <div style={{ color: theme.colors.semantic.danger }}>
            {error}
          </div>
        </Card>
      )}

      <div style={{
        display: 'flex',
        gap: theme.spacing[4],
        marginBottom: theme.spacing[6],
        flexWrap: 'wrap',
      }}>
        {summary.map((data) => (
          <FrameworkReadinessCard
            key={data.framework}
            data={data}
            onClick={() => setActiveFramework(data.framework)}
            getFrameworkName={getFrameworkName}
          />
        ))}
      </div>

      {/* Two column layout */}
      {activeFramework && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)',
          gap: theme.spacing[6],
        }}>
          <ReadinessByDomainTable areas={areas} loading={loading} error={error} />
          <GapsTable gaps={gaps} loading={loading} error={error} />
        </div>
      )}
    </div>
  );
}

