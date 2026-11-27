import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { Control } from '../types/control';
import type { EvidenceItem } from '../types/evidence';
import type { GovernanceDocument } from '../types/governance';
import type { Risk } from '../types/risk';

export type SoaControlLinks = { controlId: string; riskIds: string[]; policyIds: string[]; evidenceIds: string[] };
type MultiField = 'riskIds' | 'policyIds' | 'evidenceIds';
type LinkOption = { id: string; label: string; detail: string };
type Options = { controls: LinkOption[]; riskIds: LinkOption[]; policyIds: LinkOption[]; evidenceIds: LinkOption[] };

const emptyOptions = (): Options => ({ controls: [], riskIds: [], policyIds: [], evidenceIds: [] });
const labels: Record<MultiField, string> = { riskIds: 'Related risks', policyIds: 'Policies', evidenceIds: 'Evidence metadata' };
const inputStyle = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };

export function SoaControlLinkSelector({ active, value, onChange, disabled = false }: {
  active: boolean;
  value: SoaControlLinks;
  onChange: (value: SoaControlLinks) => void;
  disabled?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [errors, setErrors] = useState<Partial<Record<keyof Options, string>>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!active) return;
    const sequence = ++requestSequence.current;
    const workspaceId = currentWorkspace.id;
    void Promise.resolve().then(() => {
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return null;
      setLoading(true); setErrors({}); setOptions(emptyOptions()); setSearch('');
      return Promise.allSettled([
        apiCall<{ data: Control[] }>('/api/v1/controls'),
        apiCall<{ data: Risk[] }>('/api/v1/risks'),
        apiCall<{ data: GovernanceDocument[] }>('/api/v1/governance-documents?docType=policy'),
        apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
      ]);
    }).then(results => {
      if (!results) return;
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      const next = emptyOptions();
      const nextErrors: Partial<Record<keyof Options, string>> = {};
      if (results[0].status === 'fulfilled') next.controls = results[0].value.data.map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` })); else nextErrors.controls = 'Controls are unavailable with current access.';
      if (results[1].status === 'fulfilled') next.riskIds = results[1].value.data.map(item => ({ id: item.id, label: item.title, detail: `${item.riskRef || item.id} · ${item.owner} · ${item.status}` })); else nextErrors.riskIds = 'Risks are unavailable with current access.';
      if (results[2].status === 'fulfilled') next.policyIds = results[2].value.data.filter(item => item.docType === 'policy').map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` })); else nextErrors.policyIds = 'Policies are unavailable with current access.';
      if (results[3].status === 'fulfilled') next.evidenceIds = results[3].value.data.map(item => ({ id: item.id, label: item.name, detail: `${item.type} · ${item.reviewStatus || 'not reviewed'} · ${item.attachmentStatus === 'stored' ? 'stored attachment' : 'metadata/reference only'}` })); else nextErrors.evidenceIds = 'Evidence metadata is unavailable with current access.';
      setOptions(next); setErrors(nextErrors);
    }).finally(() => { if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false); });
    return () => { requestSequence.current += 1; };
  }, [active, currentWorkspace.id]);

  const query = search.trim().toLowerCase();
  const visible = (items: LinkOption[]) => items.filter(item => !query || `${item.label} ${item.detail}`.toLowerCase().includes(query));
  const toggle = (field: MultiField, id: string) => onChange({ ...value, [field]: value[field].includes(id) ? value[field].filter(item => item !== id) : [...value[field], id] });

  return <div style={{ gridColumn: '1 / -1', display: 'grid', gap: theme.spacing[3] }}>
    <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Select canonical records already available in this workspace. Evidence metadata is a governed reference and does not prove that a binary attachment is stored.</div>
    <label style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>Search canonical records<input aria-label="Search SoA control relationships" style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled || loading} placeholder="Search title, owner, reference, type or status" /></label>
    <section style={{ display: 'grid', gap: theme.spacing[2], padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
      <strong>Canonical control</strong>
      {loading ? <span role="status">Loading...</span> : errors.controls ? <span role="alert" style={{ color: theme.colors.semantic.danger }}>{errors.controls}</span> : <select aria-label="Canonical control" required value={value.controlId} onChange={event => onChange({ ...value, controlId: event.target.value })} disabled={disabled} style={inputStyle}><option value="">Select a control</option>{visible(options.controls).map(item => <option value={item.id} key={item.id}>{item.label} · {item.detail}</option>)}</select>}
    </section>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: theme.spacing[3] }}>{(['riskIds', 'policyIds', 'evidenceIds'] as MultiField[]).map(field => { const items = visible(options[field]); return <section key={field} style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2] }}><strong>{labels[field]}</strong><small>{value[field].length} linked</small></div>{loading ? <span role="status">Loading...</span> : errors[field] ? <span role="alert" style={{ color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>{errors[field]}</span> : items.length ? <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 190, overflowY: 'auto' }}>{items.map(item => <label key={item.id} style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'flex-start' }}><input type="checkbox" checked={value[field].includes(item.id)} onChange={() => toggle(field, item.id)} disabled={disabled} /><span><strong>{item.label}</strong><br/><small>{item.detail}</small></span></label>)}</div> : <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>No matching records available.</span>}</section>; })}</div>
  </div>;
}
