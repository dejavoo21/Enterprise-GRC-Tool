import { useEffect, useRef, useState } from 'react';
import { Button } from '../components';
import { apiCall, API_BASE } from '../lib/api';
import { RiskReportPreview } from './RiskReportPreview';

interface Report { id:string;title:string;report_type:string;status:string;revision:number;prepared_email:string;created_at:string;pack?:unknown;events?:{action:string;actor_email:string;comment:string;created_at:string}[] }
export function RiskReportHistory({ refreshKey }: { refreshKey: string }) {
  const [history,setHistory]=useState<{items:Report[];total:number}>({items:[],total:0});
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Report|null>(null);
  const [comment,setComment]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const [format,setFormat]=useState('pdf');
  const request=useRef(0);
  useEffect(()=>{let active=true;apiCall<{data:typeof history}>(`${API_BASE}/risk-intelligence/reports/history?page=${page}`).then(result=>{if(active){setHistory(result.data);setError('');}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'History unavailable.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[page,refreshKey,revision]);
  useEffect(()=>()=>{request.current++;},[]);
  async function open(id:string){const current=++request.current;setBusy(true);setError('');try{const result=await apiCall<{data:Report}>(`${API_BASE}/risk-intelligence/reports/history/${encodeURIComponent(id)}`);if(current===request.current){setSelected(result.data);setComment('');}}catch(e){if(current===request.current)setError(e instanceof Error?e.message:'Report unavailable.');}finally{if(current===request.current)setBusy(false);}}
  async function transition(action:string){if(!selected)return;const current=++request.current;setBusy(true);setError('');try{const result=await apiCall<{data:Report}>(`${API_BASE}/risk-intelligence/reports/history/${selected.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:selected.revision,comment})});if(current===request.current){setSelected(result.data);setComment('');setRevision(value=>value+1);}}catch(e){if(current===request.current)setError(e instanceof Error?e.message:'Workflow update failed.');}finally{if(current===request.current)setBusy(false);}}
  async function download(){if(!selected)return;const current=++request.current;setBusy(true);setError('');try{const {data}=await apiCall<{data:{base64:string;filename:string;contentType:string}}>(`${API_BASE}/risk-intelligence/reports/history/${selected.id}/download`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({format})});if(current!==request.current)return;const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))],{type:data.contentType}));const anchor=document.createElement('a');anchor.href=url;anchor.download=data.filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){if(current===request.current)setError(e instanceof Error?e.message:'Download failed.');}finally{if(current===request.current)setBusy(false);}}
  return <section className="rdCard" aria-label="Report archive"><header><div><h2>Recent Reports ({history.total})</h2><p>Saved snapshots retain their original data. Review and approval decisions are recorded separately.</p></div><Button disabled={busy} onClick={()=>{setLoading(true);setRevision(value=>value+1);}}>Refresh history</Button></header>
    {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Loading report history...</p>}
    <div className="rdTableScroll" tabIndex={0} role="region" aria-label="Saved reports"><table><thead><tr>{['Report','Generated','Prepared by','Status','Actions'].map(name=><th scope="col" key={name}>{name}</th>)}</tr></thead><tbody>{history.items.map(report=><tr key={report.id}><th scope="row">{report.title}<small>{report.id}</small></th><td>{new Date(report.created_at).toLocaleString()}</td><td>{report.prepared_email}</td><td>{report.status}</td><td><Button disabled={busy} onClick={()=>void open(report.id)}>Review snapshot</Button></td></tr>)}</tbody></table></div>
    {!loading&&!error&&!history.total&&<p>No archived reports yet. Download or email a report to save a snapshot.</p>}
    <footer className="rrPagination"><Button disabled={page===1||busy} onClick={()=>{setLoading(true);setPage(value=>value-1);}}>Previous reports</Button><span>Page {page} of {Math.max(1,Math.ceil(history.total/20))}</span><Button disabled={page*20>=history.total||busy} onClick={()=>{setLoading(true);setPage(value=>value+1);}}>Next reports</Button></footer>
    {selected&&<section className="rdArchiveDetail" aria-label="Report review"><header><h3>{selected.title} · {selected.status}</h3><Button disabled={busy} onClick={()=>setSelected(null)}>Close review</Button></header><p>{selected.id} · Revision {selected.revision}. A new export creates a separate draft; it never changes this snapshot.</p>
      <details><summary>Inspect saved report</summary><RiskReportPreview json={JSON.stringify(selected.pack)} reviewStatus={selected.status}/></details>
      <div className="rdToolbar"><label>Archived format<select aria-label="Archived report format" value={format} onChange={event=>setFormat(event.target.value)}><option value="pdf">PDF</option><option value="csv">CSV</option><option value="json">JSON</option></select></label><Button disabled={busy} onClick={()=>void download()}>Download saved snapshot</Button></div>
      {!['approved','rejected'].includes(selected.status)&&<><label>Review comment<textarea aria-label="Report review comment" value={comment} maxLength={2000} onChange={event=>setComment(event.target.value)}/></label><p>Reviewers cannot be the preparer. Final approval requires a different authorised user from both preparer and reviewer.</p><div className="rdArchiveActions">{(selected.status==='draft'?['submit']:selected.status==='submitted'?['review','reject']:['approve','reject']).map(action=><Button key={action} disabled={busy||comment.trim().length<3} onClick={()=>void transition(action)}>{action==='submit'?'Submit for review':action==='review'?'Record review':action==='approve'?'Approve report':'Reject report'}</Button>)}</div></>}
      <h4>Decision trail</h4><ul className="rdList">{selected.events?.map((event,index)=><li key={index}><strong>{event.action} · {event.actor_email}</strong><span>{new Date(event.created_at).toLocaleString()}</span><p>{event.comment}</p></li>)}</ul>
    </section>}
  </section>;
}
