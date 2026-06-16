import { useState } from 'react';
import {
  ActivityFeed,
  Badge,
  Button,
  Card,
  DataTableShell,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  StepUpVerificationModal,
  SummaryMetricStrip,
} from '../../components';
import { useAccessGovernanceStore } from '../../lib/accessGovernanceStore';
import { theme } from '../../theme';
import type {
  AccessGovernanceAuditEntry,
  AccessRequest,
  EnterpriseRole,
  EnterpriseRoleKey,
  PermissionModule,
  RbacUser,
} from '../../types/rbac';

const pageStyle = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[5],
  overflowX: 'hidden' as const,
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleShortLabel(name: string) {
  return name
    .split(' ')
    .map((part, index) => (index === 0 ? part.slice(0, 5) : part.slice(0, 4)))
    .join('.');
}

function roleBadgeVariant(roleId: EnterpriseRoleKey): 'primary' | 'warning' | 'success' | 'default' {
  if (roleId === 'super_admin' || roleId === 'tenant_admin') return 'warning';
  if (roleId === 'grc_manager') return 'primary';
  if (roleId === 'auditor' || roleId === 'read_only_executive') return 'default';
  return 'success';
}

function statusBadgeVariant(status: string) {
  if (status === 'active' || status === 'approved' || status === 'completed') return 'success' as const;
  if (status === 'suspended' || status === 'rejected' || status === 'revoked') return 'danger' as const;
  if (status === 'pending' || status === 'needs_info' || status === 'in_progress') return 'warning' as const;
  return 'default' as const;
}

function mfaBadgeVariant(status: string) {
  if (status === 'enabled') return 'success' as const;
  if (status === 'required') return 'warning' as const;
  return 'danger' as const;
}

function ActionMenu({
  items,
}: {
  items: Array<{ label: string; onClick: () => void; tone?: 'default' | 'danger' }>;
}) {
  return (
    <details style={{ position: 'relative' }}>
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          width: 34,
          height: 34,
          borderRadius: theme.borderRadius.md,
          border: `1px solid ${theme.colors.border}`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⋯
      </summary>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 38,
          width: 190,
          backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.lg,
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            style={{
              width: '100%',
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: theme.typography.sizes.sm,
              color: item.tone === 'danger' ? theme.colors.semantic.danger : theme.colors.text.main,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}

function AuditEntryCard({ entry }: { entry: AccessGovernanceAuditEntry }) {
  return (
    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
      <div style={{ display: 'grid', gap: theme.spacing[2] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge variant={statusBadgeVariant(entry.outcome.toLowerCase())} size="sm">{entry.action.replace(/_/g, ' ')}</Badge>
            {entry.targetUser ? <strong style={{ color: theme.colors.text.main }}>{entry.targetUser}</strong> : null}
          </div>
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>{formatDateTime(entry.timestamp)}</span>
        </div>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>
          <strong>{entry.actor}</strong> completed an access governance action.
        </div>
        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {entry.previousValue ? <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>From: {entry.previousValue}</span> : null}
          {entry.newValue ? <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>To: {entry.newValue}</span> : null}
          <Badge variant={statusBadgeVariant(entry.outcome.toLowerCase())} size="sm">{entry.outcome}</Badge>
        </div>
        {entry.notes ? <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{entry.notes}</div> : null}
        {entry.ipDevice ? (
          <details>
            <summary style={{ cursor: 'pointer', fontSize: theme.typography.sizes.xs, color: theme.colors.primary }}>View details</summary>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              IP / Device: {entry.ipDevice}
            </div>
          </details>
        ) : null}
      </div>
    </Card>
  );
}

function RoleDetailCard({
  role,
  privilegedConflictCount,
  permissionCount,
  onDuplicate,
  onDisable,
}: {
  role: EnterpriseRole;
  privilegedConflictCount: number;
  permissionCount: number;
  onDuplicate: () => void;
  onDisable: () => void;
}) {
  return (
    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: theme.colors.text.main }}>{role.name}</strong>
              <Badge variant={roleBadgeVariant(role.id)} size="sm">{role.status}</Badge>
              {role.isDefault ? <Badge variant="default" size="sm">Default</Badge> : <Badge variant="primary" size="sm">Custom</Badge>}
            </div>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{role.description}</div>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={onDuplicate}>Duplicate</Button>
            {!role.isDefault ? <Button variant="danger" onClick={onDisable} disabled={role.status === 'disabled'}>Disable</Button> : null}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
          <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Assigned users</div>
            <div style={{ marginTop: theme.spacing[1], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{role.userCount}</div>
          </div>
          <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Granted permissions</div>
            <div style={{ marginTop: theme.spacing[1], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{permissionCount}</div>
          </div>
          <div style={{ padding: theme.spacing[3], borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>SoD conflicts</div>
            <div style={{ marginTop: theme.spacing[1], fontWeight: theme.typography.weights.bold, color: privilegedConflictCount ? theme.colors.semantic.danger : theme.colors.text.main }}>{privilegedConflictCount}</div>
          </div>
        </div>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          Inherited permissions: {role.inheritedFrom ? `Copied from ${role.inheritedFrom.replace(/_/g, ' ')}` : 'Enterprise default role pattern'}
        </div>
      </div>
    </Card>
  );
}

function AccessRequestReviewModal({
  request,
  roles,
  onClose,
  onSubmit,
}: {
  request: AccessRequest | null;
  roles: EnterpriseRole[];
  onClose: () => void;
  onSubmit: (payload: { requestId: string; nextStatus: 'approved' | 'rejected' | 'needs_info'; notes: string; assignedRoleId: EnterpriseRoleKey; enforceMfaBeforeActivation: boolean }) => void;
}) {
  const [assignedRoleId, setAssignedRoleId] = useState<EnterpriseRoleKey>(request?.requestedRoleId || 'auditor');
  const [notes, setNotes] = useState(request?.decisionNotes || '');
  const [enforceMfa, setEnforceMfa] = useState(request?.enforceMfaBeforeActivation ?? true);

  if (!request) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 85 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 620, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6], display: 'grid', gap: theme.spacing[4] }} onClick={(event) => event.stopPropagation()}>
        <div>
          <h2 style={{ margin: 0, fontSize: theme.typography.sizes.xl }}>Review Access Request</h2>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            {request.requesterName} · {request.requestedWorkspace}
          </div>
        </div>
        <Card style={{ padding: theme.spacing[4], backgroundColor: theme.colors.surfaceHover }}>
          <div style={{ display: 'grid', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            <div><strong style={{ color: theme.colors.text.main }}>Requester:</strong> {request.requesterEmail}</div>
            <div><strong style={{ color: theme.colors.text.main }}>Requested role:</strong> {request.requestedRoleName}</div>
            <div><strong style={{ color: theme.colors.text.main }}>Reason:</strong> {request.businessReason}</div>
          </div>
        </Card>
        <select value={assignedRoleId} onChange={(event) => setAssignedRoleId(event.target.value as EnterpriseRoleKey)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
          {roles.filter((role) => role.status === 'active').map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Decision notes" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, resize: 'vertical', fontFamily: theme.typography.fontFamily }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          <input type="checkbox" checked={enforceMfa} onChange={(event) => setEnforceMfa(event.target.checked)} />
          Enforce MFA before activation
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => onSubmit({ requestId: request.id, nextStatus: 'needs_info', notes, assignedRoleId, enforceMfaBeforeActivation: enforceMfa })}>Request More Info</Button>
            <Button variant="danger" onClick={() => onSubmit({ requestId: request.id, nextStatus: 'rejected', notes, assignedRoleId, enforceMfaBeforeActivation: enforceMfa })}>Reject</Button>
            <Button variant="primary" onClick={() => onSubmit({ requestId: request.id, nextStatus: 'approved', notes, assignedRoleId, enforceMfaBeforeActivation: enforceMfa })}>Approve</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserAccessModal({
  user,
  roles,
  conflicts,
  onClose,
  onSaveRole,
}: {
  user: RbacUser | null;
  roles: EnterpriseRole[];
  conflicts: string[];
  onClose: () => void;
  onSaveRole: (userId: string, roleId: EnterpriseRoleKey) => void;
}) {
  const [roleId, setRoleId] = useState<EnterpriseRoleKey>(user?.assignedRoleId || 'auditor');

  if (!user) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 85 }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 640, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing[6], display: 'grid', gap: theme.spacing[4] }} onClick={(event) => event.stopPropagation()}>
        <div>
          <h2 style={{ margin: 0, fontSize: theme.typography.sizes.xl }}>{user.fullName}</h2>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{user.email} · {user.workspaceName}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.spacing[3] }}>
          <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Status</div>
            <div style={{ marginTop: theme.spacing[1] }}><Badge variant={statusBadgeVariant(user.status)} size="sm">{user.status}</Badge></div>
          </Card>
          <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>MFA</div>
            <div style={{ marginTop: theme.spacing[1] }}><Badge variant={mfaBadgeVariant(user.mfaStatus)} size="sm">{user.mfaStatus}</Badge></div>
          </Card>
          <Card style={{ padding: theme.spacing[3], backgroundColor: theme.colors.surfaceHover }}>
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Last login</div>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{formatDateTime(user.lastLogin)}</div>
          </Card>
        </div>
        <div>
          <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Assigned role</div>
          <select value={roleId} onChange={(event) => setRoleId(event.target.value as EnterpriseRoleKey)} style={{ width: '100%', padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
            {roles.filter((role) => role.status === 'active').map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </div>
        <Card style={{ padding: theme.spacing[4], backgroundColor: theme.colors.surfaceHover }}>
          <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Access scope</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{user.accessScope}</div>
        </Card>
        <div>
          <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>SoD conflicts</div>
          {conflicts.length ? (
            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
              {conflicts.map((conflict) => <Badge key={conflict} variant="danger" size="sm">{conflict}</Badge>)}
            </div>
          ) : (
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>No SoD conflicts detected for this user.</div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3] }}>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => onSaveRole(user.id, roleId)}>Save Role</Button>
        </div>
      </div>
    </div>
  );
}

export function PermissionMatrixPage() {
  const { state, actions, constants } = useAccessGovernanceStore();
  const [search, setSearch] = useState('');
  const [stepUpIntent, setStepUpIntent] = useState<'save' | 'reset' | null>(null);

  const roles = state.roles.filter((role) => role.status === 'active');
  const filteredModules = constants.PERMISSION_MODULES.filter((moduleName) => moduleName.toLowerCase().includes(search.toLowerCase()));

  const metrics = [
    { label: 'Roles', value: roles.length, detail: 'Roles in the permission matrix', tone: 'primary' as const },
    { label: 'Modules', value: constants.PERMISSION_MODULES.length, detail: 'Governed application areas', tone: 'default' as const },
    { label: 'Actions', value: constants.PERMISSION_ACTIONS.length, detail: 'Granular access verbs', tone: 'default' as const },
    { label: 'SoD Conflicts', value: state.sodConflicts.filter((conflict) => !conflict.userId).length, detail: 'Role-level conflicts detected', tone: state.sodConflicts.length ? 'danger' as const : 'success' as const },
  ];

  return (
    <div style={pageStyle}>
      <PageHeader
        title="Permission Matrix"
        description="Control role permissions by module and action, review segregation-of-duties conflicts, and save governed entitlement changes."
        action={<Button variant="primary" onClick={() => setStepUpIntent('save')}>Save Changes</Button>}
      />

      <SummaryMetricStrip metrics={metrics} />

      <PageSectionCard
        title="Role Permission Matrix"
        subtitle="Modules are rows, roles are columns, and each action can be enabled or disabled per role."
        action={<Button variant="outline" onClick={() => setStepUpIntent('reset')}>Reset to Default</Button>}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap', marginBottom: theme.spacing[4] }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter modules..." style={{ minWidth: 260, padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
            Sensitive changes require step-up authentication before they are committed.
          </div>
        </div>
        <div style={{ overflowX: 'hidden' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '180px' }} />
              {roles.map((role) => <col key={role.id} style={{ width: `${Math.max(85, Math.floor(1000 / Math.max(roles.length, 1)))}px` }} />)}
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Module / Action</th>
                {roles.map((role) => (
                  <th key={role.id} style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}`, textAlign: 'center' }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.main }}>{roleShortLabel(role.name)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredModules.map((moduleName) => (
                constants.PERMISSION_ACTIONS.map((action, index) => (
                  <tr key={`${moduleName}-${action}`} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <td style={{ padding: `${theme.spacing[2]} 0`, fontSize: theme.typography.sizes.sm, color: index === 0 ? theme.colors.text.main : theme.colors.text.secondary }}>
                      {index === 0 ? <strong>{moduleName}</strong> : null}
                      <div>{action}</div>
                    </td>
                    {roles.map((role) => (
                      <td key={`${moduleName}-${action}-${role.id}`} style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}`, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={state.permissionMatrix[role.id]?.[moduleName]?.[action] || false}
                          onChange={() => actions.togglePermission(role.id, moduleName, action)}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </PageSectionCard>

      <PageSectionCard title="Segregation of Duties Conflicts" subtitle="Conflicts triggered by the current permission matrix are surfaced here before save or certification.">
        {state.sodConflicts.filter((conflict) => !conflict.userId).length === 0 ? (
          <EmptyStatePanel title="No role-level SoD conflicts" description="The current matrix does not create any blocked combinations across the configured default conflict rules." />
        ) : (
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {state.sodConflicts.filter((conflict) => !conflict.userId).map((conflict) => (
              <Card key={conflict.id} style={{ padding: theme.spacing[4] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: theme.colors.text.main }}>{conflict.roleName}</strong>
                      <Badge variant={conflict.severity === 'high' ? 'danger' : 'warning'} size="sm">{conflict.severity}</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{conflict.ruleTitle}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{conflict.description}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageSectionCard>

      <StepUpVerificationModal
        isOpen={stepUpIntent !== null}
        onClose={() => setStepUpIntent(null)}
        onVerified={async (stepUpToken) => {
          if (stepUpIntent === 'save') await actions.savePermissionMatrix(stepUpToken);
          if (stepUpIntent === 'reset') await actions.resetPermissionMatrix(stepUpToken);
          setStepUpIntent(null);
        }}
        title={stepUpIntent === 'reset' ? 'Reset Permission Matrix' : 'Save Permission Changes'}
        description={stepUpIntent === 'reset' ? 'Resetting permissions changes effective access and requires step-up verification.' : 'Changing role permissions requires step-up verification.'}
        purpose="change_permissions"
      />
    </div>
  );
}

export function RoleManagementPage() {
  const { state, actions, constants } = useAccessGovernanceStore();
  const [search, setSearch] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState<EnterpriseRoleKey>('grc_manager');
  const [selectedUser, setSelectedUser] = useState<RbacUser | null>(null);
  const [pendingAdminAssignment, setPendingAdminAssignment] = useState<{ userId: string; roleId: EnterpriseRoleKey } | null>(null);

  const filteredRoles = state.roles.filter((role) => role.name.toLowerCase().includes(search.toLowerCase()) || role.description.toLowerCase().includes(search.toLowerCase()));
  const customRoles = state.roles.filter((role) => !role.isDefault).length;
  const privilegedRoles = state.roles.filter((role) => role.id === 'super_admin' || role.id === 'tenant_admin').length;

  const metrics = [
    { label: 'Roles Configured', value: state.roles.length, detail: 'Default and custom enterprise roles', tone: 'primary' as const },
    { label: 'Custom Roles', value: customRoles, detail: 'Tenant-specific roles available', tone: 'default' as const },
    { label: 'Privileged Roles', value: privilegedRoles, detail: 'Roles with administrative scope', tone: 'warning' as const },
    { label: 'SoD Conflicts', value: state.sodConflicts.filter((conflict) => !conflict.userId).length, detail: 'Role conflicts requiring remediation', tone: state.sodConflicts.length ? 'danger' as const : 'success' as const },
  ];

  return (
    <div style={pageStyle}>
      <PageHeader title="Role Management" description="Create, duplicate, disable, and assign enterprise roles while preserving inherited permissions and SoD visibility." />

      <SummaryMetricStrip metrics={metrics} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: theme.spacing[4] }}>
        <PageSectionCard title="Role Catalogue" subtitle="Review current roles, their assignment counts, and conflict posture.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roles..." style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            {filteredRoles.map((role) => {
              const permissionCount = constants.PERMISSION_MODULES.reduce((sum, moduleName) => {
                return sum + constants.PERMISSION_ACTIONS.filter((action) => state.permissionMatrix[role.id]?.[moduleName]?.[action]).length;
              }, 0);
              const roleConflictCount = state.sodConflicts.filter((conflict) => conflict.roleId === role.id && !conflict.userId).length;
              return (
                <RoleDetailCard
                  key={role.id}
                  role={role}
                  privilegedConflictCount={roleConflictCount}
                  permissionCount={permissionCount}
                  onDuplicate={() => actions.duplicateRole(role.id)}
                  onDisable={() => actions.disableRole(role.id)}
                />
              );
            })}
          </div>
        </PageSectionCard>

        <div style={{ display: 'grid', gap: theme.spacing[4] }}>
          <PageSectionCard title="Create Custom Role" subtitle="Start from an existing role and tailor permissions afterward in the permission matrix.">
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Role name" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
              <textarea value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} rows={3} placeholder="Role description" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, resize: 'vertical', fontFamily: theme.typography.fontFamily }} />
              <select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value as EnterpriseRoleKey)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }}>
                {state.roles.filter((role) => role.status === 'active').map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
              <Button
                variant="primary"
                onClick={() => {
                  if (!roleName.trim()) return;
                  actions.createRole(roleName.trim(), roleDescription.trim() || 'Custom role created for enterprise access governance.', copyFrom);
                  setRoleName('');
                  setRoleDescription('');
                }}
              >
                Create Role
              </Button>
            </div>
          </PageSectionCard>

          <PageSectionCard title="Assign Users to Roles" subtitle="Role assignment is managed here and uses step-up authentication for admin roles.">
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              {state.users.map((user) => (
                <Card key={user.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{user.fullName}</div>
                      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{user.email}</div>
                      <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                        <Badge variant={statusBadgeVariant(user.status)} size="sm">{user.status}</Badge>
                        <Badge variant={roleBadgeVariant(user.assignedRoleId)} size="sm">{user.assignedRoleName}</Badge>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                      <Button variant="outline" onClick={() => setSelectedUser(user)}>View Details</Button>
                      <ActionMenu
                        items={state.roles.filter((role) => role.status === 'active').map((role) => ({
                          label: `Assign ${role.name}`,
                          onClick: () => {
                            if (role.id === 'super_admin' || role.id === 'tenant_admin') {
                              setPendingAdminAssignment({ userId: user.id, roleId: role.id });
                              return;
                            }
                            actions.assignUserRole(user.id, role.id);
                          },
                        }))}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </PageSectionCard>
        </div>
      </div>

      <UserAccessModal
        user={selectedUser}
        roles={state.roles}
        conflicts={state.sodConflicts.filter((conflict) => conflict.userId === selectedUser?.id).map((conflict) => conflict.ruleTitle)}
        onClose={() => setSelectedUser(null)}
        onSaveRole={(userId, roleId) => {
          if (roleId === 'super_admin' || roleId === 'tenant_admin') {
            setPendingAdminAssignment({ userId, roleId });
          } else {
            actions.assignUserRole(userId, roleId);
          }
          setSelectedUser(null);
        }}
      />

      <StepUpVerificationModal
        isOpen={Boolean(pendingAdminAssignment)}
        onClose={() => setPendingAdminAssignment(null)}
        onVerified={async (stepUpToken) => {
          if (pendingAdminAssignment) {
            await actions.assignUserRole(pendingAdminAssignment.userId, pendingAdminAssignment.roleId, 'Security Office', stepUpToken);
            setPendingAdminAssignment(null);
          }
        }}
        title="Assign Administrative Role"
        description="Assigning Super Admin or Tenant Admin requires step-up verification."
        purpose="assign_admin_role"
      />
    </div>
  );
}

export function AccessReviewsPage() {
  const { state, actions, constants } = useAccessGovernanceStore();
  const [reviewName, setReviewName] = useState('');
  const [dueDate, setDueDate] = useState('2026-05-31');
  const [selectedRoles, setSelectedRoles] = useState<EnterpriseRoleKey[]>(['tenant_admin']);
  const [selectedModules, setSelectedModules] = useState<PermissionModule[]>(['Users']);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(state.users.slice(0, 2).map((user) => user.id));
  const [reviewers, setReviewers] = useState('Security Office, Compliance Lead');
  const [pendingExportReviewId, setPendingExportReviewId] = useState<string | null>(null);

  const metrics = [
    { label: 'Active Reviews', value: state.accessReviews.filter((review) => review.status !== 'completed').length, detail: 'Campaigns currently in progress', tone: 'warning' as const },
    { label: 'Completion', value: `${Math.round(state.accessReviews.reduce((sum, review) => sum + review.completionPercent, 0) / Math.max(state.accessReviews.length, 1))}%`, detail: 'Average completion across campaigns', tone: 'primary' as const },
    { label: 'Flags', value: state.accessReviews.reduce((sum, review) => sum + review.excessivePrivilegeFlags, 0), detail: 'Excessive privilege findings', tone: 'danger' as const },
    { label: 'Exported Packs', value: state.accessReviews.filter((review) => review.evidenceExportedAt).length, detail: 'Audit evidence exports created', tone: 'default' as const },
  ];

  return (
    <div style={pageStyle}>
      <PageHeader title="Access Reviews" description="Launch, review, and evidence enterprise access certifications with reviewer assignments, SoD flags, and export-ready evidence." />

      <SummaryMetricStrip metrics={metrics} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
        <PageSectionCard title="Launch Access Review" subtitle="Select the roles, modules, and users in scope before sending the campaign to reviewers.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <input value={reviewName} onChange={(event) => setReviewName(event.target.value)} placeholder="Review campaign name" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <div>
              <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Roles in scope</div>
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                {state.roles.filter((role) => role.status === 'active').map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoles((current) => current.includes(role.id) ? current.filter((item) => item !== role.id) : [...current, role.id])}
                    style={{ border: 'none', background: 'transparent', padding: 0 }}
                  >
                    <Badge variant={selectedRoles.includes(role.id) ? 'primary' : 'default'} size="sm">{role.name}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Modules in scope</div>
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                {constants.PERMISSION_MODULES.map((moduleName) => (
                  <button
                    key={moduleName}
                    type="button"
                    onClick={() => setSelectedModules((current) => current.includes(moduleName) ? current.filter((item) => item !== moduleName) : [...current, moduleName])}
                    style={{ border: 'none', background: 'transparent', padding: 0 }}
                  >
                    <Badge variant={selectedModules.includes(moduleName) ? 'primary' : 'default'} size="sm">{moduleName}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Users in scope</div>
              <div style={{ display: 'grid', gap: theme.spacing[2], maxHeight: 180, overflowY: 'auto' }}>
                {state.users.map((user) => (
                  <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={(event) => setSelectedUserIds((current) => event.target.checked ? [...current, user.id] : current.filter((item) => item !== user.id))} />
                    {user.fullName} · {user.assignedRoleName}
                  </label>
                ))}
              </div>
            </div>
            <input value={reviewers} onChange={(event) => setReviewers(event.target.value)} placeholder="Reviewers, comma separated" style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
            <Button
              variant="primary"
              onClick={() => {
                if (!reviewName.trim()) return;
                actions.launchAccessReview({
                  name: reviewName.trim(),
                  selectedRoles,
                  selectedModules,
                  selectedUserIds,
                  reviewers: reviewers.split(',').map((item) => item.trim()).filter(Boolean),
                  dueDate: `${dueDate}T00:00:00.000Z`,
                });
                setReviewName('');
              }}
            >
              Launch Access Review
            </Button>
          </div>
        </PageSectionCard>

        <PageSectionCard title="Current Review Findings" subtitle="Track flagged privileges and completion status before export.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {state.sodConflicts.filter((conflict) => conflict.userId).slice(0, 6).map((conflict) => (
              <Card key={conflict.id} style={{ padding: theme.spacing[4] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: theme.colors.text.main }}>{conflict.userName}</strong>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{conflict.ruleTitle}</div>
                  </div>
                  <Badge variant={conflict.severity === 'high' ? 'danger' : 'warning'} size="sm">{conflict.severity}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </PageSectionCard>
      </div>

      <PageSectionCard title="Access Review Campaigns" subtitle="Review completion, approve or revoke user access, and export evidence packs for audit." action={<Badge variant="default" size="sm">{state.accessReviews.length} campaigns</Badge>}>
        <div style={{ display: 'grid', gap: theme.spacing[4] }}>
          {state.accessReviews.map((review) => (
            <Card key={review.id} style={{ padding: theme.spacing[4], minWidth: 0 }}>
              <div style={{ display: 'grid', gap: theme.spacing[3] }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: theme.spacing[2], alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: theme.colors.text.main }}>{review.name}</strong>
                      <Badge variant={statusBadgeVariant(review.status)} size="sm">{review.status}</Badge>
                    </div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{review.scopeSummary}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Due {formatDateTime(review.dueDate)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Badge variant={review.excessivePrivilegeFlags ? 'danger' : 'success'} size="sm">{review.excessivePrivilegeFlags} flags</Badge>
                    <Button variant="outline" onClick={() => setPendingExportReviewId(review.id)}>Export Evidence</Button>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight }}>
                  <div style={{ width: `${Math.max(review.completionPercent, 4)}%`, height: '100%', borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary }} />
                </div>
                <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{review.completionPercent}% completed</div>
                <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                  {review.decisions.map((decision) => (
                    <div key={`${review.id}-${decision.userId}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: theme.spacing[3], alignItems: 'center', padding: `${theme.spacing[2]} 0`, borderTop: `1px solid ${theme.colors.border}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{decision.userName}</div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{decision.roleName} · Reviewer: {decision.reviewer}</div>
                        {decision.notes ? <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{decision.notes}</div> : null}
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Button variant="outline" onClick={() => actions.recordAccessReviewDecision(review.id, decision.userId, 'approved', 'Retained during review.')}>Approve</Button>
                        <Button variant="secondary" onClick={() => actions.recordAccessReviewDecision(review.id, decision.userId, 'flagged', 'Excessive privilege requires remediation.')}>Flag</Button>
                        <Button variant="danger" onClick={() => actions.recordAccessReviewDecision(review.id, decision.userId, 'revoked', 'Access revoked by reviewer decision.')}>Revoke</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageSectionCard>

      <StepUpVerificationModal
        isOpen={Boolean(pendingExportReviewId)}
        onClose={() => setPendingExportReviewId(null)}
        onVerified={async (stepUpToken) => {
          if (!pendingExportReviewId) return;
          const content = await actions.exportAccessReviewEvidence(pendingExportReviewId, stepUpToken);
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${pendingExportReviewId}-evidence.txt`;
          anchor.click();
          URL.revokeObjectURL(url);
          setPendingExportReviewId(null);
        }}
        title="Export Access Review Evidence"
        description="Exporting access review evidence requires step-up verification."
        purpose="export_access_review"
      />
    </div>
  );
}

export function TeamAccessGovernancePage() {
  const { state, actions } = useAccessGovernanceStore();
  const [requestFilter, setRequestFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedUser, setSelectedUser] = useState<RbacUser | null>(null);
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<{
    kind: 'request' | 'revoke' | 'admin_role';
    run: (stepUpToken?: string) => Promise<void> | void;
    title: string;
    description: string;
  } | null>(null);

  const requestMetrics = [
    { label: 'Pending Requests', value: state.accessRequests.filter((request) => request.status === 'pending' || request.status === 'needs_info').length, detail: 'Awaiting reviewer action', tone: 'warning' as const },
    { label: 'Privileged Requests', value: state.accessRequests.filter((request) => request.requestedRoleId === 'super_admin' || request.requestedRoleId === 'tenant_admin').length, detail: 'Admin access in queue', tone: 'danger' as const },
    { label: 'MFA Required Users', value: state.users.filter((user) => user.mfaStatus === 'required').length, detail: 'Must complete MFA enrollment', tone: 'warning' as const },
    { label: 'Suspended / Revoked', value: state.users.filter((user) => user.status === 'suspended' || user.status === 'revoked').length, detail: 'Accounts removed from active access', tone: 'danger' as const },
  ];

  const filteredRequests = state.accessRequests.filter((request) =>
    [request.requesterName, request.requesterEmail, request.requestedRoleName, request.requestedWorkspace]
      .join(' ')
      .toLowerCase()
      .includes(requestFilter.toLowerCase()),
  );

  const filteredUsers = state.users.filter((user) =>
    [user.fullName, user.email, user.assignedRoleName, user.workspaceName, user.accessScope]
      .join(' ')
      .toLowerCase()
      .includes(userFilter.toLowerCase()),
  );

  const selectedUserConflicts = state.sodConflicts.filter((conflict) => conflict.userId === selectedUser?.id).map((conflict) => conflict.ruleTitle);

  return (
    <div style={pageStyle}>
      <PageHeader title="Team Access" description="Manage user access, review access requests, enforce MFA, and maintain an audit-ready governance trail." />

      <SummaryMetricStrip metrics={requestMetrics} />

      <DataTableShell title="Access Requests Queue" subtitle="Review new access requests, assign the final role, require MFA before activation, and record reviewer notes." action={<Badge variant="warning" size="sm">{filteredRequests.length} requests</Badge>}>
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <input value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)} placeholder="Search access requests..." style={{ maxWidth: 320, padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Requester</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Role</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Business Reason</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Workspace</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Status / Reviewer</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Date</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{request.requesterName}</div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{request.requesterEmail}</div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top' }}><Badge variant={roleBadgeVariant(request.requestedRoleId)} size="sm">{request.requestedRoleName}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{request.businessReason}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{request.requestedWorkspace}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top' }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                      <Badge variant={statusBadgeVariant(request.status)} size="sm">{request.status}</Badge>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{request.reviewer || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{formatDateTime(request.requestDate)}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: theme.spacing[2], justifyContent: 'flex-end' }}>
                      <Button variant="primary" onClick={() => setSelectedRequest(request)}>Review</Button>
                      <ActionMenu
                        items={[
                          {
                            label: 'Approve',
                            onClick: () => {
                              setSelectedRequest(request);
                            },
                          },
                          {
                            label: 'Reject',
                            onClick: () => {
                              setSelectedRequest(request);
                            },
                          },
                          {
                            label: 'Request More Info',
                            onClick: () => {
                              setSelectedRequest(request);
                            },
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      <PageSectionCard title="User Access Management" subtitle="Manage role assignments, status, MFA requirements, and access scope for active and pending users." action={<Badge variant="default" size="sm">{filteredUsers.length} users</Badge>}>
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <input value={userFilter} onChange={(event) => setUserFilter(event.target.value)} placeholder="Search users..." style={{ maxWidth: 320, padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md }} />
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>User</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Status</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Role</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>MFA</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Last Login</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[1]}` }}>Access Scope</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>{user.fullName}</div>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{user.email}</div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top' }}><Badge variant={statusBadgeVariant(user.status)} size="sm">{user.status}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top' }}><Badge variant={roleBadgeVariant(user.assignedRoleId)} size="sm">{user.assignedRoleName}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top' }}><Badge variant={mfaBadgeVariant(user.mfaStatus)} size="sm">{user.mfaStatus}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{formatDateTime(user.lastLogin)}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[1]}`, verticalAlign: 'top', fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{user.accessScope}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', gap: theme.spacing[2], justifyContent: 'flex-end' }}>
                      <Button variant="outline" onClick={() => setSelectedUser(user)}>View Activity</Button>
                      <ActionMenu
                        items={[
                          { label: 'Edit Role', onClick: () => setSelectedUser(user) },
                          { label: 'Suspend User', onClick: () => actions.setUserStatus(user.id, 'suspended', 'Security Office', 'Suspended during access review.') },
                          { label: 'Require MFA', onClick: () => actions.requireMfa(user.id) },
                          {
                            label: 'Revoke Access',
                            onClick: () => setPendingSensitiveAction({
                              kind: 'revoke',
                              run: (stepUpToken) => actions.setUserStatus(user.id, 'revoked', 'Security Office', 'Access revoked from Team Access page.', stepUpToken),
                              title: 'Revoke User Access',
                              description: 'Revoking user access requires step-up verification.',
                            }),
                            tone: 'danger',
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
        <ActivityFeed title="Access Governance Audit Trail" subtitle="All role changes, permission changes, access approvals, suspensions, revocations, and review actions are logged here." countLabel={`${state.auditTrail.length} events`}>
          {state.auditTrail.slice(0, 8).map((entry) => <AuditEntryCard key={entry.id} entry={entry} />)}
        </ActivityFeed>

        <PageSectionCard title="User Detail" subtitle="Selected user context with SoD findings and governance posture.">
          {!selectedUser ? (
            <EmptyStatePanel title="Select a user" description="Choose View Activity or Edit Role from the user table to inspect the access scope, role, SoD conflicts, and recent status." />
          ) : (
            <div style={{ display: 'grid', gap: theme.spacing[3] }}>
              <Card style={{ padding: theme.spacing[4], backgroundColor: theme.colors.surfaceHover }}>
                <div style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{selectedUser.fullName}</div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{selectedUser.email}</div>
                <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Badge variant={statusBadgeVariant(selectedUser.status)} size="sm">{selectedUser.status}</Badge>
                  <Badge variant={roleBadgeVariant(selectedUser.assignedRoleId)} size="sm">{selectedUser.assignedRoleName}</Badge>
                  <Badge variant={mfaBadgeVariant(selectedUser.mfaStatus)} size="sm">{selectedUser.mfaStatus}</Badge>
                </div>
              </Card>
              <Card style={{ padding: theme.spacing[4] }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Access scope</div>
                <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{selectedUser.accessScope}</div>
              </Card>
              <Card style={{ padding: theme.spacing[4] }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Segregation of Duties</div>
                <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[2] }}>
                  {selectedUserConflicts.length ? selectedUserConflicts.map((conflict) => <Badge key={conflict} variant="danger" size="sm">{conflict}</Badge>) : <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>No SoD conflicts detected.</span>}
                </div>
              </Card>
              <Card style={{ padding: theme.spacing[4] }}>
                <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>Recent activity</div>
                <div style={{ marginTop: theme.spacing[2], display: 'grid', gap: theme.spacing[2] }}>
                  {state.auditTrail.filter((entry) => entry.targetUser === selectedUser.fullName).slice(0, 4).map((entry) => (
                    <div key={entry.id} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                      {formatDateTime(entry.timestamp)} · {entry.action.replace(/_/g, ' ')} · {entry.outcome}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </PageSectionCard>
      </div>

      <AccessRequestReviewModal
        request={selectedRequest}
        roles={state.roles}
        onClose={() => setSelectedRequest(null)}
        onSubmit={({ requestId, nextStatus, notes, assignedRoleId }) => {
          const run = async (stepUpToken?: string) => {
            await actions.updateAccessRequest(requestId, nextStatus, 'Security Office', notes, assignedRoleId, stepUpToken);
            setSelectedRequest(null);
          };

          if (nextStatus === 'approved') {
            setPendingSensitiveAction({
              kind: 'request',
              run,
              title: 'Approve Access Request',
              description: 'Approving access requests requires step-up verification.',
            });
            return;
          }

          run();
        }}
      />

      <UserAccessModal
        user={selectedUser}
        roles={state.roles}
        conflicts={selectedUserConflicts}
        onClose={() => setSelectedUser(null)}
        onSaveRole={(userId, roleId) => {
          const run = async (stepUpToken?: string) => {
            await actions.assignUserRole(userId, roleId, 'Security Office', stepUpToken);
            setSelectedUser(null);
          };

          if (roleId === 'super_admin' || roleId === 'tenant_admin') {
            setPendingSensitiveAction({
              kind: 'admin_role',
              run,
              title: 'Assign Administrative Role',
              description: 'Assigning an administrative role requires step-up verification.',
            });
            return;
          }

          run();
        }}
      />

      <StepUpVerificationModal
        isOpen={Boolean(pendingSensitiveAction)}
        onClose={() => setPendingSensitiveAction(null)}
        onVerified={async (stepUpToken) => {
          await pendingSensitiveAction?.run(stepUpToken);
          setPendingSensitiveAction(null);
        }}
        title={pendingSensitiveAction?.title || 'Verify Sensitive Action'}
        description={pendingSensitiveAction?.description || 'Step-up verification is required for this action.'}
        purpose={
          pendingSensitiveAction?.kind === 'request'
            ? 'approve_access_request'
            : pendingSensitiveAction?.kind === 'admin_role'
              ? 'assign_admin_role'
              : 'revoke_access'
        }
      />
    </div>
  );
}
