import { useRef, useState } from 'react';
import { Badge, Button } from '../components';
import { scoreLabel } from '../lib/riskScoreProfile';
import { sortTreatmentPlans, treatmentPage } from '../lib/treatmentTable';
import type { RiskWorkspaceViewProps } from './RiskWorkspaceViews';
import './RiskDecisionWorkspace.css';

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString() : 'Not set';

export function RiskTreatmentWorkspace({ treatments, treatmentSummary, state, onNavigate, onEditTreatment, onCreateTreatment }: RiskWorkspaceViewProps) {
  const [status, setStatus] = useState('all');
  const [strategy, setStrategy] = useState('all');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('all');
  const [riskId, setRiskId] = useState('all');
  const [sort, setSort] = useState('due');
  const [pageSize, setPageSize] = useState(5);
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  const [selection, setSelection] = useState<string | null>(null);
  const [detailSection, setDetailSection] = useState('overview');
  const selectionTrigger = useRef<HTMLButtonElement | null>(null);
  const reference = (riskId: string) => state.risks.find(risk => risk.id === riskId)?.riskRef;
  const filtered = treatments.filter(plan => (status === 'all' || plan.status === status) && (strategy === 'all' || plan.strategy === strategy) && (owner === 'all' || plan.owner === owner) && (riskId === 'all' || plan.riskId === riskId) && [plan.id, plan.title, plan.riskTitle, plan.riskRef || reference(plan.riskId), plan.owner].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())));
  const sorted = sortTreatmentPlans(filtered, sort);
  const pageKey = JSON.stringify([status, strategy, search, owner, riskId, sort, pageSize]);
  const {page, pageCount, visible} = treatmentPage(sorted, pageSize, pagination, pageKey);
  const selected = visible.find(plan => plan.id === selection);
  const selectedRisk = selected ? state.risks.find(risk => risk.id === selected.riskId) : undefined;
  const summaries = [
    ['Open plans', treatmentSummary.open, 'Plans requiring follow-up'],
    ['Recorded treatments', treatmentSummary.total, 'All recorded plans'],
    ['Average progress', treatments.length ? `${treatmentSummary.averageProgress}%` : 'Not available', 'Across recorded plans'],
    ['Overdue actions', treatmentSummary.overdue, 'Open plans past their due date'],
    ['High-risk plans', treatments.filter(plan => ['critical','high'].includes(plan.priority)).length, 'High or critical priority'],
  ];
  return <div className="rdWorkspace rdTreatmentWorkspace">
    <section className="rdMetrics" aria-label="Treatment delivery summary">{summaries.map(([name,value,note]) => <article key={name}><span>{name}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <section className="rdToolbar" aria-label="Treatment filters">
      <input type="search" aria-label="Search treatment plans" placeholder="Search plan, risk reference or owner" value={search} onChange={event => setSearch(event.target.value)}/>
      <select aria-label="Treatment status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{['draft','planned','in_progress','awaiting_evidence','under_review','completed','accepted','deferred','cancelled','overdue'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select>
      <select aria-label="Treatment strategy" value={strategy} onChange={event => setStrategy(event.target.value)}><option value="all">All strategies</option>{['mitigate','accept','transfer','avoid','monitor'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select>
      <select aria-label="Treatment owner" value={owner} onChange={event => setOwner(event.target.value)}><option value="all">All owners</option>{[...new Set(treatments.map(plan => plan.owner).filter(Boolean))].sort().map(value => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Treatment linked risk" value={riskId} onChange={event => setRiskId(event.target.value)}><option value="all">All linked risks</option>{[...new Map(treatments.map(plan => [plan.riskId, plan])).values()].map(plan => <option key={plan.riskId} value={plan.riskId}>{plan.riskRef || reference(plan.riskId) || 'Reference not assigned'} · {plan.riskTitle || 'Risk title unavailable'}</option>)}</select>
      <Button variant="ghost" onClick={() => {setStatus('all');setStrategy('all');setSearch('');setOwner('all');setRiskId('all');}}>Clear filters</Button>
      <Button variant="primary" onClick={() => onNavigate('register')}>Select risk to record treatment</Button>
    </section>
    <div className={`rdSplit${selected ? ' rdSplit--selected' : ''}`}>
      <section className="rdCard"><header><div><h2>Treatment Plans <span>({sorted.length})</span></h2><p>Select a plan to review delivery, expected outcomes and linked controls.</p></div><label>Sort by<select aria-label="Sort treatment plans" value={sort} onChange={event => setSort(event.target.value)}><option value="due">Due date (earliest)</option><option value="updated">Last updated</option><option value="title">Plan name</option><option value="progress">Highest progress</option></select></label></header>
        <div className="rdTableScroll" role="region" aria-label="Treatment plans table" tabIndex={0}><table><thead><tr>{['Plan / reference','Linked risk','Strategy','Owner','Status','Progress','Due date','Priority','Updated'].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>{visible.map(plan => <tr key={plan.id} className={selected?.id === plan.id ? 'rdSelected' : ''}><th scope="row"><button type="button" className="rdTextButton" aria-pressed={selected?.id === plan.id} onClick={event => { selectionTrigger.current = event.currentTarget; setSelection(plan.id); }}>{plan.title}</button><small className="rdReference">{plan.id}</small></th><td><strong>{plan.riskRef || reference(plan.riskId) || 'Reference not assigned'}</strong><small>{plan.riskTitle || 'Risk title unavailable'}</small></td><td>{label(plan.strategy)}</td><td>{plan.owner || 'Not assigned'}</td><td><Badge size="sm" variant={plan.status === 'overdue' ? 'danger' : plan.status === 'completed' ? 'success' : 'default'}>{label(plan.status)}</Badge></td><td><div className="rdProgress"><progress value={plan.progressPercent} max={100} aria-label={`${plan.title} progress`}/><span>{plan.progressPercent}%</span></div></td><td>{date(plan.dueDate)}</td><td>{label(plan.priority)}</td><td>{date(plan.updatedAt)}</td></tr>)}</tbody></table></div>
        {!visible.length && <div className="rdEmpty"><h3>{treatments.length ? 'No plans match these filters' : 'No treatment plans recorded'}</h3><p>{treatments.length ? 'Clear or adjust the filters to review your plans.' : 'Select a risk in the register to record its first treatment plan.'}</p></div>}
        <footer className="rrPagination"><span role="status">{sorted.length ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, sorted.length)} of ${sorted.length} plans` : '0 plans'}</span><label>Rows per page<select aria-label="Treatment rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[5,10,25].map(value => <option key={value}>{value}</option>)}</select></label><button type="button" aria-label="Previous treatment page" disabled={page === 1} onClick={() => setPagination({key:pageKey,page:page-1})}>‹</button><span>Page {page} of {pageCount}</span><button type="button" aria-label="Next treatment page" disabled={page === pageCount} onClick={() => setPagination({key:pageKey,page:page+1})}>›</button></footer>
      </section>
      {selected && <aside className="rdCard rdTreatmentDetail" tabIndex={0} aria-label="Selected treatment plan"><header><h2>Selected Plan</h2><button type="button" className="rdTextButton" onClick={() => { setSelection(null); selectionTrigger.current?.focus(); }}>Close</button></header><h3>{selected.title}</h3><div className="rdPlanStatus"><Badge size="sm" variant={selected.status === 'completed' ? 'success' : selected.status === 'overdue' ? 'danger' : 'default'}>{label(selected.status)}</Badge><span>{label(selected.priority)} priority</span></div><p>{selected.description?.trim() || 'No plan description recorded.'}</p><p className="rdReference">{selected.id}</p><p><strong>{selected.riskRef || reference(selected.riskId) || 'Reference not assigned'}</strong> · {selected.riskTitle || 'Risk title unavailable'}</p>
        <div className="rdTreatmentSections" role="group" aria-label="Selected plan sections">{['overview', 'controls', 'evidence'].map(section => <button key={section} type="button" aria-pressed={detailSection === section} onClick={() => setDetailSection(section)}>{label(section)}{section === 'controls' ? ` (${selected.linkedControls?.length || 0})` : ''}</button>)}</div>
        <section hidden={detailSection !== 'overview'} aria-label="Plan overview">
        <div className="rdProgress"><progress max={100} value={selected.progressPercent} aria-label="Selected plan progress"/><strong>{selected.progressPercent}%</strong></div>
        <dl className="rdFacts">{[['Owner',selected.owner || 'Not assigned'],['Due date',date(selected.dueDate)],['Status',label(selected.status)],['Expected residual after treatment',selected.expectedResidualScore ?? 'Not set'],['Approval',label(selected.approvalStatus)],['Updated',date(selected.updatedAt)]].map(([name,value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        <dl className="rdFacts">
          <div><dt>Risk scoring basis</dt><dd>{selectedRisk?.methodologyId ? `${selectedRisk.methodology?.config.name || 'Pinned methodology'} · version ${selectedRisk.methodologyVersion ?? 'unavailable'}` : selectedRisk ? 'Legacy compatibility scoring' : 'Linked risk methodology unavailable'}</dd></div>
          <div><dt>Expected residual rating</dt><dd>{selected.expectedResidualScore == null ? 'Not set' : selectedRisk ? scoreLabel(selectedRisk, selected.expectedResidualScore) : 'Linked risk scoring basis unavailable'}</dd></div>
        </dl>
        <p className="rdNote">Expected residual is a planned outcome evaluated on the linked risk's original scoring basis, not the workspace's latest policy. Completing a treatment does not replace the current residual assessment.</p>
        </section>
        <section hidden={detailSection !== 'controls'} aria-label="Plan controls">
        <h3>Linked Controls ({selected.linkedControls?.length || 0})</h3><ul className="rdList">{selected.linkedControls?.map(control => <li key={control.controlId}><strong>{control.controlId} · {control.title || 'Untitled control'}</strong><span>{control.role}</span>{control.implementationNote && <p>{control.implementationNote}</p>}</li>)}</ul>{!selected.linkedControls?.length && <p>No controls linked.</p>}
        </section>
        <section hidden={detailSection !== 'evidence'} aria-label="Plan evidence"><h3>Evidence</h3><p>{selected.evidenceSummary || 'No evidence summary recorded.'}</p><small>Evidence-file linking is not available. A written summary is not a verified attachment.</small></section>
        <footer className="rdTreatmentActions"><Button variant="primary" onClick={() => onEditTreatment(selected)}>Edit Plan</Button><Button variant="secondary" onClick={() => onEditTreatment(selected, true)}>Update Progress</Button><details><summary>More actions</summary><Button variant="ghost" onClick={() => onEditTreatment(selected)}>Link Controls</Button><Button variant="ghost" disabled={!selectedRisk} onClick={() => { if (selectedRisk) onCreateTreatment(selectedRisk); }}>Add Treatment for this Risk</Button><p>Evidence-file linking is not available. Use Edit Plan for recorded treatment details.</p></details></footer>
      </aside>}
    </div>
  </div>;
}
