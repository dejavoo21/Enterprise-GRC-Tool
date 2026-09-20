import { useMemo, useState } from 'react';
import { Badge, Button, Card, PageSectionCard } from '.';
import { useFrameworks } from '../context/FrameworkContext';
import { approveFrameworkAssessmentScope, createFrameworkAssessmentScope, fetchFrameworkAssessmentScope, includeAllFrameworkScopeControls, listFrameworkAssessmentScopes, updateFrameworkScopeControl } from '../lib/api';
import { SCOPE_REASON_OPTIONS, SCOPE_STATUS_OPTIONS, type FrameworkAssessmentScope, type FrameworkScopeControl, type ScopeExclusionReason, type ScopeInclusionStatus } from '../types/frameworkAssessmentScope';
import { theme } from '../theme';

export function FrameworkAssessmentScopePanel() {
  const { frameworks } = useFrameworks();
  const [frameworkCode, setFrameworkCode] = useState('');
  const [scope, setScope] = useState<FrameworkAssessmentScope | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<FrameworkScopeControl | null>(null);
  const [draft, setDraft] = useState<{ inclusionStatus: ScopeInclusionStatus; exclusionReason?: ScopeExclusionReason; justification: string; evidenceReference: string; reviewDate: string }>({ inclusionStatus: 'included', justification: '', evidenceReference: '', reviewDate: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOrCreate = async () => {
    const framework = frameworks.find((item) => item.code === frameworkCode); if (!framework) return;
    setBusy(true); setMessage(null);
    try {
      const scopes = await listFrameworkAssessmentScopes(framework.code);
      setScope(scopes[0] ? await fetchFrameworkAssessmentScope(scopes[0].id) : await createFrameworkAssessmentScope({ frameworkCode: framework.code, frameworkName: framework.name, name: `${framework.name} current assessment`, description: 'Workspace-specific control applicability and readiness scope.' }));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to configure assessment scope.'); } finally { setBusy(false); }
  };
  const filtered = useMemo(() => (scope?.controls || []).filter((control) => (statusFilter === 'all' || control.inclusionStatus === statusFilter) && `${control.frameworkReference} ${control.controlTitle}`.toLowerCase().includes(search.toLowerCase())), [scope, search, statusFilter]);
  const beginEdit = (control: FrameworkScopeControl) => { setEditing(control); setDraft({ inclusionStatus: control.inclusionStatus, exclusionReason: control.exclusionReason || undefined, justification: control.justification || '', evidenceReference: control.evidenceReference || '', reviewDate: control.reviewDate?.slice(0, 10) || '' }); setMessage(null); };
  const save = async () => {
    if (!scope || !editing) return; const needsReason = draft.inclusionStatus !== 'included';
    if (needsReason && (!draft.exclusionReason || !draft.justification.trim())) { setMessage('A reason and audit-ready justification are required for this status.'); return; }
    if (draft.inclusionStatus === 'deferred' && !draft.reviewDate) { setMessage('Deferred controls require a review date.'); return; }
    setBusy(true); try { await updateFrameworkScopeControl(scope.id, editing.controlId, draft); setScope(await fetchFrameworkAssessmentScope(scope.id)); setEditing(null); setMessage('Control scope saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save control scope.'); } finally { setBusy(false); }
  };

  return <PageSectionCard title="Framework Assessment Scope" subtitle="Include or exclude controls for this assessment without changing the framework library.">
    <div style={{ display: 'grid', gap: theme.spacing[4] }}>
      <Card style={{ padding: theme.spacing[3], background: theme.colors.primaryLight, color: theme.colors.text.main }}>Excluding a control removes it from this assessment’s readiness calculation but does not delete it from the framework library.</Card>
      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        <select aria-label="Framework to scope" value={frameworkCode} onChange={(e) => { setFrameworkCode(e.target.value); setScope(null); }} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, minWidth: 260 }}><option value="">Select framework</option>{frameworks.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
        <Button variant="primary" disabled={!frameworkCode || busy} onClick={() => void loadOrCreate()}>{busy ? 'Loading...' : 'Configure Scope'}</Button>
      </div>
      {message ? <div role="status" style={{ color: message.includes('required') || message.includes('Unable') ? theme.colors.semantic.danger : theme.colors.semantic.success }}>{message}</div> : null}
      {scope ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: theme.spacing[2] }}>{[
          ['Total',scope.summary.total],['Included',scope.summary.included],['Excluded',scope.summary.excluded],['Not applicable',scope.summary.notApplicable],['Deferred',scope.summary.deferred],['Readiness',`${scope.summary.readinessPercent}%`]
        ].map(([label,value]) => <Card key={label} style={{ padding: theme.spacing[3] }}><div style={{ color: theme.colors.text.muted, fontSize: theme.typography.sizes.xs }}>{label}</div><strong style={{ fontSize: theme.typography.sizes.xl }}>{value}</strong></Card>)}</div>
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}><input aria-label="Search scoped controls" placeholder="Search control or reference" value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, flex: 1 }} /><select aria-label="Filter scope status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}><option value="all">All statuses</option>{SCOPE_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Button variant="outline" onClick={async () => { setBusy(true); try { setScope(await includeAllFrameworkScopeControls(scope.id)); } finally { setBusy(false); } }}>Include All</Button><Button variant="secondary" disabled={scope.approvalStatus === 'approved' || scope.summary.requiringJustification > 0 || busy} onClick={async () => { setBusy(true); try { setScope(await approveFrameworkAssessmentScope(scope.id)); setMessage('Assessment scope approved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to approve scope.'); } finally { setBusy(false); } }}>{scope.approvalStatus === 'approved' ? 'Approved' : 'Approve Scope'}</Button></div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm }}><thead><tr>{['Reference','Control','Status','Implementation','Action'].map((head) => <th key={head} style={{ textAlign: 'left', padding: theme.spacing[2], borderBottom: `1px solid ${theme.colors.border}` }}>{head}</th>)}</tr></thead><tbody>{filtered.map((control) => <tr key={control.controlId}><td style={{ padding: theme.spacing[2], borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.frameworkReference || '—'}</td><td style={{ padding: theme.spacing[2], borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.controlTitle}</td><td style={{ padding: theme.spacing[2], borderBottom: `1px solid ${theme.colors.borderLight}` }}><Badge size="sm" variant={control.inclusionStatus === 'included' ? 'success' : 'warning'}>{SCOPE_STATUS_OPTIONS.find((item) => item.value === control.inclusionStatus)?.label}</Badge></td><td style={{ padding: theme.spacing[2], borderBottom: `1px solid ${theme.colors.borderLight}` }}>{control.implementationStatus.replaceAll('_',' ')}</td><td style={{ padding: theme.spacing[2], borderBottom: `1px solid ${theme.colors.borderLight}` }}><Button variant="ghost" onClick={() => beginEdit(control)}>Manage</Button></td></tr>)}</tbody></table></div>
        {editing ? <Card style={{ padding: theme.spacing[4], display: 'grid', gap: theme.spacing[3] }}><strong>Manage scope: {editing.controlTitle}</strong><select aria-label="Inclusion status" value={draft.inclusionStatus} onChange={(e) => setDraft((v) => ({ ...v, inclusionStatus: e.target.value as ScopeInclusionStatus }))}>{SCOPE_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{draft.inclusionStatus !== 'included' ? <><select aria-label="Exclusion reason" value={draft.exclusionReason || ''} onChange={(e) => setDraft((v) => ({ ...v, exclusionReason: e.target.value as ScopeExclusionReason }))}><option value="">Select reason</option>{SCOPE_REASON_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><textarea aria-label="Audit-ready justification" placeholder="Audit-ready justification" rows={3} value={draft.justification} onChange={(e) => setDraft((v) => ({ ...v, justification: e.target.value }))}/><input aria-label="Evidence or inheritance reference" placeholder="Evidence or inheritance reference" value={draft.evidenceReference} onChange={(e) => setDraft((v) => ({ ...v, evidenceReference: e.target.value }))}/>{draft.inclusionStatus === 'deferred' ? <input aria-label="Review date" type="date" value={draft.reviewDate} onChange={(e) => setDraft((v) => ({ ...v, reviewDate: e.target.value }))}/> : null}</> : null}<div style={{ display: 'flex', gap: theme.spacing[2] }}><Button variant="primary" disabled={busy} onClick={() => void save()}>Save Scope</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div></Card> : null}
      </> : null}
    </div>
  </PageSectionCard>;
}
