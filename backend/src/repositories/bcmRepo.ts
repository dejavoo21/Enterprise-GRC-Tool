import { generateId, query } from '../db.js';
import type {
  BcmComplianceMappingRecord,
  BcmCorrectiveActionRecord,
  BcmEntityStatus,
  BcmReportRecord,
  BcmReportType,
  BiaProcessRecord,
  BusinessContinuitySummary,
  CriticalServiceRecord,
  CrisisEventRecord,
  DependencyMappingRecord,
  OperationalResilienceScenarioRecord,
  RecoveryExerciseRecord,
  RecoveryPlanRecord,
} from '../types/resilience.js';

type AnyRow = Record<string, unknown>;

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function mapBiaProcess(row: AnyRow): BiaProcessRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    processName: String(row.process_name),
    processOwner: String(row.process_owner),
    businessUnit: String(row.business_unit),
    criticality: row.criticality as BiaProcessRecord['criticality'],
    impactRating: row.impact_rating as BiaProcessRecord['impactRating'],
    recoveryPriority: row.recovery_priority as BiaProcessRecord['recoveryPriority'],
    productsServices: asArray(row.products_services),
    dependencies: asArray(row.dependencies),
    supportingAssets: asArray(row.supporting_assets),
    supportingVendors: asArray(row.supporting_vendors),
    supportingApplications: asArray(row.supporting_applications),
    rtoHours: Number(row.rto_hours || 0),
    rpoHours: Number(row.rpo_hours || 0),
    maximumTolerableDowntimeHours: Number(row.maximum_tolerable_downtime_hours || 0),
    maximumDataLossHours: Number(row.maximum_data_loss_hours || 0),
    currentRecoveryTimeHours: Number(row.current_recovery_time_hours || 0),
    currentDataRecoveryHours: Number(row.current_data_recovery_hours || 0),
    status: row.status as BcmEntityStatus,
    linkedRiskIds: asArray(row.linked_risk_ids),
    linkedControlIds: asArray(row.linked_control_ids),
    linkedEvidenceIds: asArray(row.linked_evidence_ids),
    linkedVendorIds: asArray(row.linked_vendor_ids),
    linkedAssetIds: asArray(row.linked_asset_ids),
    linkedFindingIds: asArray(row.linked_finding_ids),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapCriticalService(row: AnyRow): CriticalServiceRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    serviceName: String(row.service_name),
    owner: String(row.owner),
    businessUnit: String(row.business_unit),
    criticality: row.criticality as CriticalServiceRecord['criticality'],
    biaProcessIds: asArray(row.bia_process_ids),
    supportingAssets: asArray(row.supporting_assets),
    supportingVendors: asArray(row.supporting_vendors),
    supportingApplications: asArray(row.supporting_applications),
    recoveryPlanId: row.recovery_plan_id ? String(row.recovery_plan_id) : null,
    status: row.status as BcmEntityStatus,
    impactToleranceHours: Number(row.impact_tolerance_hours || 0),
    recoveryCoveragePercent: Number(row.recovery_coverage_percent || 0),
    doraRelevant: Boolean(row.dora_relevant),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapRecoveryPlan(row: AnyRow): RecoveryPlanRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    planType: row.plan_type as RecoveryPlanRecord['planType'],
    title: String(row.title),
    objectives: asArray(row.objectives),
    steps: asArray(row.steps),
    owners: asArray(row.owners),
    dependencies: asArray(row.dependencies),
    recoverySites: asArray(row.recovery_sites),
    recoveryTeams: asArray(row.recovery_teams),
    supportingAssets: asArray(row.supporting_assets),
    supportingVendors: asArray(row.supporting_vendors),
    supportingApplications: asArray(row.supporting_applications),
    targetRtoHours: Number(row.target_rto_hours || 0),
    currentRtoHours: Number(row.current_rto_hours || 0),
    targetRpoHours: Number(row.target_rpo_hours || 0),
    currentRpoHours: Number(row.current_rpo_hours || 0),
    maximumTolerableDowntimeHours: Number(row.maximum_tolerable_downtime_hours || 0),
    recoveryReadinessPercent: Number(row.recovery_readiness_percent || 0),
    status: row.status as BcmEntityStatus,
    lastReviewedAt: toIso(row.last_reviewed_at),
    lastTestedAt: toIso(row.last_tested_at),
    nextReviewAt: toIso(row.next_review_at),
    approvedAt: toIso(row.approved_at),
    createdBy: row.created_by ? String(row.created_by) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapExercise(row: AnyRow): RecoveryExerciseRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    exerciseType: row.exercise_type as RecoveryExerciseRecord['exerciseType'],
    title: String(row.title),
    exerciseDate: toIso(row.exercise_date)!,
    participants: asArray(row.participants),
    scenario: String(row.scenario),
    resultSummary: String(row.result_summary),
    findings: asArray(row.findings),
    lessonsLearned: asArray(row.lessons_learned),
    correctiveActions: asArray(row.corrective_actions),
    performanceScore: Number(row.performance_score || 0),
    status: row.status as BcmEntityStatus,
    linkedPlanIds: asArray(row.linked_plan_ids),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapCorrectiveAction(row: AnyRow): BcmCorrectiveActionRecord {
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), exerciseId: String(row.exercise_id),
    title: String(row.title), description: String(row.description), owner: String(row.owner),
    priority: row.priority as BcmCorrectiveActionRecord['priority'], status: row.status as BcmCorrectiveActionRecord['status'],
    dueDate: toIso(row.due_date), evidenceIds: asArray(row.evidence_ids), closureNotes: row.closure_notes ? String(row.closure_notes) : null,
    createdBy: row.created_by ? String(row.created_by) : null, closedBy: row.closed_by ? String(row.closed_by) : null,
    closedAt: toIso(row.closed_at), createdAt: toIso(row.created_at)!, updatedAt: toIso(row.updated_at)!,
  };
}

function mapCrisisEvent(row: AnyRow): CrisisEventRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    eventTitle: String(row.event_title),
    severity: row.severity as CrisisEventRecord['severity'],
    owner: String(row.owner),
    status: row.status as CrisisEventRecord['status'],
    communications: asArray(row.communications),
    stakeholders: asArray(row.stakeholders),
    actions: asArray(row.actions),
    escalations: asArray(row.escalations),
    lessonsLearned: asArray(row.lessons_learned),
    openedAt: toIso(row.opened_at)!,
    closedAt: toIso(row.closed_at),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapDependency(row: AnyRow): DependencyMappingRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    sourceName: String(row.source_name),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    targetName: String(row.target_name),
    dependencyKind: row.dependency_kind as DependencyMappingRecord['dependencyKind'],
    criticality: row.criticality as DependencyMappingRecord['criticality'],
    status: row.status as BcmEntityStatus,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapScenario(row: AnyRow): OperationalResilienceScenarioRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    criticalServiceId: row.critical_service_id ? String(row.critical_service_id) : null,
    disruptionScenario: String(row.disruption_scenario),
    impactToleranceHours: Number(row.impact_tolerance_hours || 0),
    operationalCapacityPercent: Number(row.operational_capacity_percent || 0),
    recoveryCapabilityPercent: Number(row.recovery_capability_percent || 0),
    resilienceRating: Number(row.resilience_rating || 0),
    status: row.status as BcmEntityStatus,
    doraScenario: Boolean(row.dora_scenario),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapCompliance(row: AnyRow): BcmComplianceMappingRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    frameworkCode: String(row.framework_code),
    frameworkName: String(row.framework_name),
    mappedControlIds: asArray(row.mapped_control_ids),
    mappedEvidenceIds: asArray(row.mapped_evidence_ids),
    mappedRecoveryPlanIds: asArray(row.mapped_recovery_plan_ids),
    mappedFindingIds: asArray(row.mapped_finding_ids),
    coveragePercent: Number(row.coverage_percent || 0),
    status: row.status as BcmEntityStatus,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapReport(row: AnyRow): BcmReportRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    reportType: row.report_type as BcmReportType,
    title: String(row.title),
    status: row.status as BcmReportRecord['status'],
    generatedBy: String(row.generated_by),
    summary: asArray(row.summary),
    generatedAt: toIso(row.generated_at)!,
  };
}

export async function listBiaProcesses(workspaceId: string): Promise<BiaProcessRecord[]> {
  const result = await query(`SELECT * FROM bcm_bia_processes WHERE workspace_id = $1 ORDER BY recovery_priority, criticality DESC, process_name`, [workspaceId]);
  return result.rows.map((row) => mapBiaProcess(row as AnyRow));
}

export async function createBiaProcess(workspaceId: string, input: Partial<BiaProcessRecord>): Promise<BiaProcessRecord> {
  const result = await query(
    `INSERT INTO bcm_bia_processes (
      id, workspace_id, process_name, process_owner, business_unit, criticality, impact_rating, recovery_priority,
      products_services, dependencies, supporting_assets, supporting_vendors, supporting_applications, rto_hours, rpo_hours,
      maximum_tolerable_downtime_hours, maximum_data_loss_hours, current_recovery_time_hours, current_data_recovery_hours,
      status, linked_risk_ids, linked_control_ids, linked_evidence_ids, linked_vendor_ids, linked_asset_ids, linked_finding_ids
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15,
      $16, $17, $18, $19, $20, $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb, $25::jsonb, $26::jsonb
    ) RETURNING *`,
    [
      input.id || generateId('bia'),
      workspaceId,
      input.processName,
      input.processOwner,
      input.businessUnit,
      input.criticality || 'high',
      input.impactRating || 'major',
      input.recoveryPriority || 'tier_2',
      JSON.stringify(input.productsServices || []),
      JSON.stringify(input.dependencies || []),
      JSON.stringify(input.supportingAssets || []),
      JSON.stringify(input.supportingVendors || []),
      JSON.stringify(input.supportingApplications || []),
      input.rtoHours || 0,
      input.rpoHours || 0,
      input.maximumTolerableDowntimeHours || 0,
      input.maximumDataLossHours || 0,
      input.currentRecoveryTimeHours || 0,
      input.currentDataRecoveryHours || 0,
      input.status || 'active',
      JSON.stringify(input.linkedRiskIds || []),
      JSON.stringify(input.linkedControlIds || []),
      JSON.stringify(input.linkedEvidenceIds || []),
      JSON.stringify(input.linkedVendorIds || []),
      JSON.stringify(input.linkedAssetIds || []),
      JSON.stringify(input.linkedFindingIds || []),
    ],
  );
  return mapBiaProcess(result.rows[0] as AnyRow);
}

export async function updateBiaProcess(workspaceId: string, id: string, input: Partial<BiaProcessRecord>): Promise<BiaProcessRecord | null> {
  const current = await query(`SELECT * FROM bcm_bia_processes WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0] as AnyRow;
  const result = await query(
    `UPDATE bcm_bia_processes
     SET process_name = $3, process_owner = $4, business_unit = $5, criticality = $6, impact_rating = $7, recovery_priority = $8,
         products_services = $9::jsonb, dependencies = $10::jsonb, supporting_assets = $11::jsonb, supporting_vendors = $12::jsonb,
         supporting_applications = $13::jsonb, rto_hours = $14, rpo_hours = $15, maximum_tolerable_downtime_hours = $16,
         maximum_data_loss_hours = $17, current_recovery_time_hours = $18, current_data_recovery_hours = $19, status = $20,
         linked_risk_ids = $21::jsonb, linked_control_ids = $22::jsonb, linked_evidence_ids = $23::jsonb, linked_vendor_ids = $24::jsonb,
         linked_asset_ids = $25::jsonb, linked_finding_ids = $26::jsonb, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.processName ?? row.process_name,
      input.processOwner ?? row.process_owner,
      input.businessUnit ?? row.business_unit,
      input.criticality ?? row.criticality,
      input.impactRating ?? row.impact_rating,
      input.recoveryPriority ?? row.recovery_priority,
      JSON.stringify(input.productsServices ?? row.products_services ?? []),
      JSON.stringify(input.dependencies ?? row.dependencies ?? []),
      JSON.stringify(input.supportingAssets ?? row.supporting_assets ?? []),
      JSON.stringify(input.supportingVendors ?? row.supporting_vendors ?? []),
      JSON.stringify(input.supportingApplications ?? row.supporting_applications ?? []),
      input.rtoHours ?? row.rto_hours ?? 0,
      input.rpoHours ?? row.rpo_hours ?? 0,
      input.maximumTolerableDowntimeHours ?? row.maximum_tolerable_downtime_hours ?? 0,
      input.maximumDataLossHours ?? row.maximum_data_loss_hours ?? 0,
      input.currentRecoveryTimeHours ?? row.current_recovery_time_hours ?? 0,
      input.currentDataRecoveryHours ?? row.current_data_recovery_hours ?? 0,
      input.status ?? row.status,
      JSON.stringify(input.linkedRiskIds ?? row.linked_risk_ids ?? []),
      JSON.stringify(input.linkedControlIds ?? row.linked_control_ids ?? []),
      JSON.stringify(input.linkedEvidenceIds ?? row.linked_evidence_ids ?? []),
      JSON.stringify(input.linkedVendorIds ?? row.linked_vendor_ids ?? []),
      JSON.stringify(input.linkedAssetIds ?? row.linked_asset_ids ?? []),
      JSON.stringify(input.linkedFindingIds ?? row.linked_finding_ids ?? []),
    ],
  );
  return mapBiaProcess(result.rows[0] as AnyRow);
}

export async function listCriticalServices(workspaceId: string): Promise<CriticalServiceRecord[]> {
  const result = await query(`SELECT * FROM bcm_critical_services WHERE workspace_id = $1 ORDER BY criticality DESC, service_name`, [workspaceId]);
  return result.rows.map((row) => mapCriticalService(row as AnyRow));
}

export async function createCriticalService(workspaceId: string, input: Partial<CriticalServiceRecord>): Promise<CriticalServiceRecord> {
  const result = await query(
    `INSERT INTO bcm_critical_services (
      id, workspace_id, service_name, owner, business_unit, criticality, bia_process_ids, supporting_assets, supporting_vendors,
      supporting_applications, recovery_plan_id, status, impact_tolerance_hours, recovery_coverage_percent, dora_relevant
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15
    ) RETURNING *`,
    [
      input.id || generateId('bcmsvc'),
      workspaceId,
      input.serviceName,
      input.owner,
      input.businessUnit,
      input.criticality || 'high',
      JSON.stringify(input.biaProcessIds || []),
      JSON.stringify(input.supportingAssets || []),
      JSON.stringify(input.supportingVendors || []),
      JSON.stringify(input.supportingApplications || []),
      input.recoveryPlanId || null,
      input.status || 'active',
      input.impactToleranceHours || 0,
      input.recoveryCoveragePercent || 0,
      input.doraRelevant || false,
    ],
  );
  return mapCriticalService(result.rows[0] as AnyRow);
}

export async function listRecoveryPlans(workspaceId: string): Promise<RecoveryPlanRecord[]> {
  const result = await query(`SELECT * FROM bcm_recovery_plans WHERE workspace_id = $1 ORDER BY next_review_at NULLS LAST, title`, [workspaceId]);
  return result.rows.map((row) => mapRecoveryPlan(row as AnyRow));
}

export async function createRecoveryPlan(workspaceId: string, input: Partial<RecoveryPlanRecord>, createdBy?: string | null): Promise<RecoveryPlanRecord> {
  const result = await query(
    `INSERT INTO bcm_recovery_plans (
      id, workspace_id, plan_type, title, objectives, steps, owners, dependencies, recovery_sites, recovery_teams,
      supporting_assets, supporting_vendors, supporting_applications, target_rto_hours, current_rto_hours, target_rpo_hours,
      current_rpo_hours, maximum_tolerable_downtime_hours, recovery_readiness_percent, status, last_reviewed_at,
      last_tested_at, next_review_at, approved_at, created_by, approved_by
    ) VALUES (
      $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
      $11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
    ) RETURNING *`,
    [
      input.id || generateId('bcmplan'),
      workspaceId,
      input.planType,
      input.title,
      JSON.stringify(input.objectives || []),
      JSON.stringify(input.steps || []),
      JSON.stringify(input.owners || []),
      JSON.stringify(input.dependencies || []),
      JSON.stringify(input.recoverySites || []),
      JSON.stringify(input.recoveryTeams || []),
      JSON.stringify(input.supportingAssets || []),
      JSON.stringify(input.supportingVendors || []),
      JSON.stringify(input.supportingApplications || []),
      input.targetRtoHours || 0,
      input.currentRtoHours || 0,
      input.targetRpoHours || 0,
      input.currentRpoHours || 0,
      input.maximumTolerableDowntimeHours || 0,
      input.recoveryReadinessPercent || 0,
      input.status || 'draft',
      input.lastReviewedAt || null,
      input.lastTestedAt || null,
      input.nextReviewAt || null,
      input.approvedAt || null,
      createdBy || null,
      input.approvedBy || null,
    ],
  );
  return mapRecoveryPlan(result.rows[0] as AnyRow);
}

export async function submitRecoveryPlan(workspaceId: string, id: string): Promise<RecoveryPlanRecord | null> {
  const result = await query(`UPDATE bcm_recovery_plans SET status='in_review',updated_at=NOW() WHERE workspace_id=$1 AND id=$2 AND status='draft' RETURNING *`, [workspaceId,id]);
  return result.rows[0] ? mapRecoveryPlan(result.rows[0] as AnyRow) : null;
}

export async function approveRecoveryPlan(workspaceId: string, id: string, approvedBy: string): Promise<RecoveryPlanRecord | null> {
  const result = await query(
    `UPDATE bcm_recovery_plans SET status='approved',approved_at=NOW(),approved_by=$3,last_reviewed_at=NOW(),updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 AND status='in_review' AND created_by IS DISTINCT FROM $3 RETURNING *`,
    [workspaceId,id,approvedBy],
  );
  return result.rows[0] ? mapRecoveryPlan(result.rows[0] as AnyRow) : null;
}

export async function updateRecoveryPlan(workspaceId: string, id: string, input: Partial<RecoveryPlanRecord>): Promise<RecoveryPlanRecord | null> {
  const current = await query(`SELECT * FROM bcm_recovery_plans WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0] as AnyRow;
  const result = await query(
    `UPDATE bcm_recovery_plans
     SET plan_type = $3, title = $4, objectives = $5::jsonb, steps = $6::jsonb, owners = $7::jsonb, dependencies = $8::jsonb,
         recovery_sites = $9::jsonb, recovery_teams = $10::jsonb, supporting_assets = $11::jsonb, supporting_vendors = $12::jsonb,
         supporting_applications = $13::jsonb, target_rto_hours = $14, current_rto_hours = $15, target_rpo_hours = $16,
         current_rpo_hours = $17, maximum_tolerable_downtime_hours = $18, recovery_readiness_percent = $19, status = $20,
         last_reviewed_at = $21, last_tested_at = $22, next_review_at = $23, approved_at = $24, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.planType ?? row.plan_type,
      input.title ?? row.title,
      JSON.stringify(input.objectives ?? row.objectives ?? []),
      JSON.stringify(input.steps ?? row.steps ?? []),
      JSON.stringify(input.owners ?? row.owners ?? []),
      JSON.stringify(input.dependencies ?? row.dependencies ?? []),
      JSON.stringify(input.recoverySites ?? row.recovery_sites ?? []),
      JSON.stringify(input.recoveryTeams ?? row.recovery_teams ?? []),
      JSON.stringify(input.supportingAssets ?? row.supporting_assets ?? []),
      JSON.stringify(input.supportingVendors ?? row.supporting_vendors ?? []),
      JSON.stringify(input.supportingApplications ?? row.supporting_applications ?? []),
      input.targetRtoHours ?? row.target_rto_hours ?? 0,
      input.currentRtoHours ?? row.current_rto_hours ?? 0,
      input.targetRpoHours ?? row.target_rpo_hours ?? 0,
      input.currentRpoHours ?? row.current_rpo_hours ?? 0,
      input.maximumTolerableDowntimeHours ?? row.maximum_tolerable_downtime_hours ?? 0,
      input.recoveryReadinessPercent ?? row.recovery_readiness_percent ?? 0,
      input.status ?? row.status,
      input.lastReviewedAt ?? row.last_reviewed_at ?? null,
      input.lastTestedAt ?? row.last_tested_at ?? null,
      input.nextReviewAt ?? row.next_review_at ?? null,
      input.approvedAt ?? row.approved_at ?? null,
    ],
  );
  return mapRecoveryPlan(result.rows[0] as AnyRow);
}

export async function listExercises(workspaceId: string): Promise<RecoveryExerciseRecord[]> {
  const result = await query(`SELECT * FROM bcm_exercises WHERE workspace_id = $1 ORDER BY exercise_date DESC`, [workspaceId]);
  return result.rows.map((row) => mapExercise(row as AnyRow));
}

export async function createExercise(workspaceId: string, input: Partial<RecoveryExerciseRecord>): Promise<RecoveryExerciseRecord> {
  const result = await query(
    `INSERT INTO bcm_exercises (
      id, workspace_id, exercise_type, title, exercise_date, participants, scenario, result_summary, findings, lessons_learned,
      corrective_actions, performance_score, status, linked_plan_ids
    ) VALUES (
      $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14::jsonb
    ) RETURNING *`,
    [
      input.id || generateId('bcmex'),
      workspaceId,
      input.exerciseType,
      input.title,
      input.exerciseDate,
      JSON.stringify(input.participants || []),
      input.scenario,
      input.resultSummary,
      JSON.stringify(input.findings || []),
      JSON.stringify(input.lessonsLearned || []),
      JSON.stringify(input.correctiveActions || []),
      input.performanceScore ?? 0,
      input.status || 'completed',
      JSON.stringify(input.linkedPlanIds || []),
    ],
  );
  return mapExercise(result.rows[0] as AnyRow);
}

export async function listCorrectiveActions(workspaceId: string): Promise<BcmCorrectiveActionRecord[]> {
  const result = await query(`SELECT * FROM bcm_corrective_actions WHERE workspace_id=$1 ORDER BY status='closed', due_date NULLS LAST, created_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapCorrectiveAction(row as AnyRow));
}

export async function createCorrectiveAction(workspaceId: string, input: Partial<BcmCorrectiveActionRecord>, createdBy?: string | null): Promise<BcmCorrectiveActionRecord> {
  const result = await query(
    `INSERT INTO bcm_corrective_actions (id,workspace_id,exercise_id,title,description,owner,priority,status,due_date,evidence_ids,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
    [input.id || generateId('bcmca'),workspaceId,input.exerciseId,input.title,input.description,input.owner,input.priority || 'medium',input.status || 'open',input.dueDate || null,JSON.stringify(input.evidenceIds || []),createdBy || null],
  );
  return mapCorrectiveAction(result.rows[0] as AnyRow);
}

export async function updateCorrectiveActionStatus(workspaceId: string, id: string, status: BcmCorrectiveActionRecord['status']): Promise<BcmCorrectiveActionRecord | null> {
  const result = await query(`UPDATE bcm_corrective_actions SET status=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 AND status<>'closed' RETURNING *`, [workspaceId,id,status]);
  return result.rows[0] ? mapCorrectiveAction(result.rows[0] as AnyRow) : null;
}

export async function closeCorrectiveAction(workspaceId: string, id: string, evidenceIds: string[], closureNotes: string, closedBy: string): Promise<BcmCorrectiveActionRecord | null> {
  const result = await query(
    `UPDATE bcm_corrective_actions SET status='closed',evidence_ids=$3::jsonb,closure_notes=$4,closed_by=$5,closed_at=NOW(),updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 AND status='awaiting_review' AND created_by IS DISTINCT FROM $5 RETURNING *`,
    [workspaceId,id,JSON.stringify(evidenceIds),closureNotes,closedBy],
  );
  return result.rows[0] ? mapCorrectiveAction(result.rows[0] as AnyRow) : null;
}

export async function listCrisisEvents(workspaceId: string): Promise<CrisisEventRecord[]> {
  const result = await query(`SELECT * FROM bcm_crisis_events WHERE workspace_id = $1 ORDER BY opened_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapCrisisEvent(row as AnyRow));
}

export async function createCrisisEvent(workspaceId: string, input: Partial<CrisisEventRecord>): Promise<CrisisEventRecord> {
  const result = await query(
    `INSERT INTO bcm_crisis_events (
      id, workspace_id, event_title, severity, owner, status, communications, stakeholders, actions, escalations, lessons_learned, opened_at, closed_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13
    ) RETURNING *`,
    [
      input.id || generateId('bcmcr'),
      workspaceId,
      input.eventTitle,
      input.severity || 'high',
      input.owner,
      input.status || 'monitoring',
      JSON.stringify(input.communications || []),
      JSON.stringify(input.stakeholders || []),
      JSON.stringify(input.actions || []),
      JSON.stringify(input.escalations || []),
      JSON.stringify(input.lessonsLearned || []),
      input.openedAt || new Date().toISOString(),
      input.closedAt || null,
    ],
  );
  return mapCrisisEvent(result.rows[0] as AnyRow);
}

export async function listDependencies(workspaceId: string): Promise<DependencyMappingRecord[]> {
  const result = await query(`SELECT * FROM bcm_dependencies WHERE workspace_id = $1 ORDER BY source_type, source_name`, [workspaceId]);
  return result.rows.map((row) => mapDependency(row as AnyRow));
}

export async function createDependency(workspaceId: string, input: Partial<DependencyMappingRecord>): Promise<DependencyMappingRecord> {
  const result = await query(
    `INSERT INTO bcm_dependencies (
      id, workspace_id, source_type, source_id, source_name, target_type, target_id, target_name, dependency_kind, criticality, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    ) RETURNING *`,
    [
      input.id || generateId('bcmdep'),
      workspaceId,
      input.sourceType,
      input.sourceId,
      input.sourceName,
      input.targetType,
      input.targetId,
      input.targetName,
      input.dependencyKind,
      input.criticality || 'medium',
      input.status || 'active',
    ],
  );
  return mapDependency(result.rows[0] as AnyRow);
}

export async function listResilienceScenarios(workspaceId: string): Promise<OperationalResilienceScenarioRecord[]> {
  const result = await query(`SELECT * FROM bcm_resilience_scenarios WHERE workspace_id = $1 ORDER BY resilience_rating DESC, title`, [workspaceId]);
  return result.rows.map((row) => mapScenario(row as AnyRow));
}

export async function createResilienceScenario(workspaceId: string, input: Partial<OperationalResilienceScenarioRecord>): Promise<OperationalResilienceScenarioRecord> {
  const result = await query(
    `INSERT INTO bcm_resilience_scenarios (
      id, workspace_id, title, critical_service_id, disruption_scenario, impact_tolerance_hours, operational_capacity_percent,
      recovery_capability_percent, resilience_rating, status, dora_scenario
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    ) RETURNING *`,
    [
      input.id || generateId('bcmscn'),
      workspaceId,
      input.title,
      input.criticalServiceId || null,
      input.disruptionScenario,
      input.impactToleranceHours || 0,
      input.operationalCapacityPercent || 0,
      input.recoveryCapabilityPercent || 0,
      input.resilienceRating || 0,
      input.status || 'active',
      input.doraScenario || false,
    ],
  );
  return mapScenario(result.rows[0] as AnyRow);
}

export async function listComplianceMappings(workspaceId: string): Promise<BcmComplianceMappingRecord[]> {
  const result = await query(`SELECT * FROM bcm_compliance_mappings WHERE workspace_id = $1 ORDER BY framework_name`, [workspaceId]);
  return result.rows.map((row) => mapCompliance(row as AnyRow));
}

export async function createComplianceMapping(workspaceId: string, input: Partial<BcmComplianceMappingRecord>): Promise<BcmComplianceMappingRecord> {
  const result = await query(
    `INSERT INTO bcm_compliance_mappings (
      id, workspace_id, framework_code, framework_name, mapped_control_ids, mapped_evidence_ids, mapped_recovery_plan_ids, mapped_finding_ids, coverage_percent, status
    ) VALUES (
      $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10
    )
    ON CONFLICT (workspace_id, framework_code)
    DO UPDATE SET framework_name = EXCLUDED.framework_name,
                  mapped_control_ids = EXCLUDED.mapped_control_ids,
                  mapped_evidence_ids = EXCLUDED.mapped_evidence_ids,
                  mapped_recovery_plan_ids = EXCLUDED.mapped_recovery_plan_ids,
                  mapped_finding_ids = EXCLUDED.mapped_finding_ids,
                  coverage_percent = EXCLUDED.coverage_percent,
                  status = EXCLUDED.status,
                  updated_at = NOW()
    RETURNING *`,
    [
      input.id || generateId('bcmmap'),
      workspaceId,
      input.frameworkCode,
      input.frameworkName,
      JSON.stringify(input.mappedControlIds || []),
      JSON.stringify(input.mappedEvidenceIds || []),
      JSON.stringify(input.mappedRecoveryPlanIds || []),
      JSON.stringify(input.mappedFindingIds || []),
      input.coveragePercent || 0,
      input.status || 'active',
    ],
  );
  return mapCompliance(result.rows[0] as AnyRow);
}

export async function listReports(workspaceId: string): Promise<BcmReportRecord[]> {
  const result = await query(`SELECT * FROM bcm_reports WHERE workspace_id = $1 ORDER BY generated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapReport(row as AnyRow));
}

export async function createBcmReport(workspaceId: string, input: Partial<BcmReportRecord>): Promise<BcmReportRecord> {
  const result = await query(
    `INSERT INTO bcm_reports (id, workspace_id, report_type, title, status, generated_by, summary, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [
      input.id || generateId('bcmrpt'),
      workspaceId,
      input.reportType,
      input.title,
      input.status || 'generated',
      input.generatedBy,
      JSON.stringify(input.summary || []),
      input.generatedAt || new Date().toISOString(),
    ],
  );
  return mapReport(result.rows[0] as AnyRow);
}

export async function getBcmSummary(workspaceId: string): Promise<BusinessContinuitySummary> {
  const [processes, plans, exercises, dependencies, services, scenarios, openRisks] = await Promise.all([
    listBiaProcesses(workspaceId),
    listRecoveryPlans(workspaceId),
    listExercises(workspaceId),
    listDependencies(workspaceId),
    listCriticalServices(workspaceId),
    listResilienceScenarios(workspaceId),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM risks WHERE workspace_id = $1 AND status <> 'closed'`, [workspaceId]),
  ]);

  const recoveryReadiness = plans.length ? Math.round(plans.reduce((sum, plan) => sum + plan.recoveryReadinessPercent, 0) / plans.length) : null;
  const testingStatus = exercises.length
    ? Math.round(exercises.filter((exercise) => exercise.status === 'completed').length / exercises.length * 100)
    : null;
  const recoveryCoverage = services.length
    ? Math.round(services.reduce((sum, service) => sum + service.recoveryCoveragePercent, 0) / services.length)
    : null;
  const scenarioReadiness = scenarios.length
    ? Math.round(scenarios.reduce((sum, item) => sum + item.resilienceRating, 0) / scenarios.length)
    : null;
  const resilienceComponents = [recoveryReadiness, testingStatus, recoveryCoverage, scenarioReadiness]
    .filter((value): value is number => value !== null);
  const resilienceScore = resilienceComponents.length
    ? Math.round(resilienceComponents.reduce((sum, value) => sum + value, 0) / resilienceComponents.length)
    : null;

  return {
    criticalProcesses: processes.filter((process) => process.criticality === 'critical' || process.criticality === 'high').length,
    recoveryPlans: plans.length,
    recoveryExercises: exercises.length,
    recoveryReadiness,
    openRisks: Number(openRisks.rows[0]?.count || 0),
    criticalDependencies: dependencies.filter((dependency) => dependency.criticality === 'critical' || dependency.criticality === 'high').length,
    thirdPartyDependencies: dependencies.filter((dependency) => dependency.targetType === 'vendor').length,
    testingStatus,
    resilienceScore,
    recoveryCoverage,
  };
}
