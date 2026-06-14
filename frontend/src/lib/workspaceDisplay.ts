import type { Workspace } from '../types/workspace';

export function getWorkspaceDisplayName(workspace?: Pick<Workspace, 'displayName' | 'name'> | null) {
  return workspace?.displayName || workspace?.name || 'Workspace';
}

export function getWorkspaceOrganizationName(
  workspace?: Pick<Workspace, 'organizationName' | 'displayName' | 'name'> | null,
) {
  return workspace?.organizationName || getWorkspaceDisplayName(workspace);
}

export function getWorkspaceSelectorLabel(
  workspace?: Pick<Workspace, 'organizationName' | 'displayName' | 'name'> | null,
) {
  return getWorkspaceOrganizationName(workspace);
}
