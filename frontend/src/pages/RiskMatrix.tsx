import { useId, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { theme } from '../theme';
import { ReportsIcon, RiskIcon, ControlIcon, MatrixIcon, TrendUpIcon, TrendDownIcon } from '../components/icons';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import { updateQueryFilters } from '../lib/queryFilters';
import './RiskMatrix.css';
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

const categories = [
  { category: 'Technical', critical: 1, high: 3, medium: 5, low: 4 },
  { category: 'Operational', critical: 1, high: 2, medium: 4, low: 3 },
  { category: 'Vendor', critical: 1, high: 2, medium: 3, low: 5 },
  { category: 'Compliance', critical: 0, high: 1, medium: 4, low: 3 },
  { category: 'Strategic', critical: 0, high: 1, medium: 2, low: 2 },
];
const severities = ['critical', 'high', 'medium', 'low', 'negligible'] as const;

function MetricCard({ title, value, subtitle, icon, tone = 'blue', trend }: {
  title: string; value: string | number; subtitle: string; icon: ReactNode;
  tone?: 'blue' | 'critical' | 'high' | 'success'; trend?: string;
}) {
  return <div className={`rmMetric rmTone-${tone}`}>
    <span className="rmIcon" aria-hidden="true">{icon}</span>
    <div><div className="rmMetricValue"><strong>{value}</strong>{trend && <span className="rmTrend"><TrendDownIcon size={14} />{trend}</span>}</div>
      <span className="rmMetricLabel">{title}</span><p>{subtitle}</p>
    </div>
  </div>;
}

function RiskHeatmap({ title, description, data, icon }: {
  title: string; description: string; data: number[][]; icon: ReactNode;
}) {
  const titleId = useId();
  const getSeverity = (row: number, col: number) => {
    const riskLevel = (5 - row) * (col + 1);
    if (riskLevel >= 20) return 'critical';
    if (riskLevel >= 12) return 'high';
    if (riskLevel >= 6) return 'medium';
    if (riskLevel >= 3) return 'low';
    return 'negligible';
  };
  // Totals describe each existing matrix, not the separate sample KPI dataset.
  const total = data.flat().reduce((sum, count) => sum + count, 0);
  return <section className="rmCard rmHeatmapCard" aria-labelledby={titleId}>
    <header className="rmCardHeader">
      <span className="rmIcon" aria-hidden="true">{icon}</span>
      <div><h2 id={titleId}>{title}</h2><p>{description}</p></div>
      <span className="rmTotal">Total: {total} plotted</span>
    </header>
    <div className="rmHeatmap">
      <div className="rmYAxis">Likelihood</div>
      <div className="rmYLabels" aria-hidden="true">{likelihoodLabels.map(label => <span key={label}>{label}</span>)}</div>
      <div className="rmMatrix" role="group" aria-label={`${title}. Five by five likelihood and impact matrix.`}>
        {data.map((row, r) => row.map((value, c) => <div key={`${r}-${c}`} role="img"
          className="rmCell" data-severity={getSeverity(r, c)} style={{ backgroundColor: theme.colors.heatmap[getSeverity(r, c)] }}
          aria-label={`${likelihoodLabels[r]}, ${impactLabels[c]} impact: ${value} risks; ${getSeverity(r, c)} severity`}>
          {value > 0 && <span aria-hidden="true">{value}</span>}
        </div>))}
      </div>
      <div className="rmXLabels" aria-hidden="true">{impactLabels.map(label => <span key={label}>{label}</span>)}</div>
      <div className="rmXAxis">Impact</div>
    </div>
    <ul className="rmLegend" aria-label="Risk severity legend">{severities.map(severity => <li key={severity}>
      <span aria-hidden="true" style={{ backgroundColor: theme.colors.heatmap[severity] }} />{severity}
    </li>)}</ul>
  </section>;
}

export function RiskMatrix() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewFilter = searchParams.get('review');
  return <main className="rmPage">
    <header className="rmHero">
      <div><p className="rmEyebrow">Risk Management / Risk Assessments · Sample data</p>
        <h1>Risk Matrix &amp; Analytics</h1>
        <p>Visualize and analyze risk distribution across likelihood and impact dimensions.<br />Compare inherent vs. residual risk levels after control implementation.</p>
      </div>
      <aside className="rmHeroAside" aria-hidden="true"><TrendUpIcon size={42} /><p>Better insights.<br />Stronger decisions.<br />A more resilient tomorrow.</p></aside>
    </header>

    {reviewFilter && <AppliedQueryFilter label={reviewFilter === 'due' ? 'Assessments due' : `Review: ${reviewFilter}`} routeReady description="Assessment due dates are not exposed by this matrix dataset yet. The requested context is preserved without changing the heatmap results." onRemove={() => setSearchParams(updateQueryFilters(searchParams, { review: null }))} />}
    <section className="rmMetrics" aria-label="Risk assessment summary">
      <MetricCard title="Assessment Records" value={metrics.totalRisks} subtitle="Sample assessment summary" icon={<ReportsIcon />} />
      <MetricCard title="Critical" value={metrics.critical} subtitle="Require immediate action" tone="critical" icon={<RiskIcon />} />
      <MetricCard title="High" value={metrics.high} subtitle="Need attention soon" tone="high" icon={<RiskIcon />} />
      <MetricCard title="Treated" value={`${metrics.treatedCount}/${metrics.treatedTotal}`} subtitle="Controls implemented" tone="success" icon={<ControlIcon />} />
      <MetricCard title="Avg. Score Change" value={metrics.avgScoreChange} subtitle="After treatment" trend="15%" icon={<MatrixIcon />} />
    </section>
    <div className="rmHeatmapGrid">
      <RiskHeatmap title="Inherent Risk Heatmap" description="Risk levels before control implementation" data={inherentRiskData} icon={<MatrixIcon />} />
      <RiskHeatmap title="Residual Risk Heatmap" description="Risk levels after control implementation" data={residualRiskData} icon={<ControlIcon />} />
    </div>
    <section className="rmCard rmCategoryCard" aria-labelledby="rm-category-title">
      <header className="rmCardHeader"><span className="rmIcon" aria-hidden="true"><ReportsIcon /></span><div>
        <h2 id="rm-category-title">Risk Summary by Category</h2><p>Breakdown of risks by category and risk level.</p>
      </div></header>
      <div className="rmTableScroll" tabIndex={0} role="region" aria-label="Risk summary by category, horizontally scrollable">
        <table><thead><tr><th scope="col">Category</th>{['Critical', 'High', 'Medium', 'Low', 'Total'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{categories.map(row => <tr key={row.category}><th scope="row">{row.category}</th>
            {(['critical', 'high', 'medium', 'low'] as const).map(severity => <td key={severity}><span className={`rmCount rmCount-${severity}`}>{row[severity]}</span></td>)}
            <td className="rmCategoryTotal">{row.critical + row.high + row.medium + row.low}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <p className="rmDatasetNote">Assessment sample dataset. These existing example values are not live Risk Register data; summary and matrix totals differ.</p>
  </main>;
}
