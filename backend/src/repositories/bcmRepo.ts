import { generateId, query } from '../db.js';
import type {
  BcmComplianceMappingRecord,
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

export async function ensureBcmSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS bcm_bia_processes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      process_name TEXT NOT NULL,
      process_owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      criticality TEXT NOT NULL,
      impact_rating TEXT NOT NULL,
      recovery_priority TEXT NOT NULL,
      products_services JSONB NOT NULL DEFAULT '[]'::jsonb,
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_vendors JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_applications JSONB NOT NULL DEFAULT '[]'::jsonb,
      rto_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      rpo_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      maximum_tolerable_downtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      maximum_data_loss_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_recovery_time_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_data_recovery_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      linked_risk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_vendor_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_finding_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_critical_services (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      criticality TEXT NOT NULL,
      supporting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_vendors JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_applications JSONB NOT NULL DEFAULT '[]'::jsonb,
      recovery_plan_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      impact_tolerance_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      recovery_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      dora_relevant BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_recovery_plans (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      title TEXT NOT NULL,
      objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      owners JSONB NOT NULL DEFAULT '[]'::jsonb,
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
      recovery_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
      recovery_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_vendors JSONB NOT NULL DEFAULT '[]'::jsonb,
      supporting_applications JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_rto_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_rto_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      target_rpo_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      current_rpo_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      maximum_tolerable_downtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      recovery_readiness_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      last_reviewed_at TIMESTAMPTZ,
      last_tested_at TIMESTAMPTZ,
      next_review_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_exercises (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      title TEXT NOT NULL,
      exercise_date TIMESTAMPTZ NOT NULL,
      participants JSONB NOT NULL DEFAULT '[]'::jsonb,
      scenario TEXT NOT NULL,
      result_summary TEXT NOT NULL,
      findings JSONB NOT NULL DEFAULT '[]'::jsonb,
      lessons_learned JSONB NOT NULL DEFAULT '[]'::jsonb,
      corrective_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      performance_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      linked_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_crisis_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      event_title TEXT NOT NULL,
      severity TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'monitoring',
      communications JSONB NOT NULL DEFAULT '[]'::jsonb,
      stakeholders JSONB NOT NULL DEFAULT '[]'::jsonb,
      actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      escalations JSONB NOT NULL DEFAULT '[]'::jsonb,
      lessons_learned JSONB NOT NULL DEFAULT '[]'::jsonb,
      opened_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_dependencies (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      dependency_kind TEXT NOT NULL,
      criticality TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_resilience_scenarios (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      critical_service_id TEXT,
      disruption_scenario TEXT NOT NULL,
      impact_tolerance_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      operational_capacity_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      recovery_capability_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      resilience_rating NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      dora_scenario BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_compliance_mappings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework_code TEXT NOT NULL,
      framework_name TEXT NOT NULL,
      mapped_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      mapped_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      mapped_recovery_plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      mapped_finding_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework_code)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bcm_reports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      generated_by TEXT NOT NULL,
      summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_bia_workspace ON bcm_bia_processes (workspace_id, criticality, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_services_workspace ON bcm_critical_services (workspace_id, criticality, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_plans_workspace ON bcm_recovery_plans (workspace_id, status, next_review_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_exercises_workspace ON bcm_exercises (workspace_id, exercise_date DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_crisis_workspace ON bcm_crisis_events (workspace_id, severity, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_dependencies_workspace ON bcm_dependencies (workspace_id, source_type, target_type)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bcm_scenarios_workspace ON bcm_resilience_scenarios (workspace_id, status)`);
}

export async function seedBcmDefaults(workspaceId: string): Promise<void> {
  const existing = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM bcm_bia_processes WHERE workspace_id = $1`, [workspaceId]);
  if (Number(existing.rows[0]?.count || 0) > 0) {
    return;
  }

  const processRows: Array<Partial<BiaProcessRecord>> = [
    {
      id: generateId('bia'),
      processName: 'Customer Payment Processing',
      processOwner: 'Finance Operations',
      businessUnit: 'Finance',
      criticality: 'critical',
      impactRating: 'severe',
      recoveryPriority: 'tier_1',
      productsServices: ['Card payments', 'Settlement operations'],
      dependencies: ['ERP finance workflows', 'Card acquiring network'],
      supportingAssets: ['Finance ERP System', 'Customer Data Warehouse'],
      supportingVendors: ['SAP SE', 'Verizon Enterprise'],
      supportingApplications: ['Finance ERP System', 'Payment Gateway'],
      rtoHours: 4,
      rpoHours: 1,
      maximumTolerableDowntimeHours: 8,
      maximumDataLossHours: 2,
      currentRecoveryTimeHours: 5,
      currentDataRecoveryHours: 2,
      status: 'active',
      linkedRiskIds: ['RSK-001', 'RSK-002'],
      linkedControlIds: ['CTR-010', 'CTR-011'],
      linkedEvidenceIds: ['EVD-010'],
      linkedVendorIds: ['VND-001'],
      linkedAssetIds: ['AST-001'],
      linkedFindingIds: ['FND-BCM-001'],
    },
    {
      id: generateId('bia'),
      processName: 'Identity and Workforce Access',
      processOwner: 'Security Operations',
      businessUnit: 'IT',
      criticality: 'high',
      impactRating: 'major',
      recoveryPriority: 'tier_1',
      productsServices: ['SSO access', 'MFA verification'],
      dependencies: ['Identity provider', 'Admin workflows'],
      supportingAssets: ['Microsoft 365 Suite', 'Endpoint Security'],
      supportingVendors: ['Microsoft Corporation', 'CrowdStrike Inc'],
      supportingApplications: ['Identity Platform', 'Access Review Console'],
      rtoHours: 6,
      rpoHours: 2,
      maximumTolerableDowntimeHours: 12,
      maximumDataLossHours: 4,
      currentRecoveryTimeHours: 7,
      currentDataRecoveryHours: 2,
      status: 'active',
      linkedRiskIds: ['RSK-002'],
      linkedControlIds: ['CTR-005', 'CTR-006'],
      linkedEvidenceIds: ['EVD-004'],
      linkedVendorIds: ['VND-004'],
      linkedAssetIds: ['AST-006'],
      linkedFindingIds: [],
    },
    {
      id: generateId('bia'),
      processName: 'Regulatory Reporting and Board Governance',
      processOwner: 'GRC Office',
      businessUnit: 'Compliance',
      criticality: 'high',
      impactRating: 'major',
      recoveryPriority: 'tier_2',
      productsServices: ['Board packs', 'Regulatory obligations'],
      dependencies: ['Reporting center', 'Activity ledger'],
      supportingAssets: ['Document Repository'],
      supportingVendors: ['EY (Ernst & Young)'],
      supportingApplications: ['Executive Reporting Center', 'Regulatory Change Management'],
      rtoHours: 12,
      rpoHours: 4,
      maximumTolerableDowntimeHours: 24,
      maximumDataLossHours: 8,
      currentRecoveryTimeHours: 10,
      currentDataRecoveryHours: 3,
      status: 'active',
      linkedRiskIds: ['RSK-003'],
      linkedControlIds: ['CTR-016'],
      linkedEvidenceIds: ['EVD-018'],
      linkedVendorIds: ['VND-008'],
      linkedAssetIds: ['AST-011'],
      linkedFindingIds: ['FND-BCM-002'],
    },
  ];

  for (const row of processRows) {
    await createBiaProcess(workspaceId, row);
  }

  const planTechnology = await createRecoveryPlan(workspaceId, {
    planType: 'technology_recovery',
    title: 'Core Platform Technology Recovery Plan',
    objectives: ['Restore customer-facing GRC workflows within agreed RTO', 'Recover enterprise data services and reporting pipelines'],
    steps: ['Declare incident bridge', 'Fail over application services', 'Validate data integrity', 'Restore integrations'],
    owners: ['Platform Engineering', 'Security Operations'],
    dependencies: ['Cloud hosting', 'Identity services', 'Database recovery runbook'],
    recoverySites: ['Primary EU site', 'Warm standby UK site'],
    recoveryTeams: ['Platform SRE', 'DBA', 'Identity Security'],
    supportingAssets: ['Microsoft 365 Suite', 'Customer Data Warehouse'],
    supportingVendors: ['Microsoft Corporation', 'CrowdStrike Inc'],
    supportingApplications: ['Executive Reporting Center', 'Risk Intelligence'],
    targetRtoHours: 4,
    currentRtoHours: 5,
    targetRpoHours: 1,
    currentRpoHours: 2,
    maximumTolerableDowntimeHours: 8,
    recoveryReadinessPercent: 78,
    status: 'approved',
    lastReviewedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    lastTestedAt: new Date(Date.now() - 21 * 86400000).toISOString(),
    nextReviewAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  });

  const planVendor = await createRecoveryPlan(workspaceId, {
    planType: 'vendor_failure',
    title: 'Critical Third-Party Vendor Failure Playbook',
    objectives: ['Maintain continuity during SaaS failure', 'Switch to contingency workflows and alternate providers'],
    steps: ['Assess vendor outage severity', 'Activate alternate process', 'Notify stakeholders', 'Review contractual escalation path'],
    owners: ['Third-Party Risk Office', 'Business Continuity Lead'],
    dependencies: ['Vendor contact tree', 'Escalation workflow'],
    recoverySites: ['Primary operations office'],
    recoveryTeams: ['Vendor Management', 'Legal', 'Operations'],
    supportingAssets: ['Finance ERP System'],
    supportingVendors: ['SAP SE', 'Verizon Enterprise'],
    supportingApplications: ['Vendor Risk Console'],
    targetRtoHours: 8,
    currentRtoHours: 10,
    targetRpoHours: 2,
    currentRpoHours: 3,
    maximumTolerableDowntimeHours: 16,
    recoveryReadinessPercent: 71,
    status: 'in_review',
    lastReviewedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    lastTestedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    nextReviewAt: new Date(Date.now() + 20 * 86400000).toISOString(),
  });

  const serviceFinance = await createCriticalService(workspaceId, {
    serviceName: 'Card Payment Settlement Service',
    owner: 'Head of Finance Operations',
    businessUnit: 'Finance',
    criticality: 'critical',
    supportingAssets: ['Finance ERP System', 'Customer Data Warehouse'],
    supportingVendors: ['SAP SE', 'Verizon Enterprise'],
    supportingApplications: ['Payment Gateway', 'Finance ERP System'],
    recoveryPlanId: planTechnology.id,
    status: 'active',
    impactToleranceHours: 8,
    recoveryCoveragePercent: 82,
    doraRelevant: true,
  });

  const serviceIdentity = await createCriticalService(workspaceId, {
    serviceName: 'Enterprise Identity and Access Service',
    owner: 'Director of Security Operations',
    businessUnit: 'IT',
    criticality: 'critical',
    supportingAssets: ['Microsoft 365 Suite', 'Endpoint Security'],
    supportingVendors: ['Microsoft Corporation', 'CrowdStrike Inc'],
    supportingApplications: ['Identity Platform', 'Admin Security Settings'],
    recoveryPlanId: planTechnology.id,
    status: 'active',
    impactToleranceHours: 12,
    recoveryCoveragePercent: 77,
    doraRelevant: true,
  });

  await createExercise(workspaceId, {
    exerciseType: 'tabletop',
    title: 'Quarterly ransomware tabletop',
    exerciseDate: new Date(Date.now() - 6 * 86400000).toISOString(),
    participants: ['Security Operations', 'Platform Engineering', 'Communications Lead'],
    scenario: 'Ransomware affects identity and collaboration services during month-end close.',
    resultSummary: 'Escalation and executive briefing performed well; backup verification lag identified.',
    findings: ['Standby communications list outdated', 'Vendor escalation matrix needs refresh'],
    lessonsLearned: ['Run monthly contact verification', 'Increase recovery evidence collection'],
    correctiveActions: ['Refresh crisis contact tree', 'Automate backup integrity reporting'],
    performanceScore: 74,
    status: 'completed',
    linkedPlanIds: [planTechnology.id],
  });

  await createExercise(workspaceId, {
    exerciseType: 'vendor_exercise',
    title: 'Critical vendor settlement outage simulation',
    exerciseDate: new Date(Date.now() + 12 * 86400000).toISOString(),
    participants: ['Vendor Management', 'Finance Operations', 'BCM Lead'],
    scenario: 'Settlement service unavailable for 10 hours with degraded vendor communications.',
    resultSummary: 'Scheduled validation of fallback clearing process.',
    findings: ['Secondary approval chain not fully documented'],
    lessonsLearned: ['Need tighter dependency mapping on settlement workflows'],
    correctiveActions: ['Update fallback procedures', 'Train alternate approvers'],
    performanceScore: 0,
    status: 'planned',
    linkedPlanIds: [planVendor.id],
  });

  await createCrisisEvent(workspaceId, {
    eventTitle: 'Regional connectivity disruption monitoring',
    severity: 'high',
    owner: 'BCM Duty Manager',
    status: 'monitoring',
    communications: ['Situation room opened', 'Executive standby notice issued'],
    stakeholders: ['Executive Leadership', 'Technology Operations', 'Customer Support'],
    actions: ['Review provider status page', 'Assess impact to critical services'],
    escalations: ['Escalate to crisis management if outage exceeds tolerance'],
    lessonsLearned: [],
    openedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  });

  await createDependency(workspaceId, {
    sourceType: 'process',
    sourceId: processRows[0].id,
    sourceName: processRows[0].processName,
    targetType: 'application',
    targetId: 'app-finance-erp',
    targetName: 'Finance ERP System',
    dependencyKind: 'process_application',
    criticality: 'critical',
    status: 'active',
  });
  await createDependency(workspaceId, {
    sourceType: 'application',
    sourceId: 'app-finance-erp',
    sourceName: 'Finance ERP System',
    targetType: 'asset',
    targetId: 'AST-001',
    targetName: 'Finance ERP System',
    dependencyKind: 'application_asset',
    criticality: 'critical',
    status: 'active',
  });
  await createDependency(workspaceId, {
    sourceType: 'asset',
    sourceId: 'AST-001',
    sourceName: 'Finance ERP System',
    targetType: 'vendor',
    targetId: 'VND-001',
    targetName: 'SAP SE',
    dependencyKind: 'asset_vendor',
    criticality: 'high',
    status: 'active',
  });
  await createDependency(workspaceId, {
    sourceType: 'vendor',
    sourceId: 'VND-001',
    sourceName: 'SAP SE',
    targetType: 'recovery_plan',
    targetId: planVendor.id,
    targetName: planVendor.title,
    dependencyKind: 'process_plan',
    criticality: 'high',
    status: 'active',
  });

  await createResilienceScenario(workspaceId, {
    title: 'DORA ICT concentration event',
    criticalServiceId: serviceFinance.id,
    disruptionScenario: 'Major ICT supplier disruption affects payment workflows and board reporting cadence.',
    impactToleranceHours: 8,
    operationalCapacityPercent: 72,
    recoveryCapabilityPercent: 76,
    resilienceRating: 74,
    status: 'active',
    doraScenario: true,
  });

  await createResilienceScenario(workspaceId, {
    title: 'Identity platform ransomware disruption',
    criticalServiceId: serviceIdentity.id,
    disruptionScenario: 'Identity service disruption blocks workforce access and approval actions.',
    impactToleranceHours: 12,
    operationalCapacityPercent: 68,
    recoveryCapabilityPercent: 79,
    resilienceRating: 73,
    status: 'active',
    doraScenario: true,
  });

  await createComplianceMapping(workspaceId, {
    frameworkCode: 'ISO22301',
    frameworkName: 'ISO 22301',
    mappedControlIds: ['CTR-010', 'CTR-011', 'CTR-016'],
    mappedEvidenceIds: ['EVD-010', 'EVD-018'],
    mappedRecoveryPlanIds: [planTechnology.id, planVendor.id],
    mappedFindingIds: ['FND-BCM-001'],
    coveragePercent: 79,
    status: 'active',
  });
  await createComplianceMapping(workspaceId, {
    frameworkCode: 'DORA',
    frameworkName: 'DORA',
    mappedControlIds: ['CTR-018', 'CTR-020'],
    mappedEvidenceIds: ['EVD-013'],
    mappedRecoveryPlanIds: [planTechnology.id],
    mappedFindingIds: ['FND-DORA-001'],
    coveragePercent: 71,
    status: 'active',
  });
  await createComplianceMapping(workspaceId, {
    frameworkCode: 'NIST',
    frameworkName: 'NIST',
    mappedControlIds: ['CTR-005', 'CTR-006', 'CTR-014'],
    mappedEvidenceIds: ['EVD-004', 'EVD-011'],
    mappedRecoveryPlanIds: [planTechnology.id],
    mappedFindingIds: [],
    coveragePercent: 76,
    status: 'active',
  });
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
      id, workspace_id, service_name, owner, business_unit, criticality, supporting_assets, supporting_vendors,
      supporting_applications, recovery_plan_id, status, impact_tolerance_hours, recovery_coverage_percent, dora_relevant
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14
    ) RETURNING *`,
    [
      input.id || generateId('bcmsvc'),
      workspaceId,
      input.serviceName,
      input.owner,
      input.businessUnit,
      input.criticality || 'high',
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

export async function createRecoveryPlan(workspaceId: string, input: Partial<RecoveryPlanRecord>): Promise<RecoveryPlanRecord> {
  const result = await query(
    `INSERT INTO bcm_recovery_plans (
      id, workspace_id, plan_type, title, objectives, steps, owners, dependencies, recovery_sites, recovery_teams,
      supporting_assets, supporting_vendors, supporting_applications, target_rto_hours, current_rto_hours, target_rpo_hours,
      current_rpo_hours, maximum_tolerable_downtime_hours, recovery_readiness_percent, status, last_reviewed_at,
      last_tested_at, next_review_at, approved_at
    ) VALUES (
      $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,
      $11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
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
    ],
  );
  return mapRecoveryPlan(result.rows[0] as AnyRow);
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
      input.performanceScore || 0,
      input.status || 'completed',
      JSON.stringify(input.linkedPlanIds || []),
    ],
  );
  return mapExercise(result.rows[0] as AnyRow);
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

  const recoveryReadiness = plans.length ? Math.round(plans.reduce((sum, plan) => sum + plan.recoveryReadinessPercent, 0) / plans.length) : 0;
  const testingStatus = exercises.length
    ? Math.round(exercises.filter((exercise) => exercise.status === 'completed').length / exercises.length * 100)
    : 0;
  const recoveryCoverage = services.length
    ? Math.round(services.reduce((sum, service) => sum + service.recoveryCoveragePercent, 0) / services.length)
    : 0;
  const resilienceScore = scenarios.length
    ? Math.round((recoveryReadiness + testingStatus + recoveryCoverage + Math.round(scenarios.reduce((sum, item) => sum + item.resilienceRating, 0) / scenarios.length)) / 4)
    : Math.round((recoveryReadiness + testingStatus + recoveryCoverage) / 3 || 0);

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
