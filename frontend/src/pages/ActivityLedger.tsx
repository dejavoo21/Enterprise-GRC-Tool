import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Modal } from '../components';
import { summarizeAdminEvents } from '../lib/adminWorkspace';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatActivityAction, formatActivityTimestamp } from '../lib/activityLedgerUtils';
import { listActivities, exportActivities } from '../services/activityLedger/activityLedger';
import type { ActivityLedgerEntry, ActivityLedgerFilters, ActivityLedgerSummary } from '../types/activityLedger';
import { AdminCard, AdminHero, AdminMetrics, AdminNotice, AdminOverlay } from './admin/AdminPrimitives';
import { AdminEventDistribution, AdminEventTrend } from './admin/AdminEventCharts';

const categories = ['audit','ai','risk','control','evidence','issue','vendor','asset','policy','training','report','resilience','regulatory','user','rbac','auth','workspace','framework','system'] as const;
const initialFilters: ActivityLedgerFilters = { limit: 100, category: '', severity: '', outcome: '' };
const stringify = (value: unknown) => value == null ? 'Not recorded' : JSON.stringify(value, null, 2);
const outcomeTone = (outcome: string) => outcome === 'success' ? 'success' : outcome === 'pending' ? 'warning' : 'danger';

export function ActivityLedger() {
  const { workspaceId } = useWorkspace();
  return <ActivityLedgerContent key={workspaceId} />;
}
function ActivityLedgerContent() {
  const { activeWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<ActivityLedgerEntry[]>([]);
  const [summary, setSummary] = useState<ActivityLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullDetails, setFullDetails] = useState(false);
  const [filters, setFilters] = useState<ActivityLedgerFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<ActivityLedgerFilters>(initialFilters);
  const [revision, setRevision] = useState(0);
  const selected = entries.find(entry => entry.id === selectedId) || null;
  useEffect(() => {
    let cancelled = false;
    listActivities(filters, { requireRemote: true }).then(result => { if (!cancelled) { setEntries(result.entries); setSelectedId(current => current && result.entries.some(entry => entry.id === current) ? current : result.entries[0]?.id || null); setSummary(result.summary); setLoading(false); } })
      .catch(err => { if (!cancelled) { setEntries([]); setSummary(null); setSelectedId(null); setFullDetails(false); setError(err instanceof Error ? err.message : 'Activity could not be loaded.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [filters, revision]);
  const refresh = () => { setLoading(true); setError(null); setRevision(value => value + 1); };
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (draftFilters.dateFrom && draftFilters.dateTo && draftFilters.dateFrom > draftFilters.dateTo) { setError('The start date must be before the end date.'); return; }
    setEntries([]); setSummary(null); setSelectedId(null); setFullDetails(false); setError(null); setLoading(true); setFilters({ ...draftFilters });
  };
  const exportLedger = async () => {
    setExporting(true); setError(null);
    try {
      const payload = await exportActivities(filters, { requireRemote: true });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `enterprise-activity-ledger-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to export the ledger.'); }
    finally { setExporting(false); }
  };
  const byType = useMemo(() => Object.entries(entries.reduce<Record<string,number>>((counts, entry) => { counts[entry.category] = (counts[entry.category] || 0) + 1; return counts; }, {})).sort((a,b) => b[1]-a[1]), [entries]);
  const byDay = useMemo(() => Object.entries(entries.reduce<Record<string,number>>((counts, entry) => { const day = entry.timestamp.slice(0,10); counts[day] = (counts[day] || 0) + 1; return counts; }, {})).sort((a,b) => a[0].localeCompare(b[0])).slice(-7), [entries]);
  const metric = (count: number) => loading ? 'Loading' : error && !summary ? 'Unavailable' : count;
  const eventMetrics = summarizeAdminEvents(entries, new Date());
  return <div className="adminPage">
    <AdminHero title="Enterprise Activity Ledger" description="Unified event history across operational activity, access governance, and platform security." action={<Button variant="outline" disabled={exporting || loading} onClick={() => void exportLedger()}>{exporting ? 'Exporting...' : 'Export JSON'}</Button>} />
    <AdminMetrics metrics={[
      { label: 'Events Today', value: metric(eventMetrics.today), detail: 'Loaded events, UTC today' },
      { label: 'Permission Denials', value: metric(eventMetrics.permissionDenials), detail: 'Recorded permission/access denials', tone: 'danger' },
      { label: 'Access Changes', value: metric(eventMetrics.accessChanges), detail: 'Loaded user and RBAC events', tone: 'warning' },
      { label: 'High Priority', value: metric(eventMetrics.highPriority), detail: 'Loaded high / critical events', tone: 'danger' },
    ]} />
    {error && <AdminNotice error>{error}</AdminNotice>}
    <AdminCard title="Activity Filters" description={`Workspace scope: ${activeWorkspace?.displayName || activeWorkspace?.name || 'Not selected'}. Metrics and charts reflect up to 100 loaded events.`}>
      <form onSubmit={apply}><div className="adminToolbar">
        <label>Action<input type="search" value={draftFilters.action || ''} onChange={event => setDraftFilters({ ...draftFilters, action: event.target.value })} placeholder="Search actions" /></label>
        <label>Actor<input type="search" value={draftFilters.actor || ''} onChange={event => setDraftFilters({ ...draftFilters, actor: event.target.value })} placeholder="Actor name" /></label>
        <label>Category<select value={draftFilters.category} onChange={event => setDraftFilters({ ...draftFilters, category: event.target.value as ActivityLedgerFilters['category'] })}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Severity<select value={draftFilters.severity} onChange={event => setDraftFilters({ ...draftFilters, severity: event.target.value as ActivityLedgerFilters['severity'] })}><option value="">All severities</option>{['info','low','medium','high','critical'].map(severity => <option key={severity}>{severity}</option>)}</select></label>
        <label>Outcome<select value={draftFilters.outcome} onChange={event => setDraftFilters({ ...draftFilters, outcome: event.target.value as ActivityLedgerFilters['outcome'] })}><option value="">All outcomes</option>{['success','failed','blocked','pending'].map(outcome => <option key={outcome}>{outcome}</option>)}</select></label>
      </div><div className="adminToolbar"><label>From date<input type="date" value={draftFilters.dateFrom || ''} onChange={event => setDraftFilters({ ...draftFilters, dateFrom: event.target.value })} /></label><label>To date<input type="date" value={draftFilters.dateTo?.slice(0,10) || ''} onChange={event => setDraftFilters({ ...draftFilters, dateTo: event.target.value ? `${event.target.value}T23:59:59.999Z` : '' })} /></label>
        <Button type="submit" disabled={loading}>Apply Filters</Button><Button type="button" variant="outline" onClick={() => { setDraftFilters(initialFilters); setFilters({ ...initialFilters }); setSelectedId(null); setError(null); setLoading(true); }}>Reset Filters</Button><Button type="button" variant="outline" disabled={loading} onClick={refresh}>Refresh</Button>
      </div></form>
    </AdminCard>
    <div className={selected ? 'adminSplit' : 'adminStack'}>
      <AdminCard title="Activity Table" description="Select an event for its recorded context and investigation details." action={<Badge size="sm">{loading ? 'Loading' : `${entries.length} events`}</Badge>}>
        <div className="adminTableScroll" role="region" aria-label="Activity ledger events" tabIndex={0} aria-busy={loading}><table className="adminTable"><thead><tr>{['Timestamp','Actor','Action / Target','Category','Outcome','Severity'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{entries.map(entry => <tr key={entry.id} data-selected={selected?.id === entry.id}>
          <td>{formatActivityTimestamp(entry.timestamp)}</td><td>{entry.actorName || 'System'}</td><td><button className="adminRowAction" aria-label={`Inspect ${formatActivityAction(entry.action)} at ${formatActivityTimestamp(entry.timestamp)}`} onClick={() => setSelectedId(entry.id)}>{formatActivityAction(entry.action)}</button><div className="adminHelp">{entry.targetName || entry.targetType}</div></td><td>{entry.category}</td><td><Badge size="sm" variant={outcomeTone(entry.outcome)}>{entry.outcome}</Badge></td><td><Badge size="sm" variant={['high','critical'].includes(entry.severity) ? 'danger' : entry.severity === 'medium' ? 'warning' : 'default'}>{entry.severity}</Badge></td>
        </tr>)}{!entries.length && <tr><td colSpan={6} className="adminEmpty">{loading ? 'Loading activity...' : error ? 'Activity is unavailable.' : 'No recorded events match these filters.'}</td></tr>}</tbody></table></div>
        <p className="adminHelp">{summary ? `${summary.totalEvents} filtered events across available ledger sources; ${entries.length} shown. ${summary.authSecurityEvents} authentication/security events; ${summary.changesThisWeek} changes this week.` : error ? 'Activity data is unavailable. Retry using Refresh.' : 'Waiting for activity data.'}</p>
      </AdminCard>
      {selected && <AdminCard title="Event Detail" description={formatActivityAction(selected.action)} action={<Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Close</Button>}>
        <div className="adminRowButtons"><Badge size="sm" variant={outcomeTone(selected.outcome)}>{selected.outcome}</Badge><Badge size="sm">{selected.severity}</Badge></div>
        <dl className="adminDetailGrid">{Object.entries({ Actor: selected.actorName, Role: selected.actorRole, Category: selected.category, Target: selected.targetName || selected.targetType, Source: selected.source, Timestamp: formatActivityTimestamp(selected.timestamp), Workspace: selected.workspaceId, 'Correlation ID': selected.correlationId }).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
        <h3>Recorded reason</h3><p className="adminHelp">{selected.notes || 'No reason or notes recorded for this event.'}</p>
        <div className="adminFooterActions"><Button size="sm" onClick={() => setFullDetails(true)}>View full event details</Button></div>
      </AdminCard>}
    </div>
    <div className="adminGridTwo">
      <AdminCard title="Events by Type" description="Category distribution within the loaded events."><AdminEventDistribution values={byType} /></AdminCard>
      <AdminCard title="Daily Event Trend" description="Last seven recorded dates in the loaded results; not a complete historical trend."><AdminEventTrend values={byDay} /></AdminCard>
    </div>
    <AdminOverlay><Modal accessibleDialog isOpen={fullDetails && Boolean(selected)} onClose={() => setFullDetails(false)} title="Full event details" width="680px" footer={<Button variant="outline" onClick={() => setFullDetails(false)}>Close</Button>}>
      {selected && <div className="adminStack"><dl className="adminDetailGrid">{Object.entries({ Actor: selected.actorName, Role: selected.actorRole, Target: selected.targetName || selected.targetType, 'Target ID': selected.targetId, Source: selected.source, 'Correlation ID': selected.correlationId, 'IP address': selected.ipAddress, Device: selected.device, 'User agent': selected.userAgent, Location: selected.location, Timestamp: formatActivityTimestamp(selected.timestamp) }).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl><h3>Previous Value</h3><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{stringify(selected.previousValue)}</pre><h3>New Value</h3><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{stringify(selected.newValue)}</pre><h3>Notes</h3><p>{selected.notes || 'No notes recorded.'}</p></div>}
    </Modal></AdminOverlay>
  </div>;
}
