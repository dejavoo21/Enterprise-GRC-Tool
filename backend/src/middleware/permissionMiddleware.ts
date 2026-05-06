import { NextFunction, Request, Response } from 'express';
import { PermissionAction, PermissionModule, StepUpPurpose } from '../types/accessGovernance.js';
import * as governanceRepo from '../repositories/accessGovernanceRepo.js';
import { appendGovernanceAuditLog, buildGovernanceAuditFromRequest } from '../services/governanceAuditService.js';
import { verifyStepUpVerificationToken } from '../services/authService.js';
import { getStepUpWindowMinutes } from '../services/authService.js';
import { findActiveSessionById } from '../repositories/authRepo.js';

declare global {
  namespace Express {
    interface Request {
      enterpriseRoleId?: string | null;
    }
  }
}

export async function resolveEnterpriseRole(req: Request) {
  if (!req.authUser) {
    return null;
  }
  if (req.enterpriseRoleId) {
    return req.enterpriseRoleId;
  }
  const roleId = await governanceRepo.getEffectiveRoleForUser(req.authUser.workspaceId, req.authUser.userId);
  req.enterpriseRoleId = roleId;
  return roleId;
}

async function deny(req: Request, res: Response, message: string, action: string) {
  if (req.authUser) {
    await appendGovernanceAuditLog(
      buildGovernanceAuditFromRequest(req, {
        action,
        targetType: 'permission',
        targetId: null,
        targetName: null,
        previousValue: null,
        newValue: null,
        outcome: 'Denied',
        notes: message,
      }),
    );
  }

  return res.status(403).json({
    data: null,
    error: {
      code: 'FORBIDDEN',
      message,
    },
  });
}

export function requirePermission(moduleName: PermissionModule, action: PermissionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const roleId = await resolveEnterpriseRole(req);
    if (!roleId) {
      return deny(req, res, 'No enterprise role is assigned for this workspace.', 'permission_denied');
    }

    const allowed = await governanceRepo.hasPermission(req.authUser.workspaceId, roleId as any, moduleName, action);
    if (!allowed) {
      return deny(req, res, `Missing permission ${moduleName}.${action}`, 'permission_denied');
    }

    if (action === 'approve') {
      const conflicts = await governanceRepo.getUserSodConflicts(req.authUser.workspaceId, req.authUser.userId);
      if (conflicts.some((conflict) => conflict.ruleTitle.toLowerCase().includes(moduleName.toLowerCase()))) {
        return deny(req, res, `Segregation of duties conflict blocks ${moduleName}.${action}`, 'sod_conflict_denied');
      }
    }

    next();
  };
}

export function requireModulePermissions(
  moduleName: PermissionModule,
  overrides?: Partial<Record<string, PermissionAction>>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const action = overrides?.[req.method] || defaultActionForMethod(req.method);
    return requirePermission(moduleName, action)(req, res, next);
  };
}

function defaultActionForMethod(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'view';
    case 'POST':
      return 'create';
    case 'PATCH':
    case 'PUT':
      return 'edit';
    case 'DELETE':
      return 'delete';
    default:
      return 'view';
  }
}

export function requireStepUp(purpose: StepUpPurpose) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser?.sessionId) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const stepUpToken = (req.headers['x-step-up-token'] as string | undefined) || req.body?.stepUpToken;
    if (stepUpToken) {
      const payload = verifyStepUpVerificationToken(stepUpToken);
      if (
        payload &&
        payload.sub === req.authUser.userId &&
        payload.workspaceId === req.authUser.workspaceId &&
        payload.sessionId === req.authUser.sessionId &&
        payload.actionPurpose === purpose
      ) {
        const challenge = await governanceRepo.findValidStepUpChallenge(
          req.authUser.workspaceId,
          req.authUser.userId,
          req.authUser.sessionId,
          payload.stepUpTokenId,
          purpose,
        );
        if (challenge) {
          await governanceRepo.consumeStepUpChallenge(challenge.id);
          return next();
        }
      }
    }

    const session = await findActiveSessionById(req.authUser.sessionId);
    if (session?.lastStepUpAt) {
      const windowMs = getStepUpWindowMinutes() * 60 * 1000;
      if (new Date(session.lastStepUpAt).getTime() + windowMs > Date.now()) {
        return next();
      }
    }

    return res.status(428).json({
      data: null,
      error: {
        code: 'STEP_UP_REQUIRED',
        message: 'Step-up verification is required for this action.',
      },
    });
  };
}
