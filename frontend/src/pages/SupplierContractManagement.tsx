/* eslint-disable @typescript-eslint/no-explicit-any -- heterogeneous register rows are narrowed by the active module mode. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '../lib/api';
import type { Vendor, VendorStatus } from '../types/vendor';
import type { ContractStatus, VendorContract, VendorRiskAssessment, VendorAssessmentStatus } from '../types/tprm';
import { RelationshipExplorer } from '../components/RelationshipExplorer';
import { Modal } from '../components/Modal';
import './SupplierContractManagement.css';

type Mode='suppliers'|'assessments'|'contracts';
type Api<T>={data:T;error:null|{message:string}|string};
type LifecycleEvent={id:string;previousStatus?:string;newStatus:string;decision?:string;reason?:string;changedAt:string};
const labels:Record<Mode,string>={suppliers:'Supplier Register',assessments:'Due Diligence',contracts:'Contracts'};
const nextSupplier:Partial<Record<VendorStatus,VendorStatus[]>>={onboarding:['pending_approval'],pending_approval:['active','onboarding'],active:['suspended','offboarded'],suspended:['active','offboarded'],offboarded:['archived']};
const nextAssessment:Partial<Record<VendorAssessmentStatus,VendorAssessmentStatus[]>>={draft:['in_progress'],not_started:['in_progress'],in_progress:['submitted'],pending_review:['under_review'],submitted:['under_review'],under_review:['approved','approved_with_conditions','rejected'],completed:['expired'],approved:['expired'],approved_with_conditions:['expired'],rejected:['in_progress'],expired:['in_progress']};
const nextContract:Partial<Record<ContractStatus,ContractStatus[]>>={draft:['under_review','archived'],pending_review:['approved','draft','terminated'],under_review:['approved','draft','terminated'],approved:['active','terminated'],active:['renewal_due','expired','terminated'],renewal_due:['under_review','expired','terminated'],expired:['under_review','terminated','archived'],terminated:['archived']};
const clean=(value:string)=>value.replace(/_/g,' ');
const tone=(value:string)=>['active','approved','completed'].includes(value)?'good':['critical','high','rejected','expired','terminated','overdue'].includes(value)?'danger':'warn';
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'The operation could not be completed.';

export function SupplierContractManagement({initialMode='suppliers',onNavigate}:{initialMode?:Mode;onNavigate?:(key:string)=>void}){
 const [mode,setMode]=useState<Mode>(initialMode);const [vendors,setVendors]=useState<Vendor[]>([]);const [assessments,setAssessments]=useState<VendorRiskAssessment[]>([]);const [contracts,setContracts]=useState<VendorContract[]>([]);const [selected,setSelected]=useState<Vendor|VendorRiskAssessment|VendorContract|null>(null);const [history,setHistory]=useState<LifecycleEvent[]>([]);const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [form,setForm]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const selectedTriggerRef=useRef<HTMLElement|null>(null);
 const load=useCallback(async()=>{setError('');try{const [v,a,c]=await Promise.all([apiCall<Api<Vendor[]>>('/api/v1/vendors'),apiCall<Api<VendorRiskAssessment[]>>('/api/v1/tprm/assessments'),apiCall<Api<VendorContract[]>>('/api/v1/tprm/contracts')]);setVendors(v.data||[]);setAssessments(a.data||[]);setContracts(c.data||[]);}catch(e){setError(errorMessage(e));}},[]);
 useEffect(()=>{void load();},[load]);useEffect(()=>{setMode(initialMode);setSelected(null);},[initialMode]);
 useEffect(()=>{if(!selected){setHistory([]);return;}const endpoint=mode==='suppliers'?`/api/v1/vendors/${selected.id}/history`:mode==='assessments'?`/api/v1/tprm/assessments/${selected.id}/history`:`/api/v1/tprm/contracts/${selected.id}/history`;void apiCall<Api<LifecycleEvent[]>>(endpoint).then(response=>setHistory(response.data||[])).catch(()=>setHistory([]));},[mode,selected]);
 const rows=mode==='suppliers'?vendors:mode==='assessments'?assessments:contracts;
 const filtered=useMemo(()=>rows.filter((row:any)=>{const text=JSON.stringify(row).toLowerCase();return(!search||text.includes(search.toLowerCase()))&&(!status||row.status===status);}),[rows,search,status]);
 const metrics=useMemo(()=>({suppliers:vendors.length,active:vendors.filter(v=>v.status==='active').length,critical:vendors.filter(v=>v.riskLevel==='critical').length,pending:vendors.filter(v=>v.status==='pending_approval').length,overdue:assessments.filter(a=>a.dueDate&&new Date(a.dueDate)<new Date()&&!['approved','rejected'].includes(a.status)).length,renewals:contracts.filter(c=>c.status==='renewal_due'||(c.expirationDate&&new Date(c.expirationDate).getTime()-Date.now()<60*86400000)).length}),[vendors,assessments,contracts]);
 const selectRecord=(record:Vendor|VendorRiskAssessment|VendorContract,target:HTMLElement)=>{selectedTriggerRef.current=target;setSelected(record);};
 const closeSelection=()=>{if(busy)return;setSelected(null);requestAnimationFrame(()=>selectedTriggerRef.current?.focus());};
 const transition=async(next:string)=>{if(!selected||busy)return;setBusy(true);setError('');try{const endpoint=mode==='suppliers'?`/api/v1/vendors/${selected.id}/transition`:mode==='assessments'?`/api/v1/tprm/assessments/${selected.id}/transition`:`/api/v1/tprm/contracts/${selected.id}/transition`;await apiCall(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next,reason:'Recorded through Supplier and Contract Management'})});setSelected(null);requestAnimationFrame(()=>selectedTriggerRef.current?.focus());await load();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}};
 return <div className="supplierOps"><header className="supplierHero"><div><h1>Supplier & Contract Intelligence</h1><p>Govern onboarding, due diligence, supplier risk, contractual obligations, renewal and offboarding from persisted workspace records.</p></div><button className="supplierButton primary" onClick={()=>setForm(true)}>New {mode==='suppliers'?'supplier':mode==='assessments'?'assessment':'contract'}</button></header>
 <nav className="supplierTabs">{(['suppliers','assessments','contracts'] as Mode[]).map(tab=><button key={tab} className={mode===tab?'active':''} onClick={()=>{setMode(tab);setSelected(null);setStatus('');}}>{labels[tab]}</button>)}</nav>
 <section className="supplierMetrics">{[['Suppliers',metrics.suppliers],['Active',metrics.active],['Critical',metrics.critical],['Pending approval',metrics.pending],['Overdue reviews',metrics.overdue],['Renewal attention',metrics.renewals]].map(([label,value])=><div className="supplierMetric" key={label}><span>{label}</span><strong>{value}</strong><span>Persisted source records</span></div>)}</section>
 {error&&<div className="supplierError">{error}</div>}<div className="supplierToolbar"><input aria-label="Search supplier management" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${labels[mode].toLowerCase()}...`}/><select aria-label="Filter by status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{Array.from(new Set(rows.map((r:any)=>r.status))).map(value=><option key={value}>{value}</option>)}</select><button className="supplierButton" onClick={()=>{setSearch('');setStatus('');}}>Clear filters</button></div>
 <div className="supplierGrid"><section className="supplierTableCard">{filtered.length?<table><thead><tr>{mode==='suppliers'?<><th>Supplier ID</th><th>Supplier</th><th>Service</th><th>Owner</th><th>Risk</th><th>Status</th><th>Next review</th></>:mode==='assessments'?<><th>Supplier</th><th>Type</th><th>Assessor</th><th>Residual risk</th><th>Status</th><th>Due</th></>:<><th>Contract ID</th><th>Contract</th><th>Supplier</th><th>Owner</th><th>Status</th><th>Expiry</th></>}</tr></thead><tbody>{filtered.map((row:any)=><tr key={row.id} tabIndex={0} className={selected?.id===row.id?'selected':''} onClick={event=>selectRecord(row,event.currentTarget)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRecord(row,event.currentTarget);}}}>{mode==='suppliers'?<><td>{row.supplierRef||row.id.slice(0,8)}</td><td><strong>{row.name}</strong><br/><small>{row.category}</small></td><td>{row.businessService||'Not recorded'}</td><td>{row.owner}</td><td><span className={`supplierBadge ${tone(row.riskLevel)}`}>{row.riskLevel}</span></td><td><span className={`supplierBadge ${tone(row.status)}`}>{clean(row.status)}</span></td><td>{row.nextReviewDate?.slice(0,10)||'Not scheduled'}</td></>:mode==='assessments'?<><td><strong>{row.vendorName||row.vendorId}</strong></td><td>{clean(row.assessmentType)}</td><td>{row.assessorName||'Unassigned'}</td><td>{row.residualRiskScore??'Not scored'}</td><td><span className={`supplierBadge ${tone(row.status)}`}>{clean(row.status)}</span></td><td>{row.dueDate||'Not set'}</td></>:<><td>{row.contractRef||row.id.slice(0,8)}</td><td><strong>{row.contractName}</strong><br/><small>{clean(row.contractType)}</small></td><td>{row.vendorName||row.vendorId}</td><td>{row.contractOwner||row.ownerName||'Unassigned'}</td><td><span className={`supplierBadge ${tone(row.status)}`}>{clean(row.status)}</span></td><td>{row.expirationDate||'Not set'}</td></>}</tr>)}</tbody></table>:<div className="supplierEmpty">No persisted records match the selected filters.</div>}</section>
 {selected?<Detail mode={mode} record={selected as any} history={history} busy={busy} onClose={closeSelection} onEdit={()=>setForm(true)} onTransition={transition}/>:<aside className="supplierDetail supplierEmpty">Select a record to review details and authorised lifecycle actions.</aside>}</div>
 {selected&&mode==='suppliers'?<RelationshipExplorer entityType="supplier" entityId={selected.id} onNavigate={onNavigate}/>:null}
 {form&&<RecordForm mode={mode} vendors={vendors} record={selected as any} onClose={()=>setForm(false)} onSaved={async()=>{setForm(false);setSelected(null);await load();}}/>}</div>;
}

function Detail({mode,record,history,busy,onClose,onEdit,onTransition}:{mode:Mode;record:any;history:LifecycleEvent[];busy:boolean;onClose:()=>void;onEdit:()=>void;onTransition:(value:string)=>Promise<void>}){
 const detailRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{detailRef.current?.focus();},[record.id]);
 const transitions=(mode==='suppliers'?nextSupplier[record.status as VendorStatus]:mode==='assessments'?nextAssessment[record.status as VendorAssessmentStatus]:nextContract[record.status as ContractStatus])||[];
 const fields=mode==='suppliers'?[['Supplier Ref',record.supplierRef],['Business service',record.businessService],['Criticality',record.criticality],['Information access',record.informationAccess],['Due diligence',record.dueDiligenceStatus],['Locations',record.businessLocations?.join(', ')]]:mode==='assessments'?[['Supplier',record.vendorName],['Assessment type',clean(record.assessmentType)],['Inherent risk',record.inherentRiskScore],['Current residual',record.residualRiskScore],['Target risk',record.targetRiskScore],['Evidence references',record.evidenceReferences?.length||0]]:[['Contract Ref',record.contractRef],['Supplier',record.vendorName],['Effective date',record.effectiveDate],['Expiry date',record.expirationDate],['Notice date',record.noticeDate],['Renewal',clean(record.renewalType||'manual')],['Security obligations',record.securityObligations],['Audit rights',record.auditRights]];
 const title=record.name||record.vendorName||record.contractName;
 return <aside ref={detailRef} className="supplierDetail" role="dialog" aria-modal="false" aria-labelledby="supplier-detail-title" aria-busy={busy} tabIndex={-1} onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.stopPropagation();onClose();}}}><button type="button" className="supplierDetailClose" aria-label="Close supplier details" disabled={busy} onClick={onClose}>×</button><h2 id="supplier-detail-title">{title}</h2><p>{mode==='assessments'?'Assessment scores use the enterprise risk methodology; supplier criticality is shown separately.':mode==='contracts'?'Contract metadata and obligations only. No signed document is claimed unless an approved reference exists.':'Workspace-scoped supplier lifecycle and monitoring record.'}</p><div className="supplierDl">{fields.map(([label,value])=><div key={label}><span>{label}</span><strong>{value??'Not recorded'}</strong></div>)}</div>{mode==='assessments'&&<div className="supplierNotice">Evidence references are metadata only. Unreviewed evidence is never treated as approved.</div>}<h3>Lifecycle history</h3>{history.length?<div className="supplierDl">{history.slice(0,5).map(event=><div key={event.id}><span>{new Date(event.changedAt).toLocaleString()}</span><strong>{event.previousStatus?`${clean(event.previousStatus)} to `:''}{clean(event.newStatus)}</strong>{event.reason&&<small>{event.reason}</small>}</div>)}</div>:<p>No lifecycle changes have been recorded yet.</p>}<div className="supplierActions"><button className="supplierButton" disabled={busy} onClick={onEdit}>Edit</button>{transitions.map(next=><button disabled={busy} className={`supplierButton ${['rejected','terminated','offboarded','archived'].includes(next)?'danger':''}`} key={next} onClick={()=>void onTransition(next)}>{busy?'Saving...':clean(next)}</button>)}</div></aside>
}

function RecordForm({ mode, vendors, record, onClose, onSaved }: { mode: Mode; vendors: Vendor[]; record: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<any>({ ...record });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const entityLabel = mode === 'suppliers' ? 'supplier' : mode === 'assessments' ? 'due diligence assessment' : 'contract';
  const requestClose = () => { if (!busy) onClose(); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let url = '/api/v1/vendors';
      const method = record ? 'PATCH' : 'POST';
      let payload = { ...data };
      if (mode === 'suppliers') {
        url = record ? `/api/v1/vendors/${record.id}` : '/api/v1/vendors';
        payload = { ...payload, status: payload.status || 'onboarding', riskLevel: payload.riskLevel || 'medium', nextReviewDate: payload.nextReviewDate || new Date().toISOString().slice(0, 10) };
      } else if (mode === 'assessments') {
        url = record ? `/api/v1/tprm/assessments/${record.id}` : '/api/v1/tprm/assessments';
        payload = { ...payload, assessmentType: payload.assessmentType || 'initial' };
      } else {
        url = record ? `/api/v1/tprm/contracts/${record.id}` : '/api/v1/tprm/contracts';
        payload = { ...payload, contractType: payload.contractType || 'msa', renewalType: payload.renewalType || 'manual', renewalNoticeDays: Number(payload.renewalNoticeDays || 30) };
      }
      await apiCall(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      await onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const field = (name: string, label: string, type = 'text') => {
    const id = `supplier-record-${mode}-${name}`;
    return <label htmlFor={id}>{label}<input id={id} name={name} type={type} value={data[name] || ''} onChange={event => setData({ ...data, [name]: event.target.value })} /></label>;
  };

  return (
    <Modal accessibleDialog isOpen onClose={requestClose} title={`${record ? 'Edit' : 'Create'} ${entityLabel}`} width="760px">
      <form className="supplierForm" onSubmit={save} aria-busy={busy}>
        <fieldset disabled={busy}>
          {error ? <div className="supplierError wide" role="alert">{error}</div> : null}
          {mode === 'suppliers' ? <>
            {field('name', 'Supplier name')}{field('owner', 'Owner')}{field('category', 'Category')}{field('businessService', 'Business service')}{field('criticality', 'Criticality')}{field('informationAccess', 'Information/data access')}{field('nextReviewDate', 'Next review', 'date')}{field('regions', 'Regions')}
          </> : <>
            <label htmlFor={`supplier-record-${mode}-vendorId`}>Supplier<select id={`supplier-record-${mode}-vendorId`} name="vendorId" value={data.vendorId || ''} onChange={event => setData({ ...data, vendorId: event.target.value })} required><option value="">Select supplier</option>{vendors.filter(vendor => !vendor.archivedAt).map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
            {mode === 'assessments' ? <>{field('assessmentType', 'Assessment type')}{field('assessorId', 'Assigned assessor ID')}{field('dueDate', 'Due date', 'date')}{field('inherentRiskScore', 'Suggested inherent score', 'number')}{field('residualRiskScore', 'Current residual score', 'number')}{field('targetRiskScore', 'Target score', 'number')}</> : <>{field('contractName', 'Contract name')}{field('contractOwner', 'Contract owner')}{field('contractType', 'Contract type')}{field('effectiveDate', 'Effective date', 'date')}{field('expirationDate', 'Expiry date', 'date')}{field('renewalDate', 'Renewal date', 'date')}{field('renewalNoticeDays', 'Notice period (days)', 'number')}{field('relatedBusinessService', 'Related business service')}{field('securityObligations', 'Security obligations')}{field('dataProtectionObligations', 'Data protection obligations')}{field('slaRequirements', 'SLA requirements')}{field('auditRights', 'Audit rights')}{field('terminationProvisions', 'Termination provisions')}{field('exitRequirements', 'Exit requirements')}</>}
          </>}
          <div className="supplierActions wide"><button type="button" className="supplierButton" onClick={requestClose} disabled={busy}>Cancel</button><button type="submit" className="supplierButton primary" disabled={busy}>{busy ? 'Saving...' : 'Save record'}</button></div>
        </fieldset>
      </form>
    </Modal>
  );
}
