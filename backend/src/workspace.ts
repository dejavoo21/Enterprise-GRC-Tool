import { Request } from 'express';

/**
 * Extract workspaceId from request headers or query params
 * Priority: header (X-Workspace-Id) > query param (?workspaceId=) > default ('demo-workspace')
 */
export function getWorkspaceId(req: Request): string {
  // Check header first
  const headerWorkspace = req.headers['x-workspace-id'];
  if (headerWorkspace && typeof headerWorkspace === 'string') {
    return headerWorkspace;
  }

  // Check query param
  const queryWorkspace = req.query.workspaceId;
  if (queryWorkspace && typeof queryWorkspace === 'string') {
    return queryWorkspace;
  }

  // Default to demo-workspace
  return 'demo-workspace';
}
