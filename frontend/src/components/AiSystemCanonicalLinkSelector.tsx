import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { AiIncidentRecord } from '../types/aiGovernance';
import type { Control } from '../types/control';
import type { EvidenceItem } from '../types/evidence';
import type { Risk } from '../types/risk';
import type { Vendor } from '../types/vendor';

export type AiSystemLinkField = 'linkedRiskIds' | 'linkedControlIds' | 'linkedEvidenceIds' | 'linkedVendorIds' | 'linkedIncidentIds';
export type AiSystemLinks = Record<AiSystemLinkField, string[]>;
type LinkOption = { id: string; label: string; detail: string };

const fields: AiSystemLinkField[] = ['linkedRiskIds', 'linkedControlIds', 'linkedEvidenceIds', 'linkedVendorIds', 'linkedIncidentIds'];
const labels: Record<AiSystemLinkField, string> = { linkedRiskIds: 'Enterprise risks', linkedControlIds: 'Controls', linkedEvidenceIds: 'Evidence metadata', linkedVendorIds: 'Suppliers', linkedIncidentIds: 'Recorded AI incidents' };
const emptyOptions = (): Record<AiSystemLinkField, LinkOption[]> => ({ linkedRiskIds: [], linkedControlIds: [], linkedEvidenceIds: [], linkedVendorIds: [], linkedIncidentIds: [] });
const inputStyle = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };

export function AiSystemCanonicalLinkSelector({ active, incidents, value, onChange, disabled = false }: {
  active: boolean;
  incidents: AiIncidentRecord[];
  value: AiSystemLinks;
  onChange: (field: AiSystemLinkField, value: string[]) => void;
  disabled?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();
  const [options, setOptions] = useState<Record<AiSystemLinkField, LinkOption[]>>(emptyOptions);
  const [errors, setErrors] = useState<Partial<Record<AiSystemLinkField, string>>>({});
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
        apiCall<{ data: Risk[] }>('/api/v1/risks'),
        apiCall<{ data: Control[] }>('/api/v1/controls'),
        apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
        apiCall<{ data: Vendor[] }>('/api/v1/vendors'),
      ]);
    }).then(results => {
      if (!results || sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      const next = emptyOptions();
      const nextErrors: Partial<Record<AiSystemLinkField, string>> = {};
      const remoteFields: AiSystemLinkField[] = ['linkedRiskIds', 'linkedControlIds', 'linkedEvidenceIds', 'linkedVendorIds'];
      results.forEach((result, index) => { if (result.status === 'rejected') nextErrors[remoteFields[index]] = 'Unavailable with current access.'; });
      if (results[0].status === 'fulfilled') next.linkedRiskIds = results[0].value.data.map(item => ({ id: item.id, label: `${item.riskRef || item.id} · ${item.title}`, detail: `${item.owner} · ${item.category}` }));
      if (results[1].status === 'fulfilled') next.linkedControlIds = results[1].value.data.map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.status}` }));
      if (results[2].status === 'fulfilled') next.linkedEvidenceIds = results[2].value.data.map(item => ({ id: item.id, label: item.name, detail: `${item.type} · ${item.reviewStatus || 'not reviewed'} · ${item.attachmentStatus === 'stored' ? 'stored attachment' : 'metadata/reference only'}` }));
      if (results[3].status === 'fulfilled') next.linkedVendorIds = results[3].value.data.map(item => ({ id: item.id, label: `${item.supplierRef || item.id} · ${item.name}`, detail: `${item.owner} · ${item.status}` }));
      next.linkedIncidentIds = incidents.map(item => ({ id: item.id, label: item.title, detail: `${item.owner} · ${item.severity} · ${item.status}` }));
      setOptions(next); setErrors(nextErrors);
    }).finally(() => { if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false); });
    return () => { requestSequence.current += 1; };
  }, [active, currentWorkspace.id, incidents]);

  const query = search.trim().toLowerCase();
  const toggle = (field: AiSystemLinkField, id: string) => onChange(field, value[field].includes(id) ? value[field].filter(item => item !== id) : [...value[field], id]);

  return <div style={{ display: 'grid', gap: theme.spacing[3] }}>
    <div style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Optional links use canonical records from this workspace. Evidence metadata does not prove binary storage, and no relationship is inferred from names or provider activity.</div>
    <label style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>Search linked records<input aria-label="Search AI system relationships" style={inputStyle} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled || loading} placeholder="Search reference, title, owner or status" /></label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: theme.spacing[3] }}>{fields.map(field => { const visible = options[field].filter(item => !query || `${item.label} ${item.detail}`.toLowerCase().includes(query)); return <section key={field} style={{ display: 'grid', gap: theme.spacing[2], alignContent: 'start', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2] }}><strong>{labels[field]}</strong><small>{value[field].length} linked</small></div>{loading && field !== 'linkedIncidentIds' ? <span role="status">Loading...</span> : errors[field] ? <span role="alert" style={{ color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>{errors[field]}</span> : visible.length ? <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 190, overflowY: 'auto' }}>{visible.map(item => <label key={item.id} style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'flex-start' }}><input type="checkbox" checked={value[field].includes(item.id)} onChange={() => toggle(field, item.id)} disabled={disabled} /><span><strong>{item.label}</strong><br/><small>{item.detail}</small></span></label>)}</div> : <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>No matching records available.</span>}</section>; })}</div>
  </div>;
}
