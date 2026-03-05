/**
 * Workspace Types
 */

export type WorkspaceSeedProfile = 'minimal' | 'standard' | 'full';

export type WorkspaceRole = 'owner' | 'admin' | 'grc' | 'auditor' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  displayName: string | null;
  description?: string;
  industry: string | null;
  region: string | null;
  status: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  email: string;
  fullName: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdBy: string;
  createdAt: string;
  inviteUrl?: string;
}

export interface SeedProfile {
  id: WorkspaceSeedProfile;
  name: string;
  description: string;
}

export interface CreateWorkspacePayload {
  displayName: string;
  industry?: string;
  region?: string;
  seedProfile?: WorkspaceSeedProfile;
}

export interface CreateInvitationPayload {
  email: string;
  role: WorkspaceRole;
  expiresInDays?: number;
}

export const INDUSTRY_OPTIONS = [
  { value: 'general', label: 'General / Other' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'technology', label: 'Technology' },
  { value: 'public-sector', label: 'Public Sector / Government' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
] as const;

export const REGION_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'eu-uk', label: 'EU / UK' },
  { value: 'us', label: 'United States' },
  { value: 'apac', label: 'Asia-Pacific' },
  { value: 'africa', label: 'Africa' },
  { value: 'latam', label: 'Latin America' },
] as const;

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  grc: 'GRC Manager',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: 'Full access, can manage workspace settings and members',
  admin: 'Full access, can manage members but not workspace settings',
  grc: 'Can manage risks, controls, policies, and evidence',
  auditor: 'Read-only access with ability to review and comment',
  viewer: 'Read-only access to view GRC data',
};
