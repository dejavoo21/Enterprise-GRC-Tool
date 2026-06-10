import {
  exportActivityLedger,
  fetchActivityLedger,
  fetchActivityLedgerEntry,
  fetchActivityLedgerForTarget,
  fetchActivityLedgerForUser,
} from '../../lib/api';
import type {
  ActivityLedgerEntry,
  ActivityLedgerExportResponse,
  ActivityLedgerFilters,
  ActivityLedgerListResponse,
} from '../../types/activityLedger';

export async function recordActivity(): Promise<void> {
  return Promise.resolve();
}

export async function listActivities(filters: ActivityLedgerFilters = {}): Promise<ActivityLedgerListResponse> {
  return fetchActivityLedger(filters);
}

export async function filterActivities(filters: ActivityLedgerFilters = {}): Promise<ActivityLedgerEntry[]> {
  const result = await fetchActivityLedger(filters);
  return result.entries;
}

export async function getActivitiesForTarget(targetType: string, targetId: string): Promise<ActivityLedgerEntry[]> {
  return fetchActivityLedgerForTarget(targetType, targetId);
}

export async function getActivitiesForUser(userId: string): Promise<ActivityLedgerEntry[]> {
  return fetchActivityLedgerForUser(userId);
}

export async function exportActivities(filters: ActivityLedgerFilters = {}): Promise<ActivityLedgerExportResponse> {
  return exportActivityLedger(filters);
}

export async function summarizeActivity(filters: ActivityLedgerFilters = {}) {
  const result = await fetchActivityLedger(filters);
  return result.summary;
}

export async function getActivityById(entryId: string): Promise<ActivityLedgerEntry | null> {
  return fetchActivityLedgerEntry(entryId);
}
