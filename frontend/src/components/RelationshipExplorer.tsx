import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { archiveRelationship, createRelationship, getRelationshipHistory, getRelationships, searchRelationshipTargets } from '../services/relationships';
import type { EnterpriseRelationship, RelationshipEntityType, RelationshipEvent, RelationshipExplorerData, RelationshipType } from '../types/relationships';
import { Badge, Button, Card, EmptyStatePanel, Modal, PageSectionCard } from './index';
import { theme } from '../theme';

const options: Partial<Record<RelationshipEntityType, Array<{ type: RelationshipType; target: RelationshipEntityType; label: string }>>> = {
  risk: [{ type: 'risk_asset', target: 'asset', label: 'Asset' }, { type: 'risk_control', target: 'control', label: 'Control' }, { type: 'risk_evidence', target: 'evidence', label: 'Evidence' }],
  supplier: [{ type: 'supplier_asset', target: 'asset', label: 'Asset' }, { type: 'supplier_contract', target: 'contract', label: 'Contract' }],
  asset: [{ type: 'asset_business_process', target: 'business_process', label: 'Business process' }],
  ai_system: [{ type: 'ai_system_data_asset', target: 'data_asset', label: 'Data asset' }],
};
const inputStyle = { width: '100%', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, background: theme.colors.surface };
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const routeFor: Partial<Record<RelationshipEntityType, string>> = {
  risk: 'risks', asset: 'assets', control: 'controls', evidence: 'evidence', supplier: 'vendors', contract: 'vendors',
  policy: 'governance-documents', framework: 'frameworks', finding: 'audit-readiness', remediation: 'audit-readiness',
  business_process: 'business-continuity',
  ai_system: 'ai-governance', data_asset: 'privacy-data-governance',
};

export function RelationshipExplorer({ entityType, entityId, onNavigate }: { entityType: RelationshipEntityType; entityId: string; onNavigate?: (key: string) => void }) {
  const [data, setData] = useState<RelationshipExplorerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RelationshipEntityType | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState<RelationshipType | ''>('');
  const [search, setSearch] = useState('');
  const [targets, setTargets] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [archiving, setArchiving] = useState<EnterpriseRelationship | null>(null);
  const [historyRelationship, setHistoryRelationship] = useState<EnterpriseRelationship | null>(null);
  const [history, setHistory] = useState<RelationshipEvent[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const historyLock = useRef(false);
  const choices = options[entityType] || [];
  const choice = choices.find(item => item.type === selectedType);
  const closeArchive = () => { if (!busy && !mutationLock.current) setArchiving(null); };

  const load = useCallback(async () => {
    try { setError(null); setData(await getRelationships(entityType, entityId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load relationships.'); }
  }, [entityId, entityType]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelectedType(''); setSearch(''); setTargets([]); setSelectedTarget(''); setShowAdd(false); setArchiving(null); setHistoryRelationship(null); setHistory([]); setHistoryError(null); }, [entityId, entityType]);
  const visible = useMemo(() => (data?.relationships || []).filter(item => filter === 'all' || (item.direction === 'outgoing' ? item.targetEntityType : item.sourceEntityType) === filter), [data, filter]);
  const grouped = useMemo(() => visible.reduce<Record<string, EnterpriseRelationship[]>>((acc, item) => {
    const group = item.direction === 'outgoing' ? item.targetEntityType : item.sourceEntityType;
    (acc[group] ||= []).push(item); return acc;
  }, {}), [visible]);

  const runSearch = async () => {
    if (mutationLock.current) return;
    if (!choice) return;
    mutationLock.current = true;
    setBusy(true); setError(null);
    try { setTargets(await searchRelationshipTargets(entityType, choice.target, search)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to search relationship targets.'); }
    finally { mutationLock.current = false; setBusy(false); }
  };
  const add = async () => {
    if (mutationLock.current) return;
    if (!choice || !selectedTarget) return;
    mutationLock.current = true;
    setBusy(true); setError(null);
    try { await createRelationship({ sourceEntityType: entityType, sourceEntityId: entityId, targetEntityType: choice.target, targetEntityId: selectedTarget, relationshipType: choice.type }); setShowAdd(false); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create relationship.'); }
    finally { mutationLock.current = false; setBusy(false); }
  };
  const archive = async () => {
    if (mutationLock.current) return;
    if (!archiving) return;
    mutationLock.current = true;
    setBusy(true); setError(null);
    try { await archiveRelationship(archiving.id); setArchiving(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to archive the relationship.'); }
    finally { mutationLock.current = false; setBusy(false); }
  };
  const openHistory = async (relationship: EnterpriseRelationship) => {
    if (historyLock.current) return;
    historyLock.current = true;
    setHistoryRelationship(relationship); setHistory([]); setHistoryError(null); setHistoryLoading(true);
    try { setHistory(await getRelationshipHistory(relationship.id)); }
    catch (cause) { setHistoryError(cause instanceof Error ? cause.message : 'Unable to load relationship history.'); }
    finally { historyLock.current = false; setHistoryLoading(false); }
  };

  return (
    <PageSectionCard title="Relationship Explorer" subtitle="Direct, workspace-scoped relationships only. No indirect dependency or impact score is inferred."
      action={<div style={{ display: 'flex', gap: theme.spacing[2] }}><Button variant="secondary" onClick={() => void load()} disabled={busy}>Refresh</Button>{choices.length ? <Button variant="primary" onClick={() => setShowAdd(value => !value)} disabled={busy}>Add relationship</Button> : null}</div>}>
      {error ? <Card role="alert" style={{ padding: theme.spacing[3], color: theme.colors.semantic.danger }}>{error}</Card> : null}
      {data ? <div style={{ display: 'grid', gap: theme.spacing[4] }}>
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', alignItems: 'center' }}>
          <strong>{data.entity.label}</strong><Badge variant="primary" size="sm">{label(data.entity.type)}</Badge>
          {Object.entries(data.counts).map(([type, count]) => <button key={type} type="button" onClick={() => setFilter(type as RelationshipEntityType)} style={{ border: 0, background: 'transparent', padding: 0 }}><Badge variant="default" size="sm">{label(type)} {count}</Badge></button>)}
          {filter !== 'all' ? <Button variant="ghost" onClick={() => setFilter('all')}>Clear filter</Button> : null}
        </div>
        {showAdd ? <Card style={{ padding: theme.spacing[4] }}><fieldset disabled={busy} aria-busy={busy} style={{ margin: 0, padding: 0, border: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.spacing[3], alignItems: 'end' }}>
          <label><span>Relationship</span><select value={selectedType} onChange={event => { setSelectedType(event.target.value as RelationshipType); setTargets([]); setSelectedTarget(''); }} style={inputStyle}><option value="">Select type</option>{choices.map(item => <option key={item.type} value={item.type}>Links to {item.label}</option>)}</select></label>
          <label><span>Find target record</span><input value={search} onChange={event => setSearch(event.target.value)} style={inputStyle} placeholder="Search by ID or name" /></label>
          <Button variant="secondary" onClick={() => void runSearch()} disabled={!choice || busy}>Search</Button>
          {targets.length ? <label style={{ gridColumn: '1 / -1' }}><span>Target</span><select value={selectedTarget} onChange={event => setSelectedTarget(event.target.value)} style={inputStyle}><option value="">Select record</option>{targets.map(item => <option key={item.id} value={item.id}>{item.label} ({item.id})</option>)}</select></label> : null}
          {targets.length ? <Button variant="primary" onClick={() => void add()} disabled={!selectedTarget || busy}>Create link</Button> : null}
        </fieldset></Card> : null}
        {visible.length === 0 ? <EmptyStatePanel title="No direct relationships" description="No active canonical relationships match this record and filter." /> : Object.entries(grouped).map(([group, items]) => <div key={group} style={{ display: 'grid', gap: theme.spacing[2] }}>
          <strong>{label(group)}</strong>{items.map(item => { const incoming = item.direction === 'incoming'; return <Card key={item.id} style={{ padding: theme.spacing[3], display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
            <div><strong>{incoming ? item.sourceLabel : item.targetLabel}</strong><div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>{label(item.relationshipType)} · {incoming ? 'Upstream' : 'Downstream'} · {item.provenance}</div></div>
            <div style={{ display: 'flex', gap: theme.spacing[2] }}>
              <Button variant="ghost" onClick={() => void openHistory(item)} disabled={historyLoading}>History</Button>
              {onNavigate && routeFor[incoming ? item.sourceEntityType : item.targetEntityType] ? <Button variant="ghost" onClick={() => onNavigate(routeFor[incoming ? item.sourceEntityType : item.targetEntityType]!)}>Open record</Button> : null}
              {incoming
                ? <span style={{ alignSelf: 'center', color: theme.colors.text.muted, fontSize: theme.typography.sizes.xs }}>Managed from source</span>
                : <Button variant="secondary" onClick={() => setArchiving(item)} disabled={busy}>Archive</Button>}
            </div>
          </Card>; })}
        </div>)}
      </div> : <div style={{ color: theme.colors.text.secondary }}>Loading relationships...</div>}
      <Modal accessibleDialog isOpen={Boolean(archiving)} onClose={closeArchive} title="Archive relationship" width="560px" footer={<><Button variant="secondary" onClick={closeArchive} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => void archive()} disabled={busy}>{busy ? 'Archiving...' : 'Archive relationship'}</Button></>}>
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <p style={{ margin: 0 }}>Archive the direct relationship with <strong>{archiving ? (archiving.direction === 'incoming' ? archiving.sourceLabel : archiving.targetLabel) : ''}</strong>?</p>
          <p style={{ margin: 0, color: theme.colors.text.secondary }}>The active link will be removed from impact views. Immutable relationship history will be retained.</p>
          {error ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{error}</div> : null}
        </div>
      </Modal>
      <Modal accessibleDialog isOpen={Boolean(historyRelationship)} onClose={() => { if (!historyLoading) setHistoryRelationship(null); }} title="Relationship history" width="640px" footer={<Button variant="secondary" onClick={() => setHistoryRelationship(null)} disabled={historyLoading}>Close</Button>}>
        <div aria-busy={historyLoading} style={{ display: 'grid', gap: theme.spacing[3] }}>
          <p style={{ margin: 0, color: theme.colors.text.secondary }}>Immutable create and archive events for this direct relationship.</p>
          {historyLoading ? <p style={{ margin: 0 }}>Loading recorded history...</p> : null}
          {historyError ? <div role="alert" style={{ color: theme.colors.semantic.danger }}>{historyError}</div> : null}
          {!historyLoading && !historyError && history.length === 0 ? <p style={{ margin: 0, color: theme.colors.text.muted }}>No relationship history is available.</p> : null}
          {history.map(event => <Card key={event.id} style={{ padding: theme.spacing[3] }}>
            <strong>{event.eventType === 'created' ? 'Relationship created' : 'Relationship archived'}</strong>
            <div style={{ marginTop: theme.spacing[1], color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>{event.actorName} · {new Date(event.occurredAt).toLocaleString()}</div>
          </Card>)}
        </div>
      </Modal>
    </PageSectionCard>
  );
}
