import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiCall, API_BASE, fetchRiskIntelligenceState, listRiskTreatmentPlans } from '../lib/api';
import type { RiskTreatmentPlan } from '../types/riskTreatment';
import type { RiskIntelligenceRiskSummary } from '../types/riskIntelligence';
import { useWorkspace } from '../context/WorkspaceContext';
import { AppliedQueryFilter } from '../components/AppliedQueryFilter';
import { updateQueryFilters } from '../lib/queryFilters';
import { axisScore, buildMatrix, matrixScope, ratingFor, type MatrixRisk, type MethodologyConfig, type MethodologyVersion } from '../lib/methodologyMatrix';
import { MatrixIcon, RiskIcon, TreatmentIcon, TrendUpIcon } from '../components/icons';
import './RiskMatrix.css';
import './RiskVisualSystem.css';

type Data = { active: MethodologyVersion | null; config: MethodologyConfig; risks: RiskIntelligenceRiskSummary[]; plans: RiskTreatmentPlan[] | null; mode: string };
function countColour(background?: string) {
  if (!background || !/^#[\da-f]{6}$/i.test(background)) return 'var(--color-text-main)';
  const rgb = [1, 3, 5].map(start => {
    const channel = parseInt(background.slice(start, start + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#000' : '#fff';
}
function Heatmap({ title, config, risks, kind }: { title: string; config: MethodologyConfig; risks: MatrixRisk[]; kind: 'inherent' | 'residual' | 'target' }) {
  const id = useId();
  const cells = buildMatrix(config, risks, kind);
  const plotted = cells.flat().reduce((sum, cell) => sum + cell.count, 0);
  const columns = { gridTemplateColumns: `repeat(${config.impactLevels.length}, minmax(0, 1fr))` };
  return <section className="rmCard rmHeatmapCard" aria-labelledby={id}>
    <header className="rmCardHeader"><div><h2 id={id}>{title}</h2><p>{kind === 'inherent' ? 'Before controls' : kind === 'target' ? 'Desired position; only explicitly recorded target coordinates' : 'Current position after existing controls'}</p></div><span className="rmTotal">{plotted} plotted</span></header>
    <div className="rmDynamicHeatmap"><div className="rmHeatmap">
      <div className="rmYAxis">Likelihood</div>
      <div className="rmYLabels" style={{ gridTemplateRows: `repeat(${config.likelihoodLevels.length}, 1fr)` }} aria-hidden="true">{[...config.likelihoodLevels].reverse().map(level => <span key={level.value}>{level.label}</span>)}</div>
      <div className="rmMatrix" style={columns} role="group" aria-label={title}>{cells.flat().map(cell => <div className="rmCell rmDynamicCell" key={`${cell.likelihood.value}-${cell.impact.value}`} style={{ backgroundColor: cell.band?.colour || 'var(--color-surface-hover)', color: countColour(cell.band?.colour) }} role="img" aria-label={`${cell.likelihood.label}, ${cell.impact.label}: ${cell.count} risks; score ${cell.score}, ${cell.band?.label || 'Rating not configured'}`}>{cell.count > 0 && <span aria-hidden="true">{cell.count}</span>}</div>)}</div>
      <div className="rmXLabels" style={columns} aria-hidden="true">{config.impactLevels.map(level => <span key={level.value}>{level.label}</span>)}</div><div className="rmXAxis">Impact</div>
    </div></div>
    <ul className="rmLegend" aria-label="Configured rating bands">{config.ratingBands.map(band => <li key={band.label}><span style={{ backgroundColor: band.colour }} aria-hidden="true"/>{band.label} ({band.minScore}-{band.maxScore})</li>)}</ul>
    {plotted !== risks.length && <p className="rmDatasetNote">{risks.length - plotted} records have missing or incompatible {kind} coordinates and are not plotted. Scores are not reverse-engineered into coordinates.</p>}
  </section>;
}
export function RiskMatrix() {
  const { currentWorkspace } = useWorkspace();
  return <RiskMatrixContent key={currentWorkspace.id} />;
}
function RiskMatrixContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewFilter = searchParams.get('review');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<'comparison' | 'target' | 'forecast'>('comparison');
  useEffect(() => {
    let current = true;
    void Promise.all([apiCall<{ data: MethodologyVersion | null }>(`${API_BASE}/risk-methodologies/active`), fetchRiskIntelligenceState(), listRiskTreatmentPlans().catch(() => null), apiCall<{data:{methodologyMode:string}}>(`${API_BASE}/risk-methodologies/state`)]).then(async ([methodology, state, plans, mode]) => {
      const config = methodology.data?.config || (await apiCall<{ data: MethodologyConfig }>(`${API_BASE}/risk-methodologies/template`)).data;
      if (current) setData({ active: methodology.data, config, risks: state.risks, plans, mode: mode.data.methodologyMode });
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Risk analytics unavailable.'); });
    return () => { current = false; };
  }, [reload]);
  const scoped = useMemo(() => data ? matrixScope(data.risks, data.active) : [], [data]);
  const categories = useMemo(() => data ? [...new Set(scoped.map(risk => risk.category))].sort().map(category => {
    const rows = scoped.filter(risk => risk.category === category);
    return { category, total: rows.length, bands: data.config.ratingBands.map(band => rows.filter(risk => ratingFor(data.config, axisScore(data.config, risk.residualLikelihood, risk.residualImpact))?.label === band.label).length), unclassified: rows.filter(risk => !ratingFor(data.config, axisScore(data.config, risk.residualLikelihood, risk.residualImpact))).length };
  }) : [], [data, scoped]);
  const comparable = data ? scoped.flatMap(risk => { const inherent = axisScore(data.config, risk.inherentLikelihood, risk.inherentImpact); const residual = axisScore(data.config, risk.residualLikelihood, risk.residualImpact); return inherent === null || residual === null ? [] : [residual - inherent]; }) : [];
  const residualCount = data ? scoped.filter(risk => axisScore(data.config, risk.residualLikelihood, risk.residualImpact) !== null).length : 0;
  const bandCount = (name: string) => data ? scoped.filter(risk => ratingFor(data.config, axisScore(data.config, risk.residualLikelihood, risk.residualImpact))?.label.toLowerCase() === name).length : 0;
  const treatedCount = scoped.filter(risk => risk.status === 'treated' || risk.treatmentStatus === 'completed').length;
  return <section className="rmPage" aria-label="Risk Matrix and Analytics">
    <header className="rmHero"><div><p className="rmEyebrow">Risk Management / Risk Assessments</p><h1>Risk Matrix &amp; Analytics</h1><p>Visualize and analyze risk distribution across likelihood and impact dimensions.</p><p>Compare inherent vs. residual risk levels after control implementation.</p>{data && <small>{data.active ? `Active matrix: ${data.config.name} v${data.active.version} · ${data.config.likelihoodLevels.length}×${data.config.impactLevels.length}` : `Legacy compatibility matrix · ${data.config.likelihoodLevels.length}×${data.config.impactLevels.length}`} · {scoped.length} records in scope</small>}</div><div className="rmHeroAside" aria-hidden="true"><div className="rmHeroBars"><i/><i/><i/></div><p>Better insights.<br/>Stronger decisions.<br/>A more resilient tomorrow.</p></div></header>
    {error && <section className="rmCard" role="alert"><p>{error}</p><button type="button" onClick={() => { setData(null); setError(''); setReload(value => value + 1); }}>Retry loading</button></section>}
    {!data && !error && <p role="status">Loading risk methodology and assessment records...</p>}
    {data && <>
      {reviewFilter && <AppliedQueryFilter label={reviewFilter === 'due' ? 'Assessments due' : `Review: ${reviewFilter}`} routeReady description="Review context is retained. A review-date filter is not applied to this matrix." onRemove={() => setSearchParams(updateQueryFilters(searchParams, { review: null }))}/>}
      <section className="rmMetrics" aria-label="Risk assessment summary">{[
        ['Assessment records', residualCount, 'Records represented in heatmaps', <MatrixIcon size={20}/>, 'primary'],
        ['Critical', bandCount('critical'), 'Require immediate action', <RiskIcon size={20}/>, 'critical'],
        ['High', bandCount('high'), 'Need attention soon', <RiskIcon size={20}/>, 'high'],
        ['Treated', `${treatedCount}/${scoped.length}`, 'Controls implemented', <TreatmentIcon size={20}/>, 'success'],
        ['Avg. score change', comparable.length ? (comparable.reduce((sum, value) => sum + value, 0) / comparable.length).toFixed(1) : 'Not available', comparable.length ? 'After treatment' : 'No comparable records', <TrendUpIcon size={20}/>, 'primary'],
      ].map(([title, value, detail, icon, tone]) => <div className={`rmMetric rmTone-${tone}`} key={String(title)}><span className="rmIcon" aria-hidden="true">{icon}</span><div><div className="rmMetricValue"><strong>{value}</strong></div><span className="rmMetricLabel">{title}</span><p>{detail}</p></div></div>)}</section>
      <nav className="rmViewSwitch" aria-label="Risk matrix views">{([['comparison','Inherent / Residual'],['target','Future Target Risk'],['forecast','Forecast View']] as const).map(([key,name]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}>{name}</button>)}<span>Workspace mode: {data.mode}</span></nav>
      {view === 'comparison' && <div className="rmHeatmapGrid"><Heatmap title="Inherent Risk Heatmap" kind="inherent" config={data.config} risks={scoped}/><Heatmap title="Residual Risk Heatmap" kind="residual" config={data.config} risks={scoped}/></div>}
      {view === 'target' && <div className="rmHeatmapGrid"><Heatmap title="Current Residual Risk" kind="residual" config={data.config} risks={scoped}/><Heatmap title="Future Target Risk" kind="target" config={data.config} risks={scoped}/></div>}
      {view === 'forecast' && <section className="rmCard"><header className="rmCardHeader"><div><h2>Expected Residual After Treatment</h2><p>Recorded plan outcomes, not current risk scores. Scalar forecasts cannot be plotted as likelihood / impact coordinates.</p></div></header><div className="rmTableScroll" role="region" aria-label="Treatment forecasts" tabIndex={0}><table><thead><tr><th>Risk reference</th><th>Treatment plan</th><th>Expected residual</th><th>Status</th></tr></thead><tbody>{(data.plans || []).filter(plan => scoped.some(risk => risk.id === plan.riskId)).map(plan => <tr key={plan.id}><th scope="row">{plan.riskRef || 'Not assigned'}</th><td>{plan.title}</td><td>{plan.expectedResidualScore ?? 'Not set'}</td><td>{plan.status.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>{!(data.plans || []).some(plan => scoped.some(risk => risk.id === plan.riskId)) && <p>{data.plans === null ? 'Treatment forecasts could not be loaded. Matrix assessments remain available.' : 'No treatment forecasts recorded for this methodology scope.'}</p>}</section>}
      <section className="rmCard rmCategoryCard"><header className="rmCardHeader"><div><h2>Risk Summary by Category</h2><p>Current residual coordinate ratings in the selected methodology scope. Unmapped records are shown separately.</p></div></header><div className="rmTableScroll" tabIndex={0} role="region" aria-label="Category summary, scroll horizontally if needed"><table><thead><tr><th scope="col">Category</th>{data.config.ratingBands.map(band => <th scope="col" key={band.label}><span className="rmBandSwatch" style={{ background: band.colour }}/>{band.label}</th>)}<th scope="col">Unmapped</th><th scope="col">Total</th></tr></thead><tbody>{categories.map(row => <tr key={row.category}><th scope="row">{row.category.replaceAll('_', ' ')}</th>{row.bands.map((count, index) => <td key={index}>{count}</td>)}<td>{row.unclassified}</td><td className="rmCategoryTotal">{row.total}</td></tr>)}</tbody></table></div>{!categories.length && <p>No risks are linked to this matrix scope.</p>}</section>
    </>}
  </section>;
}
