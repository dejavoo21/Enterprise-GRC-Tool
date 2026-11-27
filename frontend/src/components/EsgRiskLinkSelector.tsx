import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall } from '../lib/api';
import type { Risk } from '../types/risk';

export function EsgRiskLinkSelector({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { currentWorkspace } = useWorkspace();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const workspaceId = currentWorkspace.id;
    void Promise.resolve().then(() => {
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return null;
      setRisks([]);
      setSearch('');
      setError('');
      setLoading(true);
      return apiCall<{ data: Risk[] }>('/api/v1/risks');
    }).then((response) => {
      if (!response) return;
      if (sequence !== requestSequence.current || workspaceId !== currentWorkspace.id) return;
      setRisks(response.data);
    }).catch((cause) => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) {
        setError(cause instanceof Error ? cause.message : 'Risk Register records are unavailable with current access.');
      }
    }).finally(() => {
      if (sequence === requestSequence.current && workspaceId === currentWorkspace.id) setLoading(false);
    });
    return () => { requestSequence.current += 1; };
  }, [currentWorkspace.id]);

  const query = search.trim().toLowerCase();
  const visible = risks.filter((risk) => !query || `${risk.riskRef || ''} ${risk.title} ${risk.owner} ${risk.category}`.toLowerCase().includes(query));

  return <div className="esgEntryWide" style={{ display: 'grid', gap: 8 }}>
    <strong>Linked enterprise risk (optional)</strong>
    <span style={{ fontSize: 12 }}>Select an existing current-workspace Risk Register record. No relationship is inferred from the ESG risk title or score.</span>
    <input aria-label="Search enterprise risks" type="search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled || loading || Boolean(error)} placeholder="Search risk reference, title, owner or category" />
    {loading ? <span role="status">Loading Risk Register...</span> : error ? <span role="alert">{error}</span> : <select aria-label="Linked enterprise risk" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      <option value="">No enterprise risk linked</option>
      {visible.map((risk) => <option key={risk.id} value={risk.id}>{risk.riskRef || risk.id} · {risk.title} · {risk.owner}</option>)}
    </select>}
  </div>;
}
