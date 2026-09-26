import { useState } from 'react';
import { Badge, Button, Modal } from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { archiveWorkspace, createWorkspace, updateWorkspaceSettings } from '../lib/api';
import { getWorkspaceDisplayName, getWorkspaceOrganizationName } from '../lib/workspaceDisplay';
import { INDUSTRY_OPTIONS, REGION_OPTIONS, type Workspace } from '../types/workspace';
import { AdminCard, AdminHero, AdminMetrics, AdminNotice, AdminOverlay } from './admin/AdminPrimitives';

type WorkspaceForm = { displayName: string; industry: string; region: string; status: string };
function WorkspaceFields({ value, onChange, settings = false }: { value: WorkspaceForm; onChange: (value: WorkspaceForm) => void; settings?: boolean }) {
  return <div className="adminStack">
    <label>{settings ? 'Workspace Name' : 'Organization Name'}<input required maxLength={200} value={value.displayName} onChange={event => onChange({ ...value, displayName: event.target.value })} placeholder="Enter name" /></label>
    <div className="adminFormGrid"><label>Industry<select value={value.industry} onChange={event => onChange({ ...value, industry: event.target.value })}>{INDUSTRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Region<select value={value.region} onChange={event => onChange({ ...value, region: event.target.value })}>{REGION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    {settings && <label>Workspace Status<select value={value.status} onChange={event => onChange({ ...value, status: event.target.value })}><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option>{value.status === 'archived' && <option value="archived">Archived</option>}</select></label>}
  </div>;
}
function WorkspaceSettings({ workspace, onSaved }: { workspace: Workspace; onSaved: () => Promise<void> }) {
  const initial = { displayName: workspace.displayName || workspace.name, industry: workspace.industry || 'general', region: workspace.region || 'global', status: workspace.status };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.displayName.trim()) { setError('Workspace name is required.'); return; }
    setSaving(true); setError(null); setMessage('');
    try { await updateWorkspaceSettings(workspace.id, { ...form, displayName: form.displayName.trim() }); await onSaved(); setMessage('Workspace settings saved.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save settings.'); }
    finally { setSaving(false); }
  };
  return <form onSubmit={save}>
    <p className="adminHelp">Editing {getWorkspaceDisplayName(workspace)}. Changes apply only to this workspace.</p>
    <WorkspaceFields value={form} onChange={setForm} settings />
    {error && <AdminNotice error>{error}</AdminNotice>}{message && <AdminNotice>{message}</AdminNotice>}
    <div className="adminFooterActions"><Button type="button" variant="outline" disabled={saving} onClick={() => { setForm(initial); setError(null); setMessage('Changes discarded.'); }}>Cancel changes</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button></div>
  </form>;
}
export function WorkspaceManagement() {
  const { activeWorkspace, workspaces, refreshWorkspaces, switchWorkspace, loading } = useWorkspace();
  const auth = useAuth();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Workspace | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createForm, setCreateForm] = useState<WorkspaceForm>({ displayName: '', industry: 'general', region: 'global', status: 'active' });
  const editing = workspaces.find(workspace => workspace.id === editingId) || activeWorkspace;
  const visible = workspaces.filter(workspace => (!status || workspace.status === status) && [getWorkspaceDisplayName(workspace), workspace.tenantName, workspace.region, workspace.industry].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const run = async (id: string, operation: () => Promise<void>, success: string) => {
    if (busyId) return;
    setBusyId(id); setError(null); setMessage(null);
    try { await operation(); setMessage(success); }
    catch (err) { setError(err instanceof Error ? err.message : 'Workspace action failed.'); }
    finally { setBusyId(null); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    if (!createForm.displayName.trim()) { setError('Organization name is required.'); return; }
    setCreating(true); setError(null); setMessage(null);
    try {
      const result = await createWorkspace({ displayName: createForm.displayName.trim(), industry: createForm.industry, region: createForm.region, seedProfile: 'minimal' });
      setCreateForm({ displayName: '', industry: 'general', region: 'global', status: 'active' });
      setMessage('Workspace created.');
      // Auth switching does not depend on a stale inventory closure after provisioning.
      await auth.switchWorkspace(result.workspace.id);
      await refreshWorkspaces();
      setMessage('Workspace created and selected.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Workspace creation or selection failed.'); }
    finally { setCreating(false); }
  };
  return <div className="adminPage">
    <AdminHero title="Workspace Management" description="Create, switch, archive, and configure tenant-scoped operating workspaces." action={<Button type="submit" form="workspace-create-form" disabled={creating}>{creating ? 'Creating...' : 'Create Workspace'}</Button>} />
    <AdminMetrics metrics={[
      { label: 'Active Workspaces', value: loading ? 'Loading' : workspaces.filter(workspace => workspace.status === 'active').length, detail: 'Accessible active workspaces' },
      { label: 'Current Organization', value: activeWorkspace ? getWorkspaceOrganizationName(activeWorkspace) : 'Not selected', detail: 'Organization context', tone: 'success' },
      { label: 'Tenant Scope', value: activeWorkspace?.tenantName || 'Not selected', detail: 'Current tenant binding' },
      { label: 'Workspace Status', value: activeWorkspace?.status || 'Unavailable', detail: 'Current operating state', tone: 'success' },
    ]} />
    {error && <AdminNotice error>{error}</AdminNotice>}{message && <AdminNotice>{message}</AdminNotice>}
    <AdminCard title="Workspace Inventory" description="Select an operating context or manage its settings. All actions remain permission checked.">
      <div className="adminToolbar"><label>Search workspaces<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, tenant, region, or industry" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['active','draft','paused','archived'].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <div className="adminTableScroll" role="region" aria-label="Workspace inventory" tabIndex={0}><table className="adminTable"><thead><tr>{['Workspace','Tenant','Region / Industry','Status','Created','Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
        {visible.map(workspace => <tr key={workspace.id} data-selected={workspace.id === activeWorkspace?.id}><td><strong>{getWorkspaceDisplayName(workspace)}</strong>{workspace.id === activeWorkspace?.id && <div><Badge size="sm" variant="primary">Current</Badge></div>}</td><td>{workspace.tenantName || 'Not recorded'}</td><td>{workspace.region || 'Not set'}<div className="adminHelp">{workspace.industry || 'Not set'}</div></td><td><Badge size="sm" variant={workspace.status === 'active' ? 'success' : 'default'}>{workspace.status}</Badge></td><td>{workspace.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : 'Not recorded'}</td><td><div className="adminRowButtons">
          <Button size="sm" variant="outline" disabled={Boolean(busyId) || workspace.id === activeWorkspace?.id || workspace.status === 'archived'} onClick={() => void run(workspace.id, () => switchWorkspace(workspace.id), 'Workspace selected.')}>Switch</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditingId(workspace.id); document.getElementById('workspace-settings')?.scrollIntoView({ block: 'nearest' }); }}>Edit</Button>
          {workspace.status !== 'archived' ? <Button size="sm" variant="ghost" disabled={Boolean(busyId) || workspace.id === activeWorkspace?.id} onClick={() => setArchiveTarget(workspace)}>Archive</Button> : <Button size="sm" variant="outline" disabled={Boolean(busyId)} onClick={() => void run(workspace.id, async () => { await updateWorkspaceSettings(workspace.id, { status: 'active' }); await refreshWorkspaces(); }, 'Workspace restored.')}>Restore</Button>}
        </div></td></tr>)}
        {!visible.length && <tr><td colSpan={6} className="adminEmpty">{loading ? 'Loading workspaces...' : 'No accessible workspaces match these filters.'}</td></tr>}
      </tbody></table></div>
      <p className="adminHelp">Showing {visible.length} of {workspaces.length} accessible workspaces. Last-updated timestamps are not provided; creation dates are shown instead. Switch away before archiving the current workspace.</p>
    </AdminCard>
    <div className="adminGridTwo">
      <AdminCard title="Create Workspace" description="Provision an organization and tenant-scoped workspace with the minimal starter baseline."><form id="workspace-create-form" onSubmit={create}><WorkspaceFields value={createForm} onChange={setCreateForm} /><div className="adminFooterActions"><Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Workspace'}</Button></div></form></AdminCard>
      <div id="workspace-settings"><AdminCard title="Workspace Settings" description="Update workspace identity and its operating profile.">{editing ? <WorkspaceSettings key={editing.id} workspace={editing} onSaved={refreshWorkspaces} /> : <p className="adminEmpty">Create or select a workspace to manage its settings.</p>}</AdminCard></div>
    </div>
    <AdminOverlay><Modal accessibleDialog isOpen={Boolean(archiveTarget)} onClose={() => { if (!busyId) setArchiveTarget(null); }} title="Archive workspace" footer={<><Button variant="outline" disabled={Boolean(busyId)} onClick={() => setArchiveTarget(null)}>Cancel</Button><Button variant="danger" disabled={Boolean(busyId)} onClick={() => { if (archiveTarget) void run(archiveTarget.id, async () => { await archiveWorkspace(archiveTarget.id); await refreshWorkspaces(); setArchiveTarget(null); }, 'Workspace archived.'); }}>{busyId ? 'Archiving...' : 'Archive Workspace'}</Button></>}>
      <p>Archive {archiveTarget ? getWorkspaceDisplayName(archiveTarget) : 'this workspace'}? Its records are retained. Only authorized workspace owners can perform this action.</p>
      {error && <p role="alert">{error}</p>}
    </Modal></AdminOverlay>
  </div>;
}
