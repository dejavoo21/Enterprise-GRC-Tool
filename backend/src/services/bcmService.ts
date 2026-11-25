import * as bcmRepo from '../repositories/bcmRepo.js';
import { recordActivity, type RecordActivityInput } from './activityLedger/activityLedger.js';
import { assertWorkspaceLinks, type WorkspaceLinks } from './workspaceLinkValidation.js';
import { assertCorrectiveActionTransition, assertIndependentCorrectiveClosure, assertIndependentRecoveryPlanApproval, assertRecoveryPlanSubmission } from './bcmLifecycleRules.js';
import type {
  BcmReportRecord,
  BcmReportType,
  BcmCorrectiveActionRecord,
  BiaProcessRecord,
  BusinessContinuityState,
  CriticalServiceRecord,
  CrisisEventRecord,
  DependencyMappingRecord,
  OperationalResilienceScenarioRecord,
  RecoveryExerciseRecord,
  RecoveryPlanRecord,
} from '../types/resilience.js';

interface ActorContext {
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
}

async function validateBiaLinks(workspaceId: string, input: Partial<BiaProcessRecord>) {
  await assertWorkspaceLinks(workspaceId, {
    risks: input.linkedRiskIds,
    controls: input.linkedControlIds,
    evidence: input.linkedEvidenceIds,
    vendors: input.linkedVendorIds,
    assets: input.linkedAssetIds,
    findings: input.linkedFindingIds,
  });
}

async function validateDependencyLinks(workspaceId: string, input: Partial<DependencyMappingRecord>) {
  const links: WorkspaceLinks = {};
  const add = (type: unknown, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) return;
    const append = (key: keyof WorkspaceLinks) => {
      links[key] = [...((links[key] as string[] | undefined) || []), id];
    };
    if (type === 'process') append('bcmProcesses');
    if (type === 'asset') append('assets');
    if (type === 'vendor') append('vendors');
    if (type === 'recovery_plan') append('bcmRecoveryPlans');
  };
  add(input.sourceType, input.sourceId);
  add(input.targetType, input.targetId);
  await assertWorkspaceLinks(workspaceId, links);
}

async function logBcmActivity(workspaceId: string, entry: Omit<RecordActivityInput, 'workspaceId' | 'category' | 'source'>) {
  await recordActivity({
    workspaceId,
    category: 'resilience',
    source: 'backend',
    severity: 'medium',
    outcome: 'success',
    ...entry,
  });
}

export async function getBusinessContinuityState(workspaceId: string): Promise<BusinessContinuityState> {
  const [summary, biaProcesses, criticalServices, recoveryPlans, exercises, correctiveActions, crisisEvents, dependencies, resilienceScenarios, complianceMappings, reports] = await Promise.all([
    bcmRepo.getBcmSummary(workspaceId),
    bcmRepo.listBiaProcesses(workspaceId),
    bcmRepo.listCriticalServices(workspaceId),
    bcmRepo.listRecoveryPlans(workspaceId),
    bcmRepo.listExercises(workspaceId),
    bcmRepo.listCorrectiveActions(workspaceId),
    bcmRepo.listCrisisEvents(workspaceId),
    bcmRepo.listDependencies(workspaceId),
    bcmRepo.listResilienceScenarios(workspaceId),
    bcmRepo.listComplianceMappings(workspaceId),
    bcmRepo.listReports(workspaceId),
  ]);

  return {
    summary,
    biaProcesses,
    criticalServices,
    recoveryPlans,
    exercises,
    correctiveActions,
    crisisEvents,
    dependencies,
    resilienceScenarios,
    complianceMappings,
    reports,
  };
}

export async function createBiaProcess(workspaceId: string, input: Partial<BiaProcessRecord>, actor: ActorContext) {
  await validateBiaLinks(workspaceId, input);
  const record = await bcmRepo.createBiaProcess(workspaceId, input);
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'bia_created',
    targetType: 'bia_process',
    targetId: record.id,
    targetName: record.processName,
    newValue: { criticality: record.criticality, businessUnit: record.businessUnit, rtoHours: record.rtoHours, rpoHours: record.rpoHours },
    notes: `Created BIA process ${record.processName}`,
  });
  return record;
}

export async function updateBiaProcess(workspaceId: string, id: string, input: Partial<BiaProcessRecord>, actor: ActorContext) {
  await validateBiaLinks(workspaceId, input);
  const current = (await bcmRepo.listBiaProcesses(workspaceId)).find((process) => process.id === id) || null;
  const record = await bcmRepo.updateBiaProcess(workspaceId, id, input);
  if (!record) return null;
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'bia_updated',
    targetType: 'bia_process',
    targetId: record.id,
    targetName: record.processName,
    previousValue: current,
    newValue: record,
    notes: `Updated BIA process ${record.processName}`,
  });
  return record;
}

export async function createCriticalService(workspaceId: string, input: Partial<CriticalServiceRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { bcmProcesses: input.biaProcessIds, bcmRecoveryPlans: input.recoveryPlanId ? [input.recoveryPlanId] : undefined });
  const record = await bcmRepo.createCriticalService(workspaceId, input);
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'critical_service_registered',
    targetType: 'critical_service',
    targetId: record.id,
    targetName: record.serviceName,
    newValue: record,
    notes: `Registered critical service ${record.serviceName}`,
  });
  return record;
}

export async function createRecoveryPlan(workspaceId: string, input: Partial<RecoveryPlanRecord>, actor: ActorContext) {
  if (!actor.actorUserId) throw new Error('Authenticated creator identity is required.');
  const record = await bcmRepo.createRecoveryPlan(workspaceId, input, actor.actorUserId);
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'recovery_plan_created',
    targetType: 'recovery_plan',
    targetId: record.id,
    targetName: record.title,
    newValue: { planType: record.planType, readiness: record.recoveryReadinessPercent, status: record.status },
    notes: `Created recovery plan ${record.title}`,
  });
  return record;
}

export async function submitRecoveryPlan(workspaceId: string, id: string, actor: ActorContext) {
  const current = (await bcmRepo.listRecoveryPlans(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertRecoveryPlanSubmission(current.status);
  const record = await bcmRepo.submitRecoveryPlan(workspaceId, id);
  if (record) await logBcmActivity(workspaceId, { ...actor, action: 'recovery_plan_submitted', targetType: 'recovery_plan', targetId: id, targetName: record.title, previousValue: current.status, newValue: record.status, notes: `Submitted recovery plan ${record.title} for independent review.` });
  return record;
}

export async function approveRecoveryPlan(workspaceId: string, id: string, actor: ActorContext) {
  const current = (await bcmRepo.listRecoveryPlans(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertIndependentRecoveryPlanApproval(current.status, current.createdBy, actor.actorUserId);
  const record = await bcmRepo.approveRecoveryPlan(workspaceId, id, actor.actorUserId);
  if (!record) throw new Error('Recovery plan approval failed the independent-review guard.');
  await logBcmActivity(workspaceId, { ...actor, action: 'plan_approved', targetType: 'recovery_plan', targetId: id, targetName: record.title, previousValue: current.status, newValue: record.status, notes: `Independently approved recovery plan ${record.title}.` });
  return record;
}

export async function updateRecoveryPlan(workspaceId: string, id: string, input: Partial<RecoveryPlanRecord>, actor: ActorContext) {
  const current = (await bcmRepo.listRecoveryPlans(workspaceId)).find((plan) => plan.id === id) || null;
  if (current && current.status !== 'draft') throw new Error('Only draft recovery plans can be edited. Return the plan to controlled revision before changing approved content.');
  const record = await bcmRepo.updateRecoveryPlan(workspaceId, id, input);
  if (!record) return null;
  const action = record.status === 'approved' ? 'plan_approved' : 'recovery_plan_updated';
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action,
    targetType: 'recovery_plan',
    targetId: record.id,
    targetName: record.title,
    previousValue: current,
    newValue: record,
    notes: record.status === 'approved' ? `Approved recovery plan ${record.title}` : `Updated recovery plan ${record.title}`,
  });
  return record;
}

export async function createExercise(workspaceId: string, input: Partial<RecoveryExerciseRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { bcmRecoveryPlans: input.linkedPlanIds });
  if (typeof input.performanceScore !== 'number' || !Number.isFinite(input.performanceScore) || input.performanceScore < 0 || input.performanceScore > 100) {
    throw new Error('Exercise performance score must be explicitly recorded from 0 to 100.');
  }
  const record = await bcmRepo.createExercise(workspaceId, { ...input, status: 'completed' });
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: record.performanceScore < 70 ? 'recovery_test_failed' : 'exercise_completed',
    targetType: 'recovery_exercise',
    targetId: record.id,
    targetName: record.title,
    newValue: { exerciseType: record.exerciseType, performanceScore: record.performanceScore, status: record.status },
    severity: record.performanceScore < 70 ? 'high' : 'medium',
    notes: `Logged ${record.exerciseType} exercise ${record.title}`,
  });
  return record;
}

export async function createCorrectiveAction(workspaceId: string, input: Partial<BcmCorrectiveActionRecord>, actor: ActorContext) {
  if (!actor.actorUserId) throw new Error('Authenticated creator identity is required.');
  const exercise = (await bcmRepo.listExercises(workspaceId)).find((item) => item.id === input.exerciseId);
  if (!exercise) throw new Error('The selected recovery exercise is not available in this workspace.');
  const record = await bcmRepo.createCorrectiveAction(workspaceId, input, actor.actorUserId);
  await logBcmActivity(workspaceId, { ...actor, action: 'bcm_corrective_action_created', targetType: 'bcm_corrective_action', targetId: record.id, targetName: record.title, newValue: { exerciseId: record.exerciseId, owner: record.owner, priority: record.priority, status: record.status, dueDate: record.dueDate }, severity: record.priority === 'critical' ? 'critical' : record.priority === 'high' ? 'high' : 'medium', notes: `Created corrective action ${record.title} from exercise ${exercise.title}.` });
  return record;
}

export async function transitionCorrectiveAction(workspaceId: string, id: string, status: BcmCorrectiveActionRecord['status'], actor: ActorContext) {
  const current = (await bcmRepo.listCorrectiveActions(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertCorrectiveActionTransition(current.status, status);
  const record = await bcmRepo.updateCorrectiveActionStatus(workspaceId, id, status);
  if (record) await logBcmActivity(workspaceId, { ...actor, action: 'bcm_corrective_action_status_changed', targetType: 'bcm_corrective_action', targetId: id, targetName: record.title, previousValue: current.status, newValue: status, notes: `Corrective action status changed to ${status}.` });
  return record;
}

export async function closeCorrectiveAction(workspaceId: string, id: string, evidenceIds: string[], closureNotes: string, actor: ActorContext) {
  const current = (await bcmRepo.listCorrectiveActions(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertIndependentCorrectiveClosure(current.status, current.createdBy, actor.actorUserId, evidenceIds, closureNotes);
  await assertWorkspaceLinks(workspaceId, { evidence: evidenceIds });
  const record = await bcmRepo.closeCorrectiveAction(workspaceId, id, evidenceIds, closureNotes.trim(), actor.actorUserId);
  if (!record) throw new Error('Corrective action closure failed the independent-review guard.');
  await logBcmActivity(workspaceId, { ...actor, action: 'bcm_corrective_action_closed', targetType: 'bcm_corrective_action', targetId: id, targetName: record.title, previousValue: current, newValue: record, severity: 'medium', notes: `Closed corrective action ${record.title} with ${evidenceIds.length} evidence reference(s).` });
  return record;
}

export async function createCrisisEvent(workspaceId: string, input: Partial<CrisisEventRecord>, actor: ActorContext) {
  const record = await bcmRepo.createCrisisEvent(workspaceId, input);
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: record.status === 'closed' ? 'crisis_closed' : 'crisis_declared',
    targetType: 'crisis_event',
    targetId: record.id,
    targetName: record.eventTitle,
    newValue: { severity: record.severity, status: record.status },
    severity: record.severity === 'critical' ? 'critical' : 'high',
    notes: `Logged crisis event ${record.eventTitle}`,
  });
  return record;
}

export async function createDependency(workspaceId: string, input: Partial<DependencyMappingRecord>, actor: ActorContext) {
  await validateDependencyLinks(workspaceId, input);
  const record = await bcmRepo.createDependency(workspaceId, input);
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'dependency_updated',
    targetType: 'dependency',
    targetId: record.id,
    targetName: `${record.sourceName} -> ${record.targetName}`,
    newValue: record,
    notes: `Updated dependency from ${record.sourceName} to ${record.targetName}`,
  });
  return record;
}

export async function createResilienceScenario(workspaceId: string, input: Partial<OperationalResilienceScenarioRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { bcmCriticalServices: input.criticalServiceId ? [input.criticalServiceId] : undefined });
  const record = await bcmRepo.createResilienceScenario(workspaceId, input);
  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'resilience_scenario_created',
    targetType: 'resilience_scenario',
    targetId: record.id,
    targetName: record.title,
    newValue: record,
    notes: `Created resilience scenario ${record.title}`,
  });
  return record;
}

function buildReportSummary(type: BcmReportType, state: BusinessContinuityState): string[] {
  const percent = (value: number | null, label: string) => value === null ? `${label} has not been assessed.` : `${label} is ${value}%.`;
  const summary = [
    `${state.summary.criticalProcesses} critical or high-priority processes remain in scope.`,
    `${state.summary.recoveryPlans} recovery plans are tracked. ${percent(state.summary.recoveryReadiness, 'Average recovery readiness')}`,
    `${state.summary.recoveryExercises} exercises are recorded. ${percent(state.summary.testingStatus, 'Testing completion')}`,
    `${state.correctiveActions.filter((item) => item.status !== 'closed').length} exercise corrective actions remain open.`,
    `${state.summary.thirdPartyDependencies} third-party dependencies and ${state.summary.criticalDependencies} critical dependency links are mapped.`,
    `${state.summary.resilienceScore === null ? 'Operational resilience has not been assessed.' : `Operational resilience score is ${state.summary.resilienceScore}.`} ${percent(state.summary.recoveryCoverage, 'Recovery coverage')}`,
  ];

  if (type === 'dora_report') {
    summary.push(`${state.criticalServices.filter((service) => service.doraRelevant).length} critical ICT services are flagged as DORA-relevant.`);
  }
  if (type === 'board_bcm_pack') {
    summary.push(`${state.crisisEvents.filter((event) => event.status !== 'closed').length} open crisis events currently affect resilience oversight.`);
  }

  return summary;
}

export async function generateBcmReport(workspaceId: string, reportType: BcmReportType, actor: ActorContext): Promise<BcmReportRecord> {
  const state = await getBusinessContinuityState(workspaceId);
  const titleMap: Record<BcmReportType, string> = {
    business_continuity_report: 'Business Continuity Report',
    recovery_readiness_report: 'Recovery Readiness Report',
    dora_report: 'DORA Operational Resilience Report',
    operational_resilience_report: 'Operational Resilience Report',
    executive_bcm_summary: 'Executive BCM Summary',
    board_bcm_pack: 'Board BCM Pack',
  };

  const report = await bcmRepo.createBcmReport(workspaceId, {
    reportType,
    title: `${titleMap[reportType]} - ${new Date().toLocaleDateString('en-GB')}`,
    status: 'generated',
    generatedBy: actor.actorName,
    summary: buildReportSummary(reportType, state),
    generatedAt: new Date().toISOString(),
  });

  await logBcmActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'bcm_report_generated',
    targetType: 'bcm_report',
    targetId: report.id,
    targetName: report.title,
    newValue: { reportType, summaryLines: report.summary.length },
    severity: reportType === 'board_bcm_pack' ? 'high' : 'medium',
    notes: `Generated ${report.title}`,
  });

  return report;
}
