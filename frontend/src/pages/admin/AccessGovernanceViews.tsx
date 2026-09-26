import { useState } from 'react';
import { filterAdminRequests, filterAdminUsers } from '../../lib/adminWorkspace';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AdminCard, AdminHero, AdminMetrics, AdminNotice, AdminOverlay } from './AdminPrimitives';
import {
  Modal,
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  StepUpVerificationModal,
  SummaryMetricStrip,
} from '../../components';
import { useAccessGovernanceStore } from '../../lib/accessGovernanceStore';
import { theme } from '../../theme';
import type {
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

function AccessRequestReviewModal({ request, roles, onClose, onSubmit, busy = false, error }: {
  request: AccessRequest | null; roles: EnterpriseRole[]; onClose: () => void;
  onSubmit: (payload: { requestId: string; nextStatus: 'approved' | 'rejected' | 'needs_info'; notes: string; assignedRoleId: EnterpriseRoleKey; enforceMfaBeforeActivation: boolean }) => void;
  busy?: boolean; error?: string | null;
}) {
  const [assignedRoleId, setAssignedRoleId] = useState<EnterpriseRoleKey>(request?.requestedRoleId || 'auditor');
  const [notes, setNotes] = useState(request?.decisionNotes || '');
  if (!request) return null;
  const submit = (nextStatus: 'approved' | 'rejected' | 'needs_info') => onSubmit({ requestId: request.id, nextStatus, notes, assignedRoleId, enforceMfaBeforeActivation: true });
  return <Modal accessibleDialog isOpen onClose={() => { if (!busy) onClose(); }} title="Review Access Request" width="620px" footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="secondary" disabled={busy} onClick={() => submit('needs_info')}>Request More Info</Button><Button variant="danger" disabled={busy} onClick={() => submit('rejected')}>Reject</Button><Button disabled={busy} onClick={() => submit('approved')}>Approve</Button></>}>
    <div className="adminPage"><dl className="adminDetailGrid"><div><dt>Requester</dt><dd>{request.requesterName}<br />{request.requesterEmail}</dd></div><div><dt>Workspace</dt><dd>{request.requestedWorkspace}</dd></div></dl><p className="adminHelp">{request.businessReason || 'No business reason recorded.'}</p>
      <label>Assigned role<select value={assignedRoleId} onChange={event => setAssignedRoleId(event.target.value as EnterpriseRoleKey)}>{roles.filter(role => role.status === 'active').map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <label>Decision notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} /></label>
      <AdminNotice>MFA is enforced before activation by the existing approval policy. Approval requires step-up verification.</AdminNotice>{error && <AdminNotice error>{error}</AdminNotice>}
    </div>
  </Modal>;
}
function UserAccessModal({ user, roles, conflicts, onClose, onSaveRole, busy = false, error }: {
  user: RbacUser | null; roles: EnterpriseRole[]; conflicts: string[]; onClose: () => void;
  onSaveRole: (userId: string, roleId: EnterpriseRoleKey) => void; busy?: boolean; error?: string | null;
}) {
  const [roleId, setRoleId] = useState<EnterpriseRoleKey>(user?.assignedRoleId || 'auditor');
  if (!user) return null;
  return <Modal accessibleDialog isOpen onClose={() => { if (!busy) onClose(); }} title={`Edit access: ${user.fullName}`} width="640px" footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => onSaveRole(user.id, roleId)}>{busy ? 'Saving...' : 'Save Role'}</Button></>}>
    <div className="adminPage"><p className="adminHelp">{user.email} / {user.workspaceName}</p><dl className="adminDetailGrid"><div><dt>Status</dt><dd>{user.status}</dd></div><div><dt>MFA</dt><dd>{user.mfaStatus.replaceAll('_',' ')}</dd></div><div><dt>Access scope</dt><dd>{user.accessScope}</dd></div><div><dt>Last login</dt><dd>{formatDateTime(user.lastLogin)}</dd></div></dl>
      <label>Assigned role<select value={roleId} onChange={event => setRoleId(event.target.value as EnterpriseRoleKey)}>{roles.filter(role => role.status === 'active').map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
      <div><strong>Recorded SoD findings</strong>{conflicts.length ? conflicts.map(conflict => <p key={conflict}><Badge size="sm" variant="danger">{conflict}</Badge></p>) : <p className="adminHelp">No recorded conflicts for the current assignment. This is not a preview of the proposed role.</p>}</div>{error && <AdminNotice error>{error}</AdminNotice>}
    </div>
  </Modal>;
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
  const { workspaceId } = useWorkspace();
  return <TeamAccessContent key={workspaceId} />;
}
function TeamAccessContent() {
  const { state, actions, loading, error } = useAccessGovernanceStore();
  const [requestFilter, setRequestFilter] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [requestRole, setRequestRole] = useState('');
  const [requestWorkspace, setRequestWorkspace] = useState('');
  const [requestFrom, setRequestFrom] = useState('');
  const [requestTo, setRequestTo] = useState('');
  const [userScope, setUserScope] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userRole, setUserRole] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<RbacUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<{
    kind: 'request' | 'revoke' | 'admin_role';
    run: (stepUpToken?: string) => Promise<void> | void;
    title: string; description: string;
  } | null>(null);
  const selectedUser = state.users.find(user => user.id === (selectedUserId || state.users[0]?.id)) || null;
  const selectedUserConflicts = state.sodConflicts.filter(conflict => conflict.userId === (editingUser?.id || selectedUser?.id)).map(conflict => conflict.ruleTitle);
  const runAction = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setActionError(null);
    try { await operation(); } catch (err) { setActionError(err instanceof Error ? err.message : 'The access action failed.'); }
    finally { setBusy(false); }
  };
  const metric = (count: number) => loading ? 'Loading' : error ? 'Unavailable' : count;
  const requestMetrics = [
    { label: 'Pending Requests', value: metric(state.accessRequests.filter(request => ['pending','needs_info'].includes(request.status)).length), detail: 'Awaiting reviewer action', tone: 'warning' },
    { label: 'Privileged Requests', value: metric(state.accessRequests.filter(request => ['pending','needs_info'].includes(request.status) && ['super_admin','tenant_admin'].includes(request.requestedRoleId)).length), detail: 'Administrative access in queue', tone: 'danger' },
    { label: 'MFA Required Users', value: metric(state.users.filter(user => user.mfaStatus === 'required').length), detail: 'Pending MFA enrollment', tone: 'warning' },
    { label: 'Suspended / Revoked', value: metric(state.users.filter(user => ['suspended','revoked'].includes(user.status)).length), detail: 'Removed from active access', tone: 'danger' },
  ];
  const filteredRequests = filterAdminRequests(state.accessRequests, { search: requestFilter, status: requestStatus, role: requestRole, workspace: requestWorkspace, from: requestFrom, to: requestTo });
  const filteredUsers = filterAdminUsers(state.users, { search: userFilter, status: userStatus, role: userRole, scope: userScope });
  const userEvents = state.auditTrail.filter(entry => entry.targetUser === selectedUser?.fullName).slice(0,4);
  return <div className="adminPage">
    <AdminHero title="Team Access" description="Manage user access, review requests, enforce MFA, and maintain an audit-ready governance trail." chips={['User Management','Access Requests','MFA Enforcement','Audit Ready']} action={<Button variant="outline" disabled={loading} onClick={() => void actions.resetAll()}>Refresh</Button>} />
    <AdminMetrics metrics={requestMetrics} />
    {(error || actionError) && <AdminNotice error>{error || actionError}</AdminNotice>}
    <div className="adminSplit">
      <div className="adminStack">
        <AdminCard title="Access Requests Queue" description="Review the business reason, role and scope before making a decision." action={<Badge size="sm" variant="warning">{filteredRequests.length} requests</Badge>}>
          <div className="adminToolbar"><label>Search requests<input type="search" placeholder="Requester or workspace" value={requestFilter} onChange={event => setRequestFilter(event.target.value)} /></label>
            <label>Request status<select value={requestStatus} onChange={event => setRequestStatus(event.target.value)}><option value="">All statuses</option>{['pending','needs_info','approved','rejected'].map(status => <option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}</select></label>
            <label>Requested role<select value={requestRole} onChange={event => setRequestRole(event.target.value)}><option value="">All roles</option>{state.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          </div>
          <details className="adminExtraFilters"><summary>Workspace and date filters</summary><div className="adminToolbar"><label>Requested workspace<select value={requestWorkspace} onChange={event => setRequestWorkspace(event.target.value)}><option value="">All available workspaces</option>{[...new Set(state.accessRequests.map(request => request.requestedWorkspace))].map(workspace => <option key={workspace}>{workspace}</option>)}</select></label><label>Requested from (UTC)<input type="date" value={requestFrom} onChange={event => setRequestFrom(event.target.value)} /></label><label>Requested to (UTC)<input type="date" min={requestFrom} value={requestTo} onChange={event => setRequestTo(event.target.value)} /></label></div></details>
          <div className="adminTableScroll" role="region" aria-label="Access requests" tabIndex={0}><table className="adminTable"><thead><tr>{['Requester / Workspace','Role / Reason','Status / Reviewer','Date','Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filteredRequests.map(request => <tr key={request.id}>
            <td><strong>{request.requesterName}</strong><div className="adminHelp">{request.requesterEmail}</div><div className="adminHelp">{request.requestedWorkspace}</div></td>
            <td><Badge size="sm" variant={roleBadgeVariant(request.requestedRoleId)}>{request.requestedRoleName}</Badge><p className="adminHelp">{request.businessReason}</p></td>
            <td><Badge size="sm" variant={statusBadgeVariant(request.status)}>{request.status.replaceAll('_',' ')}</Badge><div className="adminHelp">{request.reviewer || 'Unassigned'}</div></td><td>{formatDateTime(request.requestDate)}</td><td><Button size="sm" variant="outline" onClick={() => setSelectedRequest(request)}>Review</Button></td>
          </tr>)}{!filteredRequests.length && <tr><td colSpan={5} className="adminEmpty">{loading ? 'Loading requests...' : error ? 'Requests are unavailable.' : 'No access requests match these filters.'}</td></tr>}</tbody></table></div>
        </AdminCard>
        <AdminCard title="User Access Management" description="Select a user to inspect access, review findings and perform governed actions." action={<Badge size="sm">{filteredUsers.length} users</Badge>}>
          <div className="adminToolbar"><label>Search users<input type="search" placeholder="Name, email, or access scope" value={userFilter} onChange={event => setUserFilter(event.target.value)} /></label><label>User status<select value={userStatus} onChange={event => setUserStatus(event.target.value)}><option value="">All statuses</option>{['active','pending','suspended','revoked'].map(status => <option key={status}>{status}</option>)}</select></label><label>Assigned role<select value={userRole} onChange={event => setUserRole(event.target.value)}><option value="">All roles</option>{state.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div>
          <div className="adminToolbar"><label>Access scope<select value={userScope} onChange={event => setUserScope(event.target.value)}><option value="">All available scopes</option>{[...new Set(state.users.map(user => user.accessScope))].map(scope => <option key={scope}>{scope}</option>)}</select></label></div>
          <div className="adminTableScroll" role="region" aria-label="User access" tabIndex={0}><table className="adminTable"><thead><tr>{['User','Role / Status','MFA','Last Login'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filteredUsers.map(user => <tr key={user.id} data-selected={selectedUser?.id === user.id}>
            <td><button className="adminRowAction" onClick={() => setSelectedUserId(user.id)} aria-label={`View access for ${user.fullName}`}>{user.fullName}</button><div className="adminHelp">{user.email}</div></td><td><Badge size="sm" variant={roleBadgeVariant(user.assignedRoleId)}>{user.assignedRoleName}</Badge><div><Badge size="sm" variant={statusBadgeVariant(user.status)}>{user.status}</Badge></div></td><td><Badge size="sm" variant={mfaBadgeVariant(user.mfaStatus)}>{user.mfaStatus.replaceAll('_',' ')}</Badge></td><td>{formatDateTime(user.lastLogin)}</td>
          </tr>)}{!filteredUsers.length && <tr><td colSpan={4} className="adminEmpty">{loading ? 'Loading users...' : error ? 'Users are unavailable.' : 'No users match these filters.'}</td></tr>}</tbody></table></div>
        </AdminCard>
      </div>
      <AdminCard title="User Detail" description="Selected user access context.">
        {!selectedUser ? <p className="adminEmpty">Select a user name to view their role, access scope, MFA status, and recent activity.</p> : <div className="adminStack">
          <div><strong>{selectedUser.fullName}</strong><p className="adminHelp">{selectedUser.email}</p><Badge size="sm" variant={statusBadgeVariant(selectedUser.status)}>{selectedUser.status}</Badge></div>
          <dl className="adminDetailGrid"><div><dt>Assigned role</dt><dd>{selectedUser.assignedRoleName}</dd></div><div><dt>MFA status</dt><dd>{selectedUser.mfaStatus.replaceAll('_',' ')}</dd></div><div><dt>Workspace</dt><dd>{selectedUser.workspaceName}</dd></div><div><dt>Access scope</dt><dd>{selectedUser.accessScope}</dd></div><div><dt>Last login</dt><dd>{formatDateTime(selectedUser.lastLogin)}</dd></div><div><dt>Reviewer</dt><dd>{selectedUser.reviewer || 'Not assigned'}</dd></div><div><dt>Assigned roles</dt><dd>{selectedUser.assignedRoleId ? 1 : 'Not recorded'}</dd></div><div><dt>Access reviews</dt><dd>{state.accessReviews.filter(review => review.selectedUserIds.includes(selectedUser.id) || review.decisions.some(decision => decision.userId === selectedUser.id)).length}</dd></div><div><dt>Days active</dt><dd>Not available</dd></div></dl>
          <div><strong>Segregation of Duties</strong>{selectedUserConflicts.length ? selectedUserConflicts.map(conflict => <p key={conflict}><Badge size="sm" variant="danger">{conflict}</Badge></p>) : <p className="adminHelp">No recorded SoD conflicts for this user.</p>}</div>
          <div><strong>Recent activity</strong><ul className="adminEventList">{userEvents.map(entry => <li key={entry.id}>{entry.action.replaceAll('_',' ')}<small>{formatDateTime(entry.timestamp)} / {entry.outcome}</small></li>)}</ul>{!userEvents.length && <p className="adminHelp">No matching user activity in the loaded audit trail.</p>}</div>
          <p className="adminHelp">Account creation dates and MFA reset are not provided by this workflow. Require MFA enforces enrollment; it does not reset credentials.</p>
          <div className="adminRowButtons"><Button size="sm" disabled={busy} onClick={() => setEditingUser(selectedUser)}>Edit Role</Button><Button size="sm" variant="outline" disabled={busy || selectedUser.mfaStatus === 'required'} onClick={() => void runAction(() => actions.requireMfa(selectedUser.id))}>Require MFA</Button></div>
          <div className="adminRowButtons"><Button size="sm" variant="outline" disabled={busy || selectedUser.status !== 'active'} onClick={() => void runAction(() => actions.setUserStatus(selectedUser.id, 'suspended', 'Security Office', 'Suspended during access review.'))}>Suspend User</Button><Button size="sm" variant="danger" disabled={busy || selectedUser.status === 'revoked'} onClick={() => setPendingSensitiveAction({ kind: 'revoke', run: token => actions.setUserStatus(selectedUser.id, 'revoked', 'Security Office', 'Access revoked from Team Access page.', token), title: 'Revoke User Access', description: 'Revoking user access requires step-up verification.' })}>Revoke Access</Button></div>
        </div>}
      </AdminCard>
    </div>
    <div className="adminGridTwo"><AdminCard title="Access Governance Audit Trail" description="Recorded access decisions, role changes, and security events."><ul className="adminEventList">{state.auditTrail.slice(0,5).map(entry => <li key={entry.id}><strong>{entry.action.replaceAll('_',' ')}</strong><small>{entry.actor} / {formatDateTime(entry.timestamp)} / {entry.outcome}</small>{entry.notes && <p className="adminHelp">{entry.notes}</p>}</li>)}</ul>{!state.auditTrail.length && <p className="adminEmpty">{loading ? 'Loading audit trail...' : 'No audit events available in this scope.'}</p>}</AdminCard>
      <AdminCard title="Access Insights" description="Derived from the currently loaded governance records."><dl className="adminDetailGrid"><div><dt>Users with MFA enabled</dt><dd>{metric(state.users.filter(user => user.mfaStatus === 'enabled').length)}</dd></div><div><dt>SoD findings</dt><dd>{metric(state.sodConflicts.length)}</dd></div><div><dt>Access reviews in progress</dt><dd>{metric(state.accessReviews.filter(review => review.status === 'in_progress').length)}</dd></div><div><dt>Active roles</dt><dd>{metric(state.roles.filter(role => role.status === 'active').length)}</dd></div></dl><p className="adminHelp">Creating users and new access requests is not connected in this view. Existing request review and user access actions remain available.</p></AdminCard></div>

      <AdminOverlay>
      <AccessRequestReviewModal
        key={selectedRequest?.id || "no-request"}
        request={selectedRequest}
        busy={busy}
        error={actionError}
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

          void runAction(() => run());
        }}
      />

      <UserAccessModal
        key={editingUser?.id || "no-user"}
        user={editingUser}
        busy={busy}
        error={actionError}
        roles={state.roles}
        conflicts={selectedUserConflicts}
        onClose={() => setEditingUser(null)}
        onSaveRole={(userId, roleId) => {
          const run = async (stepUpToken?: string) => {
            await actions.assignUserRole(userId, roleId, 'Security Office', stepUpToken);
            setEditingUser(null);
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

          void runAction(() => run());
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
      </AdminOverlay>
    </div>;
}
