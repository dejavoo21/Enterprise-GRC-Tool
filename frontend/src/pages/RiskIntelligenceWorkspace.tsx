import { useState, type FormEvent } from 'react';
import { Badge, Button } from '../components';
import { createEmergingRisk, createLossEvent, createNearMiss, createRiskKri } from '../lib/api';
import type { RiskWorkspaceViewProps } from './RiskWorkspaceViews';
import './RiskDecisionWorkspace.css';

type Field = { key: string; label: string; type?: 'number' | 'date'; options?: string[]; min?: number; max?: number };
const fields: Record<string,Field[]> = {
  kri: [{key:'name',label:'KRI name'},{key:'owner',label:'Owner'},{key:'category',label:'Category'},{key:'measurementUnit',label:'Measurement unit'},{key:'frequency',label:'Frequency',options:['daily','weekly','monthly','quarterly']},...['currentValue','targetValue','greenThreshold','amberThreshold','redThreshold'].map(key => ({key,label:key.replace(/([A-Z])/g,' $1'),type:'number' as const}))],
  loss: [{key:'eventType',label:'Event type'},{key:'eventDate',label:'Event date',type:'date'},{key:'rootCause',label:'Root cause'},{key:'impact',label:'Impact'},{key:'businessImpact',label:'Business impact'},...['actualLoss','estimatedLoss','recoveryCost'].map(key => ({key,label:key.replace(/([A-Z])/g,' $1'),type:'number' as const,min:0}))],
  near: [{key:'nearMissType',label:'Near miss type'},{key:'description',label:'Description'},{key:'severity',label:'Severity',options:['low','medium','high','critical']},{key:'rootCause',label:'Root cause'},{key:'potentialImpact',label:'Potential impact'},{key:'mitigation',label:'Mitigation'}],
  emerging: [{key:'title',label:'Risk title'},{key:'category',label:'Category'},{key:'description',label:'Description'},{key:'likelihood',label:'Watchlist likelihood (1-5)',type:'number',min:1,max:5},{key:'impact',label:'Watchlist impact (1-5)',type:'number',min:1,max:5},{key:'monitoringStatus',label:'Monitoring status',options:['watchlist','monitoring','escalated','closed']},{key:'triggerEvents',label:'Trigger events (one per line)'}],
};
const label = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
function RecordForm({kind,title,onSaved}: {kind:keyof typeof fields;title:string;onSaved:()=>void}) {
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState('');
  const submit = async(event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: Record<string,string | number> = {};
    for(const field of fields[kind]) {
      const raw = String(data.get(field.key) || '').trim();
      if(!raw) {setFeedback(`${field.label} is required.`);return;}
      const value = field.type === 'number' ? Number(raw) : raw;
      if(typeof value === 'number' && (!Number.isFinite(value) || (kind === 'emerging' && !Number.isInteger(value)) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) {setFeedback(`Enter a valid ${field.label.toLowerCase()}.`);return;}
      values[field.key] = value;
    }
    setBusy(true);setFeedback('');
    try {
      if(kind === 'loss') await createLossEvent(values);
      else if(kind === 'near') await createNearMiss(values);
      else if(kind === 'emerging') await createEmergingRisk({...values,triggerEvents:String(values.triggerEvents).split('\n').map(value=>value.trim()).filter(Boolean)});
      else await createRiskKri({...values,sourceModule:'manual',autoCalculated:false});
      form.reset();setFeedback(`${title} recorded.`);onSaved();
    } catch(error) {setFeedback(error instanceof Error ? error.message : 'Unable to record this item.');}
    finally {setBusy(false);}
  };
  return <details className="riRecord"><summary>Record {title}</summary><form onSubmit={submit}><p>All values below are supplied by you. No example amounts or narratives are added.</p>{kind === 'emerging' && <p>Watchlist signals use the existing 1-5 signal scale, not a methodology-pinned assessment. Record an enterprise risk for formal scoring.</p>}{fields[kind].map(field => <label key={field.key}>{field.label}{field.options ? <select aria-label={field.label} name={field.key} required defaultValue=""><option value="" disabled>Select...</option>{field.options.map(value=><option key={value}>{value}</option>)}</select> : field.key === 'triggerEvents' ? <textarea name={field.key} required/> : <input name={field.key} type={field.type || 'text'} min={field.min} max={field.max} step={field.type === 'number' ? kind === 'emerging' ? 1 : 'any' : undefined} required/>}</label>)}<Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving...' : `Save ${title}`}</Button><p role="status">{feedback}</p></form></details>;
}
export function RiskIntelligenceWorkspace(props: RiskWorkspaceViewProps) {
  const {state,filteredKris,saving,onTightenTolerance,onRebalanceWeights,onRefresh} = props;
  const [kriPage, setKriPage] = useState(1);
  const [kriStatus, setKriStatus] = useState('all');
  const matchingKris = filteredKris.filter(kri => kriStatus === 'all' || kri.status === kriStatus);
  const kriCategories = [...new Set(state.kris.map(kri => kri.category.trim().toLowerCase()))].sort();
  const kriPages = Math.max(1, Math.ceil(matchingKris.length / 6));
  const currentKriPage = Math.min(kriPage, kriPages);
  const visibleKris = matchingKris.slice((currentKriPage - 1) * 6, currentKriPage * 6);
  const forecast = state.forecasts.find(item=>item.scopeType==='enterprise') || state.forecasts[0];
  const forecastValues = forecast ? [forecast.currentScore,forecast.predicted30DayScore,forecast.predicted90DayScore,forecast.predicted180DayScore] : [];
  const validForecast = forecastValues.length === 4 && forecastValues.every(Number.isFinite);
  const forecastMax = Math.max(100,...forecastValues.filter(Number.isFinite));
  const point = (value:number,index:number) => `${35+index*115},${150-value/forecastMax*125}`;
  return <div className="rdWorkspace riWorkspace">
    <section className="rdMetrics" aria-label="Risk intelligence summary">
      <article><span>Total risks in model</span><strong>{state.dashboard.summary.totalRisks.toLocaleString()}</strong><small>Current intelligence scope</small></article>
      <article><span>Appetite breaches</span><strong>{state.dashboard.summary.appetiteBreaches.toLocaleString()}</strong><small>Intelligence appetite thresholds</small></article>
      <article><span>Capacity breaches</span><strong>{state.dashboard.summary.capacityBreaches.toLocaleString()}</strong><small>Intelligence capacity thresholds</small></article>
      <article><span>KRI records</span><strong>{state.kris.length.toLocaleString()}</strong><small>Recorded indicators, including retained records</small></article>
      <article><span>Emerging risks</span><strong>{state.dashboard.summary.emergingRisks.toLocaleString()}</strong><small>Recorded watchlist signals</small></article>
    </section>
    <div className="rdReportGrid"><section className="rdCard"><header><div><h2>Risk Intelligence Dashboard</h2><p>Executive interpretation of current exposure and leading indicators.</p></div></header>{state.dashboard.executiveSummary.length ? state.dashboard.executiveSummary.map(item=><p key={item}>{item}</p>) : <p>No executive insights available.</p>}<dl className="rdFacts">{['increasing','decreasing','stable'].map(trend=><div key={trend}><dt>{trend === 'increasing' ? 'Deteriorating' : trend === 'decreasing' ? 'Improving' : 'Stable'} signals</dt><dd>{state.risks.filter(risk=>risk.trend===trend).length}</dd></div>)}<div><dt>Requires appetite review</dt><dd>{state.risks.filter(risk=>risk.appetiteStatus!=='within_appetite').length}</dd></div></dl></section>
      <section className="rdCard"><header><div><h2>Forecasting &amp; Trending</h2><p>Modelled intelligence index, not a methodology risk score or an observed history.</p></div></header>{validForecast && forecast && <figure className="riForecast"><figcaption>{forecast.scopeLabel} · Intelligence index</figcaption><svg viewBox="0 0 420 180" role="img" aria-label={`${forecast.scopeLabel}: current ${forecastValues[0]}, 30 days ${forecastValues[1]}, 90 days ${forecastValues[2]}, 180 days ${forecastValues[3]}`}><line x1="35" x2="380" y1="150" y2="150" stroke="var(--color-border)"/><line x1="35" x2="380" y1="25" y2="25" stroke="var(--color-border-soft)" strokeDasharray="4 4"/><polyline points={forecastValues.map(point).join(' ')} fill="none" stroke="var(--color-primary)" strokeWidth="3"/>{forecastValues.map((value,index)=><g key={index}><circle cx={35+index*115} cy={150-value/forecastMax*125} r="5" fill="var(--color-primary)"/><text x={35+index*115} y={140-value/forecastMax*125} textAnchor="middle">{Math.round(value)}</text><text x={35+index*115} y="175" textAnchor="middle">{['Current','30 days','90 days','180 days'][index]}</text></g>)}</svg></figure>}<details className="riRecord"><summary>View forecast values</summary><div className="riForecastScroll"><table><thead><tr><th>Scope</th><th>Current</th><th>30 days</th><th>90 days</th><th>180 days</th></tr></thead><tbody>{state.forecasts.map(item=><tr key={item.id}><th scope="row">{item.scopeLabel}</th>{[item.currentScore,item.predicted30DayScore,item.predicted90DayScore,item.predicted180DayScore].map((value,index)=><td key={index}>{Number.isFinite(value)?Math.round(value):'Not available'}</td>)}</tr>)}</tbody></table></div></details>{!state.forecasts.length && <p>No forecasts recorded.</p>}</section></div>
    <div className="rdReportModules">
      <section className="rdCard"><header><h2>KRI Engine</h2></header><div className="riFilters"><label>Category<select value={props.selectedCategory} onChange={event => { props.setSelectedCategory(event.target.value); setKriPage(1); }}><option value="all">All categories</option>{kriCategories.map(category => <option key={category} value={category}>{label(category)}</option>)}</select></label><label>Status<select value={kriStatus} onChange={event => { setKriStatus(event.target.value); setKriPage(1); }}><option value="all">All statuses</option>{["green", "amber", "red"].map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label></div><details className="riSourceNote"><summary>How automated KRIs are counted</summary><p>The automated Open Audit Findings indicator counts audit readiness areas that are not ready, not formal audit finding records.</p></details><ul className="rdList" tabIndex={0} aria-label="KRI records">{visibleKris.map(kri=><li key={kri.id}><strong>{kri.name}</strong><span>{kri.currentValue} {kri.measurementUnit} · Target {kri.targetValue}</span><Badge size="sm" variant={kri.status==='red'?'danger':kri.status==='amber'?'warning':'success'}>{label(kri.status)}</Badge></li>)}</ul>{!matchingKris.length&&<p>No KRIs match these filters.</p>}<nav aria-label="KRI pagination" className="rdQueuePagination"><button type="button" aria-label="Previous KRIs" disabled={currentKriPage === 1} onClick={() => setKriPage(currentKriPage - 1)}>Previous</button><span role="status">Page {currentKriPage} of {kriPages} · {matchingKris.length} matching records</span><button type="button" aria-label="Next KRIs" disabled={currentKriPage === kriPages} onClick={() => setKriPage(currentKriPage + 1)}>Next</button></nav><RecordForm kind="kri" title="KRI" onSaved={onRefresh}/></section>
      <section className="rdCard"><header><div><h2>Appetite &amp; Tolerance</h2><p>Intelligence thresholds; separate from pinned methodology score bands.</p></div></header><ul className="rdList" tabIndex={0} aria-label="Appetite and tolerance profiles">{state.toleranceProfiles.map(profile=><li key={profile.id}><strong>{label(profile.category)}</strong><span>Appetite {profile.appetite} · Tolerance {profile.tolerance} · Capacity {profile.capacity}</span><Button variant="ghost" disabled={saving} onClick={()=>onTightenTolerance(profile)}>Tighten threshold</Button></li>)}</ul>{!state.toleranceProfiles.length&&<p>No intelligence thresholds configured.</p>}</section>
      <section className="rdCard"><header><h2>Capacity Intelligence</h2></header><ul className="rdList" tabIndex={0} aria-label="Capacity profiles">{state.capacities.map(capacity=><li key={capacity.id}><strong>{label(capacity.capacityType)}</strong><span>{Math.round(capacity.utilizationPercent)}% utilisation</span><progress value={Math.min(capacity.utilizationPercent,100)} max={100} aria-label={`${capacity.capacityType} utilisation ${capacity.utilizationPercent}%`}/></li>)}</ul>{!state.capacities.length&&<p>No capacity profiles configured.</p>}<Button variant="secondary" disabled={saving} onClick={onRebalanceWeights}>Rebalance Weight Model</Button></section>
    </div>
    <div className="rdReportModules">
      <section className="rdCard"><h2>Loss Events</h2><ul className="rdList" tabIndex={0} aria-label="Loss events">{state.lossEvents.map(item=><li key={item.id}><strong>{label(item.eventType)}</strong><span>{item.actualLoss.toLocaleString()} recorded loss · {item.rootCause}</span></li>)}</ul>{!state.lossEvents.length&&<p>No loss events recorded.</p>}<RecordForm kind="loss" title="Loss Event" onSaved={onRefresh}/></section>
      <section className="rdCard"><h2>Near Misses</h2><ul className="rdList" tabIndex={0} aria-label="Near misses">{state.nearMisses.map(item=><li key={item.id}><strong>{item.description}</strong><span>{label(item.severity)} · {item.mitigation}</span></li>)}</ul>{!state.nearMisses.length&&<p>No near misses recorded.</p>}<RecordForm kind="near" title="Near Miss" onSaved={onRefresh}/></section>
      <section className="rdCard"><h2>Emerging Risks</h2><ul className="rdList" tabIndex={0} aria-label="Emerging risks">{state.emergingRisks.map(item=><li key={item.id}><strong>{item.title}</strong><span>{label(item.monitoringStatus)}</span></li>)}</ul>{!state.emergingRisks.length&&<p>No emerging risks recorded.</p>}<RecordForm kind="emerging" title="Emerging Risk" onSaved={onRefresh}/></section>
    </div>
  </div>;
}
