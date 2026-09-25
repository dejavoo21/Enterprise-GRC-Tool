import { useState } from 'react';
import { Badge, Button } from '../components';
import type { IssueRecord } from '../types/issues';
import { overdueAgeBands, overdueDays } from '../lib/overdueAge';
import './RiskDecisionWorkspace.css';

type Props = { kind: 'escalations' | 'overdue'; issues: IssueRecord[]; onIssue: (issue: IssueRecord) => void };
const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString() : 'Not set';
function EscalationMix({ issues }: { issues: IssueRecord[] }) {
  const [group, setGroup] = useState<'priority' | 'sourceType' | 'owner'>('priority');
  const counts = new Map<string, number>();
  issues.forEach(issue => {
    const label = issue[group] || 'Not assigned';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const rows = [...counts].sort((a, b) => b[1] - a[1]);
  const colours = ['#e5484d', '#f59e0b', '#3b82f6', '#14b8a6', '#8b5cf6'];
  const colour = (label: string, index: number) => group === 'priority'
    ? ({ Critical: '#e5484d', High: '#f59e0b', Medium: '#3b82f6', Low: '#14b8a6' }[label] || colours[index % colours.length])
    : colours[index % colours.length];
  const segments = rows.map(([label, count], index) => {
    const start = rows.slice(0, index).reduce((total, [, value]) => total + value, 0) / issues.length * 100;
    const end = start + count / issues.length * 100;
    return `${colour(label, index)} ${start}% ${end}%`;
  });
  return <section aria-label="Escalation distribution">
    <p>Current queue breakdown. Select a grouping to review concentration.</p>
    <div className="rdMixChoices" role="group" aria-label="Group escalation mix">
      {([['priority', 'By priority'], ['sourceType', 'By source'], ['owner', 'By owner']] as const).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={group === value} onClick={() => setGroup(value)}>{label}</button>)}
    </div>
    {issues.length ? <div className="rdMixBody">
      <div className="rdMixRing" aria-hidden="true" style={{ background: `conic-gradient(${segments.join(',')})` }}><span><strong>{issues.length}</strong>Total</span></div>
      <ul className="rdMixLegend" aria-label="Escalation counts and percentages">{rows.map(([label, count], index) =>
        <li key={label}><i aria-hidden="true" style={{ backgroundColor: colour(label, index) }} /><span>{label}</span><strong>{count}</strong><small>{count / issues.length < 0.01 ? '<1' : Math.round(count / issues.length * 100)}%</small></li>)}</ul>
    </div> : <p>No escalation items in this workspace.</p>}
  </section>;
}
export function RiskOperationalQueue({kind,issues,onIssue}: Props) {
  const [search,setSearch] = useState('');
  const [source,setSource] = useState('all');
  const [priority,setPriority] = useState('all');
  const [status,setStatus] = useState('all');
  const [pageSize,setPageSize] = useState(10);
  const [page,setPage] = useState(1);
  const [asOf] = useState(() => Date.now());
  const filtered = issues.filter(issue => (source === 'all' || source === issue.sourceType) && (priority === 'all' || priority === issue.priority) && (status === 'all' || status === issue.status) && [issue.id,issue.linkedRiskRef || '',issue.title,issue.owner,issue.domain].some(value => value.toLowerCase().includes(search.trim().toLowerCase())));
  const pages = Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage = Math.min(page,pages);
  const visible = filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const days = (issue:IssueRecord) => overdueDays(issue.dueDate, asOf);
  const ageBands = overdueAgeBands;
  const sources = [...new Set(issues.map(issue => issue.sourceType))];
  return <div className="rdWorkspace">
    <section className="rdMetrics" aria-label={`${kind} summary`}>{[
      [kind === 'overdue' ? 'Overdue items' : 'Escalation items',issues.length],['Critical priority',issues.filter(issue => issue.priority === 'Critical').length],['High priority',issues.filter(issue => issue.priority === 'High').length],['Owners',new Set(issues.map(issue => issue.owner).filter(Boolean)).size],['Sources',sources.length],
    ].map(([name,value]) => <article key={name}><span>{name}</span><strong>{value}</strong><small>Current queue scope</small></article>)}</section>
    <section className="rdToolbar" aria-label={`${kind} filters`}><input type="search" aria-label={`Search ${kind}`} placeholder="Search issue, owner or domain" value={search} onChange={event => {setSearch(event.target.value);setPage(1);}}/><select aria-label="Queue source" value={source} onChange={event => {setSource(event.target.value);setPage(1);}}><option value="all">All sources</option>{sources.map(value => <option key={value}>{value}</option>)}</select><select aria-label="Queue priority" value={priority} onChange={event => {setPriority(event.target.value);setPage(1);}}><option value="all">All priorities</option>{['Critical','High','Medium','Low'].map(value => <option key={value}>{value}</option>)}</select><select aria-label="Queue status" value={status} onChange={event => {setStatus(event.target.value);setPage(1);}}><option value="all">All statuses</option>{['Open','In Progress','Pending','Resolved'].map(value => <option key={value}>{value}</option>)}</select><Button variant="ghost" onClick={() => {setSearch('');setSource('all');setPriority('all');setStatus('all');setPage(1);}}>Clear filters</Button></section>
    <div className="rdSplit rdSplit--selected"><section className="rdCard"><header><div><h2>{kind === 'overdue' ? 'Overdue Operational Items' : 'Immediate Escalation Queue'}</h2><p>{filtered.length} matching issues. Open an issue to review its owner and linked source context.</p></div></header><div className="rdTableScroll" role="region" aria-label={`${kind} issue table`} tabIndex={0}><table><thead><tr>{['Issue / ID','Owner','Source','Due date',kind === 'overdue' ? 'Days overdue' : 'Priority','Status'].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>{visible.map(issue => <tr key={issue.id}><th scope="row"><button type="button" className="rdTextButton" onClick={() => onIssue(issue)}>{issue.title}</button><small className="rdReference">{issue.linkedRiskRef || issue.id}</small></th><td>{issue.owner || 'Not assigned'}</td><td>{issue.sourceType}</td><td>{date(issue.dueDate)}</td><td>{kind === 'overdue' ? days(issue) ?? 'Not available' : <Badge variant={issue.priority === 'Critical' ? 'danger' : 'warning'}>{issue.priority}</Badge>}</td><td><Badge variant={issue.status === 'Resolved' ? 'success' : 'default'}>{issue.status}</Badge></td></tr>)}</tbody></table></div>{!visible.length && <p>No issues match this queue and its filters.</p>}<footer className="rdQueuePagination"><label>Rows per page <select aria-label="Queue rows per page" value={pageSize} onChange={event => {setPageSize(Number(event.target.value));setPage(1);}}>{[5,10,25,50].map(value => <option key={value} value={value}>{value}</option>)}</select></label><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</Button><span role="status">Page {currentPage} of {pages} · {filtered.length} items</span><Button variant="outline" disabled={currentPage === pages} onClick={() => setPage(currentPage+1)}>Next</Button></footer></section>
      <aside className="rdCard"><header><h2>{kind === 'overdue' ? 'Remediation Focus' : 'Escalation Mix'}</h2></header>
        {kind === 'overdue' ? <><h3>Overdue by Age</h3><dl className="rdFacts">{ageBands.map(band => <div key={band.label}><dt>{band.label}</dt><dd>{issues.filter(issue => {const age=days(issue);return age !== null && age >= band.min && age <= band.max;}).length}</dd></div>)}</dl><h3>Common Blockers</h3><p>Blocker reasons are not captured by the derived issue model. Review each source record before assigning a cause.</p></> : null}
        {kind === 'escalations' && <EscalationMix issues={issues} />}
        <h3>{kind === 'overdue' ? 'Recommended Actions' : 'Escalation Guidance'}</h3><ol className="rdGuidance"><li>Confirm the accountable owner and source record.</li><li>Review critical exposure and overdue commitments first.</li><li>Agree a revised due date or treatment through the source workflow.</li><li>Record evidence and obtain the required review before closure.</li></ol><p className="rdNote">This queue is derived from linked records. Reviewing an item does not automatically escalate, resolve or change its risk score.</p>
      </aside></div>
  </div>;
}
