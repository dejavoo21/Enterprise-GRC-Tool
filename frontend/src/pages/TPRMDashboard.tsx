import { useState, useEffect } from 'react';
import { theme } from '../theme';
import { Card, Button, PageHeader } from '../components';
import {
  fetchTPRMSummary,
  fetchVendorAssessments,
  fetchVendorIncidents,
  fetchVendorContracts,
} from '../lib/api';
import type {
  TPRMSummary,
  VendorRiskAssessment,
  VendorIncident,
  VendorContract,
} from '../types/tprm';

interface TPRMDashboardProps {
  onNavigate?: (key: string) => void;
}

function MetricCard({
  label,
  value,
  color,
  subtext,
  onClick,
}: {
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
  onClick?: () => void;
}) {
  return (
    <Card>
      <div
        style={{
          padding: theme.spacing[4],
          textAlign: 'center',
          cursor: onClick ? 'pointer' : 'default',
        }}
        onClick={onClick}
      >
        <div
          style={{
            fontSize: theme.typography.sizes.xs,
            color: theme.colors.text.muted,
            marginBottom: theme.spacing[2],
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: theme.typography.weights.bold,
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {subtext && (
          <div
            style={{
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing[1],
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    </Card>
  );
}

function RiskTierBadge({ tier }: { tier: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    critical: { bg: '#fee2e2', text: '#dc2626' },
    high: { bg: '#fef3c7', text: '#d97706' },
    medium: { bg: '#dbeafe', text: '#2563eb' },
    low: { bg: '#d1fae5', text: '#059669' },
  };
  const style = colors[tier] || colors.medium;

  return (
    <span
      style={{
        padding: '2px 8px',
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: '4px',
        fontSize: theme.typography.sizes.xs,
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: '#f3f4f6', text: '#6b7280' },
    in_progress: { bg: '#dbeafe', text: '#2563eb' },
    pending_review: { bg: '#fef3c7', text: '#d97706' },
    completed: { bg: '#d1fae5', text: '#059669' },
    expired: { bg: '#fee2e2', text: '#dc2626' },
    open: { bg: '#fee2e2', text: '#dc2626' },
    investigating: { bg: '#fef3c7', text: '#d97706' },
    resolved: { bg: '#d1fae5', text: '#059669' },
    active: { bg: '#d1fae5', text: '#059669' },
  };
  const style = colors[status] || colors.draft;

  return (
    <span
      style={{
        padding: '2px 8px',
        backgroundColor: style.bg,
        color: style.text,
        borderRadius: '4px',
        fontSize: theme.typography.sizes.xs,
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function TPRMDashboard({ onNavigate }: TPRMDashboardProps) {
  const [summary, setSummary] = useState<TPRMSummary | null>(null);
  const [recentAssessments, setRecentAssessments] = useState<VendorRiskAssessment[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<VendorIncident[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<VendorContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [summaryData, assessments, incidents, contracts] = await Promise.all([
          fetchTPRMSummary(),
          fetchVendorAssessments(),
          fetchVendorIncidents({ status: 'open' }),
          fetchVendorContracts({ status: 'active' }),
        ]);

        setSummary(summaryData);
        setRecentAssessments(assessments.slice(0, 5));
        setRecentIncidents(incidents.slice(0, 5));
        // Filter contracts expiring in next 60 days
        const soon = contracts
          .filter(c => c.expirationDate && new Date(c.expirationDate) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000))
          .slice(0, 5);
        setExpiringContracts(soon);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load TPRM data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <PageHeader
          title="Third-Party Risk Management"
          description="Monitor vendor risks, assessments, and compliance."
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
          Loading TPRM dashboard...
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <PageHeader
          title="Third-Party Risk Management"
          description="Monitor vendor risks, assessments, and compliance."
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
            Error loading TPRM dashboard
          </p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      <PageHeader
        title="Third-Party Risk Management"
        description="Monitor vendor risks, assessments, and compliance."
      />

      {/* Top Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
        }}
      >
        <MetricCard
          label="Total Vendors"
          value={summary.totalVendors}
          color={theme.colors.text.main}
          onClick={() => onNavigate?.('vendors')}
        />
        <MetricCard
          label="Overdue Assessments"
          value={summary.overdueAssessments}
          color={summary.overdueAssessments > 0 ? '#ef4444' : '#10b981'}
          onClick={() => onNavigate?.('tprm-assessments')}
        />
        <MetricCard
          label="Open Incidents"
          value={summary.openIncidents}
          color={summary.openIncidents > 0 ? '#f59e0b' : '#10b981'}
          subtext={summary.criticalIncidents > 0 ? `${summary.criticalIncidents} critical` : undefined}
          onClick={() => onNavigate?.('tprm-incidents')}
        />
        <MetricCard
          label="Contracts Expiring"
          value={summary.contractsExpiringSoon}
          color={summary.contractsExpiringSoon > 0 ? '#f59e0b' : '#10b981'}
          subtext="within 60 days"
          onClick={() => onNavigate?.('tprm-contracts')}
        />
        <MetricCard
          label="Pending Questionnaires"
          value={summary.pendingQuestionnaires}
          color={summary.pendingQuestionnaires > 0 ? '#3b82f6' : '#10b981'}
          onClick={() => onNavigate?.('tprm-questionnaires')}
        />
      </div>

      {/* Risk Distribution */}
      <Card style={{ marginBottom: theme.spacing[6] }}>
        <div
          style={{
            padding: theme.spacing[4],
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: theme.typography.sizes.base,
              fontWeight: theme.typography.weights.semibold,
            }}
          >
            Vendor Risk Distribution
          </h3>
        </div>
        <div style={{ padding: theme.spacing[4] }}>
          <div
            style={{
              display: 'flex',
              gap: theme.spacing[6],
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flex: 1,
                height: '24px',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              {summary.vendorsByRiskTier.critical > 0 && (
                <div
                  style={{
                    width: `${(summary.vendorsByRiskTier.critical / summary.totalVendors) * 100}%`,
                    backgroundColor: '#dc2626',
                    minWidth: '20px',
                  }}
                  title={`Critical: ${summary.vendorsByRiskTier.critical}`}
                />
              )}
              {summary.vendorsByRiskTier.high > 0 && (
                <div
                  style={{
                    width: `${(summary.vendorsByRiskTier.high / summary.totalVendors) * 100}%`,
                    backgroundColor: '#f59e0b',
                    minWidth: '20px',
                  }}
                  title={`High: ${summary.vendorsByRiskTier.high}`}
                />
              )}
              {summary.vendorsByRiskTier.medium > 0 && (
                <div
                  style={{
                    width: `${(summary.vendorsByRiskTier.medium / summary.totalVendors) * 100}%`,
                    backgroundColor: '#3b82f6',
                    minWidth: '20px',
                  }}
                  title={`Medium: ${summary.vendorsByRiskTier.medium}`}
                />
              )}
              {summary.vendorsByRiskTier.low > 0 && (
                <div
                  style={{
                    width: `${(summary.vendorsByRiskTier.low / summary.totalVendors) * 100}%`,
                    backgroundColor: '#10b981',
                    minWidth: '20px',
                  }}
                  title={`Low: ${summary.vendorsByRiskTier.low}`}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: theme.spacing[4], flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1] }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '2px' }} />
                <span style={{ fontSize: theme.typography.sizes.sm }}>
                  Critical ({summary.vendorsByRiskTier.critical})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1] }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
                <span style={{ fontSize: theme.typography.sizes.sm }}>
                  High ({summary.vendorsByRiskTier.high})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1] }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
                <span style={{ fontSize: theme.typography.sizes.sm }}>
                  Medium ({summary.vendorsByRiskTier.medium})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1] }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }} />
                <span style={{ fontSize: theme.typography.sizes.sm }}>
                  Low ({summary.vendorsByRiskTier.low})
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Three Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: theme.spacing[4],
        }}
      >
        {/* Recent Assessments */}
        <Card>
          <div
            style={{
              padding: theme.spacing[4],
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: theme.typography.sizes.base,
                fontWeight: theme.typography.weights.semibold,
              }}
            >
              Recent Assessments
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.('tprm-assessments')}
            >
              View All
            </Button>
          </div>
          <div style={{ padding: theme.spacing[4] }}>
            {recentAssessments.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: theme.colors.text.muted,
                  padding: theme.spacing[4],
                }}
              >
                No assessments found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
                {recentAssessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    style={{
                      padding: theme.spacing[3],
                      backgroundColor: theme.colors.surfaceHover,
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: theme.spacing[2],
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: theme.typography.sizes.sm,
                        }}
                      >
                        {assessment.vendorName || 'Unknown Vendor'}
                      </span>
                      {assessment.riskTier && <RiskTierBadge tier={assessment.riskTier} />}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <StatusBadge status={assessment.status} />
                      {assessment.dueDate && (
                        <span
                          style={{
                            fontSize: theme.typography.sizes.xs,
                            color: theme.colors.text.muted,
                          }}
                        >
                          Due: {new Date(assessment.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Open Incidents */}
        <Card>
          <div
            style={{
              padding: theme.spacing[4],
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: theme.typography.sizes.base,
                fontWeight: theme.typography.weights.semibold,
              }}
            >
              Open Incidents
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.('tprm-incidents')}
            >
              View All
            </Button>
          </div>
          <div style={{ padding: theme.spacing[4] }}>
            {recentIncidents.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: theme.colors.text.muted,
                  padding: theme.spacing[4],
                }}
              >
                No open incidents
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
                {recentIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    style={{
                      padding: theme.spacing[3],
                      backgroundColor: theme.colors.surfaceHover,
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: theme.typography.sizes.sm,
                        marginBottom: theme.spacing[1],
                      }}
                    >
                      {incident.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.text.muted,
                        }}
                      >
                        {incident.vendorName}
                      </span>
                      <RiskTierBadge tier={incident.severity} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Expiring Contracts */}
        <Card>
          <div
            style={{
              padding: theme.spacing[4],
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: theme.typography.sizes.base,
                fontWeight: theme.typography.weights.semibold,
              }}
            >
              Expiring Contracts
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.('tprm-contracts')}
            >
              View All
            </Button>
          </div>
          <div style={{ padding: theme.spacing[4] }}>
            {expiringContracts.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: theme.colors.text.muted,
                  padding: theme.spacing[4],
                }}
              >
                No contracts expiring soon
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
                {expiringContracts.map((contract) => (
                  <div
                    key={contract.id}
                    style={{
                      padding: theme.spacing[3],
                      backgroundColor: theme.colors.surfaceHover,
                      borderRadius: theme.borderRadius.md,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: theme.typography.sizes.sm,
                        marginBottom: theme.spacing[1],
                      }}
                    >
                      {contract.contractName}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: theme.typography.sizes.xs,
                          color: theme.colors.text.muted,
                        }}
                      >
                        {contract.vendorName}
                      </span>
                      {contract.expirationDate && (
                        <span
                          style={{
                            fontSize: theme.typography.sizes.xs,
                            color: '#f59e0b',
                            fontWeight: 500,
                          }}
                        >
                          Expires: {new Date(contract.expirationDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default TPRMDashboard;
