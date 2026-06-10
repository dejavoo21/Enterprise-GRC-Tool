import { Request } from 'express';
import { generateId, query } from '../../db.js';
import {
  ActivityLedgerCategory,
  ActivityLedgerEntry,
  ActivityLedgerFilters,
  ActivityLedgerOutcome,
  ActivityLedgerSeverity,
  ActivityLedgerSource,
  ActivityLedgerSummary,
} from '../../types/activityLedger.js';

export interface RecordActivityInput {
  workspaceId: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
  action: string;
  category: ActivityLedgerCategory;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  outcome?: ActivityLedgerOutcome;
  severity?: ActivityLedgerSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
  correlationId?: string | null;
  source?: ActivityLedgerSource;
  timestamp?: string;
  notes?: string | null;
  frameworkCode?: string | null;
}

type LedgerRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_role: string | null;
  action: string;
  category: ActivityLedgerCategory;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  previous_value: unknown;
  new_value: unknown;
  outcome: ActivityLedgerOutcome;
  severity: ActivityLedgerSeverity;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
  location: string | null;
  correlation_id: string | null;
  source: ActivityLedgerSource;
  created_at: string;
  notes: string | null;
  framework_code: string | null;
};

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'otp', 'recovery', 'passkey', 'privatekey', 'sessionid', 'challenge'];

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive))) {
        return [key, '[REDACTED]'];
      }
      return [key, sanitizeValue(nested)];
    }),
  );
}

function mapRow(row: LedgerRow): ActivityLedgerEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    category: row.category,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    previousValue: row.previous_value,
    newValue: row.new_value,
    outcome: row.outcome,
    severity: row.severity,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    device: row.device,
    location: row.location,
    correlationId: row.correlation_id,
    source: row.source,
    timestamp: row.created_at,
    notes: row.notes,
    frameworkCode: row.framework_code,
  };
}

export function deriveDevice(userAgent?: string | null): string | null {
  if (!userAgent) return null;
  if (userAgent.includes('Windows')) return 'Windows device';
  if (userAgent.includes('Macintosh')) return 'macOS device';
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android device';
  return 'Unknown device';
}

export function buildActivityFromRequest(
  req: Request,
  partial: Omit<RecordActivityInput, 'workspaceId' | 'actorUserId' | 'actorName' | 'actorRole' | 'ipAddress' | 'userAgent' | 'device'>,
): RecordActivityInput {
  const forwardedFor = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
  const userAgent = (req.headers['user-agent'] as string | undefined) || null;

  return {
    workspaceId: req.authUser?.workspaceId || (req.headers['x-workspace-id'] as string | undefined) || 'system',
    actorUserId: req.authUser?.userId || null,
    actorName: req.authUser?.email || 'System',
    actorRole: req.authUser?.role || null,
    ipAddress: rawIp?.trim() || req.ip || null,
    userAgent,
    device: deriveDevice(userAgent),
    ...partial,
  };
}

export async function ensureActivityLedgerSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS enterprise_activity_ledger (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      actor_user_id TEXT,
      actor_name TEXT NOT NULL,
      actor_role TEXT,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      previous_value JSONB,
      new_value JSONB,
      outcome TEXT NOT NULL,
      severity TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      device TEXT,
      location TEXT,
      correlation_id TEXT,
      source TEXT NOT NULL,
      framework_code TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_workspace_created ON enterprise_activity_ledger (workspace_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_target ON enterprise_activity_ledger (workspace_id, target_type, target_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_actor ON enterprise_activity_ledger (workspace_id, actor_user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_category ON enterprise_activity_ledger (workspace_id, category, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_enterprise_activity_ledger_severity ON enterprise_activity_ledger (workspace_id, severity, created_at DESC)`);
}

export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    await query(
      `INSERT INTO enterprise_activity_ledger
       (id, workspace_id, actor_user_id, actor_name, actor_role, action, category, target_type, target_id, target_name,
        previous_value, new_value, outcome, severity, ip_address, user_agent, device, location, correlation_id, source, framework_code, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        generateId('aledger'),
        input.workspaceId,
        input.actorUserId || null,
        input.actorName,
        input.actorRole || null,
        input.action,
        input.category,
        input.targetType,
        input.targetId || null,
        input.targetName || null,
        input.previousValue !== undefined ? JSON.stringify(sanitizeValue(input.previousValue)) : null,
        input.newValue !== undefined ? JSON.stringify(sanitizeValue(input.newValue)) : null,
        input.outcome || 'success',
        input.severity || 'info',
        input.ipAddress || null,
        input.userAgent || null,
        input.device || null,
        input.location || null,
        input.correlationId || null,
        input.source || 'backend',
        input.frameworkCode || null,
        input.notes || null,
        input.timestamp || new Date().toISOString(),
      ],
    );
  } catch (error) {
    console.error('Failed to record enterprise activity', error);
  }
}

export async function listActivities(filters: ActivityLedgerFilters): Promise<ActivityLedgerEntry[]> {
  const conditions = ['workspace_id = $1'];
  const params: unknown[] = [filters.workspaceId];
  let index = 2;

  if (filters.dateFrom) {
    conditions.push(`created_at >= $${index++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`created_at <= $${index++}`);
    params.push(filters.dateTo);
  }
  if (filters.category) {
    conditions.push(`category = $${index++}`);
    params.push(filters.category);
  }
  if (filters.action) {
    conditions.push(`action ILIKE $${index++}`);
    params.push(`%${filters.action}%`);
  }
  if (filters.actor) {
    conditions.push(`actor_name ILIKE $${index++}`);
    params.push(`%${filters.actor}%`);
  }
  if (filters.targetType) {
    conditions.push(`target_type = $${index++}`);
    params.push(filters.targetType);
  }
  if (filters.severity) {
    conditions.push(`severity = $${index++}`);
    params.push(filters.severity);
  }
  if (filters.outcome) {
    conditions.push(`outcome = $${index++}`);
    params.push(filters.outcome);
  }
  if (filters.framework) {
    conditions.push(`framework_code = $${index++}`);
    params.push(filters.framework);
  }

  params.push(Math.min(filters.limit || 100, 500));

  const result = await query<LedgerRow>(
    `SELECT * FROM enterprise_activity_ledger
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${index}`,
    params,
  );

  return result.rows.map(mapRow);
}

export async function filterActivities(filters: ActivityLedgerFilters): Promise<ActivityLedgerEntry[]> {
  return listActivities(filters);
}

export async function getActivityById(workspaceId: string, id: string): Promise<ActivityLedgerEntry | null> {
  const result = await query<LedgerRow>(
    `SELECT * FROM enterprise_activity_ledger WHERE workspace_id = $1 AND id = $2 LIMIT 1`,
    [workspaceId, id],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getActivitiesForTarget(workspaceId: string, targetType: string, targetId: string): Promise<ActivityLedgerEntry[]> {
  const result = await query<LedgerRow>(
    `SELECT * FROM enterprise_activity_ledger
     WHERE workspace_id = $1 AND target_type = $2 AND target_id = $3
     ORDER BY created_at DESC
     LIMIT 250`,
    [workspaceId, targetType, targetId],
  );
  return result.rows.map(mapRow);
}

export async function getActivitiesForUser(workspaceId: string, userId: string): Promise<ActivityLedgerEntry[]> {
  const result = await query<LedgerRow>(
    `SELECT * FROM enterprise_activity_ledger
     WHERE workspace_id = $1 AND actor_user_id = $2
     ORDER BY created_at DESC
     LIMIT 250`,
    [workspaceId, userId],
  );
  return result.rows.map(mapRow);
}

export async function exportActivities(filters: ActivityLedgerFilters): Promise<{ exportedAt: string; count: number; entries: ActivityLedgerEntry[] }> {
  const entries = await listActivities({ ...filters, limit: Math.min(filters.limit || 500, 1000) });
  return {
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
}

export async function summarizeActivity(workspaceId: string): Promise<ActivityLedgerSummary> {
  const result = await query<{
    total_events: string;
    critical_events: string;
    failed_or_blocked_events: string;
    auth_security_events: string;
    changes_this_week: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_events,
       COUNT(*) FILTER (WHERE severity IN ('high', 'critical'))::text AS critical_events,
       COUNT(*) FILTER (WHERE outcome IN ('failed', 'blocked'))::text AS failed_or_blocked_events,
       COUNT(*) FILTER (WHERE category IN ('auth', 'rbac', 'user'))::text AS auth_security_events,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS changes_this_week
     FROM enterprise_activity_ledger
     WHERE workspace_id = $1`,
    [workspaceId],
  );

  const row = result.rows[0];
  return {
    totalEvents: Number(row?.total_events || 0),
    criticalEvents: Number(row?.critical_events || 0),
    failedOrBlockedEvents: Number(row?.failed_or_blocked_events || 0),
    authSecurityEvents: Number(row?.auth_security_events || 0),
    changesThisWeek: Number(row?.changes_this_week || 0),
  };
}
