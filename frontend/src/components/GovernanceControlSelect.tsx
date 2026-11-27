import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import type { Control } from '../types/control';

const inputStyle = { width: '100%', padding: theme.spacing[2], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, font: 'inherit' };

export function GovernanceControlSelect({ value, onChange, onSelect, disabled = false, label = 'Canonical control' }: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (control: Control | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { currentWorkspace } = useWorkspace();
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const workspaceId = currentWorkspace.id;
    void Promise.resolve().then(() => {
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return null;
      setLoading(true); setError(''); setControls([]);
      return apiCall<{ data: Control[] }>('/api/v1/controls');
    }).then(result => {
      if (!result || sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      setControls(result.data);
    }).catch(reason => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setError(reason instanceof Error ? reason.message : 'Controls are unavailable with current access.');
    }).finally(() => { if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false); });
    return () => { requestSequence.current += 1; };
  }, [currentWorkspace.id]);

  return <label style={{ display: 'grid', gap: theme.spacing[1], fontSize: theme.typography.sizes.sm }}>{label}
    {loading ? <span role="status">Loading controls...</span> : error ? <span role="alert" style={{ color: theme.colors.semantic.danger }}>{error} Existing selection is retained.</span> : <select required value={value} onChange={event => { const nextValue = event.target.value; onChange(nextValue); onSelect?.(controls.find(item => item.id === nextValue) || null); }} disabled={disabled} style={inputStyle}><option value="">Select a control</option>{controls.map(item => <option value={item.id} key={item.id}>{item.title} · {item.owner} · {item.status}</option>)}</select>}
  </label>;
}
