import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { Control } from '../types/control';
import type { EvidenceItem } from '../types/evidence';

export type RegulatoryObligationLinks = { linkedControls: string[]; complianceEvidence: string[] };
type LinkField = keyof RegulatoryObligationLinks;
type LinkOption = { id: string; label: string; detail: string };

const fields: LinkField[] = ['linkedControls', 'complianceEvidence'];
const labels: Record<LinkField, string> = { linkedControls: 'Controls', complianceEvidence: 'Evidence metadata' };
const emptyOptions = (): Record<LinkField, LinkOption[]> => ({ linkedControls: [], complianceEvidence: [] });
const inputStyle = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };

export function RegulatoryObligationLinkSelector({ active, value, onChange, disabled = false }: {
  active: boolean;
  value: RegulatoryObligationLinks;
  onChange: (field: LinkField, value: string[]) => void;
  disabled?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();
  const [options, setOptions] = useState<Record<LinkField, LinkOption[]>>(emptyOptions);
  const [errors, setErrors] = useState<Partial<Record<LinkField, string>>>({});
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
        apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
      ]);
    }).then(results => {
      if (!results || sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      const next = emptyOptions();
      const nextErrors: Partial<Record<LinkField, string>> = {};
      if (results[0].status === 'fulfilled') next.linkedControls = results[0].value.data.map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` })); else nextErrors.linkedControls = 'Controls are unavailable with current access.';
      if (results[1].status === 'fulfilled') next.complianceEvidence = results[1].value.data.map(item => ({ id: item.id, label: item.name, detail: `${item.type} · ${item.reviewStatus || 'not reviewed'} · ${item.attachmentStatus === 'stored' ? 'stored attachment' : 'metadata/reference only'}` })); else nextErrors.complianceEvidence = 'Evidence metadata is unavailable with current access.';
      setOptions(next); setErrors(nextErrors);
    }).finally(() => { if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false); });
    return () => { requestSequence.current += 1; };
  }, [active, currentWorkspace.id]);

  const query = search.trim().toLowerCase();
  const toggle = (field: LinkField, id: string) => onChange(field, value[field].includes(id) ? value[field].filter(item => item !== id) : [...value[field], id]);

  return <div style={{ gridColumn: '1 / -1', display: 'grid', gap: theme.spacing[3] }}>
    <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Link canonical workspace Controls and Evidence metadata. Evidence metadata does not prove that a binary attachment is stored or that compliance has been independently verified.</div>
    <label style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>Search linked records<input aria-label="Search obligation relationships" style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled || loading} placeholder="Search title, owner, type or status" /></label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: theme.spacing[3] }}>{fields.map(field => { const visible = options[field].filter(item => !query || `${item.label} ${item.detail}`.toLowerCase().includes(query)); return <section key={field} style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2] }}><strong>{labels[field]}</strong><small>{value[field].length} linked</small></div>{loading ? <span role="status">Loading...</span> : errors[field] ? <span role="alert" style={{ color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>{errors[field]}</span> : visible.length ? <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 190, overflowY: 'auto' }}>{visible.map(item => <label key={item.id} style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'flex-start' }}><input type="checkbox" checked={value[field].includes(item.id)} onChange={() => toggle(field, item.id)} disabled={disabled} /><span><strong>{item.label}</strong><br/><small>{item.detail}</small></span></label>)}</div> : <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>No matching records available.</span>}</section>; })}</div>
  </div>;
}
