import { useEffect, useRef, useState } from 'react';
import { apiCall, API_BASE } from '../lib/api';
import { useWorkspace } from '../context/WorkspaceContext';
import './RiskMethodology.css';

type Level = { value: number; label: string; description: string };
type Band = { label: string; minScore: number; maxScore: number; colour: string; severityOrder: number };
type Factor = { key: string; label: string; enabled: boolean; weight: number; minScore: number; maxScore: number; description: string; displayOrder: number };
type Config = { name: string; description: string; scoringMethod: 'multiplication' | 'weighted'; likelihoodLevels: Level[]; impactLevels: Level[]; weightedFactors?: Factor[]; ratingBands: Band[]; appetiteMaxScore: number; treatmentRequiredFromScore: number; escalationRequiredFromScore: number; targetRequired: boolean };
type Version = { id: string; version: number; status: string; config: Config; updatedAt: string };
type Cell = { likelihood: number; impact: number; score: number; rating: string; colour: string };
type WeightedProfile = { residual: { score: number; rating: string; breakdown: Array<{ key: string; label: string; score: number; weight: number; contribution: number }> } };
type Response<T> = { data: T };
const endpoint = `${API_BASE}/risk-methodologies`;
const defaultWeightedConfig: Config = {
  name: 'Enterprise Weighted Risk Methodology', description: 'Optional factor-based scoring for mature risk programmes.', scoringMethod: 'weighted',
  likelihoodLevels: [], impactLevels: [], weightedFactors: [
    { key: 'likelihood', label: 'Likelihood', enabled: true, weight: 30, minScore: 1, maxScore: 5, description: 'Probability or frequency of the scenario.', displayOrder: 1 },
    { key: 'impact', label: 'Impact', enabled: true, weight: 40, minScore: 1, maxScore: 5, description: 'Enterprise consequence if the scenario occurs.', displayOrder: 2 },
    { key: 'control_weakness', label: 'Control Weakness', enabled: true, weight: 20, minScore: 1, maxScore: 5, description: 'Weakness remaining in the control environment.', displayOrder: 3 },
    { key: 'exposure', label: 'Exposure', enabled: true, weight: 10, minScore: 1, maxScore: 5, description: 'Extent and duration of exposure.', displayOrder: 4 },
  ],
  ratingBands: [{ label: 'Low', minScore: 1, maxScore: 1.9, colour: '#047857', severityOrder: 1 }, { label: 'Medium', minScore: 2, maxScore: 2.9, colour: '#ca8a04', severityOrder: 2 }, { label: 'High', minScore: 3, maxScore: 3.9, colour: '#ea580c', severityOrder: 3 }, { label: 'Critical', minScore: 4, maxScore: 5, colour: '#dc2626', severityOrder: 4 }],
  appetiteMaxScore: 2.9, treatmentRequiredFromScore: 3, escalationRequiredFromScore: 4, targetRequired: false,
};

export function RiskMethodology() {
  const { currentWorkspace } = useWorkspace();
  const [versions, setVersions] = useState<Version[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [selected, setSelected] = useState<Version | null>(null);
  const [cells, setCells] = useState<Cell[][]>([]);
  const [weightedTemplate, setWeightedTemplate] = useState<Config | null>(null);
  const [weightedProfile, setWeightedProfile] = useState<WeightedProfile | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modeNotice, setModeNotice] = useState('');
  const workspaceGeneration = useRef(0);
  useEffect(() => {
    let current = true;
    workspaceGeneration.current += 1;
    setBusy(false);
    setConfig(null); setVersions([]); setSelected(null); setCells([]); setError(''); setNotice('');
    setModeNotice('');
    void apiCall<Response<{methodologyMode:string; activeMethodologyVersion:number|null; enforcementWarning:string|null}>>(`${endpoint}/state`).then(({data}) => {
      if (current) setModeNotice(data.enforcementWarning || `${data.activeMethodologyVersion == null ? 'No active methodology configured' : `Configured methodology v${data.activeMethodologyVersion}`}. Workspace mode: ${data.methodologyMode}.`);
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Unable to load workspace mode.'); });
    const templates = apiCall<Response<{ matrix: Config; weighted: Config }>>(`${endpoint}/templates`).catch(async () => ({ data: { matrix: (await apiCall<Response<Config>>(`${endpoint}/template`)).data, weighted: defaultWeightedConfig } }));
    void Promise.all([apiCall<Response<Version[]>>(endpoint), templates]).then(([list, available]) => {
      if (current) { setVersions(list.data); setConfig(available.data.matrix); setWeightedTemplate(available.data.weighted); }
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Unable to load methodology.'); });
    return () => { current = false; workspaceGeneration.current += 1; };
  }, [currentWorkspace.id]);
  const update = (next: Config) => { setConfig(next); setCells([]); setWeightedProfile(null); setError(''); setNotice(''); };
  const resize = (axis: 'likelihoodLevels' | 'impactLevels', size: number) => {
    if (!config || !Number.isInteger(size) || size < 2 || size > 10) return;
    update({ ...config, [axis]: Array.from({ length: size }, (_, i) => config[axis][i] || { value: i + 1, label: `Level ${i + 1}`, description: '' }) });
  };
  const submit = async (save: boolean) => {
    if (!config) return;
    const generation = workspaceGeneration.current;
    setBusy(true); setError(''); setNotice('');
    try {
      if (save) {
        const response = await apiCall<Response<Version>>(`${endpoint}${selected ? `/${selected.id}` : ''}`, { method: selected ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, expectedUpdatedAt: selected?.updatedAt }) });
        if (generation !== workspaceGeneration.current) return;
        setSelected(response.data); setVersions(old => [response.data, ...old.filter(row => row.id !== response.data.id)].sort((a, b) => b.version - a.version));
        setNotice('Draft saved. Existing risks and scores have not changed.');
      } else {
        const sample = Object.fromEntries((config.weightedFactors || []).filter(f => f.enabled).map(f => [f.key, f.maxScore]));
        const response = await apiCall<Response<{ cells: Cell[][]; profile: WeightedProfile | null }>>(`${endpoint}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, profile: config.scoringMethod === 'weighted' ? { inherentFactors: sample, residualFactors: sample } : undefined }) });
        if (generation !== workspaceGeneration.current) return;
        setCells(response.data.cells); setWeightedProfile(response.data.profile);
      }
    } catch (err) { if (generation === workspaceGeneration.current) setError(err instanceof Error ? err.message : 'Request failed.'); }
    finally { if (generation === workspaceGeneration.current) setBusy(false); }
  };
  return <section className="methodologyPage" aria-label="Enterprise Risk Methodology">
    <header><p>Risk Management / Configuration</p><h1>Enterprise Risk Methodology</h1><p>Organisation-wide risk scoring, independent of individual compliance frameworks.</p></header>
    <aside role="note"><strong>Configuration preview.</strong> Draft edits do not change existing risks. Activation and enforcement require a controlled, approved rollout.</aside>
    {modeNotice && <p role="status">{modeNotice}</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!config && !error && <p role="status">Loading methodology...</p>}
    {config && <>
      <section><h2>Saved versions</h2><p>{versions.some(row => row.status === 'Active') ? 'An active version exists.' : 'No active methodology configured. Existing risks retain legacy scoring.'}</p>
        <div className="methodologyActions">{versions.map(row => <button type="button" disabled={busy} key={row.id} onClick={() => { setSelected(row.status === 'Draft' ? row : null); update(structuredClone(row.config)); setNotice(row.status === 'Draft' ? `Editing draft v${row.version}.` : `Settings copied from ${row.status.toLowerCase()} v${row.version}. Saving creates a new draft; the original version and historical risks remain unchanged.`); }}>{row.config.name} v{row.version} ({row.status})</button>)}
          <button type="button" disabled={busy} onClick={() => { setSelected(null); setNotice('Saving will create a new draft version.'); }}>Create new version from current settings</button>
        </div>
      </section>
      <form onSubmit={event => { event.preventDefault(); void submit(true); }}>
        <fieldset disabled={busy}><legend>{selected ? `Edit draft v${selected.version}` : 'New draft'}</legend>
          <label>Name<input required maxLength={120} value={config.name} onChange={e => update({ ...config, name: e.target.value })} /></label>
          <label>Description<textarea maxLength={2000} value={config.description} onChange={e => update({ ...config, description: e.target.value })} /></label>
          <label>Scoring method<select value={config.scoringMethod} onChange={e => { const method = e.target.value as Config['scoringMethod']; if (method === 'weighted' && weightedTemplate) update(structuredClone(weightedTemplate)); else if (method === 'multiplication') void apiCall<Response<Config>>(`${endpoint}/template`).then(result => update(result.data)); }}><option value="multiplication">Matrix scoring</option><option value="weighted">Weighted scoring</option></select></label>
          {config.scoringMethod === 'multiplication' ? <>
          <p>Matrix: {config.likelihoodLevels.length} x {config.impactLevels.length}. Multiplication scoring. Custom axes support 2–10 levels; changing dimensions requires reviewing bands and thresholds.</p>
          <div className="methodologyActions">{[3, 4, 5].map(size => <button key={size} type="button" onClick={() => update({ ...config, likelihoodLevels: Array.from({ length: size }, (_, i) => ({ value: i + 1, label: `Likelihood ${i + 1}`, description: '' })), impactLevels: Array.from({ length: size }, (_, i) => ({ value: i + 1, label: `Impact ${i + 1}`, description: '' })) })}>{size} x {size}</button>)}</div>
          <div className="methodologyColumns">{(['likelihoodLevels', 'impactLevels'] as const).map(axis => <section key={axis}><h2>{axis === 'likelihoodLevels' ? 'Likelihood' : 'Impact'}</h2>
            <label>Number of levels<input aria-label={`${axis === 'likelihoodLevels' ? 'Likelihood' : 'Impact'} number of levels`} type="number" min={2} max={10} value={config[axis].length} onChange={e => resize(axis, Number(e.target.value))} /></label>
            {config[axis].map((level, i) => <div key={level.value} className="methodologyLevel"><label>Level {level.value} label<input aria-label={`${axis === 'likelihoodLevels' ? 'Likelihood' : 'Impact'} level ${level.value} label`} required value={level.label} onChange={e => update({ ...config, [axis]: config[axis].map((item, index) => index === i ? { ...item, label: e.target.value } : item) })} /></label><label>Description<input aria-label={`${axis === 'likelihoodLevels' ? 'Likelihood' : 'Impact'} level ${level.value} description`} value={level.description} onChange={e => update({ ...config, [axis]: config[axis].map((item, index) => index === i ? { ...item, description: e.target.value } : item) })} /></label></div>)}
          </section>)}</div></> : <section className="methodologyFactorBuilder"><h2>Weighted factors</h2><p>Enabled factor weights must total 100%. Scores are normalized by their configured percentage.</p>
            {(() => { const total = (config.weightedFactors || []).filter(f => f.enabled).reduce((sum, f) => sum + f.weight, 0); return <p className="methodologyWeightTotal" role={Math.abs(total - 100) > 0.0001 ? 'alert' : undefined}>Enabled weight: {total}%{Math.abs(total - 100) > 0.0001 ? ' · Enabled factor weights must total 100%.' : ''}</p>; })()}
            {(config.weightedFactors || []).map((factor, i) => <div className="methodologyFactor" key={factor.key}>
              <label><input type="checkbox" checked={factor.enabled} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, enabled: e.target.checked } : item) })} /> Enabled</label>
              <label>Factor key<input required pattern="[a-z][a-z0-9_]*" value={factor.key} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') } : item) })} /></label>
              <label>Factor label<input required value={factor.label} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, label: e.target.value } : item) })} /></label>
              <label>Weight %<input type="number" min="0" max="100" step="0.1" value={factor.weight} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, weight: Number(e.target.value) } : item) })} /></label>
              <label>Minimum<input type="number" step="0.1" value={factor.minScore} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, minScore: Number(e.target.value) } : item) })} /></label>
              <label>Maximum<input type="number" step="0.1" value={factor.maxScore} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, maxScore: Number(e.target.value) } : item) })} /></label>
              <label>Description<input value={factor.description} onChange={e => update({ ...config, weightedFactors: config.weightedFactors!.map((item, index) => index === i ? { ...item, description: e.target.value } : item) })} /></label>
              <button type="button" disabled={(config.weightedFactors || []).length <= 2} onClick={() => update({ ...config, weightedFactors: config.weightedFactors!.filter((_, index) => index !== i).map((item, index) => ({ ...item, displayOrder: index + 1 })) })}>Remove factor</button>
            </div>)}
            <button type="button" disabled={(config.weightedFactors || []).length >= 12} onClick={() => { const factors = config.weightedFactors || []; update({ ...config, weightedFactors: [...factors, { key: `factor_${factors.length + 1}`, label: `Factor ${factors.length + 1}`, enabled: false, weight: 0, minScore: 1, maxScore: 5, description: '', displayOrder: factors.length + 1 }] }); }}>Add factor</button>
          </section>}
          <h2>Rating bands</h2><p>Cover the complete {config.scoringMethod === 'weighted' ? 'weighted scoring range' : `score range from 1 to ${config.likelihoodLevels.length * config.impactLevels.length}`}, without gaps or overlaps.</p>
          {config.ratingBands.map((band, i) => <div className="methodologyBand" key={i}>{(['label', 'minScore', 'maxScore', 'colour'] as const).map(key => <label key={key}>{key === 'minScore' ? 'Minimum score' : key === 'maxScore' ? 'Maximum score' : key === 'colour' ? 'Colour' : 'Rating label'}<input aria-label={`${band.label || `Band ${i + 1}`} ${key}`} type={key === 'colour' ? 'color' : key === 'label' ? 'text' : 'number'} value={band[key]} onChange={e => update({ ...config, ratingBands: config.ratingBands.map((item, index) => index === i ? { ...item, [key]: key === 'minScore' || key === 'maxScore' ? Number(e.target.value) : e.target.value } : item) })} /></label>)}<button type="button" aria-label={`Remove ${band.label} band`} onClick={() => update({ ...config, ratingBands: config.ratingBands.filter((_, index) => index !== i) })}>Remove</button></div>)}
          <button type="button" disabled={config.ratingBands.length >= 10} onClick={() => update({ ...config, ratingBands: [...config.ratingBands, { label: '', minScore: 1, maxScore: 1, colour: '#64748b', severityOrder: config.ratingBands.length + 1 }] })}>Add rating band</button>
          <div className="methodologyColumns">{(['appetiteMaxScore', 'treatmentRequiredFromScore', 'escalationRequiredFromScore'] as const).map(key => <label key={key}>{key === 'appetiteMaxScore' ? 'Maximum score within appetite' : key === 'treatmentRequiredFromScore' ? 'Treatment required from score' : 'Escalation required from score'}<input type="number" value={config[key]} onChange={e => update({ ...config, [key]: Number(e.target.value) })} /></label>)}</div>
          <label><input type="checkbox" checked={config.targetRequired} onChange={e => update({ ...config, targetRequired: e.target.checked })} /> Require target risk when scoring</label>
          <div className="methodologyActions"><button type="button" onClick={() => void submit(false)}>Validate and preview</button><button type="submit">Save draft</button><button type="button" disabled aria-describedby="methodology-activation-note">Activate version</button></div>
          <p id="methodology-activation-note">Activation is managed through the controlled release process after validation and policy approval. No historical risks will be silently rescored.</p>
        </fieldset>
      </form>
      {cells.length > 0 && <section><h2>Configuration preview (not risk counts)</h2><div className="methodologyMatrix" style={{ gridTemplateColumns: `repeat(${config.impactLevels.length}, minmax(0, 1fr))` }}>{cells.flat().map(cell => <div key={`${cell.likelihood}-${cell.impact}`} style={{ borderColor: cell.colour }} aria-label={`Likelihood ${cell.likelihood}, impact ${cell.impact}, score ${cell.score}, ${cell.rating}`}><strong>{cell.score}</strong><span>{cell.rating}</span><small>L{cell.likelihood} / I{cell.impact}</small></div>)}</div></section>}
      {weightedProfile && <section aria-label="Weighted scoring preview"><h2>Weighted calculation preview</h2>{weightedProfile.residual.breakdown.map(item => <p key={item.key}>{item.label}: {item.score} × {item.weight}% = {item.contribution.toFixed(2)}</p>)}<strong>Weighted score: {weightedProfile.residual.score.toFixed(2)} · {weightedProfile.residual.rating}</strong></section>}
    </>}
  </section>;
}
