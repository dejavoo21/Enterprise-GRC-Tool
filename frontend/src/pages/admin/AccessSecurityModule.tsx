import { useEffect, useState, type ReactNode } from 'react';
import { Badge, Button, Card, PageHeader } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import type { MfaEnableResponse, MfaSetupResponse, MfaStatusResponse } from '../../types/auth';

export type AccessSecurityView =
  | 'users'
  | 'roles'
  | 'permissions'
  | 'authentication'
  | 'access-reviews'
  | 'login-activity'
  | 'security-settings';

type RoleKey =
  | 'super_admin'
  | 'tenant_admin'
  | 'grc_manager'
  | 'risk_owner'
  | 'control_owner'
  | 'auditor'
  | 'evidence_contributor'
  | 'vendor_manager'
  | 'read_only_executive';

type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'export'
  | 'assign'
  | 'configure';

type SecurityTone = 'healthy' | 'attention' | 'critical';

type RoleDefinition = {
  key: RoleKey;
  label: string;
  users: number;
  admins?: boolean;
  reviewCompletion: number;
  privilegeConflicts: number;
  sodIssues: number;
};

type UserRecord = {
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Dormant' | 'Pending';
  mfa: 'Enabled' | 'Missing';
  emailVerified: boolean;
  lastLogin: string;
  accessReview: 'Reviewed' | 'Pending' | 'Flagged';
};

type PermissionModule = {
  module: string;
  actions: Record<PermissionAction, string[]>;
};

type AuthSetting = {
  label: string;
  value: string;
  detail: string;
  tone: SecurityTone;
};

type AccessReviewRecord = {
  campaign: string;
  scope: string;
  owner: string;
  completion: number;
  flagged: number;
  status: 'Open' | 'In Review' | 'Completed';
};

type LoginEvent = {
  user: string;
  method: string;
  result: 'Success' | 'Failed' | 'Locked';
  location: string;
  timestamp: string;
};

type SecuritySettingRecord = {
  label: string;
  value: string;
  detail: string;
  tone: SecurityTone;
};

const roles: RoleDefinition[] = [
  { key: 'super_admin', label: 'Super Admin', users: 2, admins: true, reviewCompletion: 100, privilegeConflicts: 0, sodIssues: 0 },
  { key: 'tenant_admin', label: 'Tenant Admin', users: 4, admins: true, reviewCompletion: 92, privilegeConflicts: 1, sodIssues: 0 },
  { key: 'grc_manager', label: 'GRC Manager', users: 6, reviewCompletion: 88, privilegeConflicts: 1, sodIssues: 1 },
  { key: 'risk_owner', label: 'Risk Owner', users: 9, reviewCompletion: 81, privilegeConflicts: 2, sodIssues: 1 },
  { key: 'control_owner', label: 'Control Owner', users: 11, reviewCompletion: 79, privilegeConflicts: 1, sodIssues: 1 },
  { key: 'auditor', label: 'Auditor', users: 5, reviewCompletion: 96, privilegeConflicts: 0, sodIssues: 0 },
  { key: 'evidence_contributor', label: 'Evidence Contributor', users: 8, reviewCompletion: 84, privilegeConflicts: 0, sodIssues: 0 },
  { key: 'vendor_manager', label: 'Vendor Manager', users: 4, reviewCompletion: 87, privilegeConflicts: 1, sodIssues: 0 },
  { key: 'read_only_executive', label: 'Read-only Executive', users: 3, reviewCompletion: 100, privilegeConflicts: 0, sodIssues: 0 },
];

const users: UserRecord[] = [
  { name: 'Amina Clarke', email: 'amina@enterprisegrc.com', role: 'Super Admin', status: 'Active', mfa: 'Enabled', emailVerified: true, lastLogin: '2 hours ago', accessReview: 'Reviewed' },
  { name: 'Noah Walsh', email: 'noah@enterprisegrc.com', role: 'Tenant Admin', status: 'Active', mfa: 'Missing', emailVerified: true, lastLogin: '1 day ago', accessReview: 'Pending' },
  { name: 'Lina Patel', email: 'lina@enterprisegrc.com', role: 'GRC Manager', status: 'Active', mfa: 'Enabled', emailVerified: true, lastLogin: '3 hours ago', accessReview: 'Reviewed' },
  { name: 'Marcus Reed', email: 'marcus@enterprisegrc.com', role: 'Risk Owner', status: 'Dormant', mfa: 'Enabled', emailVerified: true, lastLogin: '34 days ago', accessReview: 'Flagged' },
  { name: 'Priya Shah', email: 'priya@enterprisegrc.com', role: 'Control Owner', status: 'Active', mfa: 'Missing', emailVerified: false, lastLogin: '5 days ago', accessReview: 'Pending' },
  { name: 'Ethan Cole', email: 'ethan@enterprisegrc.com', role: 'Auditor', status: 'Pending', mfa: 'Enabled', emailVerified: true, lastLogin: 'Never', accessReview: 'Reviewed' },
];

const permissionActions: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'delete', 'export', 'assign', 'configure'];

const permissionModules: PermissionModule[] = [
  {
    module: 'Risk Management',
    actions: {
      view: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Risk Owner', 'Control Owner', 'Auditor', 'Read-only Executive'],
      create: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Risk Owner'],
      edit: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Risk Owner'],
      approve: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      delete: ['Super Admin', 'Tenant Admin'],
      export: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Auditor', 'Read-only Executive'],
      assign: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      configure: ['Super Admin', 'Tenant Admin'],
    },
  },
  {
    module: 'Controls & Evidence',
    actions: {
      view: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Control Owner', 'Auditor', 'Evidence Contributor', 'Read-only Executive'],
      create: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Control Owner', 'Evidence Contributor'],
      edit: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Control Owner'],
      approve: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      delete: ['Super Admin', 'Tenant Admin'],
      export: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Auditor'],
      assign: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      configure: ['Super Admin', 'Tenant Admin'],
    },
  },
  {
    module: 'Third-Party Risk',
    actions: {
      view: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Vendor Manager', 'Auditor', 'Read-only Executive'],
      create: ['Super Admin', 'Tenant Admin', 'Vendor Manager'],
      edit: ['Super Admin', 'Tenant Admin', 'Vendor Manager'],
      approve: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      delete: ['Super Admin', 'Tenant Admin'],
      export: ['Super Admin', 'Tenant Admin', 'Vendor Manager', 'Auditor'],
      assign: ['Super Admin', 'Tenant Admin', 'Vendor Manager'],
      configure: ['Super Admin', 'Tenant Admin'],
    },
  },
  {
    module: 'Governance & Training',
    actions: {
      view: ['Super Admin', 'Tenant Admin', 'GRC Manager', 'Control Owner', 'Auditor', 'Read-only Executive'],
      create: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      edit: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      approve: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      delete: ['Super Admin', 'Tenant Admin'],
      export: ['Super Admin', 'Tenant Admin', 'Auditor', 'Read-only Executive'],
      assign: ['Super Admin', 'Tenant Admin', 'GRC Manager'],
      configure: ['Super Admin', 'Tenant Admin'],
    },
  },
];

const authSettings: AuthSetting[] = [
  { label: 'Email verification coverage', value: '96%', detail: 'Users verified before elevated access is granted.', tone: 'healthy' },
  { label: 'OTP enabled users', value: '81%', detail: 'OTP available for step-up verification and login recovery.', tone: 'attention' },
  { label: '2FA / MFA enforcement', value: '89%', detail: 'MFA enforced for admins and privileged roles.', tone: 'healthy' },
  { label: 'Biometric login readiness', value: '58%', detail: 'WebAuthn / biometric login is partially provisioned.', tone: 'attention' },
  { label: 'Passphrase strength score', value: '74', detail: 'Password policy is strong but reset backlog remains.', tone: 'attention' },
  { label: 'Passwordless readiness', value: '46%', detail: 'Device trust and biometric coverage are still being expanded.', tone: 'attention' },
  { label: 'SSO readiness', value: '72%', detail: 'Core federation paths are ready for tenant rollout.', tone: 'healthy' },
];

const accessReviews: AccessReviewRecord[] = [
  { campaign: 'Q2 Admin Entitlement Review', scope: 'Admin and privileged accounts', owner: 'Security Office', completion: 78, flagged: 3, status: 'In Review' },
  { campaign: 'Vendor Access Review', scope: 'Vendor Manager and third-party accounts', owner: 'TPRM Lead', completion: 64, flagged: 2, status: 'Open' },
  { campaign: 'Finance Reporting Review', scope: 'Read-only executives and auditors', owner: 'Compliance Lead', completion: 100, flagged: 0, status: 'Completed' },
];

const loginActivity: LoginEvent[] = [
  { user: 'Amina Clarke', method: 'SSO + MFA', result: 'Success', location: 'London, UK', timestamp: '2026-05-03 09:18' },
  { user: 'Noah Walsh', method: 'Email + OTP', result: 'Failed', location: 'Dublin, IE', timestamp: '2026-05-03 08:54' },
  { user: 'Priya Shah', method: 'Password', result: 'Failed', location: 'London, UK', timestamp: '2026-05-03 08:40' },
  { user: 'Marcus Reed', method: 'Password + MFA', result: 'Locked', location: 'Remote', timestamp: '2026-05-02 18:22' },
  { user: 'Lina Patel', method: 'SSO + Recovery Code', result: 'Success', location: 'Manchester, UK', timestamp: '2026-05-02 15:11' },
];

const securitySettings: SecuritySettingRecord[] = [
  { label: 'MFA enforcement', value: 'Enabled for privileged roles', detail: 'Can be expanded tenant-wide.', tone: 'healthy' },
  { label: 'OTP methods', value: 'Email and authenticator app', detail: 'Fallback codes are enabled for recovery.', tone: 'healthy' },
  { label: 'Passphrase minimum length', value: '14 characters', detail: 'Uppercase, lowercase, number, and symbol required.', tone: 'healthy' },
  { label: 'Session timeout', value: '30 minutes', detail: 'Idle session expiry with re-authentication.', tone: 'healthy' },
  { label: 'Failed login threshold', value: '5 attempts', detail: 'Account locks for 30 minutes after threshold.', tone: 'healthy' },
  { label: 'Trusted device duration', value: '14 days', detail: 'Device trust required for passwordless and biometrics.', tone: 'attention' },
  { label: 'Biometric login', value: 'Pilot enabled', detail: 'Ready for phased rollout to privileged users.', tone: 'attention' },
  { label: 'Email verification requirement', value: 'Mandatory', detail: 'Users cannot complete enrollment without verified email.', tone: 'healthy' },
];

const toneToBadge = (tone: SecurityTone) =>
  tone === 'critical' ? 'danger' : tone === 'attention' ? 'warning' : 'success';

const DEFAULT_API_ORIGIN = 'https://enterprise-grc-tool-backend.up.railway.app';
const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? DEFAULT_API_ORIGIN : '');

const titleCase = (value: string) =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function StatCard({
  label,
  value,
  detail,
  tone = 'healthy',
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: SecurityTone;
}) {
  return (
    <Card style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{value}</div>
          <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{detail}</div>
        </div>
        <div style={{ width: 8, alignSelf: 'stretch', borderRadius: theme.borderRadius.full, backgroundColor: tone === 'critical' ? theme.colors.semantic.danger : tone === 'attention' ? theme.colors.semantic.warning : theme.colors.semantic.success }} />
      </div>
    </Card>
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
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card style={{ padding: theme.spacing[5], border: `1px solid ${theme.colors.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], alignItems: 'flex-start', marginBottom: theme.spacing[4] }}>
        <div>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg, color: theme.colors.text.main }}>{title}</h3>
          {subtitle ? <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.muted }}>{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ProgressRow({
  label,
  value,
  total = 100,
  tone = 'healthy',
}: {
  label: string;
  value: number;
  total?: number;
  tone?: SecurityTone;
}) {
  const percent = Math.max(4, Math.round((value / Math.max(total, 1)) * 100));
  const color = tone === 'critical' ? theme.colors.semantic.danger : tone === 'attention' ? theme.colors.semantic.warning : theme.colors.primary;
  return (
    <div style={{ display: 'grid', gap: theme.spacing[1] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], fontSize: theme.typography.sizes.sm }}>
        <span style={{ color: theme.colors.text.secondary }}>{label}</span>
        <strong style={{ color: theme.colors.text.main }}>{value}{total === 100 ? '%' : ''}</strong>
      </div>
      <div style={{ height: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.borderLight }}>
        <div style={{ width: `${percent}%`, height: '100%', borderRadius: theme.borderRadius.full, backgroundColor: color }} />
      </div>
    </div>
  );
}

function LiveMfaEnrollmentCard() {
  const { token, user, refreshAuth } = useAuth();
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/mfa/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error?.message || 'Unable to load MFA status');
        }
        setStatus(result.data as MfaStatusResponse);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load MFA status');
      }
    };

    void loadStatus();
  }, [token]);

  const beginSetup = async () => {
    if (!token) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to start MFA setup');
      }
      setSetup(result.data as MfaSetupResponse);
      setRecoveryCodes([]);
      setVerificationCode('');
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Unable to start MFA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const enableMfa = async () => {
    if (!token || !verificationCode) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/mfa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verificationCode }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Unable to enable MFA');
      }

      const data = result.data as MfaEnableResponse;
      setRecoveryCodes(data.recoveryCodes);
      setStatus({
        enabled: true,
        emailVerified: status?.emailVerified ?? true,
        recoveryCodesRemaining: data.recoveryCodes.length,
      });
      setSetup(null);
      setVerificationCode('');
      await refreshAuth();
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : 'Unable to enable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SectionCard
      title="Live MFA Enrollment"
      subtitle="Enable authenticator-app MFA for the signed-in user with a QR code and recovery codes."
      action={status?.enabled ? <Badge variant="success" size="sm">Enabled</Badge> : <Badge variant="warning" size="sm">Not Enabled</Badge>}
    >
      <div style={{ display: 'grid', gap: theme.spacing[4] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[4], flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
              {user?.email}
            </div>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              Email verified: {status?.emailVerified ? 'Yes' : 'No'} · Recovery codes remaining: {status?.recoveryCodesRemaining ?? 0}
            </div>
          </div>
          {!status?.enabled ? (
            <Button variant="primary" onClick={beginSetup} disabled={isLoading}>
              {setup ? 'Refresh QR Code' : 'Set Up MFA'}
            </Button>
          ) : null}
        </div>

        {error ? (
          <div style={{ padding: theme.spacing[3], border: '1px solid #fecaca', borderRadius: theme.borderRadius.md, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: theme.typography.sizes.sm }}>
            {error}
          </div>
        ) : null}

        {setup ? (
          <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: theme.spacing[4], alignItems: 'start' }}>
            <div style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surfaceHover }}>
              <img src={setup.qrCodeDataUrl} alt="MFA QR code" style={{ width: '100%', display: 'block' }} />
            </div>
            <div style={{ display: 'grid', gap: theme.spacing[3], minWidth: 0 }}>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                Scan the QR code in Microsoft Authenticator, Google Authenticator, 1Password, or another TOTP app. If scanning is unavailable, use the manual key below.
              </div>
              <Card style={{ padding: theme.spacing[3], border: `1px solid ${theme.colors.border}` }}>
                <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase' }}>Manual Entry Key</div>
                <div style={{ marginTop: theme.spacing[2], fontFamily: 'monospace', fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, wordBreak: 'break-all' }}>
                  {setup.manualEntryKey}
                </div>
              </Card>
              <div>
                <label style={{ display: 'block', marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text.main }}>
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    padding: theme.spacing[3],
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    fontSize: theme.typography.sizes.base,
                    boxSizing: 'border-box',
                    letterSpacing: '0.2em',
                  }}
                />
              </div>
              <div>
                <Button variant="primary" onClick={enableMfa} disabled={isLoading || verificationCode.trim().length < 6}>
                  Confirm and Enable MFA
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <Card style={{ padding: theme.spacing[4], border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}>
            <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
              Recovery Codes
            </div>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              Store these once. Each recovery code works only one time.
            </div>
            <div style={{ marginTop: theme.spacing[3], display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2] }}>
              {recoveryCodes.map((code) => (
                <div
                  key={code}
                  style={{
                    padding: theme.spacing[2],
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: 'white',
                    border: `1px solid ${theme.colors.border}`,
                    fontFamily: 'monospace',
                    fontSize: theme.typography.sizes.sm,
                    color: theme.colors.text.main,
                  }}
                >
                  {code}
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </SectionCard>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
            {headers.map((header) => <th key={header} style={{ padding: `${theme.spacing[2]} 0` }}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
              {row.map((cell, cellIndex) => <td key={`cell-${index}-${cellIndex}`} style={{ padding: `${theme.spacing[3]} ${cellIndex === 0 ? 0 : theme.spacing[2]} ${theme.spacing[3]} 0`, fontSize: theme.typography.sizes.sm, color: theme.colors.text.main, verticalAlign: 'top' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getPageMeta(view: AccessSecurityView) {
  switch (view) {
    case 'users':
      return { title: 'User Management', description: 'Manage platform users, account state, identity hygiene, and access review readiness.' };
    case 'roles':
      return { title: 'Role Management', description: 'Define enterprise roles, review privileged access, and manage SoD / excessive privilege findings.' };
    case 'permissions':
      return { title: 'Permission Matrix', description: 'Inspect and govern role permissions across modules and sensitive administrative actions.' };
    case 'authentication':
      return { title: 'Authentication Settings', description: 'Monitor MFA, OTP, biometric readiness, passphrase posture, and recovery control coverage.' };
    case 'access-reviews':
      return { title: 'Access Reviews', description: 'Launch and track access certifications, approvals, revocations, and privilege remediation.' };
    case 'login-activity':
      return { title: 'Login Activity', description: 'Review login attempts, failed authentication patterns, session risk, and audit trail events.' };
    case 'security-settings':
      return { title: 'Security Settings', description: 'Configure platform authentication, passphrase, session, lockout, trust, and recovery controls.' };
  }
}

function UsersView() {
  const activeUsers = users.filter((user) => user.status === 'Active').length;
  const privilegedUsers = users.filter((user) => ['Super Admin', 'Tenant Admin', 'GRC Manager'].includes(user.role)).length;
  const usersWithoutMfa = users.filter((user) => user.mfa === 'Missing').length;
  const failedLoginAttempts = loginActivity.filter((event) => event.result === 'Failed').length;
  const dormantAccounts = users.filter((user) => user.status === 'Dormant').length;
  const pendingAccessReviews = users.filter((user) => user.accessReview !== 'Reviewed').length;

  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <StatCard label="Active Users" value={activeUsers} detail="Currently enabled user accounts." />
        <StatCard label="Privileged Users" value={privilegedUsers} detail="Admins and governance operators." tone="attention" />
        <StatCard label="Users Without MFA" value={usersWithoutMfa} detail="Accounts missing strong authentication." tone={usersWithoutMfa > 0 ? 'critical' : 'healthy'} />
        <StatCard label="Failed Login Attempts" value={failedLoginAttempts} detail="Recent authentication failures." tone={failedLoginAttempts > 0 ? 'attention' : 'healthy'} />
        <StatCard label="Dormant Accounts" value={dormantAccounts} detail="Accounts with stale activity." tone={dormantAccounts > 0 ? 'attention' : 'healthy'} />
        <StatCard label="Pending Access Reviews" value={pendingAccessReviews} detail="Users requiring reviewer action." tone={pendingAccessReviews > 0 ? 'attention' : 'healthy'} />
      </div>

      <SectionCard
        title="User Directory"
        subtitle="Track account status, verification, MFA, and access review completion."
        action={<Button variant="secondary">Invite User</Button>}
      >
        <SimpleTable
          headers={['User', 'Role', 'Account', 'MFA', 'Email Verification', 'Last Login', 'Access Review']}
          rows={users.map((user) => [
            <div key={`${user.email}-identity`} style={{ display: 'grid', gap: theme.spacing[1] }}>
              <strong>{user.name}</strong>
              <span style={{ color: theme.colors.text.secondary }}>{user.email}</span>
            </div>,
            user.role,
            <Badge key={`${user.email}-status`} variant={user.status === 'Active' ? 'success' : user.status === 'Dormant' ? 'warning' : 'default'} size="sm">{user.status}</Badge>,
            <Badge key={`${user.email}-mfa`} variant={user.mfa === 'Enabled' ? 'success' : 'danger'} size="sm">{user.mfa}</Badge>,
            <Badge key={`${user.email}-verified`} variant={user.emailVerified ? 'success' : 'warning'} size="sm">{user.emailVerified ? 'Verified' : 'Pending'}</Badge>,
            user.lastLogin,
            <Badge key={`${user.email}-review`} variant={user.accessReview === 'Reviewed' ? 'success' : user.accessReview === 'Flagged' ? 'danger' : 'warning'} size="sm">{user.accessReview}</Badge>,
          ])}
        />
      </SectionCard>
    </div>
  );
}

function RolesView() {
  const adminUsers = roles.filter((role) => role.admins).reduce((sum, role) => sum + role.users, 0);
  const privilegeConflicts = roles.reduce((sum, role) => sum + role.privilegeConflicts, 0);
  const sodIssues = roles.reduce((sum, role) => sum + role.sodIssues, 0);
  const reviewCompletion = Math.round(roles.reduce((sum, role) => sum + role.reviewCompletion, 0) / roles.length);

  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <StatCard label="Roles Configured" value={roles.length} detail="Defined enterprise access roles." />
        <StatCard label="Users by Role" value={roles.reduce((sum, role) => sum + role.users, 0)} detail="Users assigned across all roles." />
        <StatCard label="Admin Users" value={adminUsers} detail="Super Admin and Tenant Admin population." tone="attention" />
        <StatCard label="Privilege Conflicts" value={privilegeConflicts} detail="Excessive privilege findings." tone={privilegeConflicts > 0 ? 'critical' : 'healthy'} />
        <StatCard label="SoD Issues" value={sodIssues} detail="Segregation of duties conflicts." tone={sodIssues > 0 ? 'critical' : 'healthy'} />
        <StatCard label="Access Review Completion" value={`${reviewCompletion}%`} detail="Average completion across roles." tone={reviewCompletion >= 85 ? 'healthy' : 'attention'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: theme.spacing[4] }}>
        <SectionCard title="Role Governance" subtitle="Review role population, privilege conflicts, and SoD health.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {roles.map((role) => (
              <Card key={role.key} style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{role.label}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{role.users} assigned users</div>
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                    {role.admins ? <Badge variant="warning" size="sm">Admin Scope</Badge> : null}
                    <Badge variant={role.reviewCompletion >= 85 ? 'success' : 'warning'} size="sm">{role.reviewCompletion}% reviewed</Badge>
                  </div>
                </div>
                <div style={{ marginTop: theme.spacing[3], display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[2] }}>
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>Privilege conflicts: <strong style={{ color: theme.colors.text.main }}>{role.privilegeConflicts}</strong></div>
                  <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>SoD issues: <strong style={{ color: theme.colors.text.main }}>{role.sodIssues}</strong></div>
                </div>
              </Card>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Role Summary" subtitle="Compact role-level completion view.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {roles.map((role) => <ProgressRow key={role.key} label={role.label} value={role.reviewCompletion} tone={role.reviewCompletion >= 85 ? 'healthy' : 'attention'} />)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PermissionsView() {
  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <StatCard label="Modules Governed" value={permissionModules.length} detail="Core application modules in the permission matrix." />
        <StatCard label="Actions Controlled" value={permissionActions.length} detail="View, create, approve, export, configure, and more." />
        <StatCard label="Privileged Actions" value={4} detail="Approve, delete, assign, and configure actions." tone="attention" />
        <StatCard label="Executive Read-only Paths" value={permissionModules.filter((module) => module.actions.view.includes('Read-only Executive')).length} detail="Modules exposed to executive oversight." />
      </div>

      <SectionCard title="Permission Matrix" subtitle="Role permissions by module and sensitive action.">
        <SimpleTable
          headers={['Module', ...permissionActions.map((action) => titleCase(action))]}
          rows={permissionModules.map((module) => [
            <strong key={`${module.module}-name`}>{module.module}</strong>,
            ...permissionActions.map((action) => (
              <div key={`${module.module}-${action}`} style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[1] }}>
                {module.actions[action].map((role) => <Badge key={`${module.module}-${action}-${role}`} variant="default" size="sm">{role}</Badge>)}
              </div>
            )),
          ])}
        />
      </SectionCard>
    </div>
  );
}

function AuthenticationView() {
  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <LiveMfaEnrollmentCard />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        {authSettings.slice(0, 4).map((setting) => (
          <StatCard key={setting.label} label={setting.label} value={setting.value} detail={setting.detail} tone={setting.tone} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[4] }}>
        <SectionCard title="Authentication Coverage" subtitle="Coverage across verification, MFA, biometric login, and modern authentication readiness.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            <ProgressRow label="Email verification" value={96} />
            <ProgressRow label="OTP enabled users" value={81} tone="attention" />
            <ProgressRow label="2FA / MFA enforced" value={89} />
            <ProgressRow label="Biometric readiness" value={58} tone="attention" />
            <ProgressRow label="Passwordless readiness" value={46} tone="attention" />
            <ProgressRow label="SSO readiness" value={72} />
          </div>
        </SectionCard>

        <SectionCard title="Authentication Controls" subtitle="Recovery, reset, and step-up authentication posture.">
          <div style={{ display: 'grid', gap: theme.spacing[3] }}>
            {authSettings.slice(4).map((setting) => (
              <Card key={setting.label} style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{setting.label}</div>
                    <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{setting.detail}</div>
                  </div>
                  <Badge variant={toneToBadge(setting.tone)} size="sm">{setting.value}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function AccessReviewsView() {
  const completion = Math.round(accessReviews.reduce((sum, review) => sum + review.completion, 0) / accessReviews.length);
  const flagged = accessReviews.reduce((sum, review) => sum + review.flagged, 0);

  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <StatCard label="Open Campaigns" value={accessReviews.filter((review) => review.status !== 'Completed').length} detail="Active certification cycles." tone="attention" />
        <StatCard label="Completion Rate" value={`${completion}%`} detail="Average completion across current campaigns." tone={completion >= 85 ? 'healthy' : 'attention'} />
        <StatCard label="Flagged Excessive Access" value={flagged} detail="Users requiring privilege review." tone={flagged > 0 ? 'critical' : 'healthy'} />
        <StatCard label="Completed Reviews" value={accessReviews.filter((review) => review.status === 'Completed').length} detail="Campaigns closed this cycle." />
      </div>

      <SectionCard
        title="Access Review Campaigns"
        subtitle="Launch campaigns, review users by role, revoke access, and track completion."
        action={
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            <Button variant="secondary">Launch Access Review</Button>
            <Button variant="secondary">Export Review Pack</Button>
          </div>
        }
      >
        <SimpleTable
          headers={['Campaign', 'Scope', 'Owner', 'Completion', 'Flagged', 'Status']}
          rows={accessReviews.map((review) => [
            review.campaign,
            review.scope,
            review.owner,
            <div key={`${review.campaign}-completion`} style={{ minWidth: 140 }}>
              <ProgressRow label="Progress" value={review.completion} tone={review.completion >= 85 ? 'healthy' : 'attention'} />
            </div>,
            <Badge key={`${review.campaign}-flagged`} variant={review.flagged > 0 ? 'danger' : 'success'} size="sm">{review.flagged}</Badge>,
            <Badge key={`${review.campaign}-status`} variant={review.status === 'Completed' ? 'success' : review.status === 'In Review' ? 'warning' : 'default'} size="sm">{review.status}</Badge>,
          ])}
        />
      </SectionCard>
    </div>
  );
}

function LoginActivityView() {
  const failedAttempts = loginActivity.filter((event) => event.result === 'Failed').length;
  const lockedAccounts = loginActivity.filter((event) => event.result === 'Locked').length;

  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <StatCard label="Successful Logins" value={loginActivity.filter((event) => event.result === 'Success').length} detail="Recent successful sign-ins." />
        <StatCard label="Failed Attempts" value={failedAttempts} detail="Authentication failures requiring monitoring." tone={failedAttempts > 0 ? 'attention' : 'healthy'} />
        <StatCard label="Locked Accounts" value={lockedAccounts} detail="Accounts locked by failed login policy." tone={lockedAccounts > 0 ? 'critical' : 'healthy'} />
        <StatCard label="OTP / MFA Events" value={loginActivity.filter((event) => event.method.includes('OTP') || event.method.includes('MFA')).length} detail="Strong-authentication login paths." />
      </div>

      <SectionCard title="Login Audit Log" subtitle="Review login method, location, and authentication result for recent events.">
        <SimpleTable
          headers={['User', 'Method', 'Result', 'Location', 'Timestamp']}
          rows={loginActivity.map((event) => [
            event.user,
            event.method,
            <Badge key={`${event.user}-${event.timestamp}-result`} variant={event.result === 'Success' ? 'success' : event.result === 'Locked' ? 'danger' : 'warning'} size="sm">{event.result}</Badge>,
            event.location,
            event.timestamp,
          ])}
        />
      </SectionCard>
    </div>
  );
}

function SecuritySettingsView() {
  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: theme.spacing[3] }}>
        <StatCard label="MFA Enforcement" value="Enabled" detail="Privileged roles enforced, tenant-wide ready." />
        <StatCard label="Session Timeout" value="30 min" detail="Idle sessions require re-authentication." />
        <StatCard label="Login Lockout" value="5 / 30 min" detail="Failed threshold and lockout duration." tone="attention" />
        <StatCard label="Trusted Devices" value="14 days" detail="Trusted-device allowance window." tone="attention" />
      </div>

      <SectionCard title="Security Control Configuration" subtitle="Platform-level authentication, session, lockout, trust, and recovery settings.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.spacing[3] }}>
          {securitySettings.map((setting) => (
            <Card key={setting.label} style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{setting.label}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{setting.detail}</div>
                </div>
                <Badge variant={toneToBadge(setting.tone)} size="sm">{setting.value}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function renderView(view: AccessSecurityView) {
  switch (view) {
    case 'users':
      return <UsersView />;
    case 'roles':
      return <RolesView />;
    case 'permissions':
      return <PermissionsView />;
    case 'authentication':
      return <AuthenticationView />;
    case 'access-reviews':
      return <AccessReviewsView />;
    case 'login-activity':
      return <LoginActivityView />;
    case 'security-settings':
      return <SecuritySettingsView />;
  }
}

export function AccessSecurityModule({ view }: { view: AccessSecurityView }) {
  const meta = getPageMeta(view);

  return (
    <div style={{ display: 'grid', gap: theme.spacing[5] }}>
      <PageHeader title={meta.title} description={meta.description} />
      {renderView(view)}
    </div>
  );
}
