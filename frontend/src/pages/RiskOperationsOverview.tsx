import { Badge } from '../components/Badge';
import { RiskIcon, AlertCircleIcon, ClockIcon, FrameworkIcon, ReportsIcon } from '../components/icons';
import type { IssueRecord } from '../types/issues';
import { RiskOperationalActivity } from './RiskOperationalActivity';

type Tab = 'overview' | 'queue' | 'escalations' | 'overdue' | 'reports';
type Count = { label: string; value: number };
type Props = {
  metrics: (Count & { detail: string })[];
  domains: Count[];
  statuses: Count[];
  total: number;
  escalations: IssueRecord[];
  overdueCount: number;
  openCount: number;
  onTab: (tab: Tab) => void;
  onIssue: (issue: IssueRecord) => void;
  formatDate: (value?: string) => string;
};
const icons = [RiskIcon, AlertCircleIcon, ClockIcon, FrameworkIcon];
const destinations: Tab[] = ['queue', 'escalations', 'overdue', 'reports'];

export function RiskOperationsOverview({ metrics, domains, statuses, total, escalations, overdueCount, openCount, onTab, onIssue, formatDate }: Props) {
  return <>
    <section className="roMetrics" aria-label="Operational summary">
      {metrics.map((metric, index) => {
        const Icon = icons[index];
        return <button type="button" className={`roMetric roAccent-${index}`} key={metric.label} onClick={() => onTab(destinations[index])}>
          <span className="roIcon" aria-hidden="true"><Icon size={23} /></span>
          <span className="roMetricText"><span>{metric.label}</span><strong>{metric.value.toLocaleString()}</strong><small>{metric.detail}</small></span>
          <span className="roArrow" aria-hidden="true">&rsaquo;</span>
        </button>;
      })}
    </section>
    <div className="roCommandGrid">
      <section className="roCard roDomains" aria-labelledby="ro-domains-title">
        <header><h2 id="ro-domains-title">Issues by Operational Domain</h2><p>Current concentration across live issue sources.</p></header>
        <div className="roDomainList">{domains.length ? domains.map(domain => <div className="roDomain" key={domain.label}>
          <div><span>{domain.label}</span><strong>{domain.value.toLocaleString()}</strong><small>{total && domain.value > 0 ? domain.value / total < 0.01 ? '<1%' : `${Math.round(domain.value / total * 100)}%` : '0%'}</small></div>
          <progress value={domain.value} max={Math.max(total, 1)} aria-label={`${domain.label}: ${domain.value} of ${total} issues`} />
        </div>) : <p>No operational domains available.</p>}</div>
        <button className="roTextAction" type="button" onClick={() => onTab('queue')}>Open issue queue <span aria-hidden="true">&rarr;</span></button>
      </section>
      <section className="roCard roEscalations" aria-labelledby="ro-escalations-title">
        <header className="roSplitHeader"><div><h2 id="ro-escalations-title">Immediate Escalation Queue</h2><p>Highest-priority open issues requiring follow-up.</p></div>
          <button type="button" className="roTextAction" onClick={() => onTab('escalations')}>View queue ({escalations.length.toLocaleString()})</button>
        </header>
        {escalations.length ? <div className="roQueueScroll" tabIndex={0} role="region" aria-label="Immediate escalation queue, scroll for all columns">
          <table><thead><tr>{['Issue / Source', 'Owner', 'Due Date', 'Priority / Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{escalations.slice(0, 5).map(issue => <tr key={issue.id}>
              <td><button className="roIssueLink" type="button" onClick={() => onIssue(issue)}>{issue.title}</button><small>{issue.linkedRiskRef && `${issue.linkedRiskRef} / `}{issue.domain} / {issue.sourceType}</small></td>
              <td>{issue.owner}</td><td className={issue.isOverdue ? 'riskOperationsOverdueText' : ''}>{formatDate(issue.dueDate)}</td>
              <td><div className="roQueueBadges"><Badge variant={issue.priority === 'Critical' ? 'danger' : 'warning'}>{issue.priority}</Badge><Badge variant={issue.status === 'Open' ? 'danger' : 'info'}>{issue.status}</Badge></div></td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="riskOperationsInlineEmpty">No critical or high-priority escalations are open.</p>}
      </section>
      <section className="roCard roFocus" aria-labelledby="ro-focus-title">
        <header><h2 id="ro-focus-title">Operational Focus</h2><p>Direct access to queues requiring attention.</p></header>
        <div className="roFocusActions">
          <button type="button" onClick={() => onTab('queue')}><ReportsIcon /><span>Review issue queue<small>{openCount.toLocaleString()} open issue signals</small></span><span aria-hidden="true">&rsaquo;</span></button>
          <button type="button" onClick={() => onTab('overdue')}><ClockIcon /><span>Review overdue items<small>{overdueCount.toLocaleString()} past-due items</small></span><span aria-hidden="true">&rsaquo;</span></button>
          <button type="button" onClick={() => onTab('escalations')}><AlertCircleIcon /><span>Review escalations<small>{escalations.length.toLocaleString()} priority items</small></span><span aria-hidden="true">&rsaquo;</span></button>
        </div>
      </section>
    </div>
    <div className="roLowerGrid">
      <section className="roCard" aria-labelledby="ro-health-title"><header><h2 id="ro-health-title">Workflow Health</h2><p>Current status distribution across all issue records.</p></header>
        <dl className="roStatuses">{statuses.map(status => <div key={status.label}><dt>{status.label}</dt><dd>{status.value.toLocaleString()}</dd></div>)}</dl>
      </section>
      <RiskOperationalActivity/>
    </div>
  </>;
}
