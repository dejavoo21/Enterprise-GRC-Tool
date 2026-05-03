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
    <Card style={{ padding: theme.spacing[5], border: `1px solid ${theme.colors.border}` }}>
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

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{value}</div>
      <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{detail}</div>
    </Card>
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
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <PageHeader title="Team Access" description="Access governance for users, reviewers, and privileged workflow decisions." />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: theme.spacing[12], color: theme.colors.text.secondary }}>
          Loading access governance data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
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
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <PageHeader title="Team Access" description="Access governance for users, reviewers, and privileged workflow decisions." />
        <div style={{ padding: theme.spacing[6], backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, color: theme.colors.text.secondary }}>
          Select or create an organization before managing access governance.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gap: theme.spacing[6] }}>
      <PageHeader
        title="Team Access"
        description={`Enterprise access governance for ${currentWorkspace?.name || 'your workspace'}. Review incoming access requests, make approval decisions, and maintain a full audit trail.`}
        action={<Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>Invite User</Button>}
      />

      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #0F3D91 52%, #38BDF8 100%)',
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[6],
          color: theme.colors.text.inverse,
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: theme.spacing[5],
        }}
      >
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, letterSpacing: '0.08em', opacity: 0.74, marginBottom: theme.spacing[2] }}>
            ACCESS GOVERNANCE
          </div>
          <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, marginBottom: theme.spacing[2] }}>
            Operate user access with reviewer control, stronger authentication, and a complete audit trail.
          </div>
          <div style={{ color: 'rgba(255,255,255,0.84)', lineHeight: 1.65 }}>
            Review requests by role, enforce MFA during approvals, issue setup invites, and keep a decision-grade log of all access actions.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
          <MetricCard label="Pending Requests" value={pendingRequests} detail="Awaiting reviewer decision or follow-up." />
          <MetricCard label="Privileged Requests" value={privilegedRequests} detail="Admin or owner requests in queue." />
          <MetricCard label="Approved" value={approvedRequests} detail="Requests granted in the current view." />
          <MetricCard label="Rejected" value={rejectedRequests} detail="Rejected or expired access requests." />
        </div>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Requester</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Company / Workspace</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Requested Role</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Request Reason</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Status</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Requested Date</th>
                <th style={{ padding: `${theme.spacing[2]} ${theme.spacing[2]} ${theme.spacing[2]} 0` }}>Reviewed By</th>
                <th style={{ padding: `${theme.spacing[2]} 0` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accessRequests.map((request) => (
                <tr key={request.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 220, verticalAlign: 'top' }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                      <strong style={{ color: theme.colors.text.main }}>{request.requesterName}</strong>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{request.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 180, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{request.company}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 140 }}><RoleBadge role={request.requestedRole} /></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 300, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{request.requestReason}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0` }}><Badge variant={REQUEST_STATUS_TONE[request.status]} size="sm">{request.status}</Badge></td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{formatDate(request.requestedDate)}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{request.reviewedBy || 'Unassigned'}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 280, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2] }}>
                      <Button variant="secondary" onClick={() => openReviewAction(request, 'view')}>View Response</Button>
                      <Button variant="secondary" onClick={() => openReviewAction(request, 'request-info')}>Request More Info</Button>
                      <Button variant="primary" onClick={() => openReviewAction(request, 'approve')}>Approve</Button>
                      <Button variant="secondary" onClick={() => openReviewAction(request, 'reject')}>Reject</Button>
                      <Button variant="secondary" onClick={() => openReviewAction(request, 'delete')}>Delete</Button>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 130 }}>{event.timestamp}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, minWidth: 140 }}>{event.actor}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, minWidth: 140 }}>
                    <Badge variant={event.action === 'Access rejected' || event.action === 'User deleted' ? 'danger' : event.action === 'Info requested' || event.action === 'MFA enforced' ? 'warning' : 'success'} size="sm">
                      {event.action}
                    </Badge>
                  </td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, minWidth: 160 }}>{event.targetUser}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 120 }}>{event.roleAffected}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 140 }}>{event.decisionOutcome}</td>
                  <td style={{ padding: `${theme.spacing[3]} ${theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 180 }}>{event.ipAddress || 'Not available'}</td>
                  <td style={{ padding: `${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, minWidth: 240 }}>{event.notes || 'No notes recorded.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Current Workspace Users" subtitle="Reference view of active members and assigned roles.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <td style={{ padding: `${theme.spacing[3]} 0`, minWidth: 240 }}>
                    <div style={{ display: 'grid', gap: theme.spacing[1] }}>
                      <strong style={{ color: theme.colors.text.main }}>{member.fullName}</strong>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{member.email}</span>
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
