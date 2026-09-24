import { useEffect, useState } from 'react';
import { apiCall } from '../lib/api';
import { CONTROL_ROLES, type TreatmentControl } from '../types/riskTreatment';

type Control = { id: string; title: string; domain?: string; primaryFramework?: string };
export function TreatmentControlPicker({ value, onChange, disabled }: { value: TreatmentControl[]; onChange: (links: TreatmentControl[]) => void; disabled: boolean }) {
  const [controls, setControls] = useState<Control[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    apiCall<{ data: Control[] | null; error?: { message: string } }>('/api/v1/controls').then(result => {
      if (!Array.isArray(result.data)) throw new Error(result.error?.message || 'Control Library unavailable');
      if (!cancelled) setControls(result.data);
    }).catch(() => { if (!cancelled) setError('Control linking requires access to the Control Library. Existing links are preserved.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const results = controls.filter(c => !value.some(link => link.controlId === c.id) && `${c.id} ${c.title} ${c.domain || ''} ${c.primaryFramework || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <fieldset className="treatmentControls treatmentFieldWide" disabled={disabled}>
    <legend>Controls used to treat this risk</legend><p>Select the controls that will reduce this risk or support the treatment plan. Changes apply when you save the plan.</p>
    <label className="treatmentField"><span>Search Control Library</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Control ID, title, framework, or domain" /></label>
    <div role="status">{loading ? 'Loading controls...' : error || `${results.length} matching controls`}</div>
    <div className="treatmentControlResults">{results.slice(0, 20).map(control => <div key={control.id}><span><strong>{control.title}</strong><small>{control.id} / {control.primaryFramework || control.domain || 'No framework assigned'}</small></span><button type="button" onClick={() => onChange([...value, { controlId: control.id, title: control.title, domain: control.domain, primaryFramework: control.primaryFramework, role: 'Other', implementationNote: '' }])} aria-label={`Add control ${control.title}`}>Add</button></div>)}</div>
    {results.length > 20 && <p>Showing the first 20 matches. Refine your search.</p>}
    {!loading && !error && controls.length === 0 && <p>No controls are available in this workspace.</p>}
    {value.length === 0 && <p>No controls linked.</p>}
    {value.map(link => <div className="treatmentSelectedControl" key={link.controlId}>
      <strong>{link.title || link.controlId}</strong><small>{link.controlId} / {link.primaryFramework || link.domain || 'Control Library'}</small>
      <label className="treatmentField"><span>Role for {link.title || link.controlId}</span><select value={link.role} onChange={e => onChange(value.map(item => item.controlId === link.controlId ? { ...item, role: e.target.value as TreatmentControl['role'] } : item))}>{CONTROL_ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
      <label className="treatmentField"><span>Implementation note for {link.title || link.controlId}</span><textarea maxLength={4000} rows={2} value={link.implementationNote || ''} onChange={e => onChange(value.map(item => item.controlId === link.controlId ? { ...item, implementationNote: e.target.value } : item))} /></label>
      <button type="button" onClick={() => onChange(value.filter(item => item.controlId !== link.controlId))} aria-label={`Remove control ${link.title || link.controlId}`}>Remove link</button>
    </div>)}
  </fieldset>;
}
