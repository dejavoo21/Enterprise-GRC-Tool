import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiCall } from '../lib/api';
import { theme } from '../theme';

type GovernanceContext = {
  controlId: string;
  raci: Array<{
    id: string;
    scope_name?: string;
    location?: string;
    responsible: string[];
    accountable?: string;
    status: string;
  }>;
  soa: Array<{
    id: string;
    soa_ref: string;
    document_version: number;
    scope_name: string;
    applicable: boolean;
    implementation_status: string;
    evidence_ids: string[];
    soa_status: string;
  }>;
};

type ContextResponse = { data: GovernanceContext | null; error?: { message: string } | null };

interface ControlGovernanceSummaryProps {
  controlIds: string[];
  emptyMessage?: string;
}

export function ControlGovernanceSummary({ controlIds, emptyMessage = 'No RACI or SoA context has been recorded for the linked controls.' }: ControlGovernanceSummaryProps) {
  const normalizedIds = useMemo(() => [...new Set(controlIds.filter(Boolean))].sort(), [controlIds]);
  const requestKey = normalizedIds.join('|');
  const [result, setResult] = useState<{ key: string; contexts: GovernanceContext[]; unavailable: boolean }>({ key: '', contexts: [], unavailable: false });

  useEffect(() => {
    let active = true;
    if (!requestKey) return () => { active = false; };

    void Promise.all(normalizedIds.map((controlId) => apiCall<ContextResponse>(`${API_BASE}/governance/controls/${controlId}/context`)))
      .then((results) => {
        if (!active) return;
        const failed = results.some((result) => Boolean(result.error));
        setResult({ key: requestKey, contexts: results.flatMap((item) => item.data ? [item.data] : []), unavailable: failed });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, contexts: [], unavailable: true });
      });

    return () => { active = false; };
  }, [normalizedIds, requestKey]);

  if (!normalizedIds.length) {
    return <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>No controls are linked.</div>;
  }
  if (result.key !== requestKey) {
    return <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>Loading governance context...</div>;
  }

  const hasRecords = result.contexts.some((context) => context.raci.length || context.soa.length);
  if (!hasRecords) {
    return <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>{result.unavailable ? 'Governance context is currently unavailable.' : emptyMessage}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: theme.spacing[3] }}>
      {result.contexts.map((context) => (
        <div key={context.controlId} style={{ display: 'grid', gap: theme.spacing[2] }}>
          <strong style={{ color: theme.colors.text.main, fontSize: theme.typography.sizes.sm }}>{context.controlId}</strong>
          {context.raci.map((item) => (
            <div key={item.id} style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md }}>
              <strong style={{ fontSize: theme.typography.sizes.sm }}>RACI · {item.scope_name || 'Enterprise'}{item.location ? ` · ${item.location}` : ''}</strong>
              <div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                Responsible: {item.responsible.join(', ') || 'Missing'} · Accountable: {item.accountable || 'Missing'} · {item.status}
              </div>
            </div>
          ))}
          {context.soa.map((item) => (
            <div key={item.id} style={{ padding: theme.spacing[3], background: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md }}>
              <strong style={{ fontSize: theme.typography.sizes.sm }}>{item.soa_ref} v{item.document_version} · {item.scope_name}</strong>
              <div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.xs }}>
                {item.applicable ? 'Applicable' : 'Excluded'} · {item.implementation_status.replaceAll('_', ' ')} · {item.evidence_ids.length} evidence references · {item.soa_status}
              </div>
            </div>
          ))}
        </div>
      ))}
      {result.unavailable ? <div style={{ color: theme.colors.semantic.danger, fontSize: theme.typography.sizes.xs }}>Some linked control context could not be loaded.</div> : null}
    </div>
  );
}
