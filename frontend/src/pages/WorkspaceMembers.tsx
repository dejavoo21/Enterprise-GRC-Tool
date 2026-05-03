import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, PageHeader } from '../components';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  createWorkspaceInvitation,
  deleteWorkspaceInvitation,
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
} from '../lib/api';
import { theme } from '../theme';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../types/workspace';
import type { WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from '../types/workspace';

type AccessRequestStatus = 'Pending' | 'Needs Info' | 'Approved' | 'Rejected';
type AccessAction = 'view' | 'request-info' | 'approve' | 'reject' | 'delete';
type AuditEventType =
  | 'Access requested'
  | 'Info requested'
  | 'Access approved'
  | 'Access rejected'
  | 'User invited'
  | 'Role changed'
  | 'MFA enforced'
  | 'User disabled'
  | 'User deleted';

type AccessRequestRecord = {
  id: string;
  requesterName: string;
  email: string;
  company: string;
  requestedRole: WorkspaceRole;
  requestReason: string;
  status: AccessRequestStatus;
  requestedDate: string;
  reviewedBy?: string;
  source: 'invitation' | 'manual';
  invitationId?: string;
  response?: string;
};

type AccessAuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  action: AuditEventType;
  targetUser: string;
  roleAffected: string;
  decisionOutcome: string;
  ipAddress?: string;
  notes?: string;
};

const ROLE_COLORS: Record<WorkspaceRole, { bg: string; text: string }> = {
  owner: { bg: '#FEF3C7', text: '#D97706' },
  admin: { bg: '#DBEAFE', text: '#2563EB' },
  grc: { bg: '#D1FAE5', text: '#059669' },
  auditor: { bg: '#F3E8FF', text: '#7C3AED' },
  viewer: { bg: '#F3F4F6', text: '#6B7280' },
};

const REQUEST_STATUS_TONE: Record<AccessRequestStatus, 'default' | 'warning' | 'success' | 'danger'> = {
  Pending: 'warning',
  'Needs Info': 'default',
  Approved: 'success',
  Rejected: 'danger',
};

const MOCK_REQUESTS: AccessRequestRecord[] = [
  {
    id: 'manual-1',
    requesterName: 'Olivia Martin',
    email: 'olivia.martin@northstaradvisory.com',
    company: 'Northstar Advisory',
    requestedRole: 'auditor',
    requestReason: 'Quarterly control effectiveness review and evidence walkthrough.',
    status: 'Pending',
    requestedDate: '2026-05-01T09:15:00.000Z',
    reviewedBy: '',
    source: 'manual',
    response: 'Request includes scope for audit sampling and evidence review.',
  },
  {
    id: 'manual-2',
    requesterName: 'Daniel Hughes',
    email: 'daniel.hughes@enterprisegrc.com',
    company: 'Enterprise GRC Tool',
    requestedRole: 'admin',
    requestReason: 'Temporary admin coverage for onboarding and workspace configuration.',
    status: 'Needs Info',
    requestedDate: '2026-04-30T14:22:00.000Z',
    reviewedBy: 'Security Office',
    source: 'manual',
    response: 'Need confirmation on duration of elevated access and compensating review cadence.',
  },
  {
    id: 'manual-3',
    requesterName: 'Grace Nwosu',
    email: 'grace.nwosu@helixvendor.com',
    company: 'Helix Vendor Services',
    requestedRole: 'viewer',
    requestReason: 'Vendor evidence upload review and issue follow-up.',
    status: 'Approved',
    requestedDate: '2026-04-28T11:04:00.000Z',
    reviewedBy: 'Lina Patel',
    source: 'manual',
    response: 'Approved with MFA required and invite sent.',
  },
];

const MOCK_AUDIT_EVENTS: AccessAuditEvent[] = [
  {
    id: 'event-1',
    timestamp: '2026-05-03 09:18',
    actor: 'Security Office',
    action: 'Access approved',
    targetUser: 'Grace Nwosu',
    roleAffected: 'Viewer',
    decisionOutcome: 'Approved',
    ipAddress: '192.168.10.24 / Chrome on macOS',
    notes: 'Invite issued with MFA requirement.',
  },
  {
    id: 'event-2',
    timestamp: '2026-05-02 16:41',
    actor: 'Lina Patel',
    action: 'Info requested',
    targetUser: 'Daniel Hughes',
    roleAffected: 'Admin',
    decisionOutcome: 'More info requested',
    ipAddress: '192.168.10.18 / Edge on Windows',
    notes: 'Need business justification and expected access duration.',
  },
  {
    id: 'event-3',
    timestamp: '2026-05-01 08:57',
    actor: 'Amina Clarke',
    action: 'Role changed',
    targetUser: 'Noah Walsh',
    roleAffected: 'Tenant Admin',
    decisionOutcome: 'Updated',
    ipAddress: '192.168.10.12 / Chrome on Windows',
    notes: 'Role elevated for migration cutover weekend.',
  },
  {
    id: 'event-4',
    timestamp: '2026-04-30 18:22',
    actor: 'Security Office',
    action: 'MFA enforced',
    targetUser: 'Priya Shah',
    roleAffected: 'Control Owner',
    decisionOutcome: 'Enforced',
    ipAddress: '192.168.10.30 / Safari on iPad',
    notes: 'Step-up auth required for evidence approvals.',
  },
];

const pageStyle = {
  maxWidth: '100%',
  margin: '0 auto',
  display: 'grid',
  gap: theme.spacing[6],
  overflowX: 'hidden' as const,
};

const tableWrapperStyle = {
  maxWidth: '100%',
  overflowX: 'hidden' as const,
};

const cellClampStyle = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const multiLineClampStyle = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  wordBreak: 'break-word' as const,
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function RoleBadge({ role }: { role: WorkspaceRole }) {
  const colors = ROLE_COLORS[role];
  return (
    <span
      style={{
        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: theme.borderRadius.md,
        fontSize: theme.typography.sizes.xs,
        fontWeight: theme.typography.weights.medium,
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ padding: theme.spacing[5], border: `1px solid ${theme.colors.border}`, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing[4], marginBottom: theme.spacing[4], flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg, color: theme.colors.text.main }}>{title}</h3>
          {subtitle ? <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function RequestActionMenu({
  onSelect,
}: {
  onSelect: (action: AccessAction) => void;
}) {
  const menuButtonStyle = {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.lg,
    lineHeight: 1,
  };

  const menuItemStyle = {
    width: '100%',
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    background: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.main,
  };

  return (
    <details style={{ position: 'relative' }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
        <div style={menuButtonStyle}>⋯</div>
      </summary>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 38,
          width: 156,
          backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.lg,
          zIndex: 5,
          overflow: 'hidden',
        }}
      >
        <button type="button" style={menuItemStyle} onClick={() => onSelect('approve')}>Approve</button>
        <button type="button" style={menuItemStyle} onClick={() => onSelect('reject')}>Reject</button>
        <button type="button" style={menuItemStyle} onClick={() => onSelect('request-info')}>Request Info</button>
        <button type="button" style={menuItemStyle} onClick={() => onSelect('delete')}>Delete</button>
      </div>
    </details>
  );
}

function InviteModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: WorkspaceRole) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(email, role);
      setEmail('');
      setRole('viewer');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[8],
          width: '90%',
          maxWidth: 460,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.xl,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[6], fontSize: theme.typography.sizes.xl }}>Invite User</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: theme.spacing[4] }}>
            <div>
              <label htmlFor="invite-email" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium, fontSize: theme.typography.sizes.sm }}>
                Email Address
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="colleague@company.com"
                style={{
                  width: '100%',
                  padding: theme.spacing[3],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                }}
              />
            </div>
            <div>
              <label htmlFor="invite-role" style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: theme.typography.weights.medium, fontSize: theme.typography.sizes.sm }}>
                Default Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                style={{
                  width: '100%',
                  padding: theme.spacing[3],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                  backgroundColor: theme.colors.surface,
                }}
              >
                {(['owner', 'admin', 'grc', 'auditor', 'viewer'] as WorkspaceRole[]).map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                {ROLE_DESCRIPTIONS[role]}
              </div>
            </div>
          </div>

          {error ? (
            <div
              style={{
                marginTop: theme.spacing[4],
                padding: theme.spacing[3],
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: theme.borderRadius.md,
                color: '#DC2626',
                fontSize: theme.typography.sizes.sm,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3], marginTop: theme.spacing[6] }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || !email}>
              {isSubmitting ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReviewModal({
  request,
  action,
  onClose,
  onConfirm,
}: {
  request: AccessRequestRecord | null;
  action: AccessAction | null;
  onClose: () => void;
  onConfirm: (payload: {
    requestId: string;
    action: AccessAction;
    role: WorkspaceRole;
    enforceMfa: boolean;
    sendInvite: boolean;
    notes: string;
  }) => void;
}) {
  const [role, setRole] = useState<WorkspaceRole>('viewer');
  const [enforceMfa, setEnforceMfa] = useState(true);
  const [sendInvite, setSendInvite] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!request) return;
    setRole(request.requestedRole);
    setEnforceMfa(true);
    setSendInvite(true);
    setNotes(request.response || '');
  }, [request]);

  if (!request || !action) return null;

  const readOnly = action === 'view';
  const title =
    action === 'approve'
      ? 'Approve Access Request'
      : action === 'reject'
        ? 'Reject Access Request'
        : action === 'request-info'
          ? 'Request More Information'
          : action === 'delete'
            ? 'Delete Access Request'
            : 'Access Request Details';

  const handleConfirm = () => {
    onConfirm({
      requestId: request.id,
      action,
      role,
      enforceMfa,
      sendInvite,
      notes,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[8],
          width: '92%',
          maxWidth: 680,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.xl,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', marginBottom: theme.spacing[5] }}>
          <div>
            <h2 style={{ margin: 0, fontSize: theme.typography.sizes.xl }}>{title}</h2>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {request.requesterName} • {request.email}
            </div>
          </div>
          <Badge variant={REQUEST_STATUS_TONE[request.status]} size="sm">{request.status}</Badge>
        </div>

        <div style={{ display: 'grid', gap: theme.spacing[4] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
            <Card style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Workspace</div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{request.company}</div>
            </Card>
            <Card style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Requested Date</div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.main }}>{formatDate(request.requestedDate)}</div>
            </Card>
          </div>

          <div>
            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, marginBottom: theme.spacing[2] }}>Request Reason</div>
            <div style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, color: theme.colors.text.secondary, fontSize: theme.typography.sizes.sm }}>
              {request.requestReason}
            </div>
          </div>

          {action === 'approve' ? (
            <div style={{ display: 'grid', gap: theme.spacing[4] }}>
              <div>
                <label htmlFor="approve-role" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                  Confirm Role
                </label>
                <select
                  id="approve-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                  style={{
                    width: '100%',
                    padding: theme.spacing[3],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    fontSize: theme.typography.sizes.sm,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  {(['owner', 'admin', 'grc', 'auditor', 'viewer'] as WorkspaceRole[]).map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
                <input type="checkbox" checked={enforceMfa} onChange={(event) => setEnforceMfa(event.target.checked)} />
                Optionally enforce MFA
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3], fontSize: theme.typography.sizes.sm }}>
                <input type="checkbox" checked={sendInvite} onChange={(event) => setSendInvite(event.target.checked)} />
                Send password setup invite
              </label>
            </div>
          ) : null}

          {action !== 'delete' ? (
            <div>
              <label htmlFor="decision-notes" style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium }}>
                {action === 'request-info' ? 'Information Request' : 'Notes'}
              </label>
              <textarea
                id="decision-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                readOnly={readOnly}
                rows={4}
                style={{
                  width: '100%',
                  padding: theme.spacing[3],
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                  resize: 'vertical',
                  backgroundColor: readOnly ? theme.colors.surfaceHover : theme.colors.surface,
                }}
              />
            </div>
          ) : (
            <div style={{ padding: theme.spacing[4], backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: theme.borderRadius.lg, color: '#991B1B', fontSize: theme.typography.sizes.sm }}>
              This deletes the request from the queue and writes a removal event to the audit trail.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing[3], marginTop: theme.spacing[6] }}>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!readOnly ? (
            <Button variant={action === 'reject' || action === 'delete' ? 'secondary' : 'primary'} onClick={handleConfirm}>
              {action === 'approve'
                ? 'Approve Request'
                : action === 'reject'
                  ? 'Reject Request'
                  : action === 'request-info'
                    ? 'Send Request'
                    : 'Delete Request'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceMembers() {
  const { currentWorkspace } = useWorkspace();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<WorkspaceInvitation | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AccessAuditEvent[]>(MOCK_AUDIT_EVENTS);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestRecord | null>(null);
  const [selectedAction, setSelectedAction] = useState<AccessAction | null>(null);
  const hasWorkspace = Boolean(currentWorkspace?.id);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [membersData, invitationsData] = await Promise.all([
        fetchWorkspaceMembers(currentWorkspace.id),
        fetchWorkspaceInvitations(currentWorkspace.id).catch(() => []),
      ]);

      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const derivedRequests = useMemo<AccessRequestRecord[]>(() => {
    const invitationRequests: AccessRequestRecord[] = invitations.map((invitation, index) => ({
      id: `invitation-${invitation.id}`,
      requesterName: invitation.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      email: invitation.email,
      company: currentWorkspace?.name || 'Current Workspace',
      requestedRole: invitation.role,
      requestReason: `Invitation-based access request for ${ROLE_LABELS[invitation.role]}.`,
      status: invitation.acceptedAt ? 'Approved' : new Date(invitation.expiresAt) < new Date() ? 'Rejected' : 'Pending',
      requestedDate: invitation.createdAt,
      reviewedBy: invitation.acceptedAt ? 'Invitation Flow' : '',
      source: 'invitation',
      invitationId: invitation.id,
      response: index % 2 === 0 ? 'Invite pending acknowledgement.' : 'Awaiting reviewer confirmation.',
    }));

    return [...invitationRequests, ...MOCK_REQUESTS];
  }, [currentWorkspace?.name, invitations]);

  useEffect(() => {
    setAccessRequests(derivedRequests);
  }, [derivedRequests]);

  const pendingRequests = accessRequests.filter((request) => request.status === 'Pending' || request.status === 'Needs Info').length;
  const approvedRequests = accessRequests.filter((request) => request.status === 'Approved').length;
  const rejectedRequests = accessRequests.filter((request) => request.status === 'Rejected').length;
  const privilegedRequests = accessRequests.filter((request) => request.requestedRole === 'owner' || request.requestedRole === 'admin').length;

  const handleInvite = async (email: string, role: WorkspaceRole) => {
    if (!currentWorkspace?.id) {
      throw new Error('Create or select an organization before sending invites');
    }

    const invitation = await createWorkspaceInvitation(currentWorkspace.id, {
      email,
      role,
      expiresInDays: 7,
    });

    setLastCreatedInvite(invitation);
    setAuditEvents((current) => [
      {
        id: `event-${Date.now()}`,
        timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
        actor: 'Security Office',
        action: 'User invited',
        targetUser: email,
        roleAffected: ROLE_LABELS[role],
        decisionOutcome: 'Invite sent',
        ipAddress: 'UI action / current device',
        notes: 'Password setup invitation sent from Team Access.',
      },
      ...current,
    ]);
    await fetchData();
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!currentWorkspace?.id) return;

    try {
      await deleteWorkspaceInvitation(currentWorkspace.id, invitationId);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete invitation:', err);
    }
  };

  const openReviewAction = (request: AccessRequestRecord, action: AccessAction) => {
    setSelectedRequest(request);
    setSelectedAction(action);
  };

  const closeReviewAction = () => {
    setSelectedRequest(null);
    setSelectedAction(null);
  };

  const handleDecision = ({
    requestId,
    action,
    role,
    enforceMfa,
    sendInvite,
    notes,
  }: {
    requestId: string;
    action: AccessAction;
    role: WorkspaceRole;
    enforceMfa: boolean;
    sendInvite: boolean;
    notes: string;
  }) => {
    const request = accessRequests.find((item) => item.id === requestId);
    if (!request) return;

    let nextStatus: AccessRequestStatus = request.status;
    let auditAction: AuditEventType = 'Access requested';
    let decisionOutcome: string = request.status;

    if (action === 'approve') {
      nextStatus = 'Approved';
      auditAction = 'Access approved';
      decisionOutcome = 'Approved';
    } else if (action === 'reject') {
      nextStatus = 'Rejected';
      auditAction = 'Access rejected';
      decisionOutcome = 'Rejected';
    } else if (action === 'request-info') {
      nextStatus = 'Needs Info';
      auditAction = 'Info requested';
      decisionOutcome = 'More info requested';
    } else if (action === 'delete') {
      auditAction = request.source === 'invitation' ? 'User deleted' : 'User disabled';
      decisionOutcome = 'Deleted';
    }

    if (action === 'delete') {
      setAccessRequests((current) => current.filter((item) => item.id !== requestId));
      if (request.invitationId) {
        void handleDeleteInvitation(request.invitationId);
      }
    } else {
      setAccessRequests((current) =>
        current.map((item) =>
          item.id === requestId
            ? {
                ...item,
                requestedRole: role,
                status: nextStatus,
                reviewedBy: 'Security Office',
                response: notes || item.response,
              }
            : item,
        ),
      );
    }

    const newEvents: AccessAuditEvent[] = [
      {
        id: `event-${Date.now()}-${action}`,
        timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
        actor: 'Security Office',
        action: auditAction,
        targetUser: request.requesterName,
        roleAffected: ROLE_LABELS[role],
        decisionOutcome,
        ipAddress: 'UI action / current device',
        notes: notes || request.requestReason,
      },
    ];

    if (action === 'approve' && sendInvite) {
      newEvents.push({
        id: `event-${Date.now()}-invite`,
        timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
        actor: 'Security Office',
        action: 'User invited',
        targetUser: request.requesterName,
        roleAffected: ROLE_LABELS[role],
        decisionOutcome: 'Invite sent',
        ipAddress: 'UI action / current device',
        notes: 'Password setup invite sent at approval time.',
      });
    }

    if (action === 'approve' && enforceMfa) {
      newEvents.push({
        id: `event-${Date.now()}-mfa`,
        timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
        actor: 'Security Office',
        action: 'MFA enforced',
        targetUser: request.requesterName,
        roleAffected: ROLE_LABELS[role],
        decisionOutcome: 'Enforced',
        ipAddress: 'UI action / current device',
        notes: 'MFA enforced during access approval.',
      });
    }

    setAuditEvents((current) => [...newEvents, ...current]);
    closeReviewAction();
  };

  if (loading) {
    return (
      <div style={{ ...pageStyle, maxWidth: 1400 }}>
        <PageHeader title="Team Access" description="Access governance for users, reviewers, and privileged workflow decisions." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: theme.spacing[12], color: theme.colors.text.secondary }}>
          Loading access governance data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...pageStyle, maxWidth: 1400 }}>
        <PageHeader title="Team Access" description="Access governance for users, reviewers, and privileged workflow decisions." />
        <div style={{ padding: theme.spacing[6], backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: theme.borderRadius.lg, color: '#DC2626', textAlign: 'center' }}>
          <p style={{ margin: 0 }}>{error}</p>
          <Button onClick={fetchData} variant="secondary" style={{ marginTop: theme.spacing[4] }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!hasWorkspace) {
    return (
      <div style={{ ...pageStyle, maxWidth: 1400 }}>
        <PageHeader title="Team Access" description="Access governance for users, reviewers, and privileged workflow decisions." />
        <div style={{ padding: theme.spacing[6], backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, color: theme.colors.text.secondary }}>
          Select or create an organization before managing access governance.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyle, maxWidth: 1400 }}>
      <PageHeader
        title="Team Access"
        description="Manage users, requests, and access governance."
        action={<Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>Invite User</Button>}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing[2],
          alignItems: 'center',
        }}
      >
        <Badge variant="warning" size="sm">Pending {pendingRequests}</Badge>
        <Badge variant={privilegedRequests > 0 ? 'warning' : 'default'} size="sm">Privileged {privilegedRequests}</Badge>
        <Badge variant="success" size="sm">Approved {approvedRequests}</Badge>
        <Badge variant={rejectedRequests > 0 ? 'danger' : 'default'} size="sm">Rejected {rejectedRequests}</Badge>
      </div>

      {lastCreatedInvite ? (
        <Card style={{ padding: theme.spacing[4], border: '1px solid #10B981', backgroundColor: '#ECFDF5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'center' }}>
            <div>
              <strong>Invitation sent to {lastCreatedInvite.email}</strong>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                Password setup link: <code style={{ backgroundColor: '#D1FAE5', padding: '2px 6px', borderRadius: 4 }}>{window.location.origin}{lastCreatedInvite.inviteUrl}</code>
              </div>
            </div>
            <button
              onClick={() => setLastCreatedInvite(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#059669' }}
            >
              &times;
            </button>
          </div>
        </Card>
      ) : null}

      <SectionCard
        title="Access Requests Queue"
        subtitle="Pending requests, role decisions, and reviewer actions for user access into the workspace."
        action={<Badge variant="warning" size="sm">{pendingRequests} pending</Badge>}
      >
        <div style={tableWrapperStyle}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '19%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Requester</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Workspace</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Requested Role</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Reason</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Review Status</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Date</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accessRequests.map((request) => (
                <tr key={request.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, verticalAlign: 'top', minWidth: 0 }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 0 }}>
                      <strong style={{ ...cellClampStyle, color: theme.colors.text.main }}>{request.requesterName}</strong>
                      <span title={request.email} style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{request.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <div title={request.company} style={cellClampStyle}>{request.company}</div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0 }}><RoleBadge role={request.requestedRole} /></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <div title={request.requestReason} style={multiLineClampStyle}>{request.requestReason}</div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0 }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 0 }}>
                      <Badge variant={REQUEST_STATUS_TONE[request.status]} size="sm">{request.status}</Badge>
                      <span title={request.reviewedBy || 'Unassigned'} style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                        {request.reviewedBy || 'Unassigned'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    <span style={cellClampStyle}>{formatDate(request.requestedDate)}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 0, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: theme.spacing[2], minWidth: 0 }}>
                      <Button variant="primary" onClick={() => openReviewAction(request, 'view')}>Review</Button>
                      <RequestActionMenu onSelect={(action) => openReviewAction(request, action)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Access Audit Trail"
        subtitle="Recorded access decisions and administrative actions for reviewer accountability and operating history."
        action={<Badge variant="default" size="sm">{auditEvents.length} events</Badge>}
      >
        <div style={tableWrapperStyle}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Timestamp</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Actor</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Action</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Target User</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Role Affected</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Decision Outcome</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>IP / Device</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 0 }}>
                    <span style={cellClampStyle}>{event.timestamp}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, minWidth: 0 }}>
                    <span title={event.actor} style={cellClampStyle}>{event.actor}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 0 }}>
                    <Badge variant={event.action === 'Access rejected' || event.action === 'User deleted' ? 'danger' : event.action === 'Info requested' || event.action === 'MFA enforced' ? 'warning' : 'success'} size="sm">
                      {event.action}
                    </Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, minWidth: 0 }}>
                    <span title={event.targetUser} style={cellClampStyle}>{event.targetUser}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 0 }}>
                    <span title={event.roleAffected} style={cellClampStyle}>{event.roleAffected}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 0 }}>
                    <span title={event.decisionOutcome} style={cellClampStyle}>{event.decisionOutcome}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 0 }}>
                    <span title={event.ipAddress || 'Not available'} style={cellClampStyle}>{event.ipAddress || 'Not available'}</span>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 0 }}>
                    <div title={event.notes || 'No notes recorded.'} style={multiLineClampStyle}>{event.notes || 'No notes recorded.'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Current Workspace Users" subtitle="Reference view of active members and assigned roles.">
        <div style={tableWrapperStyle}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '56%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '24%' }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>User</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Role</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 0 }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 0 }}>
                      <strong style={{ ...cellClampStyle, color: theme.colors.text.main }}>{member.fullName}</strong>
                      <span title={member.email} style={{ ...cellClampStyle, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{member.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}><RoleBadge role={member.role} /></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    {new Date(member.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} onSubmit={handleInvite} />
      <ReviewModal request={selectedRequest} action={selectedAction} onClose={closeReviewAction} onConfirm={handleDecision} />
    </div>
  );
}
