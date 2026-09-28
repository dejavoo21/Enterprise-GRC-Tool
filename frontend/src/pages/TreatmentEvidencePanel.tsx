import { useEffect, useRef, useState } from 'react';
import { apiCall, API_BASE } from '../lib/api';
import { Button } from '../components';

interface Evidence { id: string; name: string; type: string; linked_at?: string; last_reviewed_at?: string | null }
export function TreatmentEvidencePanel({ treatmentId }: { treatmentId: string }) {
  const [links,setLinks] = useState<Evidence[]>([]);
  const [choices,setChoices] = useState<Evidence[]>([]);
  const [selected,setSelected] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [retry,setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const request=++generation.current;
    Promise.all([
      apiCall<{data:Evidence[]}>(`${API_BASE}/risk-treatments/${encodeURIComponent(treatmentId)}/evidence`),
      apiCall<{data:Evidence[]}>(`${API_BASE}/evidence`),
    ]).then(([linked,available])=>{if(request===generation.current){setLinks(linked.data);setChoices(available.data);setError('');}})
      .catch(e=>{if(request===generation.current)setError(e instanceof Error?e.message:'Unable to load evidence.');})
      .finally(()=>{if(request===generation.current)setLoading(false);});
    return ()=>{generation.current=request+1;};
  },[treatmentId,retry]);
  async function change(id:string,linked:boolean) {
    const request=generation.current;
    setSaving(true);setError('');setNotice('');
    try {
      const result=await apiCall<{data:Evidence[]}>(`${API_BASE}/risk-treatments/${encodeURIComponent(treatmentId)}/evidence`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({evidenceId:id,linked})});
      if(request===generation.current){setLinks(result.data);setSelected('');setNotice(linked?'Evidence linked. This does not certify its effectiveness.':'Evidence unlinked. The original record is unchanged.');}
    } catch(e){if(request===generation.current)setError(e instanceof Error?e.message:'Unable to update evidence.');}
    finally{if(request===generation.current)setSaving(false);}
  }
  return <div className="rdEvidencePanel">
    <h3>Linked evidence ({links.length})</h3>
    <p>Link existing workspace evidence. Linking does not verify the content or complete the treatment.</p>
    {loading && <p role="status">Loading evidence...</p>}
    {error && <div role="alert"><p>{error}</p><Button disabled={saving} onClick={()=>{setLoading(true);setRetry(value=>value+1);}}>Retry evidence</Button></div>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && !links.length && <p>No evidence linked yet.</p>}
    <ul className="rdList">{links.map(item=><li key={item.id}><strong>{item.name}</strong><span>{item.type} · {item.last_reviewed_at?`Last reviewed ${new Date(item.last_reviewed_at).toLocaleDateString()}`:'Review not recorded'}</span><Button variant="ghost" disabled={saving} onClick={()=>void change(item.id,false)} aria-label={`Unlink ${item.name}`}>Unlink</Button></li>)}</ul>
    <label>Evidence record<select aria-label="Evidence to link" value={selected} disabled={loading||saving||Boolean(error)} onChange={event=>setSelected(event.target.value)}><option value="">Select existing evidence</option>{choices.filter(item=>!links.some(link=>link.id===item.id)).map(item=><option key={item.id} value={item.id}>{item.name} ({item.type})</option>)}</select></label>
    <Button disabled={!selected||saving||Boolean(error)} onClick={()=>void change(selected,true)}>{saving?'Saving...':'Link evidence'}</Button>
  </div>;
}
