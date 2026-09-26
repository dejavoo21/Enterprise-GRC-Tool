import type { AccessRequest, RbacUser } from '../types/rbac';
import type { ActivityLedgerEntry } from '../types/activityLedger';

export function filterAdminRequests(requests: AccessRequest[], filters: { search: string; status: string; role: string; workspace: string; from: string; to: string }) {
  const search = filters.search.trim().toLowerCase();
  return requests.filter(request => {
    const timestamp = Date.parse(request.requestDate);
    return (!filters.status || request.status === filters.status)
      && (!filters.role || request.requestedRoleId === filters.role)
      && (!filters.workspace || request.requestedWorkspace === filters.workspace)
      && (!filters.from || timestamp >= Date.parse(`${filters.from}T00:00:00Z`))
      && (!filters.to || timestamp <= Date.parse(`${filters.to}T23:59:59.999Z`))
      && [request.requesterName, request.requesterEmail, request.requestedRoleName, request.requestedWorkspace].join(' ').toLowerCase().includes(search);
  });
}

export function filterAdminUsers(users: RbacUser[], filters: { search: string; status: string; role: string; scope: string }) {
  const search = filters.search.trim().toLowerCase();
  return users.filter(user => (!filters.status || user.status === filters.status)
    && (!filters.role || user.assignedRoleId === filters.role)
    && (!filters.scope || user.accessScope === filters.scope)
    && [user.fullName, user.email, user.assignedRoleName, user.workspaceName, user.accessScope].join(' ').toLowerCase().includes(search));
}

export function summarizeAdminEvents(entries: ActivityLedgerEntry[], today: Date) {
  const day = today.toISOString().slice(0, 10);
  return {
    today: entries.filter(entry => entry.timestamp.slice(0, 10) === day).length,
    permissionDenials: entries.filter(entry => /permission[._ ]denied|access[._ ]denied/i.test(entry.action)).length,
    accessChanges: entries.filter(entry => ['user', 'rbac'].includes(entry.category)
      && /role[._ ]assigned|permission[._ ]changed|access[._ ](?:approved|revoked)|user[._ ](?:invited|suspended)|mfa[._ ]required/i.test(entry.action)).length,
    highPriority: entries.filter(entry => ['high', 'critical'].includes(entry.severity)).length,
  };
}
