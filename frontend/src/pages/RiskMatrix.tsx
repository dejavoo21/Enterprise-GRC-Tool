import { theme } from '../theme';
import { Card, PageHeader, Badge, TrendDownIcon, TrendUpIcon } from '../components';

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
    <Card style={{ flex: 1, minWidth: '160px' }}>
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
    // Calculate risk level based on position (row is likelihood inverted, col is impact)
    const riskLevel = (4 - row) + col; // 0-8 scale
    if (riskLevel >= 7) return theme.colors.heatmap.critical;
    if (riskLevel >= 5) return theme.colors.heatmap.high;
    if (riskLevel >= 3) return theme.colors.heatmap.medium;
    if (riskLevel >= 1) return theme.colors.heatmap.low;
    return theme.colors.heatmap.negligible;
  };

  return (
    <Card style={{ flex: 1 }}>
      <div style={{ marginBottom: theme.spacing[4] }}>
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

      <div style={{ display: 'flex', gap: theme.spacing[3] }}>
        {/* Y-axis labels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[8],
          }}
        >
          {likelihoodLabels.map((label, i) => (
            <div
              key={i}
              style={{
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.text.muted,
                textAlign: 'right',
                minWidth: '90px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: theme.spacing[2],
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }}>
          {/* Y-axis label */}
          <div
            style={{
              position: 'absolute',
              left: '-40px',
              top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.muted,
              fontWeight: theme.typography.weights.medium,
              whiteSpace: 'nowrap',
            }}
          >
            LIKELIHOOD
          </div>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '4px',
            }}
          >
            {data.map((row, rowIndex) =>
              row.map((value, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  style={{
                    height: '48px',
                    backgroundColor: getColor(rowIndex, colIndex),
                    borderRadius: theme.borderRadius.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: theme.typography.sizes.lg,
                    fontWeight: theme.typography.weights.bold,
                    boxShadow: value > 0 ? 'inset 0 0 0 2px rgba(255,255,255,0.2)' : 'none',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {value > 0 ? value : ''}
                </div>
              ))
            )}
          </div>

          {/* X-axis labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '4px',
              marginTop: theme.spacing[2],
            }}
          >
            {impactLabels.map((label, i) => (
              <div
                key={i}
                style={{
                  fontSize: theme.typography.sizes.xs,
                  color: theme.colors.text.muted,
                  textAlign: 'center',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* X-axis title */}
          <div
            style={{
              textAlign: 'center',
              marginTop: theme.spacing[3],
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.muted,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            IMPACT
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: theme.spacing[4],
          marginTop: theme.spacing[6],
          paddingTop: theme.spacing[4],
          borderTop: `1px solid ${theme.colors.border}`,
        }}
      >
        {[
          { label: 'Critical', color: theme.colors.heatmap.critical },
          { label: 'High', color: theme.colors.heatmap.high },
          { label: 'Medium', color: theme.colors.heatmap.medium },
          { label: 'Low', color: theme.colors.heatmap.low },
          { label: 'Negligible', color: theme.colors.heatmap.negligible },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
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
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Risk Matrix & Analytics"
        description="Visualize and analyze risk distribution across likelihood and impact dimensions. Compare inherent vs. residual risk levels after control implementation."
      />

      {/* Metric Cards */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[6],
          flexWrap: 'wrap',
        }}
      >
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
      </div>

      {/* Heatmaps */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing[6],
          flexWrap: 'wrap',
        }}
      >
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
      </div>

      {/* Risk Summary Table */}
      <Card style={{ marginTop: theme.spacing[6] }}>
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
    </div>
  );
}
