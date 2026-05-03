/**
 * Authentication Types
 */

export type WorkspaceRole = 'owner' | 'admin' | 'grc' | 'auditor' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  mfaEnabled?: boolean;
  emailVerified?: boolean;
  availableMfaMethods?: ('authenticator' | 'email' | 'recovery_code')[];
}

export interface WorkspaceAccess {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  workspaceId: string | null;
  role: WorkspaceRole | null;
  availableWorkspaces: WorkspaceAccess[];
  isAuthenticated: boolean;
}

export interface LoginSuccessResponse {
  token: string;
  user: AuthUser;
  workspaceId: string;
  role: WorkspaceRole;
  availableWorkspaces: WorkspaceAccess[];
  requiresMfa: false;
}

export interface MfaChallengeResponse {
  requiresMfa: true;
  mfaToken: string;
  user: AuthUser;
  workspaceId: string;
  role: WorkspaceRole;
  availableWorkspaces: WorkspaceAccess[];
}

export type LoginResponse = LoginSuccessResponse | MfaChallengeResponse;

export interface MfaStatusResponse {
  enabled: boolean;
  emailVerified: boolean;
  recoveryCodesRemaining: number;
}

export interface MfaSetupResponse {
  issuer: string;
  accountName: string;
  manualEntryKey: string;
  otpAuthUrl: string;
  qrCodeDataUrl: string;
}

export interface MfaEnableResponse {
  enabled: boolean;
  recoveryCodes: string[];
}

export interface SendEmailOtpResponse {
  sent: boolean;
  destination: string;
  expiresAt: string;
}

export interface MeResponse {
  user: AuthUser;
  workspaceId: string;
  role: WorkspaceRole;
  availableWorkspaces: WorkspaceAccess[];
}

export interface SwitchWorkspaceResponse {
  token: string;
  workspaceId: string;
  role: WorkspaceRole;
}

// Role permission helpers
export const ADMIN_ROLES: WorkspaceRole[] = ['owner', 'admin'];
export const EDITOR_ROLES: WorkspaceRole[] = ['owner', 'admin', 'grc'];
export const ALL_ROLES: WorkspaceRole[] = ['owner', 'admin', 'grc', 'auditor', 'viewer'];

export function canEdit(role: WorkspaceRole | null): boolean {
  return role !== null && EDITOR_ROLES.includes(role);
}

export function isAdmin(role: WorkspaceRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

export function canView(role: WorkspaceRole | null): boolean {
  return role !== null && ALL_ROLES.includes(role);
}
