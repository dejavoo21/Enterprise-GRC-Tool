import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from '../components';
import { useAuth } from '../context/AuthContext';
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
type MethodologyState = { methodologyMode: 'legacy' | 'enforced'; activeMethodologyId: string | null; activeMethodologyVersion: number | null; hasActiveMethodology: boolean; enforcementWarning: string | null };
type HistoryEvent = { id: string; eventType: 'methodology' | 'mode'; action: string; actorId: string; createdAt: string; methodologyVersion: number | null; previousMode: 'legacy' | 'enforced' | null; nextMode: 'legacy' | 'enforced' | null; historicalRisksPreserved: number | null };
type Response<T> = { data: T };
const endpoint = `${API_BASE}/risk-methodologies`;
const getHistory = () => apiCall<Response<HistoryEvent[]>>(`${endpoint}/history`);
const historyLabel = (event: HistoryEvent) => event.eventType === 'mode' ? 'Enforcement mode changed' : event.action === 'draft_created' ? 'Draft created' : event.action === 'draft_updated' ? 'Draft updated' : event.action === 'activated' ? 'Methodology activated' : event.action.replaceAll('_', ' ');
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
  const { role } = useAuth();
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
  const [methodologyState, setMethodologyState] = useState<MethodologyState | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [activationTarget, setActivationTarget] = useState<Version | null>(null);
  const [activationConfirmed, setActivationConfirmed] = useState(false);
  const [modeTarget, setModeTarget] = useState<'legacy' | 'enforced' | null>(null);
  const [modeConfirmed, setModeConfirmed] = useState(false);
  const workspaceGeneration = useRef(0);
  const submitLock = useRef(false);
  useEffect(() => {
    let current = true;
    workspaceGeneration.current += 1;
    setBusy(false);
    setConfig(null); setVersions([]); setSelected(null); setCells([]); setError(''); setNotice('');
    setActivationTarget(null); setActivationConfirmed(false); setModeTarget(null); setModeConfirmed(false);
    setMethodologyState(null);
    setModeNotice('');
    setHistory([]); setHistoryLoading(true); setHistoryError('');
    void apiCall<Response<MethodologyState>>(`${endpoint}/state`).then(({data}) => {
      if (current) { setMethodologyState(data); setModeNotice(data.enforcementWarning || `${data.activeMethodologyVersion == null ? 'No active methodology configured' : `Configured methodology v${data.activeMethodologyVersion}`}. Workspace mode: ${data.methodologyMode}.`); }
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Unable to load workspace mode.'); });
    const templates = apiCall<Response<{ matrix: Config; weighted: Config }>>(`${endpoint}/templates`).catch(async () => ({ data: { matrix: (await apiCall<Response<Config>>(`${endpoint}/template`)).data, weighted: defaultWeightedConfig } }));
    void Promise.all([apiCall<Response<Version[]>>(endpoint), templates]).then(([list, available]) => {
      if (current) { setVersions(list.data); setConfig(available.data.matrix); setWeightedTemplate(available.data.weighted); }
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'Unable to load methodology.'); });
    void getHistory().then(response => { if (current) setHistory(response.data); }).catch(err => { if (current) setHistoryError(err instanceof Error ? err.message : 'Unable to load methodology history.'); }).finally(() => { if (current) setHistoryLoading(false); });
    return () => { current = false; workspaceGeneration.current += 1; };
  }, [currentWorkspace.id]);
  const update = (next: Config) => { setConfig(next); setCells([]); setWeightedProfile(null); setError(''); setNotice(''); };
  const resize = (axis: 'likelihoodLevels' | 'impactLevels', size: number) => {
    if (!config || !Number.isInteger(size) || size < 2 || size > 10) return;
    update({ ...config, [axis]: Array.from({ length: size }, (_, i) => config[axis][i] || { value: i + 1, label: `Level ${i + 1}`, description: '' }) });
  };
  const submit = async (save: boolean) => {
    if (!config || submitLock.current) return;
    submitLock.current = true;
    const generation = workspaceGeneration.current;
    const capturedConfig = structuredClone(config);
    const selectedId = selected?.id;
    const expectedUpdatedAt = selected?.updatedAt;
    setBusy(true); setError(''); setNotice('');
    try {
      if (save) {
        const payload = JSON.stringify({ config: capturedConfig, expectedUpdatedAt });
        const response = await apiCall<Response<Version>>(`${endpoint}${selectedId ? `/${selectedId}` : ''}`, { method: selectedId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        if (generation !== workspaceGeneration.current) return;
        setSelected(response.data); setVersions(old => [response.data, ...old.filter(row => row.id !== response.data.id)].sort((a, b) => b.version - a.version));
        setNotice('Draft saved. Existing risks and scores have not changed.');
        void getHistory().then(result => { if (generation === workspaceGeneration.current) { setHistory(result.data); setHistoryError(''); } }).catch(err => { if (generation === workspaceGeneration.current) setHistoryError(err instanceof Error ? err.message : 'Unable to refresh methodology history.'); });
      } else {
        const sample = Object.fromEntries((capturedConfig.weightedFactors || []).filter(f => f.enabled).map(f => [f.key, f.maxScore]));
        const payload = JSON.stringify({ config: capturedConfig, profile: capturedConfig.scoringMethod === 'weighted' ? { inherentFactors: sample, residualFactors: sample } : undefined });
        const response = await apiCall<Response<{ cells: Cell[][]; profile: WeightedProfile | null }>>(`${endpoint}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        if (generation !== workspaceGeneration.current) return;
        setCells(response.data.cells); setWeightedProfile(response.data.profile);
      }
    } catch (err) { if (generation === workspaceGeneration.current) setError(err instanceof Error ? err.message : 'Request failed.'); }
    finally { submitLock.current = false; if (generation === workspaceGeneration.current) setBusy(false); }
  };
  const closeActivation = () => {
    if (submitLock.current) return;
    setActivationTarget(null);
    setActivationConfirmed(false);
  };
  const activate = async () => {
    if (!activationTarget || !activationConfirmed || submitLock.current) return;
    submitLock.current = true;
    const generation = workspaceGeneration.current;
    const target = { id: activationTarget.id, version: activationTarget.version, name: activationTarget.config.name };
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiCall<Response<Version & { warning: string; historicalRisksPreserved: number }>>(`${endpoint}/${encodeURIComponent(target.id)}/activate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmPreserveExisting: true }),
      });
      if (generation !== workspaceGeneration.current) return;
      setActivationTarget(null); setActivationConfirmed(false); setSelected(null);
      setVersions(current => current.map(item => item.id === target.id ? response.data : item.status === 'Active' ? { ...item, status: 'Retired' } : item));
      setModeNotice(`Configured methodology v${target.version}. Workspace mode remains controlled by the recorded workspace setting.`);
      setNotice(`Activated ${target.name} v${target.version}. ${response.data.warning}`);
      try {
        const [list, state] = await Promise.all([
          apiCall<Response<Version[]>>(endpoint),
          apiCall<Response<MethodologyState>>(`${endpoint}/state`),
        ]);
        if (generation !== workspaceGeneration.current) return;
        setVersions(list.data);
        setMethodologyState(state.data);
        setModeNotice(state.data.enforcementWarning || `Configured methodology v${state.data.activeMethodologyVersion}. Workspace mode: ${state.data.methodologyMode}.`);
      } catch {
        if (generation === workspaceGeneration.current) setNotice(`Activated ${target.name} v${target.version}. ${response.data.warning} Refresh the page to reload the complete version register.`);
      }
      void getHistory().then(result => { if (generation === workspaceGeneration.current) { setHistory(result.data); setHistoryError(''); } }).catch(err => { if (generation === workspaceGeneration.current) setHistoryError(err instanceof Error ? err.message : 'Unable to refresh methodology history.'); });
    } catch (err) {
      if (generation === workspaceGeneration.current) setError(err instanceof Error ? err.message : 'Methodology activation failed.');
    } finally {
      submitLock.current = false;
      if (generation === workspaceGeneration.current) setBusy(false);
    }
  };
  const closeModeChange = () => {
    if (submitLock.current) return;
    setModeTarget(null); setModeConfirmed(false);
  };
  const changeMode = async () => {
    if (!modeTarget || !modeConfirmed || submitLock.current) return;
    submitLock.current = true;
    const generation = workspaceGeneration.current;
    const requestedMode = modeTarget;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiCall<Response<MethodologyState>>(`${endpoint}/state`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: requestedMode, confirmModeChange: true }),
      });
      if (generation !== workspaceGeneration.current) return;
      setMethodologyState(response.data); setModeTarget(null); setModeConfirmed(false);
      setModeNotice(response.data.enforcementWarning || `Configured methodology v${response.data.activeMethodologyVersion}. Workspace mode: ${response.data.methodologyMode}.`);
      setNotice(requestedMode === 'enforced' ? 'Enforced methodology mode is active for new risk records.' : 'Legacy compatibility mode is active for new risk records. Existing methodology pins remain recorded.');
      void getHistory().then(result => { if (generation === workspaceGeneration.current) { setHistory(result.data); setHistoryError(''); } }).catch(err => { if (generation === workspaceGeneration.current) setHistoryError(err instanceof Error ? err.message : 'Unable to refresh methodology history.'); });
    } catch (err) {
      if (generation === workspaceGeneration.current) setError(err instanceof Error ? err.message : 'Methodology mode change failed.');
    } finally {
      submitLock.current = false;
      if (generation === workspaceGeneration.current) setBusy(false);
    }
  };
  const canActivate = role === 'owner' || role === 'admin';
  return <section className="methodologyPage" aria-label="Enterprise Risk Methodology">
    <header><p>Risk Management / Configuration</p><h1>Enterprise Risk Methodology</h1><p>Organisation-wide risk scoring, independent of individual compliance frameworks.</p></header>
    <aside role="note"><strong>Configuration preview.</strong> Draft edits do not change existing risks. Activation and enforcement require a controlled, approved rollout.</aside>
    {modeNotice && <p role="status">{modeNotice}</p>}
    {canActivate && methodologyState && <section aria-label="Methodology enforcement"><h2>Enforcement mode</h2><p>{methodologyState.methodologyMode === 'enforced' ? 'New risks must use the active methodology. Existing risk pins and scores remain unchanged.' : 'New risks may continue using legacy compatibility behavior until enforced mode is approved.'}</p><Button disabled={busy || (methodologyState.methodologyMode === 'legacy' && !methodologyState.hasActiveMethodology)} title={methodologyState.methodologyMode === 'legacy' && !methodologyState.hasActiveMethodology ? 'Activate a methodology before enabling enforced mode.' : undefined} onClick={() => { if (!submitLock.current) { setModeTarget(methodologyState.methodologyMode === 'legacy' ? 'enforced' : 'legacy'); setModeConfirmed(false); setError(''); } }}>{methodologyState.methodologyMode === 'legacy' ? 'Review enforced mode' : 'Review legacy compatibility mode'}</Button></section>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!config && !error && <p role="status">Loading methodology...</p>}
    {config && <>
      <section><h2>Saved versions</h2><p>{versions.some(row => row.status === 'Active') ? 'An active version exists.' : 'No active methodology configured. Existing risks retain legacy scoring.'}</p>
        <div className="methodologyActions">{versions.map(row => <button type="button" disabled={busy} key={row.id} onClick={() => { if (submitLock.current) return; setSelected(row.status === 'Draft' ? row : null); update(structuredClone(row.config)); setNotice(row.status === 'Draft' ? `Editing draft v${row.version}.` : `Settings copied from ${row.status.toLowerCase()} v${row.version}. Saving creates a new draft; the original version and historical risks remain unchanged.`); }}>{row.config.name} v{row.version} ({row.status})</button>)}
          <button type="button" disabled={busy} onClick={() => { if (submitLock.current) return; setSelected(null); setNotice('Saving will create a new draft version.'); }}>Create new version from current settings</button>
        </div>
      </section>
      <section aria-labelledby="methodology-history-heading"><h2 id="methodology-history-heading">Methodology audit history</h2><p>Recorded draft, activation and enforcement-mode events for this workspace. Configuration snapshots remain protected and are not displayed here.</p>
        {historyLoading ? <p role="status">Loading methodology history...</p> : historyError ? <p role="alert">{historyError}</p> : history.length === 0 ? <p>No methodology history has been recorded for this workspace.</p> : <ol className="methodologyHistory">{history.map(event => <li key={event.id}><div><strong>{historyLabel(event)}</strong>{event.methodologyVersion != null && <span>Methodology v{event.methodologyVersion}</span>}{event.previousMode && event.nextMode && <span>{event.previousMode} to {event.nextMode}</span>}{event.historicalRisksPreserved != null && <span>{event.historicalRisksPreserved} historical risks preserved</span>}</div><small>{new Date(event.createdAt).toLocaleString('en-GB')} · actor {event.actorId}</small></li>)}</ol>}
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
          <div className="methodologyActions"><button type="button" onClick={() => void submit(false)}>Validate and preview</button><button type="submit">Save draft</button>{canActivate && <button type="button" disabled={!selected || selected.status !== 'Draft'} aria-describedby="methodology-activation-note" onClick={() => { if (!submitLock.current && selected) { setActivationTarget(selected); setActivationConfirmed(false); setError(''); } }}>Activate version</button>}</div>
          <p id="methodology-activation-note">Activation requires a saved draft, Risks approval permission, an enabled release gate and explicit confirmation. Historical risks retain their pinned scores and methodology.</p>
        </fieldset>
      </form>
      {cells.length > 0 && <section><h2>Configuration preview (not risk counts)</h2><div className="methodologyMatrix" style={{ gridTemplateColumns: `repeat(${config.impactLevels.length}, minmax(0, 1fr))` }}>{cells.flat().map(cell => <div key={`${cell.likelihood}-${cell.impact}`} style={{ borderColor: cell.colour }} aria-label={`Likelihood ${cell.likelihood}, impact ${cell.impact}, score ${cell.score}, ${cell.rating}`}><strong>{cell.score}</strong><span>{cell.rating}</span><small>L{cell.likelihood} / I{cell.impact}</small></div>)}</div></section>}
      {weightedProfile && <section aria-label="Weighted scoring preview"><h2>Weighted calculation preview</h2>{weightedProfile.residual.breakdown.map(item => <p key={item.key}>{item.label}: {item.score} × {item.weight}% = {item.contribution.toFixed(2)}</p>)}<strong>Weighted score: {weightedProfile.residual.score.toFixed(2)} · {weightedProfile.residual.rating}</strong></section>}
    </>}
    <Modal accessibleDialog isOpen={Boolean(activationTarget)} onClose={closeActivation} title={activationTarget ? `Activate methodology v${activationTarget.version}` : 'Activate methodology'} footer={<><Button variant="outline" disabled={busy} onClick={closeActivation}>Cancel</Button><Button disabled={busy || !activationConfirmed} onClick={() => void activate()}>{busy ? 'Activating...' : 'Activate reviewed version'}</Button></>}>
      {activationTarget && <fieldset disabled={busy} aria-busy={busy} className="methodologyActivation"><p><strong>{activationTarget.config.name}</strong> will become the active methodology for newly created risks. Any currently active version will be retired.</p><p>Existing risks will not be recalculated or silently moved to this version. Their scores and methodology pins remain historical records.</p><label><input type="checkbox" checked={activationConfirmed} onChange={event => setActivationConfirmed(event.target.checked)} />I confirm this controlled activation and understand that existing risks retain their current methodology and scores.</label><p role="note">The server will reject activation unless the release gate, database pinning safeguards, workspace scope and approval permission are all valid.</p></fieldset>}
    </Modal>
    <Modal accessibleDialog isOpen={Boolean(modeTarget)} onClose={closeModeChange} title={modeTarget === 'enforced' ? 'Enable enforced methodology mode' : 'Enable legacy compatibility mode'} footer={<><Button variant="outline" disabled={busy} onClick={closeModeChange}>Cancel</Button><Button disabled={busy || !modeConfirmed} onClick={() => void changeMode()}>{busy ? 'Changing mode...' : 'Confirm mode change'}</Button></>}>
      {modeTarget && <fieldset disabled={busy} aria-busy={busy} className="methodologyActivation"><p>{modeTarget === 'enforced' ? 'New risks will require the currently active methodology and will be pinned to its version.' : 'New risks may use legacy compatibility behavior. Existing methodology pins, scores and activation history will remain recorded.'}</p><label><input type="checkbox" checked={modeConfirmed} onChange={event => setModeConfirmed(event.target.checked)} />I confirm this governed methodology mode change and understand its effect on newly created risks.</label><p role="note">This action requires Risks approval permission. Enforced mode also requires an active methodology and the controlled release gate.</p></fieldset>}
    </Modal>
  </section>;
}
