import { Button } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAccessGovernanceStore } from '../../lib/accessGovernanceStore';
import { canAccessWorkspace, getWorkspaceDefinitionById } from '../../lib/platformShell';
import { AdminCard, AdminHero, AdminMetrics, AdminNotice } from './AdminPrimitives';

export function AdministrationLanding({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { role } = useAuth();
  const { workspaceId } = useWorkspace();
  if (!canAccessWorkspace('administration', role)) return <div className="adminPage"><AdminNotice error>Administration access is restricted to authorized administrators.</AdminNotice></div>;
  return <AdministrationContent key={workspaceId} onNavigate={onNavigate} />;
}

function AdministrationContent({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { state, loading, error, actions } = useAccessGovernanceStore();
  const { activeWorkspace } = useWorkspace();
  const definition = getWorkspaceDefinitionById('administration')!;
  const available = !loading && !error;
  const coverage = state.users.length ? Math.round(state.users.filter(user => user.mfaStatus === 'enabled').length / state.users.length * 100) : null;
  const display = (value: number | string | null) => available ? value ?? 'Not available' : loading ? 'Loading' : 'Unavailable';
  const links = (keys: string[]) => <div className="adminLinkList">{definition.items.filter(item => keys.includes(item.key)).map(item => <button key={item.key} onClick={() => onNavigate?.(item.key)}>{item.label}<span aria-hidden="true">&#8594;</span></button>)}</div>;
  return <div className="adminPage">
    <AdminHero title="Administration Workspace" description="Organization setup, workspaces, access governance, users, roles, permissions, authentication, and security." chips={['Governance', 'Secure Access', 'Operational Control', 'Audit Ready']} />
    <AdminMetrics metrics={[
      { label: 'Admin Views', value: definition.items.length, detail: 'Administration capabilities' },
      { label: 'Privileged Scope', value: 'Restricted', detail: 'Authorized administrators', tone: 'warning' },
      { label: 'Workspace Status', value: activeWorkspace?.status || 'Unavailable', detail: 'Current operating context', tone: 'success' },
      { label: 'Pending Reviews', value: display(state.accessReviews.filter(review => review.status === 'in_progress').length), detail: 'In-progress access campaigns', tone: 'warning' },
      { label: 'Access Risks', value: display(state.sodConflicts.length), detail: 'Recorded SoD conflicts', tone: 'danger' },
    ]} />
    {error && <AdminNotice error>{error} <Button variant="outline" onClick={() => void actions.resetAll()}>Retry governance data</Button></AdminNotice>}
    <AdminCard title="Workspace Actions" description="Open the tools for secure, controlled administration." action={<Button size="sm" onClick={() => onNavigate?.('workspace-members')}>Open Team Access</Button>}>
      <div className="adminActionGrid">{definition.items.map(item => <button className="adminAction" key={item.key} onClick={() => onNavigate?.(item.key)} aria-label={`Open ${item.label}`}>
        <span className="adminIcon" aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><p>{item.description}</p><span>Open &#8594;</span>
      </button>)}</div>
    </AdminCard>
    <div className="adminInsights">
      <AdminCard title="Access Governance" description="Review access, roles, permissions, and certification.">{links(['workspace-members', 'admin-roles', 'admin-permissions', 'admin-access-reviews'])}</AdminCard>
      <AdminCard title="Workspace Administration" description="Manage operating environments and security settings.">{links(['workspace-new', 'workspace-management', 'admin-authentication', 'admin-security-settings'])}</AdminCard>
      <AdminCard title="Security Posture" description="Current access-governance scope; not a platform health score."><dl className="adminDetailGrid">
        <div><dt>MFA enabled</dt><dd>{display(coverage === null ? null : `${coverage}%`)}</dd></div><div><dt>Users in scope</dt><dd>{display(state.users.length)}</dd></div>
        <div><dt>Pending access requests</dt><dd>{display(state.accessRequests.filter(r => r.status === 'pending' || r.status === 'needs_info').length)}</dd></div><div><dt>SoD findings</dt><dd>{display(state.sodConflicts.length)}</dd></div>
      </dl></AdminCard>
      <AdminCard title="Recent Governance Activity" description="Latest recorded access-governance events." action={<Button variant="ghost" onClick={() => onNavigate?.('activity-ledger')}>View ledger</Button>}>
        {available && state.auditTrail.length > 0 ? <ul className="adminEventList">{state.auditTrail.slice(0, 4).map(event => <li key={event.id}><strong>{event.action.replaceAll('_', ' ')}</strong><small>{event.actor} / {new Date(event.timestamp).toLocaleString()}</small></li>)}</ul> : <p className="adminEmpty">{loading ? 'Loading governance activity...' : error ? 'Governance activity is unavailable.' : 'No governance events recorded in this scope.'}</p>}
      </AdminCard>
    </div>
  </div>;
}
