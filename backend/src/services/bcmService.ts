import * as bcmRepo from '../repositories/bcmRepo.js';
import { recordActivity, type RecordActivityInput } from './activityLedger/activityLedger.js';
import type {
  BcmReportRecord,
  BcmReportType,
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
  await bcmRepo.seedBcmDefaults(workspaceId);
  const [summary, biaProcesses, criticalServices, recoveryPlans, exercises, crisisEvents, dependencies, resilienceScenarios, complianceMappings, reports] = await Promise.all([
    bcmRepo.getBcmSummary(workspaceId),
    bcmRepo.listBiaProcesses(workspaceId),
    bcmRepo.listCriticalServices(workspaceId),
    bcmRepo.listRecoveryPlans(workspaceId),
    bcmRepo.listExercises(workspaceId),
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
    crisisEvents,
    dependencies,
    resilienceScenarios,
    complianceMappings,
    reports,
  };
}

export async function createBiaProcess(workspaceId: string, input: Partial<BiaProcessRecord>, actor: ActorContext) {
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
  const record = await bcmRepo.createRecoveryPlan(workspaceId, input);
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

export async function updateRecoveryPlan(workspaceId: string, id: string, input: Partial<RecoveryPlanRecord>, actor: ActorContext) {
  const current = (await bcmRepo.listRecoveryPlans(workspaceId)).find((plan) => plan.id === id) || null;
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
  const record = await bcmRepo.createExercise(workspaceId, input);
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
  const summary = [
    `${state.summary.criticalProcesses} critical or high-priority processes remain in scope.`,
    `${state.summary.recoveryPlans} recovery plans are tracked with average readiness ${state.summary.recoveryReadiness}%.`,
    `${state.summary.recoveryExercises} exercises recorded; testing completion is ${state.summary.testingStatus}%.`,
    `${state.summary.thirdPartyDependencies} third-party dependencies and ${state.summary.criticalDependencies} critical dependency links are mapped.`,
    `Operational resilience score is ${state.summary.resilienceScore} with recovery coverage ${state.summary.recoveryCoverage}%.`,
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
