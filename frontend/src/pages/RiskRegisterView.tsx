import { RiskScoreProfile } from '../components/RiskScoreProfile';
import { targetRiskScore, scoreLabel, validScore, residualRating } from '../lib/riskScoreProfile';
import { ratingFor } from '../lib/methodologyMatrix';
import { useRef, useState } from 'react';
import { Badge, Button } from '../components';
import { RiskIcon, TargetIcon, ClockIcon, TreatmentIcon, ReviewIcon, MatrixIcon } from '../components/icons';
import { normalizeCiaImpacts, RISK_STATUS_LABELS } from '../types/risk';
import type { CiaImpact, RiskReviewStatus, RiskSeverity, RiskStatus, RiskTreatmentStatus, RiskTreatmentStrategy } from '../types/risk';
import { TOLERANCE_STATUS_LABELS } from '../types/riskIntelligence';
import type { RiskIntelligenceRiskSummary } from '../types/riskIntelligence';
import type { RiskWorkspaceViewProps } from './RiskWorkspaceViews';

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString() : 'Not set';
const tone = (status: string): 'success' | 'warning' | 'danger' | 'default' => status === 'within_appetite' || status === 'completed' ? 'success' : ['outside_tolerance', 'beyond_capacity', 'overdue'].includes(status) ? 'danger' : status === 'within_tolerance' ? 'warning' : 'default';

export function RiskRegisterKpis({ risks, openPlans }: { risks: RiskIntelligenceRiskSummary[]; openPlans: number }) {
  const summaries = [
    { name: 'Total risks', value: risks.length, note: 'Current risk register', icon: <ReviewIcon size={20}/>, tone: 'primary' },
    { name: 'Open risks', value: risks.filter(r => !['closed', 'cancelled'].includes(r.status)).length, note: 'Excludes closed and cancelled', icon: <RiskIcon size={20}/>, tone: 'warning' },
    { name: 'Outside appetite', value: risks.filter(r => r.appetiteStatus !== 'within_appetite').length, note: 'Requires appetite review', icon: <TargetIcon size={20}/>, tone: 'danger' },
    { name: 'Critical risks', value: risks.filter(r => residualRating(r).toLowerCase() === 'critical').length, note: 'Current residual rating', icon: <RiskIcon size={20}/>, tone: 'danger' },
    { name: 'Treatment plans open', value: openPlans, note: 'Recorded open plans', icon: <TreatmentIcon size={20}/>, tone: 'primary' },
    { name: 'Review overdue', value: risks.filter(r => r.reviewStatus === 'overdue').length, note: 'Marked overdue in register', icon: <ClockIcon size={20}/>, tone: 'danger' },
  ];
  return <div className="rrKpis" aria-label="Risk register summary">{summaries.map(item => <div className={`rrKpi rrTone-${item.tone}`} key={item.name}><span className="rrKpiIcon" aria-hidden="true">{item.icon}</span><div><strong>{item.value}</strong><span>{item.name}</span><small>{item.note}</small></div></div>)}</div>;
}

function CiaBadges({ risk }: { risk: RiskIntelligenceRiskSummary }) {
  const impacts = normalizeCiaImpacts(risk.ciaImpacts);
  return <span className="rrCia">{impacts.length ? impacts.map(impact => <abbr key={impact} title={impact} aria-label={impact}>{impact[0]}</abbr>) : <span>Not set</span>}</span>;
}

function ScoreChip({risk,value,name}: {risk:RiskIntelligenceRiskSummary;value:number|null|undefined;name:string}) {
  const score = validScore(value);
  const rating = scoreLabel(risk,value);
  const legacyColour: Record<string,string> = {Low:'#00865a',Medium:'#b77b00',High:'#d45b00',Critical:'#d92f43'};
  const colour = risk.methodology ? ratingFor(risk.methodology.config,score)?.colour : risk.methodologyId ? undefined : legacyColour[rating.split(' - ')[1]];
  return <span className="rrScoreChip" style={colour ? {backgroundColor:`color-mix(in srgb, ${colour} 13%, var(--color-surface))`,borderColor:`color-mix(in srgb, ${colour} 25%, var(--color-border-soft))`} : undefined} title={`${name}: ${rating}`} aria-label={`${name}: ${rating}`}>{score ?? 'Not set'}</span>;
}

type Filter = { id: string; name: string; value: string; options: [string, string][]; change: (value: string) => void };
const options = (values: string[]): [string, string][] => values.map(value => [value, label(value)]);

export function RiskRegisterView(props: RiskWorkspaceViewProps) {
  const [moreFilters, setMoreFilters] = useState(false);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [sort, setSort] = useState('source');
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  const [saveFeedback, setSaveFeedback] = useState('');
  const storageKey = props.workspaceId ? `laflo:risk-register:view:v1:${props.workspaceId}` : null;
  const [saved, setSaved] = useState<Record<string, string> | null>(() => {
    try {
      const value: unknown = storageKey ? JSON.parse(localStorage.getItem(storageKey) || 'null') : null;
      return value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'string') ? value as Record<string, string> : null;
    } catch { return null; }
  });
  const filters: Filter[] = [
    { id: 'category', name: 'categories', value: props.selectedCategory, options: options([...new Set([...props.state.risks.map(r => r.category), ...props.state.toleranceProfiles.map(p => p.category)])].sort()), change: props.setSelectedCategory },
    { id: 'rating', name: 'ratings', value: props.selectedRating, options: options([...new Set(props.state.risks.map(r => residualRating(r).toLowerCase()))]), change: value => props.setSelectedRating(value as RiskSeverity | 'all') },
    { id: 'appetite', name: 'appetite states', value: props.outsideAppetite ? 'outside' : props.selectedStatus, options: [['outside','Outside appetite'], ...Object.entries(TOLERANCE_STATUS_LABELS)], change: value => props.onApplyRegisterQuery(props.selectedRiskStatus, value) },
    { id: 'owner', name: 'owners', value: props.selectedOwner, options: [...new Set(props.state.risks.map(r => r.owner))].sort().map(owner => [owner, owner]), change: props.setSelectedOwner },
    { id: 'cia', name: 'CIA impacts', value: props.selectedCiaImpact, options: options(['Confidentiality','Integrity','Availability']), change: value => props.setSelectedCiaImpact(value as CiaImpact | 'all') },
    { id: 'lifecycle', name: 'lifecycle statuses', value: props.selectedRiskStatus, options: Object.entries(RISK_STATUS_LABELS).map(([value, text]) => [value, value === 'open' ? 'Open (not closed or cancelled)' : text]), change: value => props.setSelectedRiskStatus(value as RiskStatus | 'all') },
    { id: 'strategy', name: 'strategies', value: props.selectedTreatmentStrategy, options: options(['mitigate','accept','transfer','avoid','monitor']), change: value => props.setSelectedTreatmentStrategy(value as RiskTreatmentStrategy | 'all') },
    { id: 'treatment', name: 'treatment statuses', value: props.selectedTreatmentStatus, options: options(['not_started','planned','in_progress','awaiting_evidence','under_review','completed','overdue','accepted','deferred','cancelled']), change: value => props.setSelectedTreatmentStatus(value as RiskTreatmentStatus | 'all') },
    { id: 'review', name: 'review statuses', value: props.selectedReviewStatus, options: options(['not_reviewed','review_due','in_review','reviewed','overdue','reassessment_required']), change: value => props.setSelectedReviewStatus(value as RiskReviewStatus | 'all') },
  ];
  const activeFilters = filters.filter(f => f.value !== 'all');
  const filterKey = JSON.stringify([filters.map(f => f.value), props.searchQuery, sort, pageSize]);
  const sorted = [...props.filteredRisks].sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'residual' ? b.residualScore - a.residualScore : sort === 'owner' ? a.owner.localeCompare(b.owner) : 0);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(pagination.key === filterKey ? pagination.page : 1, pageCount);
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);
  const selected = visible.find(r => r.id === selection) || null;
  const plans = props.treatments.filter(plan => plan.riskId === selected?.id);
  const selectFilter = (filter: Filter) => <select key={filter.id} aria-label={`Filter by ${filter.name}`} value={filter.value} onChange={e => filter.change(e.target.value)}><option value="all">All {filter.name}</option>{filter.options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select>;
  const saveView = () => {
    if (!storageKey) return;
    const view = Object.fromEntries([...filters.map(f => [f.id, f.value]), ['search',props.searchQuery], ['sort',sort]]);
    try { localStorage.setItem(storageKey, JSON.stringify(view)); setSaved(view); setSaveFeedback('View saved in this browser for this workspace.'); }
    catch { setSaveFeedback('Unable to save this view. Browser storage is unavailable.'); }
  };
  const restoreView = () => {
    if (!saved) return;
    const safeValue = (filter: Filter) => filter.options.some(([v]) => v === saved[filter.id]) ? saved[filter.id] : 'all';
    filters.filter(f => !['appetite','lifecycle'].includes(f.id)).forEach(f => f.change(safeValue(f)));
    props.onApplyRegisterQuery(safeValue(filters[5]), safeValue(filters[2]));
    props.setSearchQuery(saved.search || '');
    setSort(['source','title','residual','owner'].includes(saved.sort) ? saved.sort : 'source');
    setSaveFeedback('Saved view restored.');
  };

  return <div className="rrView">
    <section className="rrFilters" aria-label="Risk register filters">
      <div className="rrPrimaryFilters"><input type="search" aria-label="Search risks" placeholder="Search reference, risk, owner..." value={props.searchQuery} onChange={e => props.setSearchQuery(e.target.value)}/>{filters.slice(0,4).map(selectFilter)}<button type="button" className="rrSecondaryButton" aria-expanded={moreFilters} aria-controls="rr-more-filters" onClick={() => setMoreFilters(!moreFilters)}>More filters{activeFilters.filter(f => filters.indexOf(f) >= 4).length ? ` (${activeFilters.filter(f => filters.indexOf(f) >= 4).length})` : ''}</button></div>
      <div className="rrSecondaryFilters" id="rr-more-filters" hidden={!moreFilters}>{filters.slice(4).map(selectFilter)}</div>
      <div className="rrFilterFooter"><div className="rrApplied" aria-label="Applied filters">{props.searchQuery && <button type="button" onClick={() => props.setSearchQuery('')} aria-label="Remove search filter">Search: {props.searchQuery} ×</button>}{activeFilters.map(f => <button type="button" key={f.id} aria-label={`Remove ${f.name} filter`} onClick={() => f.change('all')}>{f.options.find(([v]) => v === f.value)?.[1] || label(f.value)} ×</button>)}{activeFilters.length || props.searchQuery ? <button type="button" className="rrTextButton" onClick={props.onResetRegisterFilters}>Clear all</button> : <span>All risks in your current scope</span>}</div><div className="rrFilterActions"><button type="button" className="rrTextButton" onClick={props.onRefresh}>Refresh</button>{saved && <button type="button" className="rrTextButton" onClick={restoreView}>Restore saved view</button>}<button type="button" className="rrTextButton" disabled={!storageKey} title="Save filters in this browser for this workspace" onClick={saveView}>Save view</button></div></div>
      {saveFeedback && <p className="rrSaveFeedback" role="status">{saveFeedback}</p>}
    </section>
    <div className={`rrSplit${selected ? ' rrSplit--selected' : ''}`}>
      <section className="rrList" aria-labelledby="rr-list-heading">
        <header className="rrListHeader"><div><h2 id="rr-list-heading">Risk Register <span>({sorted.length} risks)</span></h2><p>Select a risk for details. Scroll the table for all columns.</p></div><label className="rrSort">Sort by<select aria-label="Sort risks" value={sort} onChange={e => setSort(e.target.value)}><option value="source">Register order</option><option value="title">Risk name</option><option value="residual">Highest residual</option><option value="owner">Owner</option></select></label></header>
        <div className="rrTableViewport" tabIndex={0} role="region" aria-label="Risk register table, scroll horizontally for all columns"><table className="rrTable"><thead><tr>{['Ref ID','Risk','Category','Owner','CIA','Inherent Risk','Residual risk','Target Risk','Rating','Appetite','Lifecycle','Treatment','Next Review','Actions'].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>{visible.map(risk => <tr key={risk.id} className={selected?.id === risk.id ? 'rrSelectedRow' : ''} onClick={event => { selectedTrigger.current = event.currentTarget.querySelector<HTMLButtonElement>('.rrRiskSelect'); setSelection(risk.id); }}><td className="rrReference">{risk.riskRef || 'Not assigned'}</td><td><button type="button" className="rrRiskSelect" aria-pressed={selected?.id === risk.id} onClick={event => { selectedTrigger.current = event.currentTarget; setSelection(risk.id); }}>{risk.title}</button></td><td>{label(risk.category)}</td><td>{risk.owner}</td><td><CiaBadges risk={risk}/></td>{([['Inherent risk',risk.inherentScore],['Residual risk',risk.residualScore],['Target risk',targetRiskScore(risk)]] as const).map(([name,value]) => <td key={name}><ScoreChip risk={risk} value={value} name={name}/></td>)}<td><Badge variant={residualRating(risk).toLowerCase() === 'critical' ? 'danger' : residualRating(risk).toLowerCase() === 'high' ? 'warning' : 'default'} size="sm">{validScore(risk.residualScore) === null ? 'Not set' : residualRating(risk)}</Badge></td><td><Badge variant={tone(risk.appetiteStatus)} size="sm">{TOLERANCE_STATUS_LABELS[risk.appetiteStatus]}</Badge></td><td>{RISK_STATUS_LABELS[risk.status]}</td><td><Badge variant={tone(risk.treatmentStatus || '')} size="sm">{label(risk.treatmentStatus || 'not_started')}</Badge></td><td>{dateLabel(risk.nextReviewDate)}<small>{label(risk.reviewStatus || 'not_reviewed')}</small></td><td><button type="button" className="rrRowAction" aria-label={`View full details for ${risk.title}`} onClick={e => { e.stopPropagation(); props.onSelectRisk(risk); }}>View</button></td></tr>)}</tbody></table></div>
        {!sorted.length && <div className="rrEmpty" role="status"><strong>No risks match these filters</strong><p>Adjust your filters or clear them to see the register.</p><button type="button" className="rrSecondaryButton" onClick={props.onResetRegisterFilters}>Clear all filters</button></div>}
        <footer className="rrPagination"><span role="status">{sorted.length ? `Showing ${(page-1)*pageSize+1}-${Math.min(page*pageSize,sorted.length)} of ${sorted.length} risks` : '0 risks'}</span><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[5,10,20].map(n => <option key={n}>{n}</option>)}</select></label><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPagination({key:filterKey,page:page-1})}>‹</button><span>Page {page} of {pageCount}</span><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPagination({key:filterKey,page:page+1})}>›</button></footer>
        <p className="rrCiaNote"><MatrixIcon size={16}/> CIA impact: Confidentiality, Integrity, and Availability. Select a risk to review its classification.</p>
      </section>
      {selected && <aside className="rrDetail" aria-label="Selected risk detail">
        <header><h2>Selected Risk</h2><button type="button" className="rrTextButton" aria-label="Close selected risk panel" onClick={() => { setSelection(null); selectedTrigger.current?.focus(); }}>Close</button>{selected && <button type="button" className="rrTextButton" onClick={() => props.onSelectRisk(selected)}>View full details ↗</button>}</header>
        {selected ? <><div className="rrDetailTitle"><h3>{selected.title}</h3><Badge variant="default" size="sm">{label(selected.category)}</Badge></div><p className="rrDetailSubtitle">{selected.riskRef || 'Reference not assigned'}</p>
          <RiskScoreProfile risk={selected}/><dl className="rrSnapshot"><div><dt>Owner</dt><dd>{selected.owner || 'Not assigned'}</dd></div><div><dt>Current residual rating</dt><dd><Badge variant={residualRating(selected).toLowerCase() === 'critical' ? 'danger' : residualRating(selected).toLowerCase() === 'high' ? 'warning' : 'default'} size="sm">{validScore(selected.residualScore) === null ? 'Not set' : residualRating(selected)}</Badge></dd></div><div><dt>Appetite</dt><dd><Badge variant={tone(selected.appetiteStatus)} size="sm">{TOLERANCE_STATUS_LABELS[selected.appetiteStatus]}</Badge></dd></div><div><dt>Current residual risk</dt><dd>{validScore(selected.residualScore) === null ? 'Not set' : Math.round(selected.residualScore)}</dd></div><div><dt>CIA impacts</dt><dd><CiaBadges risk={selected}/></dd></div><div><dt>Lifecycle status</dt><dd>{RISK_STATUS_LABELS[selected.status]}</dd></div><div><dt>Treatment status</dt><dd>{label(selected.treatmentStatus || 'not_started')}</dd></div><div><dt>Next review</dt><dd>{dateLabel(selected.nextReviewDate)}</dd></div><div><dt>Strategy</dt><dd>{selected.treatmentStrategy ? label(selected.treatmentStrategy) : 'Not set'}</dd></div><div><dt>Treatment due</dt><dd>{dateLabel(selected.treatmentDueDate)}</dd></div></dl>
          <dl className="rrSnapshot"><div><dt>Business unit</dt><dd>{selected.businessUnit || 'Not recorded'}</dd></div><div><dt>Last updated</dt><dd>{dateLabel(selected.updatedAt)}</dd></div><div><dt>Review status</dt><dd>{label(selected.reviewStatus || 'not_reviewed')}</dd></div><div><dt>Linked controls</dt><dd>{new Set(plans.flatMap(plan => plan.linkedControls?.map(control => control.controlId) || [])).size} unique controls across treatments</dd></div><div><dt>Linked evidence</dt><dd>File linking not available</dd></div></dl><div className="rrPlansHeader"><h3>Treatment Plans ({plans.length})</h3><button type="button" className="rrTextButton" onClick={() => props.onNavigate('treatments')}>View all</button></div>
          <div className="rrPlans">{plans.length ? plans.map(plan => <button type="button" className="rrPlan" key={plan.id} onClick={() => props.onEditTreatment(plan)}><strong>{plan.title}</strong><span>{plan.id}</span><span>{plan.linkedControls?.length ? `${plan.linkedControls.length} controls linked` : 'No controls linked'}</span><span>{plan.linkedControls?.slice(0,2).map(link => `${link.controlId}: ${link.title || 'Untitled control'} (${link.role})`).join(', ')}</span><span>Expected residual after treatment: {plan.expectedResidualScore ?? 'Not set'}</span><span>{plan.owner} · {dateLabel(plan.dueDate)}</span><span className="rrPlanProgress"><progress value={plan.progressPercent} max={100} aria-label={`${plan.title} progress`}/>{plan.progressPercent}%</span><Badge variant={tone(plan.status)} size="sm">{label(plan.status)}</Badge></button>) : <p className="rrEmptyPlan">No treatment plans recorded for this risk. Use Record Treatment to add one.</p>}</div>
          <div className="rrDetailActions"><Button variant="primary" onClick={() => props.onEditRisk(selected)}>Edit Risk</Button><Button variant="secondary" onClick={() => props.onCreateTreatment(selected)}>Record Treatment</Button><button type="button" className="rrSecondaryButton rrFull" onClick={() => props.onNavigate('treatments')}>Open Treatment Plans</button><button type="button" onClick={() => plans[0] ? props.onEditTreatment(plans[0]) : props.onCreateTreatment(selected)}>Link controls via treatment</button><button type="button" disabled title="Evidence linking is not available yet">Link Evidence · Coming soon</button></div>
        </> : <p className="rrEmptyPlan">Select a risk from the register to view its details.</p>}
      </aside>}
    </div>
  </div>;
}
