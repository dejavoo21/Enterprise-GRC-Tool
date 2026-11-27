import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import type { Control } from '../types/control';

export function RiskLibraryControlSelector({ value, onChange, disabled = false }: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();
  const [controls, setControls] = useState<Control[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const workspaceId = currentWorkspace.id;
    void Promise.resolve().then(() => {
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return null;
      setControls([]);
      setSearch('');
      setError('');
      setLoading(true);
      return apiCall<{ data: Control[] }>('/api/v1/controls');
    }).then((response) => {
      if (!response || sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      setControls(response.data);
    }).catch((cause) => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) {
        setError(cause instanceof Error ? cause.message : 'Control Library records are unavailable with current access.');
      }
    }).finally(() => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false);
    });
    return () => { requestSequence.current += 1; };
  }, [currentWorkspace.id]);

  const query = search.trim().toLowerCase();
  const visible = controls.filter((control) => !query || `${control.title} ${control.owner} ${control.primaryFramework || ''} ${control.domain || ''} ${control.status}`.toLowerCase().includes(query));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return <div style={{ display: 'grid', gap: 8 }}>
    <strong>Related controls</strong>
    <span>Select canonical current-workspace controls. Suggested control text remains separate and does not create a persisted link.</span>
    <input aria-label="Search related controls" type="search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled || loading || Boolean(error)} placeholder="Search control title, owner, framework or status" />
    {loading ? <span role="status">Loading Control Library...</span> : error ? <span role="alert">{error} Existing selections are retained.</span> : visible.length ? <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
      {visible.map((control) => <label key={control.id}><input type="checkbox" checked={value.includes(control.id)} onChange={() => toggle(control.id)} disabled={disabled} />{control.title} · {control.owner} · {control.status}</label>)}
    </div> : <span>No matching controls are available.</span>}
  </div>;
}
