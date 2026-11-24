import { NextFunction, Request, Response } from 'express';

const WORKSPACE_KEYS = ['workspaceId', 'workspace_id'] as const;

function requestedWorkspaceIds(req: Request): string[] {
  const values: Array<string | string[] | undefined> = [req.headers['x-workspace-id']];
  for (const key of WORKSPACE_KEYS) values.push(req.query[key] as string | string[] | undefined);
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    for (const key of WORKSPACE_KEYS) values.push(req.body[key] as string | string[] | undefined);
  }
  return values
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/**
 * Return the workspace selected by the authenticated session.
 * Client-provided workspace identifiers are compatibility assertions only and
 * are validated by requireAuthenticatedWorkspace before protected handlers run.
 */
export function getWorkspaceId(req: Request): string {
  if (req.authUser?.workspaceId) return req.authUser.workspaceId;
  throw new Error('Authenticated workspace context is required');
}

/**
 * Reject forged workspace selectors before route code or repositories execute.
 * Workspace switching remains supported by issuing a new authenticated token.
 */
export function requireAuthenticatedWorkspace(req: Request, res: Response, next: NextFunction) {
  const authenticatedWorkspaceId = req.authUser?.workspaceId;
  if (!authenticatedWorkspaceId) {
    return res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
  }

  if (requestedWorkspaceIds(req).some(workspaceId => workspaceId !== authenticatedWorkspaceId)) {
    return res.status(403).json({
      data: null,
      error: { code: 'FORBIDDEN', message: 'Workspace access is not authorised for this session.' },
    });
  }

  next();
}
