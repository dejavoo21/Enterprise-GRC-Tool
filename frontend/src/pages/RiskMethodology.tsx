import { useEffect, useState } from 'react';
import { apiCall, API_BASE } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import './RiskMethodology.css';

type Level = { value: number; label: string; description: string };
type Band = { label: string; minScore: number; maxScore: number; colour: string; severityOrder: number };
type Config = { name: string; description: string; scoringMethod: 'multiplication'; likelihoodLevels: Level[]; impactLevels: Level[]; ratingBands: Band[]; appetiteMaxScore: number; treatmentRequiredFromScore: number; escalationRequiredFromScore: number; targetRequired: boolean };
type Version = { id: string; version: number; status: string; config: Config; updatedAt: string };
type Cell = { likelihood: number; impact: number; score: number; rating: string; colour: string };
type Response<T> = { data: T };
const endpoint = `${API_BASE}/risk-methodologies`;

export function RiskMethodology() {
  const { currentWorkspace } = useWorkspace();
  const [versions, setVersions] = useState<Version[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [cells, setCells] = useState<Cell[][]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modeNotice, setModeNotice] = useState('');
  useEffect(() => {
    let current = true;
    setConfig(null); setVersions([]); setSelected(null); setCells([]); setError(''); setNotice('');
    setModeNotice('');
    void apiCall<Response<{methodologyMode:string; activeMethodologyVersion:number|null; enforcementWarning:string|null}>>(`${endpoint}/state`).then(({data}) => {
      if (current) setModeNotice(data.enforcementWarning || `Configured methodology v${data.activeMethodologyVersion}. Workspace mode: ${data.methodologyMode}.`);
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Unable to load workspace mode.'); });
    void Promise.all([apiCall<Response<Version[]>>(endpoint), apiCall<Response<Config>>(`${endpoint}/template`)]).then(([list, template]) => {
      if (current) { setVersions(list.data); setConfig(template.data); }
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Unable to load methodology.'); });
    return () => { current = false; };
  }, [currentWorkspace.id]);
  const update = (next: Config) => { setConfig(next); setCells([]); setNotice(''); };
  const resize = (axis: 'likelihoodLevels' | 'impactLevels', size: number) => {
    if (!config || !Number.isInteger(size) || size < 2 || size > 10) return;
    update({ ...config, [axis]: Array.from({ length: size }, (_, i) => config[axis][i] || { value: i + 1, label: `Level ${i + 1}`, description: '' }) });
  };
  const submit = async (save: boolean) => {
    if (!config) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (save) {
        const response = await apiCall<Response<Version>>(`${endpoint}${selected ? `/${selected.id}` : ''}`, { method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, expectedUpdatedAt: selected?.updatedAt }) });
        setSelected(response.data); setVersions(old => [response.data, ...old.filter(row => row.id !== response.data.id)].sort((a, b) => b.version - a.version));
        setNotice('Draft saved. Existing risks and scores have not changed.');
      } else {
        const response = await apiCall<Response<{ cells: Cell[][] }>>(`${endpoint}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) });
        setCells(response.data.cells);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Request failed.'); }
    finally { setBusy(false); }
  };
  return <main className="methodologyPage">
    <header><p>Risk Management / Configuration</p><h1>Enterprise Risk Methodology</h1><p>Organisation-wide risk scoring, independent of individual compliance frameworks.</p></header>
    <aside role="note"><strong>Configuration preview.</strong> Draft edits do not change existing risks. Activation and enforcement require a controlled, approved rollout.</aside>
    {modeNotice && <p role="status">{modeNotice}</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!config && !error && <p role="status">Loading methodology...</p>}
    {config && <>
      <section><h2>Saved versions</h2><p>{versions.some(row => row.status === 'Active') ? 'An active version exists.' : 'No active methodology configured. Existing risks retain legacy scoring.'}</p>
        <div className="methodologyActions">{versions.map(row => <button type="button" disabled={busy} key={row.id} onClick={() => { setSelected(row.status === 'Draft' ? row : null); update(structuredClone(row.config)); }}>{row.config.name} v{row.version} ({row.status})</button>)}
          <button type="button" disabled={busy} onClick={() => { setSelected(null); setNotice('Saving will create a new draft version.'); }}>Create new version from current settings</button>
        </div>
      </section>
      <form onSubmit={event => { event.preventDefault(); void submit(true); }}>
        <fieldset disabled={busy}><legend>{selected ? `Edit draft v${selected.version}` : 'New draft'}</legend>
          <label>Name<input required maxLength={120} value={config.name} onChange={e => update({ ...config, name: e.target.value })} /></label>
          <label>Description<textarea maxLength={2000} value={config.description} onChange={e => update({ ...config, description: e.target.value })} /></label>
          <p>Matrix: {config.likelihoodLevels.length} x {config.impactLevels.length}. Multiplication scoring. Custom axes support 2–10 levels; changing dimensions requires reviewing bands and thresholds.</p>
          <div className="methodologyActions">{[3, 4, 5].map(size => <button key={size} type="button" onClick={() => update({ ...config, likelihoodLevels: Array.from({ length: size }, (_, i) => ({ value: i + 1, label: `Likelihood ${i + 1}`, description: '' })), impactLevels: Array.from({ length: size }, (_, i) => ({ value: i + 1, label: `Impact ${i + 1}`, description: '' })) })}>{size} x {size}</button>)}</div>
          <div className="methodologyColumns">{(['likelihoodLevels', 'impactLevels'] as const).map(axis => <section key={axis}><h2>{axis === 'likelihoodLevels' ? 'Likelihood' : 'Impact'}</h2>
            <label>Number of levels<input type="number" min={2} max={10} value={config[axis].length} onChange={e => resize(axis, Number(e.target.value))} /></label>
            {config[axis].map((level, i) => <div key={level.value} className="methodologyLevel"><label>Level {level.value} label<input required value={level.label} onChange={e => update({ ...config, [axis]: config[axis].map((item, index) => index === i ? { ...item, label: e.target.value } : item) })} /></label><label>Description<input value={level.description} onChange={e => update({ ...config, [axis]: config[axis].map((item, index) => index === i ? { ...item, description: e.target.value } : item) })} /></label></div>)}
          </section>)}</div>
          <h2>Rating bands</h2><p>Cover every score from 1 to {config.likelihoodLevels.length * config.impactLevels.length}, without gaps or overlaps.</p>
          {config.ratingBands.map((band, i) => <div className="methodologyBand" key={i}>{(['label', 'minScore', 'maxScore', 'colour'] as const).map(key => <label key={key}>{key}<input type={key === 'colour' ? 'color' : key === 'label' ? 'text' : 'number'} value={band[key]} onChange={e => update({ ...config, ratingBands: config.ratingBands.map((item, index) => index === i ? { ...item, [key]: key === 'minScore' || key === 'maxScore' ? Number(e.target.value) : e.target.value } : item) })} /></label>)}<button type="button" aria-label={`Remove ${band.label} band`} onClick={() => update({ ...config, ratingBands: config.ratingBands.filter((_, index) => index !== i) })}>Remove</button></div>)}
          <button type="button" disabled={config.ratingBands.length >= 10} onClick={() => update({ ...config, ratingBands: [...config.ratingBands, { label: '', minScore: 1, maxScore: 1, colour: '#64748b', severityOrder: config.ratingBands.length + 1 }] })}>Add rating band</button>
          <div className="methodologyColumns">{(['appetiteMaxScore', 'treatmentRequiredFromScore', 'escalationRequiredFromScore'] as const).map(key => <label key={key}>{key === 'appetiteMaxScore' ? 'Maximum score within appetite' : key === 'treatmentRequiredFromScore' ? 'Treatment required from score' : 'Escalation required from score'}<input type="number" value={config[key]} onChange={e => update({ ...config, [key]: Number(e.target.value) })} /></label>)}</div>
          <label><input type="checkbox" checked={config.targetRequired} onChange={e => update({ ...config, targetRequired: e.target.checked })} /> Require target risk when scoring</label>
          <div className="methodologyActions"><button type="button" onClick={() => void submit(false)}>Validate and preview</button><button type="submit">Save draft</button><button type="button" disabled aria-describedby="methodology-activation-note">Activate version</button></div>
          <p id="methodology-activation-note">Activation is managed through the controlled release process after validation and policy approval. No historical risks will be silently rescored.</p>
        </fieldset>
      </form>
      {cells.length > 0 && <section><h2>Configuration preview (not risk counts)</h2><div className="methodologyMatrix" style={{ gridTemplateColumns: `repeat(${config.impactLevels.length}, minmax(0, 1fr))` }}>{cells.flat().map(cell => <div key={`${cell.likelihood}-${cell.impact}`} style={{ borderColor: cell.colour }} aria-label={`Likelihood ${cell.likelihood}, impact ${cell.impact}, score ${cell.score}, ${cell.rating}`}><strong>{cell.score}</strong><span>{cell.rating}</span><small>L{cell.likelihood} / I{cell.impact}</small></div>)}</div></section>}
    </>}
  </main>;
}
