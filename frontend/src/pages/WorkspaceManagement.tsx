import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
} from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import { archiveWorkspace, createWorkspace, updateWorkspaceSettings } from '../lib/api';
import { getWorkspaceDisplayName, getWorkspaceOrganizationName } from '../lib/workspaceDisplay';
import { theme } from '../theme';
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from '../types/workspace';

const pageStyle = {
  maxWidth: '1120px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

const inputStyle = {
  width: '100%',
  padding: theme.spacing[3],
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.md,
  fontSize: theme.typography.sizes.sm,
  backgroundColor: theme.colors.surface,
};

export function WorkspaceManagement() {
  const { activeWorkspace, workspaces, refreshWorkspaces, switchWorkspace } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    displayName: '',
    industry: 'general',
    region: 'global',
  });
  const [settingsForm, setSettingsForm] = useState({
    displayName: activeWorkspace?.displayName || '',
    industry: activeWorkspace?.industry || 'general',
    region: activeWorkspace?.region || 'global',
    status: activeWorkspace?.status || 'active',
  });

  const metrics = useMemo(
    () => [
      { label: 'Active Workspaces', value: workspaces.length, detail: 'Live workspace inventory', tone: 'primary' as const },
      { label: 'Current Organization', value: activeWorkspace ? getWorkspaceOrganizationName(activeWorkspace) : 'None', detail: 'Active tenant context', tone: 'success' as const },
      { label: 'Tenant Scope', value: activeWorkspace?.tenantName || 'Unassigned', detail: 'Current tenant binding', tone: 'default' as const },
      { label: 'Workspace Status', value: activeWorkspace?.status || 'draft', detail: 'Active workspace operating state', tone: activeWorkspace?.status === 'active' ? 'success' as const : 'warning' as const },
    ],
    [activeWorkspace, workspaces.length],
  );

  useEffect(() => {
    setSettingsForm({
      displayName: activeWorkspace?.displayName || '',
      industry: activeWorkspace?.industry || 'general',
      region: activeWorkspace?.region || 'global',
      status: activeWorkspace?.status || 'active',
    });
  }, [activeWorkspace?.displayName, activeWorkspace?.id, activeWorkspace?.industry, activeWorkspace?.region, activeWorkspace?.status]);

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!createForm.displayName.trim()) {
      setError('Organization name is required.');
      return;
    }

    setCreating(true);
    try {
      const result = await createWorkspace({
        displayName: createForm.displayName.trim(),
        industry: createForm.industry,
        region: createForm.region,
        seedProfile: 'minimal',
      });
      await refreshWorkspaces();
      await switchWorkspace(result.workspace.id);
      setCreateForm({ displayName: '', industry: 'general', region: 'global' });
      setMessage('Workspace created and activated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeWorkspace?.id) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateWorkspaceSettings(activeWorkspace.id, {
        displayName: settingsForm.displayName.trim(),
        industry: settingsForm.industry,
        region: settingsForm.region,
        status: settingsForm.status,
      });
      await refreshWorkspaces();
      setMessage('Workspace settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workspace settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveWorkspace = async (workspaceId: string) => {
    setArchivingId(workspaceId);
    setError(null);
    setMessage(null);
    try {
      await archiveWorkspace(workspaceId);
      await refreshWorkspaces();
      setMessage('Workspace archived.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive workspace.');
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Workspace Management"
        description="Create, switch, archive, and configure tenant-scoped operating workspaces."
        action={<Button variant="primary" type="submit" form="workspace-create-form" disabled={creating}>{creating ? 'Creating...' : 'Create Workspace'}</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      {error ? (
        <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.lg, border: `1px solid ${theme.colors.semantic.danger}`, background: theme.colors.semantic.dangerLight, color: theme.colors.semantic.danger }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.lg, border: `1px solid ${theme.colors.semantic.success}`, background: theme.colors.semantic.successLight, color: theme.colors.semantic.success }}>
          {message}
        </div>
      ) : null}

      <PageSectionCard title="Workspace Inventory" subtitle="Switch active context without leaking data across tenants or organizations.">
        {workspaces.length > 0 ? (
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspace?.id;
              return (
                <div
                  key={workspace.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: theme.spacing[3],
                    padding: theme.spacing[4],
                    border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: theme.borderRadius.xl,
                    background: isActive ? theme.colors.primaryLight : theme.colors.surface,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2], alignItems: 'center' }}>
                      <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                        {getWorkspaceOrganizationName(workspace)}
                      </div>
                      <Badge variant={isActive ? 'primary' : 'default'} size="sm">{isActive ? 'Active' : 'Available'}</Badge>
                      <Badge variant={workspace.status === 'active' ? 'success' : 'warning'} size="sm">{workspace.status}</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      Workspace: {getWorkspaceDisplayName(workspace)} · Tenant: {workspace.tenantName || 'Unassigned'}
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.muted }}>
                      Region: {workspace.region || 'Not set'} · Industry: {workspace.industry || 'Not set'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Button variant="outline" onClick={() => { void switchWorkspace(workspace.id); }} disabled={isActive}>
                      Switch Workspace
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => { void handleArchiveWorkspace(workspace.id); }}
                      disabled={isActive || archivingId === workspace.id}
                    >
                      {archivingId === workspace.id ? 'Archiving...' : 'Archive Workspace'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyStatePanel
            eyebrow="No Workspaces"
            title="Create the first workspace"
            description="Provision an organization, tenant, and operating workspace before inviting teams or loading governance data."
          />
        )}
      </PageSectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: theme.spacing[4] }}>
        <PageSectionCard title="Create Workspace" subtitle="Provision a new tenant-scoped operating environment.">
          <form id="workspace-create-form" onSubmit={handleCreateWorkspace} style={{ display: 'grid', gap: theme.spacing[3] }}>
            <div>
              <label htmlFor="new-workspace-name" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Organization Name
              </label>
              <input
                id="new-workspace-name"
                value={createForm.displayName}
                onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Sochrist Ventures"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="new-workspace-industry" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Industry
              </label>
              <select
                id="new-workspace-industry"
                value={createForm.industry}
                onChange={(event) => setCreateForm((current) => ({ ...current, industry: event.target.value }))}
                style={inputStyle}
              >
                {INDUSTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-workspace-region" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                Region
              </label>
              <select
                id="new-workspace-region"
                value={createForm.region}
                onChange={(event) => setCreateForm((current) => ({ ...current, region: event.target.value }))}
                style={inputStyle}
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </form>
        </PageSectionCard>

        <PageSectionCard title="Workspace Settings" subtitle="Update the current workspace identity and operating profile.">
          {activeWorkspace ? (
            <form onSubmit={handleSaveSettings} style={{ display: 'grid', gap: theme.spacing[3] }}>
              <div>
                <label htmlFor="workspace-display-name" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                  Workspace Name
                </label>
                <input
                  id="workspace-display-name"
                  value={settingsForm.displayName}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, displayName: event.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="workspace-industry" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                  Industry
                </label>
                <select
                  id="workspace-industry"
                  value={settingsForm.industry}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, industry: event.target.value }))}
                  style={inputStyle}
                >
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="workspace-region" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                  Region
                </label>
                <select
                  id="workspace-region"
                  value={settingsForm.region}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, region: event.target.value }))}
                  style={inputStyle}
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="workspace-status" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                  Workspace Status
                </label>
                <select
                  id="workspace-status"
                  value={settingsForm.status}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, status: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
              </div>
            </form>
          ) : (
            <EmptyStatePanel
              eyebrow="No Active Workspace"
              title="Select a workspace first"
              description="Workspace settings are available after you create or switch into an active operating workspace."
            />
          )}
        </PageSectionCard>
      </div>
    </div>
  );
}
