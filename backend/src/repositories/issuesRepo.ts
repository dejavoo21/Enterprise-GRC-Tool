import { getEvidence } from './evidenceRepo.js';
import { getRisks } from './risksRepo.js';
import { getReviewTasks } from './reviewTasksRepo.js';
import { getTrainingAssignments } from './trainingCoursesRepo.js';
import { list as getTreatmentPlans } from './riskTreatmentRepo.js';
import { listActions as getAuditActions, listEvidenceRequests as getAuditEvidenceRequests } from './auditManagementRepo.js';
import { listTasks as getRegulatoryTasks } from './regulatoryRepo.js';
import { listAssignments as getWorkflowAssignments, listWorkflows } from './enterpriseWorkflowRepo.js';
import { isDerivedTrainingOverdue } from '../lib/trainingStatus.js';
import { listIncidents, listVulnerabilities } from './incidentManagementRepo.js';
import { listExceptions as getAssuranceExceptions, listMonitors as getAssuranceMonitors, listTasks as getAssuranceTasks, listTests as getAssuranceTests } from './continuousAssuranceRepo.js';
import type { CiaImpact, DashboardIssueRecord, DashboardIssuePriority, DashboardIssueStatus } from '../types/models.js';
import type { CaseSeverity, IncidentStatus, VulnerabilityStatus } from '../types/incidentManagement.js';
import type { RemediationTask, Severity } from '../types/continuousAssurance.js';

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

export function securityCasePriority(severity: CaseSeverity): DashboardIssuePriority {
  return ({ low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' } as const)[severity];
}

export function incidentActionStatus(status: IncidentStatus): DashboardIssueStatus | null {
  if (['resolved', 'closed', 'cancelled'].includes(status)) return null;
  return ['investigating', 'contained', 'remediating'].includes(status) ? 'In Progress' : 'Open';
}

export function vulnerabilityActionStatus(status: VulnerabilityStatus): DashboardIssueStatus | null {
  if (['mitigated', 'accepted', 'closed', 'false_positive'].includes(status)) return null;
  return status === 'in_progress' ? 'In Progress' : 'Open';
}

export function assuranceTaskStatus(status: RemediationTask['status']): DashboardIssueStatus | null {
  if (status === 'resolved' || status === 'closed') return null;
  if (status === 'blocked') return 'Blocked';
  return status === 'in_progress' ? 'In Progress' : 'Open';
}

export function assuranceTaskPriority(priority: Severity): DashboardIssuePriority {
  return ({ low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' } as const)[priority];
}

function rankPriority(priority: DashboardIssuePriority) {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[priority];
}

function rankStatus(status: DashboardIssueStatus) {
  return { Open:0,Blocked:1,'Awaiting Evidence':2,'Awaiting Review':3,'In Progress':4,Pending:5,Deferred:6,Completed:7,Resolved:7,Cancelled:8 }[status];
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
  const [risks, evidence, reviewTasks, trainingAssignments, treatmentPlans, auditActions, auditEvidenceRequests, regulatoryTasks, workflowAssignments, workflows, incidents, vulnerabilities, assuranceTasks, assuranceExceptions, assuranceTests, assuranceMonitors] = await Promise.all([
    getRisks(workspaceId),
    getEvidence(workspaceId),
    getReviewTasks(workspaceId),
    getTrainingAssignments(workspaceId),
    getTreatmentPlans(workspaceId),
    getAuditActions(workspaceId),
    getAuditEvidenceRequests(workspaceId),
    getRegulatoryTasks(workspaceId),
    getWorkflowAssignments(workspaceId),
    listWorkflows(workspaceId),
    listIncidents(workspaceId),
    listVulnerabilities(workspaceId),
    getAssuranceTasks(workspaceId),
    getAssuranceExceptions(workspaceId),
    getAssuranceTests(workspaceId),
    getAssuranceMonitors(workspaceId),
  ]);

  const issues: DashboardIssueRecord[] = [];
  const riskById = new Map(risks.map(risk => [risk.id, risk]));
  const assuranceExceptionById = new Map(assuranceExceptions.map(item => [item.id, item]));
  const assuranceTestById = new Map(assuranceTests.map(item => [item.id, item]));
  const assuranceMonitorById = new Map(assuranceMonitors.map(item => [item.id, item]));

  for (const task of assuranceTasks) {
    const status = assuranceTaskStatus(task.status);
    if (!status) continue;
    const linkedException = task.linkedObjectType === 'exception' ? assuranceExceptionById.get(task.linkedObjectId) : undefined;
    const linkedTest = task.linkedObjectType === 'test' ? assuranceTestById.get(task.linkedObjectId) : undefined;
    const linkedMonitor = linkedTest ? assuranceMonitorById.get(linkedTest.monitorId) : undefined;
    const dueDate = normalizeDate(task.dueDate);
    const overdue = isPastDue(dueDate);
    const linkedRisk = linkedException?.linkedRiskId ? riskById.get(linkedException.linkedRiskId) : undefined;
    const linkedControlId = linkedException?.linkedControlId || linkedMonitor?.controlId;
    issues.push({
      id: `action-assurance-${task.id}`, workspaceId, title: task.title, description: task.description,
      owner: task.owner, status, priority: assuranceTaskPriority(task.priority), dueDate,
      domain: 'Continuous Control Assurance', sourceType: 'Control', sourceReference: task.id,
      sourceStatus: task.status, isOverdue: overdue, linkedRiskId: linkedRisk?.id,
      linkedRiskRef: linkedRisk?.riskRef, linkedControlIds: linkedControlId ? [linkedControlId] : [],
      linkedEvidenceIds: linkedException?.evidenceIds || [], linkedReviewTaskIds: [],
      linkedTrainingAssignmentIds: [], ciaImpacts: [], updatedAt: task.createdAt,
      evidenceRequired: task.sourceType === 'missing_evidence' ? task.description : undefined,
      sourceManaged: true,
    });
  }

  for (const plan of treatmentPlans) {
    const overdue = plan.status === 'overdue' || isPastDue(plan.dueDate);
    const status: DashboardIssueStatus = plan.status === 'cancelled' ? 'Cancelled' : plan.status === 'completed' || plan.status === 'accepted' ? 'Completed' : overdue ? 'Open' : plan.status === 'in_progress' ? 'In Progress' : plan.status === 'awaiting_evidence' ? 'Awaiting Evidence' : plan.status === 'under_review' ? 'Awaiting Review' : plan.status === 'deferred' ? 'Deferred' : 'Open';
    issues.push({ id:`action-treatment-${plan.id}`,workspaceId,title:plan.title,description:plan.description,owner:plan.owner,status,priority:(plan.priority[0].toUpperCase()+plan.priority.slice(1)) as DashboardIssuePriority,dueDate:normalizeDate(plan.dueDate),domain:'Risk Treatment',sourceType:'Treatment',sourceStatus:plan.status,isOverdue:overdue&&!['Completed','Cancelled'].includes(status),linkedRiskId:plan.riskId,linkedRiskRef:plan.riskRef,linkedLibraryRiskId:plan.libraryRiskId,linkedTreatmentPlanId:plan.id,linkedControlIds:(plan.linkedControls||[]).map(control=>control.controlId),linkedEvidenceIds:[],linkedReviewTaskIds:[],linkedTrainingAssignmentIds:[],ciaImpacts:[],updatedAt:plan.updatedAt,completedAt:plan.completedAt,notes:plan.notes,outsideAppetite:plan.riskOutsideAppetite,treatmentProgress:plan.progressPercent,targetRiskScore:plan.riskTargetScore,targetRiskRating:plan.riskTargetRating,expectedResidualScore:plan.expectedResidualScore,expectedResidualRating:plan.expectedResidualRating });
  }

  for (const risk of risks) {
    // Consume the persisted score from the risk's pinned methodology. Risk
    // Operations must not reinterpret matrix and weighted inputs itself.
    const residualScore = risk.residualScore ?? (risk.residualLikelihood != null && risk.residualImpact != null ? risk.residualLikelihood * risk.residualImpact : 0);
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
      linkedLibraryRiskId: risk.libraryRiskId,
      outsideAppetite: risk.methodologyOutsideAppetite ?? undefined,
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

  for (const action of auditActions) {
    if (action.closureStatus.toLowerCase() === 'closed') continue;
    const overdue = isPastDue(action.deadline);
    const awaitingReview = action.progressPercent >= 100 || /verification|review/i.test(action.closureStatus);
    issues.push({
      id: `action-audit-${action.id}`, workspaceId, title: action.actionTitle,
      description: action.dependencies.length ? `Dependencies: ${action.dependencies.join(', ')}` : undefined,
      owner: action.owner, status: awaitingReview ? 'Awaiting Review' : action.progressPercent > 0 ? 'In Progress' : 'Open',
      priority: overdue ? 'High' : 'Medium', dueDate: normalizeDate(action.deadline), domain: 'Audit Corrective Action',
      sourceType: 'Audit Readiness', sourceReference: action.id, sourceStatus: action.closureStatus,
      isOverdue: overdue, linkedControlIds: [], linkedEvidenceIds: action.evidenceIds,
      linkedReviewTaskIds: [], linkedTrainingAssignmentIds: [], ciaImpacts: [], updatedAt: action.updatedAt,
      notes: action.verification || undefined, sourceManaged: true,
    });
  }

  for (const request of auditEvidenceRequests) {
    if (request.status === 'approved') continue;
    const dueDate = normalizeDate(request.dueDate);
    const overdue = request.status === 'expired' || isPastDue(dueDate);
    issues.push({
      id: `action-audit-evidence-${request.id}`, workspaceId, title: request.requestTitle,
      description: `Evidence requested for audit engagement ${request.engagementId}.`, owner: request.owner,
      status: request.status === 'submitted' ? 'Awaiting Review' : request.status === 'requested' ? 'Awaiting Evidence' : 'Open',
      priority: overdue ? 'High' : 'Medium', dueDate, domain: 'Audit Evidence Request', sourceType: 'Evidence',
      sourceReference: request.id, sourceStatus: request.status, isOverdue: overdue,
      linkedControlIds: [], linkedEvidenceIds: request.linkedEvidence, linkedReviewTaskIds: [],
      linkedTrainingAssignmentIds: [], ciaImpacts: [], updatedAt: request.updatedAt,
      evidenceRequired: request.requestTitle, sourceManaged: true,
    });
  }

  for (const task of regulatoryTasks) {
    if (task.status === 'completed') continue;
    const overdue = task.status === 'overdue' || isPastDue(task.dueDate);
    issues.push({
      id: `action-regulatory-${task.id}`, workspaceId, title: task.title,
      description: task.escalation || undefined, owner: task.owner,
      status: task.status === 'blocked' ? 'Blocked' : task.status === 'in_progress' ? 'In Progress' : 'Open',
      priority: overdue ? 'High' : task.status === 'blocked' ? 'High' : 'Medium', dueDate: normalizeDate(task.dueDate),
      domain: 'Regulatory Compliance', sourceType: 'Regulatory', sourceReference: task.id, sourceStatus: task.status,
      isOverdue: overdue, linkedControlIds: [], linkedEvidenceIds: [], linkedReviewTaskIds: [],
      linkedTrainingAssignmentIds: [], ciaImpacts: [], updatedAt: task.updatedAt, notes: task.workflowStage,
      sourceManaged: true,
    });
  }

  const workflowById = new Map(workflows.map(item => [item.id, item]));
  for (const assignment of workflowAssignments) {
    if (['approved', 'rejected', 'cancelled', 'delegated'].includes(assignment.status)) continue;
    const workflow = workflowById.get(assignment.workflowId);
    if (!workflow) continue;
    const overdue = isPastDue(assignment.dueDate);
    issues.push({
      id: `action-workflow-${assignment.id}`, workspaceId,
      title: `${workflow.name}: ${assignment.stageId}`,
      description: `Review assignment for ${workflow.sourceRecordType} ${workflow.sourceRecordReference || workflow.sourceRecordId}.`,
      owner: assignment.assignedUserId || assignment.assignedRole || 'Unassigned',
      status: assignment.status === 'acknowledged' ? 'In Progress' : 'Awaiting Review',
      priority: overdue ? 'High' : 'Medium', dueDate: normalizeDate(assignment.dueDate), domain: workflow.sourceModule,
      sourceType: 'Workflow', sourceReference: assignment.id, sourceStatus: assignment.status, isOverdue: overdue,
      linkedControlIds: [], linkedEvidenceIds: assignment.supportingEvidenceIds, linkedReviewTaskIds: [],
      linkedTrainingAssignmentIds: [], ciaImpacts: [], updatedAt: assignment.decisionAt || assignment.acknowledgedAt || assignment.assignedAt,
      sourceManaged: true,
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

  for (const incident of incidents) {
    const status = incidentActionStatus(incident.status);
    if (!status) continue;
    const dueDate = normalizeDate(incident.targetResolutionAt);
    const linkedRisk = incident.linkedRiskIds[0] ? riskById.get(incident.linkedRiskIds[0]) : undefined;
    issues.push({
      id: `action-incident-${incident.id}`, workspaceId, title: incident.title, description: incident.description,
      owner: incident.owner, status, priority: securityCasePriority(incident.severity), dueDate,
      domain: 'Security Incident', sourceType: 'Incident', sourceReference: incident.incidentRef,
      sourceStatus: incident.status, isOverdue: isPastDue(dueDate), linkedRiskId: linkedRisk?.id,
      linkedRiskRef: linkedRisk?.riskRef, linkedControlIds: incident.linkedControlIds,
      linkedEvidenceIds: incident.linkedEvidenceIds, linkedReviewTaskIds: [], linkedTrainingAssignmentIds: [],
      ciaImpacts: [], updatedAt: incident.updatedAt, sourceManaged: true,
    });
  }

  for (const vulnerability of vulnerabilities) {
    const status = vulnerabilityActionStatus(vulnerability.status);
    if (!status) continue;
    const dueDate = normalizeDate(vulnerability.dueAt);
    const linkedRisk = vulnerability.linkedRiskIds[0] ? riskById.get(vulnerability.linkedRiskIds[0]) : undefined;
    issues.push({
      id: `action-vulnerability-${vulnerability.id}`, workspaceId, title: vulnerability.title,
      description: vulnerability.description, owner: vulnerability.owner, status,
      priority: securityCasePriority(vulnerability.severity), dueDate, domain: 'Vulnerability Management',
      sourceType: 'Vulnerability', sourceReference: vulnerability.vulnerabilityRef,
      sourceStatus: vulnerability.status, isOverdue: isPastDue(dueDate), linkedRiskId: linkedRisk?.id,
      linkedRiskRef: linkedRisk?.riskRef, linkedControlIds: vulnerability.linkedControlIds,
      linkedEvidenceIds: vulnerability.linkedEvidenceIds, linkedReviewTaskIds: [], linkedTrainingAssignmentIds: [],
      ciaImpacts: [], updatedAt: vulnerability.updatedAt, sourceManaged: true,
    });
  }

  return sortIssues(issues);
}

export async function getDerivedIssueById(workspaceId: string, issueId: string): Promise<DashboardIssueRecord | null> {
  const issues = await getDerivedIssues(workspaceId);
  return issues.find((issue) => issue.id === issueId) ?? null;
}
