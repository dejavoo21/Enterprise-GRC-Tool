import type {
  ActivityLedgerCategory,
  ActivityLedgerEntry,
  ActivityLedgerOutcome,
  ActivityLedgerSeverity,
  ActivityLedgerSource,
  ActivityLedgerSummary,
} from '../types/activityLedger';

const CATEGORY_VALUES: ActivityLedgerCategory[] = [
  'ai',
  'audit',
  'risk',
  'control',
  'evidence',
  'issue',
  'vendor',
  'asset',
  'policy',
  'training',
  'report',
  'resilience',
  'regulatory',
  'user',
  'rbac',
  'auth',
  'workspace',
  'framework',
  'system',
];

const OUTCOME_VALUES: ActivityLedgerOutcome[] = ['success', 'failed', 'blocked', 'pending'];
const SEVERITY_VALUES: ActivityLedgerSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];
const SOURCE_VALUES: ActivityLedgerSource[] = ['frontend', 'backend', 'system'];

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function toOptionalString(value: unknown): string | null {
  const normalized = toStringValue(value, '');
  return normalized || null;
}

function toEnumValue<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const normalized = toStringValue(value, '').toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function toTimestamp(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  const stringValue = toStringValue(value, '');
  if (!stringValue) return new Date(0).toISOString();

  const parsed = new Date(stringValue).getTime();
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

export function normalizeActivityLedgerEntry(value: unknown, index = 0): ActivityLedgerEntry | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const id = toStringValue(record.id, `activity-${index}-${Date.now()}`);

  return {
    id,
    workspaceId: toStringValue(record.workspaceId, 'unknown-workspace'),
    actorUserId: toOptionalString(record.actorUserId),
    actorName: toStringValue(record.actorName, 'System'),
    actorRole: toOptionalString(record.actorRole),
    action: toStringValue(record.action, 'unknown_action'),
    category: toEnumValue(record.category, CATEGORY_VALUES, 'system'),
    targetType: toStringValue(record.targetType, 'record'),
    targetId: toOptionalString(record.targetId),
    targetName: toOptionalString(record.targetName),
    previousValue: record.previousValue,
    newValue: record.newValue,
    outcome: toEnumValue(record.outcome, OUTCOME_VALUES, 'success'),
    severity: toEnumValue(record.severity, SEVERITY_VALUES, 'info'),
    ipAddress: toOptionalString(record.ipAddress),
    userAgent: toOptionalString(record.userAgent),
    device: toOptionalString(record.device),
    location: toOptionalString(record.location),
    correlationId: toOptionalString(record.correlationId),
    source: toEnumValue(record.source, SOURCE_VALUES, 'system'),
    timestamp: toTimestamp(record.timestamp),
    notes: toOptionalString(record.notes),
    frameworkCode: toOptionalString(record.frameworkCode),
  };
}

export function normalizeActivityLedgerEntries(values: unknown): ActivityLedgerEntry[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value, index) => normalizeActivityLedgerEntry(value, index))
    .filter((entry): entry is ActivityLedgerEntry => entry !== null);
}

export function normalizeActivityLedgerSummary(value: unknown): ActivityLedgerSummary {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const toCount = (input: unknown) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  return {
    totalEvents: toCount(record.totalEvents),
    criticalEvents: toCount(record.criticalEvents),
    failedOrBlockedEvents: toCount(record.failedOrBlockedEvents),
    authSecurityEvents: toCount(record.authSecurityEvents),
    changesThisWeek: toCount(record.changesThisWeek),
  };
}

export function formatActivityAction(action: unknown): string {
  return toStringValue(action, 'Unknown action')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatActivityTimestamp(value: unknown, fallback = 'Not recorded'): string {
  const timestamp = toTimestamp(value);
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed) || parsed === 0) return fallback;

  return new Date(parsed).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatRelativeActivityTimestamp(value: unknown): string {
  const timestamp = toTimestamp(value);
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed) || parsed === 0) return 'Unknown time';

  const diffMinutes = Math.round((Date.now() - parsed) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
