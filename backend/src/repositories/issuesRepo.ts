import { getEvidence } from './evidenceRepo.js';
import { getRisks } from './risksRepo.js';
import { getReviewTasks } from './reviewTasksRepo.js';
import { getTrainingAssignments } from './trainingCoursesRepo.js';
import { isDerivedTrainingOverdue } from '../lib/trainingStatus.js';
import type { CiaImpact, DashboardIssueRecord, DashboardIssuePriority, DashboardIssueStatus } from '../types/models.js';

export function riskIssueCiaImpacts(values: unknown): CiaImpact[] {
  const allowed: CiaImpact[] = ['Confidentiality', 'Integrity', 'Availability'];
  return Array.isArray(values) ? allowed.filter(value => values.includes(value)) : [];
}

const RISK_CATEGORY_LABELS: Record<string, string> = {
  information_security: 'Information Security',
  privacy: 'Privacy',
  vendor: 'Vendor',
  operational: 'Operational',
  compliance: 'Compliance',
  strategic: 'Strategic',
};

function normalizeDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().split('T')[0];
}

function isPastDue(value?: string | null) {
  const normalized = normalizeDate(value);
  if (!normalized) return false;
  const due = new Date(`${normalized}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function severityFromScore(score: number): DashboardIssuePriority {
  if (score >= 20) return 'Critical';
  if (score >= 12) return 'High';
  if (score >= 6) return 'Medium';
  return 'Low';
}

function rankPriority(priority: DashboardIssuePriority) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority];
}

function rankStatus(status: DashboardIssueStatus) {
  return { Open: 0, 'In Progress': 1, Pending: 2, Resolved: 3 }[status];
}

function sortIssues(items: DashboardIssueRecord[]) {
  return [...items].sort((left, right) => {
    const leftOverdue = left.isOverdue ? 0 : 1;
    const rightOverdue = right.isOverdue ? 0 : 1;
    if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;

    const priorityDiff = rankPriority(left.priority) - rankPriority(right.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const statusDiff = rankStatus(left.status) - rankStatus(right.status);
    if (statusDiff !== 0) return statusDiff;

    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) return leftDue - rightDue;

    return left.title.localeCompare(right.title);
  });
}

export async function getDerivedIssues(workspaceId: string): Promise<DashboardIssueRecord[]> {
  const [risks, evidence, reviewTasks, trainingAssignments] = await Promise.all([
    getRisks(workspaceId),
    getEvidence(workspaceId),
    getReviewTasks(workspaceId),
    getTrainingAssignments(workspaceId),
  ]);

  const issues: DashboardIssueRecord[] = [];

  for (const risk of risks) {
    const residualScore = risk.residualLikelihood * risk.residualImpact;
    const dueDate = normalizeDate(risk.dueDate);
    const overdue = isPastDue(dueDate);
    if (risk.status === 'closed') {
      continue;
    }

    if (residualScore < 6 && !overdue) {
      continue;
    }

    const status: DashboardIssueStatus =
      overdue || risk.status === 'identified' || risk.status === 'assessed'
        ? 'Open'
        : risk.status === 'treated'
          ? 'In Progress'
          : 'Pending';

    issues.push({
      id: `issue-risk-${risk.id}`,
      workspaceId,
      title: risk.title,
      description: risk.description,
      owner: risk.owner,
      status,
      priority: severityFromScore(residualScore),
      dueDate,
      domain: RISK_CATEGORY_LABELS[risk.category] ?? 'Risk',
      sourceType: 'Risk',
      sourceStatus: risk.status,
      isOverdue: overdue,
      linkedRiskId: risk.id,
      linkedRiskRef: risk.riskRef,
      linkedControlIds: risk.controlIds ?? [],
      linkedEvidenceIds: [],
      linkedReviewTaskIds: [],
      linkedTrainingAssignmentIds: [],
      ciaImpacts: riskIssueCiaImpacts(risk.ciaImpacts),
    });
  }

  for (const item of evidence) {
    const reviewedAt = item.lastReviewedAt || item.collectedAt;
    const reviewedDate = reviewedAt ? new Date(reviewedAt) : null;
    const daysOld = reviewedDate ? (Date.now() - reviewedDate.getTime()) / 86400000 : Number.POSITIVE_INFINITY;

    if (daysOld <= 90) {
      continue;
    }

    const status: DashboardIssueStatus = daysOld > 120 ? 'Open' : 'Pending';
    const priority: DashboardIssuePriority = daysOld > 120 ? 'High' : 'Medium';
    const issueDueDate = reviewedDate
      ? new Date(reviewedDate.getTime() + (daysOld > 120 ? 120 : 90) * 86400000).toISOString().split('T')[0]
      : undefined;

    issues.push({
      id: `issue-evidence-${item.id}`,
      workspaceId,
      title: `${daysOld > 120 ? 'Expired evidence' : 'Evidence review due'}: ${item.name}`,
      description: item.description,
      owner: item.collectedBy,
      status,
      priority,
      dueDate: issueDueDate,
      domain: 'Evidence',
      sourceType: 'Evidence',
      sourceStatus: daysOld > 120 ? 'expired' : 'due_soon',
      isOverdue: daysOld > 120,
      linkedEvidenceIds: [item.id],
      linkedRiskId: item.riskId,
      linkedControlIds: item.controlId ? [item.controlId] : [],
      linkedReviewTaskIds: [],
      linkedTrainingAssignmentIds: [],
      ciaImpacts: [],
    });
  }

  for (const task of reviewTasks) {
    if (task.status === 'completed' || task.status === 'cancelled') {
      continue;
    }

    const overdue = task.status === 'overdue' || isPastDue(task.dueAt);
    issues.push({
      id: `issue-review-${task.id}`,
      workspaceId,
      title: task.title,
      description: task.description,
      owner: task.assignee,
      status: overdue ? 'Open' : task.status === 'in_progress' ? 'In Progress' : 'Pending',
      priority: overdue ? 'High' : 'Medium',
      dueDate: normalizeDate(task.dueAt),
      domain: 'Policy Review',
      sourceType: 'Review Task',
      sourceStatus: task.status,
      isOverdue: overdue,
      linkedReviewTaskIds: [task.id],
      linkedControlIds: [],
      linkedEvidenceIds: [],
      linkedTrainingAssignmentIds: [],
      ciaImpacts: [],
    });
  }

  const overdueAssignmentsByUser = new Map<string, { count: number; dueDate?: string; assignmentIds: string[] }>();
  for (const assignment of trainingAssignments) {
    if (!isDerivedTrainingOverdue(assignment.dueAt, assignment.status, assignment.completedAt)) {
      continue;
    }
    const current = overdueAssignmentsByUser.get(assignment.userName) ?? {
      count: 0,
      dueDate: normalizeDate(assignment.dueAt),
      assignmentIds: [],
    };
    current.count += 1;
    current.assignmentIds.push(assignment.id);
    if (!current.dueDate || (assignment.dueAt && new Date(assignment.dueAt).getTime() < new Date(current.dueDate).getTime())) {
      current.dueDate = normalizeDate(assignment.dueAt);
    }
    overdueAssignmentsByUser.set(assignment.userName, current);
  }

  for (const [userName, summary] of overdueAssignmentsByUser.entries()) {
    issues.push({
      id: `issue-training-${userName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      workspaceId,
      title: summary.count === 1 ? 'Overdue training assignment' : `${summary.count} overdue training assignments`,
      description: `Training completion follow-up is required for ${userName}.`,
      owner: userName,
      status: 'Open',
      priority: summary.count >= 3 ? 'High' : 'Medium',
      dueDate: summary.dueDate,
      domain: 'Training',
      sourceType: 'Training',
      sourceStatus: 'overdue',
      isOverdue: true,
      linkedTrainingAssignmentIds: summary.assignmentIds,
      linkedControlIds: [],
      linkedEvidenceIds: [],
      linkedReviewTaskIds: [],
      ciaImpacts: [],
    });
  }

  return sortIssues(issues);
}

export async function getDerivedIssueById(workspaceId: string, issueId: string): Promise<DashboardIssueRecord | null> {
  const issues = await getDerivedIssues(workspaceId);
  return issues.find((issue) => issue.id === issueId) ?? null;
}
