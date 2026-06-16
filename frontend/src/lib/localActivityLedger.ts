import type {
  ActivityLedgerEntry,
  ActivityLedgerExportResponse,
  ActivityLedgerFilters,
  ActivityLedgerListResponse,
  ActivityLedgerSummary,
} from '../types/activityLedger';
import { normalizeActivityLedgerEntries } from './activityLedgerUtils';

const STORAGE_KEY = 'grc.local.activity-ledger';

function readEntries(): ActivityLedgerEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeActivityLedgerEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeEntries(entries: ActivityLedgerEntry[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function asTime(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortEntries(entries: ActivityLedgerEntry[]) {
  return [...entries].sort((left, right) => asTime(right.timestamp) - asTime(left.timestamp));
}

function includeEntry(entry: ActivityLedgerEntry, filters: ActivityLedgerFilters) {
  if (filters.dateFrom && asTime(entry.timestamp) < asTime(filters.dateFrom)) return false;
  if (filters.dateTo && asTime(entry.timestamp) > asTime(filters.dateTo)) return false;
  if (filters.category && entry.category !== filters.category) return false;
  if (filters.action && !entry.action.toLowerCase().includes(filters.action.toLowerCase())) return false;
  if (filters.actor && !entry.actorName.toLowerCase().includes(filters.actor.toLowerCase())) return false;
  if (filters.targetType && entry.targetType !== filters.targetType) return false;
  if (filters.severity && entry.severity !== filters.severity) return false;
  if (filters.outcome && entry.outcome !== filters.outcome) return false;
  if (filters.framework && entry.frameworkCode !== filters.framework) return false;
  return true;
}

function summarize(entries: ActivityLedgerEntry[]): ActivityLedgerSummary {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    totalEvents: entries.length,
    criticalEvents: entries.filter((entry) => entry.severity === 'critical').length,
    failedOrBlockedEvents: entries.filter((entry) => entry.outcome === 'failed' || entry.outcome === 'blocked').length,
    authSecurityEvents: entries.filter((entry) => entry.category === 'auth' || entry.category === 'rbac').length,
    changesThisWeek: entries.filter((entry) => asTime(entry.timestamp) >= weekAgo).length,
  };
}

export function appendLocalActivity(entry: ActivityLedgerEntry) {
  const entries = readEntries();
  writeEntries(sortEntries([entry, ...entries.filter((item) => item.id !== entry.id)]));
}

export function mergeActivityEntries(...collections: ActivityLedgerEntry[][]) {
  const merged = new Map<string, ActivityLedgerEntry>();
  normalizeActivityLedgerEntries(collections.flat()).forEach((entry) => {
    merged.set(entry.id, entry);
  });
  return sortEntries(Array.from(merged.values()));
}

export function listLocalActivity(filters: ActivityLedgerFilters = {}): ActivityLedgerListResponse {
  const filtered = sortEntries(readEntries().filter((entry) => includeEntry(entry, filters)));
  const entries = typeof filters.limit === 'number' ? filtered.slice(0, filters.limit) : filtered;
  return {
    entries,
    summary: summarize(filtered),
  };
}

export function getLocalActivity(entryId: string) {
  return readEntries().find((entry) => entry.id === entryId) ?? null;
}

export function getLocalActivityForTarget(targetType: string, targetId: string) {
  return sortEntries(readEntries().filter((entry) => entry.targetType === targetType && entry.targetId === targetId));
}

export function getLocalActivityForUser(userId: string) {
  return sortEntries(readEntries().filter((entry) => entry.actorUserId === userId));
}

export function exportLocalActivity(filters: ActivityLedgerFilters = {}): ActivityLedgerExportResponse {
  const result = listLocalActivity(filters);
  return {
    exportedAt: new Date().toISOString(),
    count: result.entries.length,
    entries: result.entries,
  };
}
