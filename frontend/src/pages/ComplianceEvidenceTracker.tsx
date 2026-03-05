import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import type { Control } from '../types/control';
import type { EvidenceItem } from '../types/evidence';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';

const API_BASE = '/api/v1';

interface ComplianceMapping {
  controlId: string;
  controlTitle: string;
  evidenceCount: number;
  coveragePercentage: number;
}

export function ComplianceEvidenceTracker() {
  const { currentWorkspace } = useWorkspace();
  const [controls, setControls] = useState<Control[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch controls and evidence using workspace-aware apiCall
      const [controlsData, evidenceData] = await Promise.all([
        apiCall<Control[]>(`${API_BASE}/controls`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }),
        apiCall<EvidenceItem[]>(`${API_BASE}/evidence`, {
          headers: { 'X-Workspace-Id': currentWorkspace.id },
        }),
      ]);

      setControls(controlsData || []);
      setEvidence(evidenceData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mappings: ComplianceMapping[] = controls.map(control => {
    const controlEvidence = evidence.filter(e => e.controlId === control.id);
    const coveragePercentage = controlEvidence.length > 0 ? 100 : 0;
    return {
      controlId: control.id,
      controlTitle: control.title,
      evidenceCount: controlEvidence.length,
      coveragePercentage,
    };
  });

  const stats = {
    totalControls: controls.length,
    evidencedControls: mappings.filter(m => m.evidenceCount > 0).length,
    totalEvidence: evidence.length,
    averageCoverage:
      mappings.length > 0 ? Math.round(mappings.reduce((sum, m) => sum + m.coveragePercentage, 0) / mappings.length) : 0,
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Compliance Evidence Tracker"
          description="Track evidence collection and compliance control coverage across your organization."
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
          Loading compliance data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Compliance Evidence Tracker"
          description="Track evidence collection and compliance control coverage across your organization."
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
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading compliance data</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchData}
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
        title="Compliance Evidence Tracker"
        description="Track evidence collection and compliance control coverage across your organization."
      />

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[8],
        }}
      >
        {[
          { label: 'Total Controls', value: stats.totalControls, color: theme.colors.primary },
          { label: 'Evidenced Controls', value: stats.evidencedControls, color: '#16A34A' },
          { label: 'Total Evidence Items', value: stats.totalEvidence, color: '#2563EB' },
          { label: 'Average Coverage', value: `${stats.averageCoverage}%`, color: '#7C3AED' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: theme.spacing[6],
              backgroundColor: 'white',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: theme.spacing[2] }}>
              {stat.label}
            </div>
            <div
              style={{
                fontSize: typeof stat.value === 'number' && stat.value > 999 ? '28px' : '32px',
                fontWeight: theme.typography.weights.bold,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Evidence Coverage by Control */}
      <div
        style={{
          backgroundColor: 'white',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: theme.spacing[6], borderBottom: `1px solid ${theme.colors.border}` }}>
          <h2 style={{ margin: 0, fontSize: theme.typography.sizes.lg }}>Evidence Coverage by Control</h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: `1px solid ${theme.colors.border}` }}>
                <th style={{ padding: theme.spacing[4], textAlign: 'left', fontWeight: theme.typography.weights.medium }}>
                  Control ID
                </th>
                <th style={{ padding: theme.spacing[4], textAlign: 'left', fontWeight: theme.typography.weights.medium }}>
                  Control Title
                </th>
                <th style={{ padding: theme.spacing[4], textAlign: 'center', fontWeight: theme.typography.weights.medium }}>
                  Evidence Items
                </th>
                <th style={{ padding: theme.spacing[4], textAlign: 'left', fontWeight: theme.typography.weights.medium }}>
                  Coverage Status
                </th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping, index) => (
                <tr
                  key={mapping.controlId}
                  style={{
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      index % 2 === 0 ? '#F3F4F6' : '#ECECF1';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      index % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
                  }}
                  onClick={() =>
                    setSelectedControl(controls.find(c => c.id === mapping.controlId) || null)
                  }
                >
                  <td
                    style={{
                      padding: theme.spacing[4],
                      fontWeight: theme.typography.weights.medium,
                      color: theme.colors.primary,
                    }}
                  >
                    {mapping.controlId}
                  </td>
                  <td style={{ padding: theme.spacing[4] }}>{mapping.controlTitle}</td>
                  <td style={{ padding: theme.spacing[4], textAlign: 'center', fontWeight: theme.typography.weights.medium }}>
                    {mapping.evidenceCount}
                  </td>
                  <td style={{ padding: theme.spacing[4] }}>
                    {mapping.evidenceCount > 0 ? (
                      <span
                        style={{
                          padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                          backgroundColor: '#DCFCE7',
                          color: '#166534',
                          borderRadius: theme.borderRadius.md,
                          fontSize: theme.typography.sizes.xs,
                          fontWeight: theme.typography.weights.medium,
                        }}
                      >
                        ✓ Evidence Collected
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                          backgroundColor: '#FEE2E2',
                          color: '#991B1B',
                          borderRadius: theme.borderRadius.md,
                          fontSize: theme.typography.sizes.xs,
                          fontWeight: theme.typography.weights.medium,
                        }}
                      >
                        ✗ No Evidence
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Items for Selected Control */}
      {selectedControl && (
        <div
          style={{
            marginTop: theme.spacing[8],
            backgroundColor: 'white',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: theme.spacing[6],
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: theme.typography.sizes.lg }}>
                Evidence for Control: {selectedControl.title}
              </h2>
              <p style={{ margin: `${theme.spacing[2]} 0 0`, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>
                {selectedControl.id}
              </p>
            </div>
            <button
              onClick={() => setSelectedControl(null)}
              style={{
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
              }}
            >
              Close
            </button>
          </div>

          <div>
            {evidence
              .filter(e => e.controlId === selectedControl.id)
              .map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    padding: theme.spacing[6],
                    borderBottom: index < evidence.filter(e => e.controlId === selectedControl.id).length - 1 ? `1px solid ${theme.colors.border}` : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      marginBottom: theme.spacing[3],
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{item.name}</h3>
                    <span
                      style={{
                        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                        backgroundColor:
                          item.type === 'policy'
                            ? '#DCFCE7'
                            : item.type === 'configuration'
                              ? '#FEF3C7'
                              : '#E0E7FF',
                        color:
                          item.type === 'policy'
                            ? '#166534'
                            : item.type === 'configuration'
                              ? '#92400E'
                              : '#3730A3',
                        borderRadius: theme.borderRadius.md,
                        fontSize: theme.typography.sizes.xs,
                        fontWeight: theme.typography.weights.medium,
                      }}
                    >
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </span>
                  </div>

                  <p style={{ margin: 0, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>
                    {item.description}
                  </p>

                  <div style={{ marginTop: theme.spacing[3], display: 'flex', gap: theme.spacing[6], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                    <span>Collected by: {item.collectedBy}</span>
                    <span>
                      Collected:{' '}
                      {new Date(item.collectedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}

            {evidence.filter(e => e.controlId === selectedControl.id).length === 0 && (
              <div style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
                <p>No evidence collected for this control yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
