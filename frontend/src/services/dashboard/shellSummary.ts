import { apiCall } from '@/lib/api';
import type { EvidenceItem } from '@/types/evidence';
import type { Risk as AppRisk } from '@/types/risk';
import type { VendorRiskAssessment } from '@/types/tprm';

export type ShellTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export type DashboardShellItem = {
  id: string;
  label: string;
  count: number;
  routeKey: string;
  tone: ShellTone;
  detail?: string;
};

export type DashboardShellReviewSignal = {
  id: string;
  label: string;
  count: number;
  detail: string;
  routeKey: string;
  tone: ShellTone;
  dueDate: string;
};

export type DashboardShellCounts = {
  openWorkflowActions: number;
  overdueActions: number;
  pendingApprovals: number;
  activeReviews: number;
  auditBlockers: number;
  openRisks: number;
  risksOutsideAppetite: number;
  openIssues: number;
  overdueTraining: number;
  highRiskVendors: number;
  expiredEvidence: number | null;
};

export type DashboardShellSummary = {
  counts: DashboardShellCounts;
  shortcutCounts: {
    myTasks: number;
    myApprovals: number;
    myReviews: number;
    myAudits: number;
  };
  workspaceHealth: DashboardShellItem[];
  attentionItems: DashboardShellItem[];
  decisionQueue: DashboardShellItem[];
  upcomingReviews: DashboardShellReviewSignal[];
  evidenceHealthAvailable: boolean;
  approvalsDataAvailable: boolean;
};

export const DASHBOARD_UPCOMING_REVIEWS_EMPTY_STATE =
  'Review signals will appear here when evidence, risk, policy, vendor, and audit review dates are available.';

type ReviewTaskRow = { id: string; status?: string | null };
type AccessRequestRow = { id: string; status?: string | null };
type AccessReviewRow = { id: string; status?: string | null };
type AuditSummaryRow = { framework: string; readinessPercent: number; openItems: number };
type IssueRow = { id: string; status?: string | null };
type TrainingSummary = { overdueAssignments?: number };
type RiskLike = { status?: string | null; severity?: string | null; residualRiskScore?: number | null; residualScore?: number | null; dueDate?: string | null };
type VendorLike = { riskTier?: string | null; status?: string | null; nextReviewDate?: string | null; dueDate?: string | null; vendorName?: string | null };

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countOpenWorkflowActions(rows: ReviewTaskRow[]) {
  return rows.filter((item) => (item.status || '').toLowerCase() !== 'completed').length;
}

function countOverdueActions(rows: ReviewTaskRow[]) {
  return rows.filter((item) => (item.status || '').toLowerCase() === 'overdue').length;
}

function countOpenRisks(rows: RiskLike[]) {
  return rows.filter((item) => (item.status || '').toLowerCase() !== 'closed').length;
}

function countRisksOutsideAppetite(rows: RiskLike[]) {
  return rows.filter((item) => {
    const severity = (item.severity || '').toLowerCase();
    if (severity === 'critical' || severity === 'high') return true;
    const residual = Number(item.residualRiskScore ?? item.residualScore ?? 0);
    return residual >= 12;
  }).length;
}

function countOpenIssues(rows: IssueRow[]) {
  return rows.filter((item) => !['resolved', 'closed'].includes((item.status || '').toLowerCase())).length;
}

function countHighRiskVendors(rows: VendorLike[]) {
  return rows.filter((item) => {
    const tier = (item.riskTier || '').toLowerCase();
    const status = (item.status || '').toLowerCase();
    return (tier === 'high' || tier === 'critical') && status !== 'expired';
  }).length;
}

export function calculateEvidenceHealth(evidence: EvidenceItem[], controlCount = 0) {
  const now = Date.now();
  const valid = evidence.filter((item) => {
    const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
    if (!reviewed) return false;
    return (now - reviewed.getTime()) / 86400000 <= 90;
  }).length;
  const dueForReview = evidence.filter((item) => {
    const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
    if (!reviewed) return false;
    const age = (now - reviewed.getTime()) / 86400000;
    return age > 90 && age <= 120;
  }).length;
  const expired = evidence.filter((item) => {
    const reviewed = parseDate(item.lastReviewedAt || item.collectedAt);
    if (!reviewed) return true;
    return (now - reviewed.getTime()) / 86400000 > 120;
  }).length;

  return {
    valid,
    dueForReview,
    expired,
    missing: Math.max(0, controlCount - evidence.length),
  };
}

export function buildUpcomingReviews(risks: RiskLike[], vendorAssessments: VendorLike[]): DashboardShellReviewSignal[] {
  const now = Date.now();
  const horizon = now + 30 * 86400000;

  const riskDueDates = risks
    .filter((item) => (item.status || '').toLowerCase() !== 'closed')
    .map((item) => parseDate(item.dueDate || undefined))
    .filter((item): item is Date => Boolean(item))
    .filter((item) => item.getTime() >= now && item.getTime() <= horizon)
    .sort((left, right) => left.getTime() - right.getTime());

  const vendorReviewDates = vendorAssessments
    .map((item) => parseDate(item.nextReviewDate || item.dueDate || undefined))
    .filter((item): item is Date => Boolean(item))
    .filter((item) => item.getTime() >= now && item.getTime() <= horizon)
    .sort((left, right) => left.getTime() - right.getTime());

  const items: DashboardShellReviewSignal[] = [];

  if (riskDueDates.length > 0) {
    const nextDate = riskDueDates[0];
    items.push({
      id: 'upcoming-risk-reviews',
      label: 'Risk reviews due',
      count: riskDueDates.length,
      detail: `${riskDueDates.length} risk review${riskDueDates.length === 1 ? '' : 's'} due by ${nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}.`,
      routeKey: 'risks',
      tone: riskDueDates.length > 3 ? 'warning' : 'primary',
      dueDate: nextDate.toISOString(),
    });
  }

  if (vendorReviewDates.length > 0) {
    const nextDate = vendorReviewDates[0];
    items.push({
      id: 'upcoming-vendor-reviews',
      label: 'Vendor reassessments due',
      count: vendorReviewDates.length,
      detail: `${vendorReviewDates.length} vendor reassessment${vendorReviewDates.length === 1 ? '' : 's'} due by ${nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}.`,
      routeKey: 'tprm-dashboard',
      tone: vendorReviewDates.length > 2 ? 'warning' : 'primary',
      dueDate: nextDate.toISOString(),
    });
  }

  return items.sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());
}

export async function fetchDashboardShellSummary(): Promise<DashboardShellSummary> {
  const results = await Promise.allSettled([
    apiCall<{ data: ReviewTaskRow[] }>('/api/v1/review-tasks'),
    apiCall<{ data: AccessRequestRow[] }>('/api/v1/admin/access-requests'),
    apiCall<{ data: AccessReviewRow[] }>('/api/v1/admin/access-reviews'),
    apiCall<{ data: AuditSummaryRow[] }>('/api/v1/audit-readiness/summary'),
    apiCall<{ data: AppRisk[] }>('/api/v1/risks'),
    apiCall<{ data: IssueRow[] }>('/api/v1/issues'),
    apiCall<{ data: TrainingSummary }>('/api/v1/training/dashboard'),
    apiCall<{ data: VendorRiskAssessment[] }>('/api/v1/tprm/assessments'),
    apiCall<{ data: EvidenceItem[] }>('/api/v1/evidence'),
  ]);

  const reviewTasks = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
  const accessRequests = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];
  const accessReviews = results[2].status === 'fulfilled' ? results[2].value.data || [] : [];
  const auditSummary = results[3].status === 'fulfilled' ? results[3].value.data || [] : [];
  const risks = results[4].status === 'fulfilled' ? results[4].value.data || [] : [];
  const issues = results[5].status === 'fulfilled' ? results[5].value.data || [] : [];
  const trainingSummary = results[6].status === 'fulfilled' ? results[6].value.data || {} : {};
  const vendorAssessments = results[7].status === 'fulfilled' ? results[7].value.data || [] : [];
  const evidence = results[8].status === 'fulfilled' ? results[8].value.data || [] : [];

  const evidenceHealthAvailable = results[8].status === 'fulfilled';
  const approvalsDataAvailable = results[1].status === 'fulfilled';
  const evidenceHealth = evidenceHealthAvailable ? calculateEvidenceHealth(evidence) : null;

  const counts: DashboardShellCounts = {
    openWorkflowActions: countOpenWorkflowActions(reviewTasks),
    overdueActions: countOverdueActions(reviewTasks),
    pendingApprovals: accessRequests.filter((item) => ['pending', 'request_info'].includes((item.status || '').toLowerCase())).length,
    activeReviews: accessReviews.filter((item) => !['completed', 'closed'].includes((item.status || '').toLowerCase())).length,
    auditBlockers: auditSummary.reduce((total, item) => total + Number(item.openItems || 0), 0),
    openRisks: countOpenRisks(risks),
    risksOutsideAppetite: countRisksOutsideAppetite(risks),
    openIssues: countOpenIssues(issues),
    overdueTraining: Number(trainingSummary.overdueAssignments || 0),
    highRiskVendors: countHighRiskVendors(vendorAssessments),
    expiredEvidence: evidenceHealth ? evidenceHealth.expired : null,
  };

  const workspaceHealth: DashboardShellItem[] = [
    { id: 'health-open-risks', label: 'Open risks', count: counts.openRisks, routeKey: 'risks', tone: counts.openRisks > 0 ? 'primary' : 'success' },
    { id: 'health-appetite', label: 'High residual exposure', count: counts.risksOutsideAppetite, routeKey: 'risks', tone: counts.risksOutsideAppetite > 0 ? 'danger' : 'success' },
    ...(evidenceHealth ? [{ id: 'health-evidence', label: 'Expired evidence', count: evidenceHealth.expired, routeKey: 'evidence', tone: evidenceHealth.expired > 0 ? 'warning' as ShellTone : 'success' as ShellTone }] : []),
    { id: 'health-audits', label: 'Audit blockers', count: counts.auditBlockers, routeKey: 'audit-readiness', tone: counts.auditBlockers > 0 ? 'warning' : 'success' },
    { id: 'health-training', label: 'Overdue training', count: counts.overdueTraining, routeKey: 'training', tone: counts.overdueTraining > 0 ? 'warning' : 'success' },
    { id: 'health-issues', label: 'Open issues', count: counts.openIssues, routeKey: 'issues', tone: counts.openIssues > 0 ? 'warning' : 'success' },
    { id: 'health-vendors', label: 'High-risk vendors', count: counts.highRiskVendors, routeKey: 'tprm-dashboard', tone: counts.highRiskVendors > 0 ? 'danger' : 'success' },
    { id: 'health-actions', label: 'Overdue actions', count: counts.overdueActions, routeKey: 'review-tasks', tone: counts.overdueActions > 0 ? 'warning' : 'success' },
  ];

  const decisionQueueCandidates: DashboardShellItem[] = [
    { id: 'decision-appetite', label: 'Risk exposure review', count: counts.risksOutsideAppetite, routeKey: 'risks', tone: counts.risksOutsideAppetite > 0 ? 'danger' : 'success', detail: 'High/critical severity or residual score of at least 12; review appetite in the Risk Register.' },
    ...(evidenceHealth ? [{ id: 'decision-evidence', label: 'Evidence exception review', count: evidenceHealth.expired, routeKey: 'evidence', tone: evidenceHealth.expired > 0 ? 'warning' as ShellTone : 'success' as ShellTone, detail: 'Expired evidence requiring review, replacement, or an approved exception.' }] : []),
    { id: 'decision-training', label: 'Training escalation', count: counts.overdueTraining, routeKey: 'training', tone: counts.overdueTraining > 0 ? 'warning' : 'success', detail: 'Overdue assignments that may require management escalation.' },
    { id: 'decision-audit', label: 'Audit readiness review', count: counts.auditBlockers, routeKey: 'audit-readiness', tone: counts.auditBlockers > 0 ? 'warning' : 'success', detail: 'Open audit blockers requiring prioritisation or ownership decisions.' },
    { id: 'decision-issues', label: 'Open issue review', count: counts.openIssues, routeKey: 'issues', tone: counts.openIssues > 0 ? 'warning' : 'success', detail: 'Open issues requiring closure, remediation, or risk acceptance.' },
  ];
  const decisionQueue = decisionQueueCandidates.filter((item) => item.count > 0).slice(0, 4);

  const attentionItems: DashboardShellItem[] = [
    {
      id: 'attention-risks',
      label: 'High residual exposure',
      detail: counts.risksOutsideAppetite > 0 ? `${counts.risksOutsideAppetite} priority risk${counts.risksOutsideAppetite === 1 ? '' : 's'} has high/critical severity or residual score of at least 12.` : 'No risks meet the high-exposure threshold.',
      count: counts.risksOutsideAppetite,
      routeKey: 'risks',
      tone: counts.risksOutsideAppetite > 0 ? 'danger' : 'success',
    },
    {
      id: 'attention-audits',
      label: 'Audit blockers',
      detail: counts.auditBlockers > 0 ? `${counts.auditBlockers} blocker item${counts.auditBlockers === 1 ? '' : 's'} is slowing readiness progress.` : 'No audit blockers are currently open.',
      count: counts.auditBlockers,
      routeKey: 'audit-readiness',
      tone: counts.auditBlockers > 0 ? 'warning' : 'success',
    },
    ...(evidenceHealth ? [{
      id: 'attention-evidence',
      label: 'Expired evidence',
      detail: evidenceHealth.expired > 0 ? `${evidenceHealth.expired} evidence artifact${evidenceHealth.expired === 1 ? '' : 's'} is outside review tolerance.` : 'No evidence artifacts are currently expired.',
      count: evidenceHealth.expired,
      routeKey: 'evidence',
      tone: evidenceHealth.expired > 0 ? 'warning' as ShellTone : 'success' as ShellTone,
    }] : []),
    {
      id: 'attention-issues',
      label: 'Open issues',
      detail: counts.openIssues > 0 ? `${counts.openIssues} open issue${counts.openIssues === 1 ? '' : 's'} needs closure or reassessment.` : 'No open issues currently require executive attention.',
      count: counts.openIssues,
      routeKey: 'issues',
      tone: counts.openIssues > 0 ? 'warning' : 'success',
    },
    {
      id: 'attention-training',
      label: 'Overdue training',
      detail: counts.overdueTraining > 0 ? `${counts.overdueTraining} overdue assignment${counts.overdueTraining === 1 ? '' : 's'} is affecting workforce readiness.` : 'No overdue training assignments currently affect readiness.',
      count: counts.overdueTraining,
      routeKey: 'training',
      tone: counts.overdueTraining > 0 ? 'warning' : 'success',
    },
    {
      id: 'attention-vendors',
      label: 'High-risk vendors',
      detail: counts.highRiskVendors > 0 ? `${counts.highRiskVendors} high-risk vendor${counts.highRiskVendors === 1 ? '' : 's'} requires monitoring or reassessment.` : 'No high-risk vendors are currently elevated.',
      count: counts.highRiskVendors,
      routeKey: 'tprm-dashboard',
      tone: counts.highRiskVendors > 0 ? 'danger' : 'success',
    },
    {
      id: 'attention-actions',
      label: 'Open workflow actions',
      detail: counts.openWorkflowActions > 0 ? `${counts.openWorkflowActions} open task${counts.openWorkflowActions === 1 ? '' : 's'} remains in progress across workflow lanes.` : 'No open workflow tasks currently require attention.',
      count: counts.openWorkflowActions,
      routeKey: 'review-tasks',
      tone: counts.overdueActions > 0 ? 'warning' : counts.openWorkflowActions > 0 ? 'primary' : 'success',
    },
    ...(approvalsDataAvailable ? [{
      id: 'attention-approvals',
      label: 'Pending approvals',
      detail: counts.pendingApprovals > 0 ? `${counts.pendingApprovals} approval${counts.pendingApprovals === 1 ? '' : 's'} is waiting for review.` : 'No pending approvals currently require escalation.',
      count: counts.pendingApprovals,
      routeKey: 'workspace-members',
      tone: counts.pendingApprovals > 0 ? 'danger' as ShellTone : 'success' as ShellTone,
    }] : []),
  ];

  return {
    counts,
    shortcutCounts: {
      myTasks: counts.openWorkflowActions,
      myApprovals: counts.pendingApprovals,
      myReviews: counts.activeReviews,
      myAudits: counts.auditBlockers,
    },
    workspaceHealth,
    attentionItems,
    decisionQueue,
    upcomingReviews: buildUpcomingReviews(risks, vendorAssessments),
    evidenceHealthAvailable,
    approvalsDataAvailable,
  };
}
