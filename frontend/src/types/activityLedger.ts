export type ActivityLedgerCategory =
  | 'ai'
  | 'audit'
  | 'risk'
  | 'control'
  | 'evidence'
  | 'issue'
  | 'vendor'
  | 'asset'
  | 'policy'
  | 'training'
  | 'report'
  | 'resilience'
  | 'regulatory'
  | 'user'
  | 'rbac'
  | 'auth'
  | 'workspace'
  | 'framework'
  | 'system';

export type ActivityLedgerOutcome = 'success' | 'failed' | 'blocked' | 'pending';
export type ActivityLedgerSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ActivityLedgerSource = 'frontend' | 'backend' | 'system';

export interface ActivityLedgerEntry {
  id: string;
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
  outcome: ActivityLedgerOutcome;
  severity: ActivityLedgerSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  location?: string | null;
  correlationId?: string | null;
  source: ActivityLedgerSource;
  timestamp: string;
  notes?: string | null;
  frameworkCode?: string | null;
}

export interface ActivityLedgerFilters {
  dateFrom?: string;
  dateTo?: string;
  category?: ActivityLedgerCategory | '';
  action?: string;
  actor?: string;
  targetType?: string;
  severity?: ActivityLedgerSeverity | '';
  outcome?: ActivityLedgerOutcome | '';
  framework?: string;
  limit?: number;
}

export interface ActivityLedgerSummary {
  totalEvents: number;
  criticalEvents: number;
  failedOrBlockedEvents: number;
  authSecurityEvents: number;
  changesThisWeek: number;
}

export interface ActivityLedgerListResponse {
  entries: ActivityLedgerEntry[];
  summary: ActivityLedgerSummary;
}

export interface ActivityLedgerExportResponse {
  exportedAt: string;
  count: number;
  entries: ActivityLedgerEntry[];
}
