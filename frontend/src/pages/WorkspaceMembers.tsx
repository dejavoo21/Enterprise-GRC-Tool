import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { DataTable } from '../components/DataTable';
import { Button } from '../components/Button';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  fetchWorkspaceMembers,
  fetchWorkspaceInvitations,
  createWorkspaceInvitation,
  deleteWorkspaceInvitation,
} from '../lib/api';
import type {
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceRole,
} from '../types/workspace';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../types/workspace';

const ROLE_COLORS: Record<WorkspaceRole, { bg: string; text: string }> = {
  owner: { bg: '#FEF3C7', text: '#D97706' },
  admin: { bg: '#DBEAFE', text: '#2563EB' },
  grc: { bg: '#D1FAE5', text: '#059669' },
  auditor: { bg: '#F3E8FF', text: '#7C3AED' },
  viewer: { bg: '#F3F4F6', text: '#6B7280' },
};

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
      }}
    >
      {ROLE_LABELS[role]}
    </span>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[8],
          maxWidth: '450px',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: theme.spacing[6] }}>Invite Team Member</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: theme.spacing[4] }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: theme.spacing[2],
                fontWeight: theme.typography.weights.medium,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              style={{
                width: '100%',
                padding: theme.spacing[3],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
              }}
            />
          </div>

          <div style={{ marginBottom: theme.spacing[6] }}>
            <label
              htmlFor="role"
              style={{
                display: 'block',
                marginBottom: theme.spacing[2],
                fontWeight: theme.typography.weights.medium,
                fontSize: theme.typography.sizes.sm,
              }}
            >
              Role *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              style={{
                width: '100%',
                padding: theme.spacing[3],
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.sm,
                backgroundColor: 'white',
              }}
            >
              {(['owner', 'admin', 'grc', 'auditor', 'viewer'] as WorkspaceRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing[3],
                marginBottom: theme.spacing[4],
                color: '#DC2626',
                fontSize: theme.typography.sizes.sm,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: theme.spacing[3], justifyContent: 'flex-end' }}>
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

export function WorkspaceMembers() {
  const { currentWorkspace } = useWorkspace();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<WorkspaceInvitation | null>(null);
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

  const memberColumns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: WorkspaceMember) => (
        <div>
          <div style={{ fontWeight: theme.typography.weights.medium }}>{item.fullName}</div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
            {item.email}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '120px',
      render: (item: WorkspaceMember) => <RoleBadge role={item.role} />,
    },
    {
      key: 'joined',
      header: 'Joined',
      width: '120px',
      render: (item: WorkspaceMember) => (
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
          {new Date(item.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
  ];

  const invitationColumns = [
    {
      key: 'email',
      header: 'Email',
      render: (item: WorkspaceInvitation) => (
        <span style={{ color: theme.colors.text.main }}>{item.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '120px',
      render: (item: WorkspaceInvitation) => <RoleBadge role={item.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (item: WorkspaceInvitation) => {
        const isExpired = new Date(item.expiresAt) < new Date();
        const isAccepted = !!item.acceptedAt;

        if (isAccepted) {
          return (
            <span
              style={{
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                backgroundColor: '#D1FAE5',
                color: '#059669',
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.xs,
              }}
            >
              Accepted
            </span>
          );
        }
        if (isExpired) {
          return (
            <span
              style={{
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.xs,
              }}
            >
              Expired
            </span>
          );
        }
        return (
          <span
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.xs,
            }}
          >
            Pending
          </span>
        );
      },
    },
    {
      key: 'expires',
      header: 'Expires',
      width: '120px',
      render: (item: WorkspaceInvitation) => (
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
          {new Date(item.expiresAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (item: WorkspaceInvitation) => {
        if (item.acceptedAt) return null;
        return (
          <button
            onClick={() => handleDeleteInvitation(item.id)}
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.sm,
              cursor: 'pointer',
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.secondary,
            }}
          >
            Cancel
          </button>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <PageHeader
          title="Team Access"
          description="Manage who has access to this operating environment."
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[12],
            color: theme.colors.text.secondary,
          }}
        >
          Loading members...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <PageHeader
          title="Team Access"
          description="Manage who has access to this operating environment."
        />
        <div
          style={{
            padding: theme.spacing[6],
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: theme.borderRadius.lg,
            color: '#DC2626',
            textAlign: 'center',
          }}
        >
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
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <PageHeader
          title="Team Access"
          description="Manage who has access to this operating environment."
        />
        <div
          style={{
            padding: theme.spacing[6],
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            color: theme.colors.text.secondary,
          }}
        >
          Select or create an organization before managing team access.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        title="Team Access"
        description={`Manage who has access to ${currentWorkspace?.name || 'your operating environment'}.`}
      />

      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0f766e 48%, #38bdf8 100%)',
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing[6],
          marginBottom: theme.spacing[6],
          color: theme.colors.text.inverse,
        }}
      >
        <div style={{ fontSize: theme.typography.sizes.xs, letterSpacing: '0.08em', opacity: 0.74, marginBottom: theme.spacing[2] }}>
          TEAM ACCESS
        </div>
        <div style={{ fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, marginBottom: theme.spacing[2] }}>
          Control who can operate inside the platform and what level of authority they hold.
        </div>
        <div style={{ color: 'rgba(255,255,255,0.86)', lineHeight: 1.65 }}>
          Use this page to manage active access, send new invitations, and keep role assignments aligned with how governance and risk work is actually distributed.
        </div>
      </div>

      {/* Last Created Invite Banner */}
      {lastCreatedInvite && (
        <div
          style={{
            backgroundColor: '#D1FAE5',
            border: '1px solid #10B981',
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing[4],
            marginBottom: theme.spacing[6],
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          >
          <div>
            <strong>Invitation sent to {lastCreatedInvite.email}</strong>
            <div style={{ fontSize: theme.typography.sizes.sm, marginTop: theme.spacing[1] }}>
              Access link: <code style={{ backgroundColor: '#ECFDF5', padding: '2px 6px', borderRadius: '4px' }}>
                {window.location.origin}{lastCreatedInvite.inviteUrl}
              </code>
            </div>
          </div>
          <button
            onClick={() => setLastCreatedInvite(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#059669',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Members Table */}
      <div style={{ marginBottom: theme.spacing[8] }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing[4],
          }}
        >
          <h3 style={{ margin: 0 }}>Team Members ({members.length})</h3>
          <Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>
            + Invite Team Member
          </Button>
        </div>
        {members.length === 0 ? (
          <div
            style={{
              padding: theme.spacing[6],
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              textAlign: 'center',
              color: theme.colors.text.secondary,
            }}
          >
            No team members yet. Invite collaborators to activate shared operations.
          </div>
        ) : (
          <DataTable data={members} columns={memberColumns} searchPlaceholder="Search members..." />
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 style={{ marginBottom: theme.spacing[4] }}>Pending Invites ({invitations.filter(i => !i.acceptedAt).length})</h3>
          <DataTable
            data={invitations}
            columns={invitationColumns}
            searchPlaceholder="Search invites..."
          />
        </div>
      )}

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={handleInvite}
      />
    </div>
  );
}
