import { Request } from 'express';
import { generateId, query } from '../db.js';

export interface GovernanceAuditInput {
  workspaceId: string;
  actorUserId?: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  outcome: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  notes?: string | null;
}

export function buildGovernanceAuditFromRequest(
  req: Request,
  partial: Omit<GovernanceAuditInput, 'workspaceId' | 'actorUserId' | 'actorName' | 'ipAddress' | 'userAgent'>,
): GovernanceAuditInput {
  const forwardedFor = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];

  return {
    workspaceId: req.authUser?.workspaceId || '',
    actorUserId: req.authUser?.userId || null,
    actorName: req.authUser?.email || 'System',
    ipAddress: rawIp?.trim() || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
    ...partial,
  };
}

export async function appendGovernanceAuditLog(input: GovernanceAuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO governance_audit_logs
       (id, workspace_id, actor_user_id, actor_name, action, target_type, target_id, target_name, previous_value, new_value, outcome, ip_address, user_agent, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        generateId('gaudit'),
        input.workspaceId,
        input.actorUserId || null,
        input.actorName,
        input.action,
        input.targetType,
        input.targetId || null,
        input.targetName || null,
        input.previousValue || null,
        input.newValue || null,
        input.outcome,
        input.ipAddress || null,
        input.userAgent || null,
        input.notes || null,
      ],
    );
  } catch (error) {
    console.error('Failed to append governance audit log', error);
  }
}
