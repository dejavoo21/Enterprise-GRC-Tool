import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { fetchActivityLedger } from '../lib/api';
import type { ActivityLedgerEntry } from '../types/activityLedger';

export function RiskOperationalActivity() {
  const {currentWorkspace} = useWorkspace();
  return <WorkspaceActivity key={currentWorkspace.id} workspaceId={currentWorkspace.id}/>;
}

function WorkspaceActivity({workspaceId}: {workspaceId:string}) {
  const navigate = useNavigate();
  const [entries,setEntries] = useState<ActivityLedgerEntry[]>([]);
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    void Promise.all([fetchActivityLedger({category:'issue',limit:8}),fetchActivityLedger({category:'risk',limit:8})]).then(results => {
      if(!current) return;
      const unique = new Map(results.flatMap(result=>result.entries).filter(entry=>entry.workspaceId===workspaceId).map(entry=>[entry.id,entry]));
      setEntries([...unique.values()].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,5));setLoading(false);
    }).catch(()=>{if(current){setEntries([]);setLoading(false);}});
    return () => {current=false;};
  },[workspaceId]);
  return <section className="roCard" aria-labelledby="ro-activity-title"><header className="roSplitHeader"><div><h2 id="ro-activity-title">Recent Operational Activity</h2><p>Recorded risk and issue activity in this workspace.</p></div><button type="button" className="roTextAction" onClick={()=>navigate('/activity-log')}>View activity ledger</button></header>{loading ? <p role="status">Loading activity...</p> : entries.length ? <div className="roActivityScroll" role="region" aria-label="Recent operational activity entries" tabIndex={0}><ul className="rdList">{entries.map(entry=><li key={entry.id}><strong>{entry.action.replaceAll('_',' ')}</strong><span>{entry.targetName || entry.targetId || 'Target not recorded'} · {entry.actorName}</span><small>{new Date(entry.timestamp).toLocaleString()} · {entry.outcome}</small></li>)}</ul></div> : <p>No recent operational activity is available from the ledger. No example events are shown.</p>}</section>;
}
