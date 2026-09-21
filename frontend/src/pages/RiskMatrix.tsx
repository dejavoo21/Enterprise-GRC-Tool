import { theme } from '../theme';
import { useSearchParams } from 'react-router-dom';
import { Card, PageHeader, Badge, TrendDownIcon, TrendUpIcon } from '../components';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import { updateQueryFilters } from '../lib/queryFilters';
import './RiskWorkspaceShared.css';

// Demo data for heatmaps
const inherentRiskData = [
  [0, 1, 2, 3, 5],  // Almost Certain
  [0, 2, 4, 5, 3],  // Likely
  [1, 3, 6, 4, 2],  // Possible
  [2, 4, 3, 2, 1],  // Unlikely
  [3, 2, 1, 0, 0],  // Rare
];

const residualRiskData = [
  [0, 0, 1, 1, 2],  // Almost Certain
  [0, 1, 2, 3, 1],  // Likely
  [0, 2, 3, 2, 1],  // Possible
  [1, 2, 2, 1, 0],  // Unlikely
  [2, 1, 1, 0, 0],  // Rare
];

const metrics = {
  totalRisks: 47,
  critical: 3,
  high: 9,
  treatedCount: 35,
  treatedTotal: 47,
  avgScoreChange: -2.4,
};

const likelihoodLabels = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];
const impactLabels = ['Minimal', 'Minor', 'Moderate', 'Major', 'Severe'];

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendDirection,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
}) {
  return (
    <Card className="riskWorkspaceMetricCard">
      <p
        style={{
          margin: 0,
          fontSize: theme.typography.sizes.sm,
          color: theme.colors.text.muted,
          marginBottom: theme.spacing[2],
        }}
      >
        {title}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing[2] }}>
        <span
          style={{
            fontSize: theme.typography.sizes['2xl'],
            fontWeight: theme.typography.weights.bold,
            color: theme.colors.text.main,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              fontSize: theme.typography.sizes.sm,
              color: trendDirection === 'down' ? theme.colors.semantic.success : theme.colors.semantic.danger,
            }}
          >
            {trendDirection === 'down' ? <TrendDownIcon size={14} /> : <TrendUpIcon size={14} />}
            {trend}
          </span>
        )}
      </div>
      {subtitle && (
        <p
          style={{
            margin: 0,
            marginTop: theme.spacing[1],
            fontSize: theme.typography.sizes.xs,
            color: theme.colors.text.secondary,
          }}
        >
          {subtitle}
        </p>
      )}
    </Card>
  );
}

function RiskHeatmap({
  title,
  data,
  description,
}: {
  title: string;
  data: number[][];
  description?: string;
}) {
  const getColor = (row: number, col: number): string => {
    const riskLevel = (5 - row) * (col + 1);
    if (riskLevel >= 20) return theme.colors.heatmap.critical;
    if (riskLevel >= 12) return theme.colors.heatmap.high;
    if (riskLevel >= 6) return theme.colors.heatmap.medium;
    if (riskLevel >= 3) return theme.colors.heatmap.low;
    return theme.colors.heatmap.negligible;
  };

  return (
    <Card className="riskAssessmentHeatmapCard">
      <div className="riskAssessmentHeatmapHeader">
        <h3
          style={{
            margin: 0,
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.semibold,
            color: theme.colors.text.main,
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              margin: 0,
              marginTop: theme.spacing[1],
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.text.secondary,
            }}
          >
            {description}
          </p>
        )}
      </div>

      <div className="riskAssessmentHeatmapBody">
        <div className="riskAssessmentYAxisTitle">Likelihood</div>
        <div className="riskAssessmentYAxisLabels" aria-hidden="true">
          {likelihoodLabels.map((label, i) => (
            <div
              key={i}
              className="riskAssessmentAxisLabel"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="riskAssessmentMatrixZone">
          <div className="riskAssessmentMatrix" role="img" aria-label={`${title}. Five by five likelihood and impact matrix.`}>
            {data.map((row, rowIndex) =>
              row.map((value, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className="riskAssessmentCell"
                  style={{ backgroundColor: getColor(rowIndex, colIndex) }}
                  aria-label={`${likelihoodLabels[rowIndex]}, ${impactLabels[colIndex]} impact: ${value} risks`}
                >
                  {value > 0 ? value : ''}
                </div>
              ))
            )}
          </div>

          {/* X-axis labels */}
          <div className="riskAssessmentXAxisLabels" aria-hidden="true">
            {impactLabels.map((label, i) => (
              <div
                key={i}
                className="riskAssessmentAxisLabel"
              >
                {label}
              </div>
            ))}
          </div>

          {/* X-axis title */}
          <div className="riskAssessmentXAxisTitle">Impact</div>
        </div>
      </div>

      {/* Legend */}
      <div className="riskAssessmentLegend" aria-label="Risk severity legend">
        {[
          { label: 'Critical', color: theme.colors.heatmap.critical },
          { label: 'High', color: theme.colors.heatmap.high },
          { label: 'Medium', color: theme.colors.heatmap.medium },
          { label: 'Low', color: theme.colors.heatmap.low },
          { label: 'Negligible', color: theme.colors.heatmap.negligible },
        ].map((item, i) => (
          <div key={i}>
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: theme.borderRadius.sm,
                backgroundColor: item.color,
              }}
            />
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RiskMatrix() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewFilter = searchParams.get('review');
  return (
    <main className="riskWorkspacePage riskAssessmentPage">
      <PageHeader
        breadcrumb="Risk Workspace / Risk Assessments"
        title="Risk Matrix & Analytics"
        description="Visualize and analyze risk distribution across likelihood and impact dimensions. Compare inherent vs. residual risk levels after control implementation."
      />

      {reviewFilter ? <AppliedQueryFilter label={reviewFilter === 'due' ? 'Assessments due' : `Review: ${reviewFilter}`} routeReady description="Assessment due dates are not exposed by this matrix dataset yet. The requested context is preserved without changing the heatmap results." onRemove={() => setSearchParams(updateQueryFilters(searchParams, { review: null }))} /> : null}

      {/* Metric Cards */}
      <section className="riskWorkspaceMetricGrid" aria-label="Risk assessment summary">
        <MetricCard title="Total Risks" value={metrics.totalRisks} subtitle="Across all categories" />
        <MetricCard title="Critical" value={metrics.critical} subtitle="Require immediate action" />
        <MetricCard title="High" value={metrics.high} subtitle="Need attention soon" />
        <MetricCard
          title="Treated"
          value={`${metrics.treatedCount}/${metrics.treatedTotal}`}
          subtitle="Controls implemented"
        />
        <MetricCard
          title="Avg. Score Change"
          value={metrics.avgScoreChange}
          subtitle="After treatment"
          trend="15%"
          trendDirection="down"
        />
      </section>

      {/* Heatmaps */}
      <section className="riskAssessmentHeatmapGrid" aria-label="Risk heatmaps">
        <RiskHeatmap
          title="Inherent Risk Heatmap"
          description="Risk levels before control implementation"
          data={inherentRiskData}
        />
        <RiskHeatmap
          title="Residual Risk Heatmap"
          description="Risk levels after control implementation"
          data={residualRiskData}
        />
      </section>

      {/* Risk Summary Table */}
      <Card className="riskWorkspaceTableCard">
        <h3
          style={{
            margin: 0,
            marginBottom: theme.spacing[4],
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.semibold,
            color: theme.colors.text.main,
          }}
        >
          Risk Summary by Category
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                  }}
                >
                  Category
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                  }}
                >
                  Critical
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                  }}
                >
                  High
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                  }}
                >
                  Medium
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                  }}
                >
                  Low
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                    borderBottom: `2px solid ${theme.colors.border}`,
                    color: theme.colors.text.secondary,
                    fontWeight: theme.typography.weights.semibold,
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { category: 'Technical', critical: 1, high: 3, medium: 5, low: 4 },
                { category: 'Operational', critical: 1, high: 2, medium: 4, low: 3 },
                { category: 'Vendor', critical: 1, high: 2, medium: 3, low: 5 },
                { category: 'Compliance', critical: 0, high: 1, medium: 4, low: 3 },
                { category: 'Strategic', critical: 0, high: 1, medium: 2, low: 2 },
              ].map((row, i) => (
                <tr key={i}>
                  <td
                    style={{
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                      color: theme.colors.text.main,
                      fontWeight: theme.typography.weights.medium,
                    }}
                  >
                    {row.category}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                    }}
                  >
                    {row.critical > 0 ? (
                      <Badge variant="critical">{row.critical}</Badge>
                    ) : (
                      <span style={{ color: theme.colors.text.muted }}>-</span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                    }}
                  >
                    {row.high > 0 ? (
                      <Badge variant="high">{row.high}</Badge>
                    ) : (
                      <span style={{ color: theme.colors.text.muted }}>-</span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                    }}
                  >
                    {row.medium > 0 ? (
                      <Badge variant="medium">{row.medium}</Badge>
                    ) : (
                      <span style={{ color: theme.colors.text.muted }}>-</span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                    }}
                  >
                    {row.low > 0 ? (
                      <Badge variant="low">{row.low}</Badge>
                    ) : (
                      <span style={{ color: theme.colors.text.muted }}>-</span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                      fontWeight: theme.typography.weights.semibold,
                      color: theme.colors.text.main,
                    }}
                  >
                    {row.critical + row.high + row.medium + row.low}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
