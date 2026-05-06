import { Request } from 'express';

/**
 * Extract workspaceId from request headers or query params
 * Priority: header (X-Workspace-Id) > query param (?workspaceId=) > authenticated token workspace
 */
export function getWorkspaceId(req: Request): string {
  const headerWorkspace = req.headers['x-workspace-id'];
  if (headerWorkspace && typeof headerWorkspace === 'string') return headerWorkspace;

  const queryWorkspace = req.query.workspaceId;
  if (queryWorkspace && typeof queryWorkspace === 'string') return queryWorkspace;

  if (req.authUser?.workspaceId) return req.authUser.workspaceId;

  throw new Error('Workspace context is required');
}
