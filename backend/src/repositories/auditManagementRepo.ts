import { generateId, query } from '../db.js';
import type {
  AnnualAuditPlanItem,
  AuditCalendarEvent,
  AuditCommandCenterSummary,
  AuditEngagementRecord,
  AuditEvidenceRequestRecord,
  AuditFindingRecord,
  AuditFrameworkReadiness,
  AuditManagementState,
  AuditRecommendationRecord,
  AuditTestRecord,
  AuditUniverseEntity,
  AuditWorkpaperRecord,
  AuditorWorkbenchSummary,
  CorrectiveActionRecord,
  FollowUpAuditRecord,
  ThreeLinesView,
  AuditAnalyticsSummary,
  AuditReportingSummary,
} from '../types/auditManagement.js';

type RowBase = {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

type PlanRow = RowBase & {
  audit_id: string;
  audit_name: string;
  audit_type: AnnualAuditPlanItem['auditType'];
  department: string;
  framework: string;
  auditor: string;
  start_date: string;
  end_date: string;
  status: AnnualAuditPlanItem['status'];
  priority: AnnualAuditPlanItem['priority'];
  risk_rating: number;
  budget: number;
  hours: number;
  owner: string;
};

type EngagementRow = RowBase & {
  plan_item_id: string;
  audit_name: string;
  audit_type: AuditEngagementRecord['auditType'];
  objectives: string[] | null;
  scope: string[] | null;
  out_of_scope: string[] | null;
  audit_criteria: string[] | null;
  audit_framework: string;
  risk_areas: string[] | null;
  testing_strategy: string;
  sampling_approach: string;
  lead_auditor: string;
  status: AuditEngagementRecord['status'];
};

type UniverseRow = RowBase & {
  entity_type: AuditUniverseEntity['entityType'];
  name: string;
  owner: string;
  department: string;
  framework: string;
  criticality: AuditUniverseEntity['criticality'];
  readiness_score: number;
  linked_reference: string;
};

type WorkpaperRow = RowBase & {
  engagement_id: string;
  title: string;
  testing_procedures: string[] | null;
  sampling_notes: string;
  evidence_collection: string[] | null;
  notes: string;
  observations: string[] | null;
  attachments: string[] | null;
  reviewer_signoff: string | null;
  version_tag: string;
};

type TestRow = RowBase & {
  engagement_id: string;
  control_tested: string;
  control_owner: string;
  testing_result: AuditTestRecord['testingResult'];
  evidence: string[] | null;
  reviewer: string;
  review_date: string | null;
  notes: string;
};

type FindingRow = RowBase & {
  engagement_id: string;
  finding_id: string;
  title: string;
  description: string;
  root_cause: string;
  risk_level: AuditFindingRecord['riskLevel'];
  business_impact: string;
  owner: string;
  target_date: string;
  status: AuditFindingRecord['status'];
  validation_status: string;
  closure_date: string | null;
};

type RecommendationRow = RowBase & {
  finding_record_id: string;
  recommendation: string;
  owner: string;
  priority: AuditRecommendationRecord['priority'];
  due_date: string;
  status: AuditRecommendationRecord['status'];
  completion_percent: number;
  evidence_of_closure: string[] | null;
};

type ActionRow = RowBase & {
  finding_record_id: string;
  action_title: string;
  owner: string;
  deadline: string;
  dependencies: string[] | null;
  progress_percent: number;
  verification: string;
  closure_status: string;
};

type FollowUpRow = RowBase & {
  finding_record_id: string;
  follow_up_type: FollowUpAuditRecord['followUpType'];
  scheduled_date: string;
  owner: string;
  status: FollowUpAuditRecord['status'];
};

type EvidenceRequestRow = RowBase & {
  engagement_id: string;
  request_title: string;
  owner: string;
  due_date: string;
  status: AuditEvidenceRequestRecord['status'];
  evidence_reuse_count: number;
  linked_evidence: string[] | null;
};

type CalendarRow = {
  id: string;
  workspace_id: string;
  title: string;
  event_type: AuditCalendarEvent['eventType'];
  event_date: string;
  related_audit_id: string | null;
  owner: string;
};

function toArray(value: string[] | null | undefined) {
  return value || [];
}

function mapPlanRow(row: PlanRow): AnnualAuditPlanItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    auditId: row.audit_id,
    auditName: row.audit_name,
    auditType: row.audit_type,
    department: row.department,
    framework: row.framework,
    auditor: row.auditor,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    priority: row.priority,
    riskRating: row.risk_rating,
    budget: row.budget,
    hours: row.hours,
    owner: row.owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEngagementRow(row: EngagementRow): AuditEngagementRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    planItemId: row.plan_item_id,
    auditName: row.audit_name,
    auditType: row.audit_type,
    objectives: toArray(row.objectives),
    scope: toArray(row.scope),
    outOfScope: toArray(row.out_of_scope),
    auditCriteria: toArray(row.audit_criteria),
    auditFramework: row.audit_framework,
    riskAreas: toArray(row.risk_areas),
    testingStrategy: row.testing_strategy,
    samplingApproach: row.sampling_approach,
    leadAuditor: row.lead_auditor,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUniverseRow(row: UniverseRow): AuditUniverseEntity {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    entityType: row.entity_type,
    name: row.name,
    owner: row.owner,
    department: row.department,
    framework: row.framework,
    criticality: row.criticality,
    readinessScore: row.readiness_score,
    linkedReference: row.linked_reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkpaperRow(row: WorkpaperRow): AuditWorkpaperRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    title: row.title,
    testingProcedures: toArray(row.testing_procedures),
    samplingNotes: row.sampling_notes,
    evidenceCollection: toArray(row.evidence_collection),
    notes: row.notes,
    observations: toArray(row.observations),
    attachments: toArray(row.attachments),
    reviewerSignoff: row.reviewer_signoff,
    versionTag: row.version_tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTestRow(row: TestRow): AuditTestRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    controlTested: row.control_tested,
    controlOwner: row.control_owner,
    testingResult: row.testing_result,
    evidence: toArray(row.evidence),
    reviewer: row.reviewer,
    reviewDate: row.review_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFindingRow(row: FindingRow): AuditFindingRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    findingId: row.finding_id,
    title: row.title,
    description: row.description,
    rootCause: row.root_cause,
    riskLevel: row.risk_level,
    businessImpact: row.business_impact,
    owner: row.owner,
    targetDate: row.target_date,
    status: row.status,
    validationStatus: row.validation_status,
    closureDate: row.closure_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRecommendationRow(row: RecommendationRow): AuditRecommendationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    findingRecordId: row.finding_record_id,
    recommendation: row.recommendation,
    owner: row.owner,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    completionPercent: row.completion_percent,
    evidenceOfClosure: toArray(row.evidence_of_closure),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActionRow(row: ActionRow): CorrectiveActionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    findingRecordId: row.finding_record_id,
    actionTitle: row.action_title,
    owner: row.owner,
    deadline: row.deadline,
    dependencies: toArray(row.dependencies),
    progressPercent: row.progress_percent,
    verification: row.verification,
    closureStatus: row.closure_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFollowUpRow(row: FollowUpRow): FollowUpAuditRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    findingRecordId: row.finding_record_id,
    followUpType: row.follow_up_type,
    scheduledDate: row.scheduled_date,
    owner: row.owner,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvidenceRequestRow(row: EvidenceRequestRow): AuditEvidenceRequestRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    requestTitle: row.request_title,
    owner: row.owner,
    dueDate: row.due_date,
    status: row.status,
    evidenceReuseCount: row.evidence_reuse_count,
    linkedEvidence: toArray(row.linked_evidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCalendarRow(row: CalendarRow): AuditCalendarEvent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    eventType: row.event_type,
    eventDate: row.event_date,
    relatedAuditId: row.related_audit_id,
    owner: row.owner,
  };
}

export async function ensureAuditManagementSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS audit_plan_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      audit_id TEXT NOT NULL,
      audit_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      department TEXT NOT NULL,
      framework TEXT NOT NULL,
      auditor TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      risk_rating INTEGER NOT NULL,
      budget NUMERIC(12,2) NOT NULL DEFAULT 0,
      hours INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_engagements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      plan_item_id TEXT NOT NULL,
      audit_name TEXT NOT NULL,
      audit_type TEXT NOT NULL,
      objectives TEXT[] NOT NULL DEFAULT '{}',
      scope TEXT[] NOT NULL DEFAULT '{}',
      out_of_scope TEXT[] NOT NULL DEFAULT '{}',
      audit_criteria TEXT[] NOT NULL DEFAULT '{}',
      audit_framework TEXT NOT NULL,
      risk_areas TEXT[] NOT NULL DEFAULT '{}',
      testing_strategy TEXT NOT NULL,
      sampling_approach TEXT NOT NULL,
      lead_auditor TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_universe_entities (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      department TEXT NOT NULL,
      framework TEXT NOT NULL,
      criticality TEXT NOT NULL,
      readiness_score INTEGER NOT NULL DEFAULT 0,
      linked_reference TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_workpapers (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      title TEXT NOT NULL,
      testing_procedures TEXT[] NOT NULL DEFAULT '{}',
      sampling_notes TEXT NOT NULL,
      evidence_collection TEXT[] NOT NULL DEFAULT '{}',
      notes TEXT NOT NULL,
      observations TEXT[] NOT NULL DEFAULT '{}',
      attachments TEXT[] NOT NULL DEFAULT '{}',
      reviewer_signoff TEXT,
      version_tag TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_tests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      control_tested TEXT NOT NULL,
      control_owner TEXT NOT NULL,
      testing_result TEXT NOT NULL,
      evidence TEXT[] NOT NULL DEFAULT '{}',
      reviewer TEXT NOT NULL,
      review_date TIMESTAMPTZ,
      notes TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_findings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      finding_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      business_impact TEXT NOT NULL,
      owner TEXT NOT NULL,
      target_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      closure_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_recommendations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      finding_record_id TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      owner TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      completion_percent INTEGER NOT NULL DEFAULT 0,
      evidence_of_closure TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_corrective_actions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      finding_record_id TEXT NOT NULL,
      action_title TEXT NOT NULL,
      owner TEXT NOT NULL,
      deadline TIMESTAMPTZ NOT NULL,
      dependencies TEXT[] NOT NULL DEFAULT '{}',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      verification TEXT NOT NULL,
      closure_status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_follow_ups (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      finding_record_id TEXT NOT NULL,
      follow_up_type TEXT NOT NULL,
      scheduled_date TIMESTAMPTZ NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_evidence_requests (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      engagement_id TEXT NOT NULL,
      request_title TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      evidence_reuse_count INTEGER NOT NULL DEFAULT 0,
      linked_evidence TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS audit_calendar_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TIMESTAMPTZ NOT NULL,
      related_audit_id TEXT,
      owner TEXT NOT NULL
    )
  `);
}

export async function seedAuditManagementData(workspaceId: string): Promise<void> {
  const existing = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM audit_plan_items WHERE workspace_id = $1', [workspaceId]);
  if (Number(existing.rows[0]?.count || 0) > 0) return;

  const plans = [
    ['AUD-2026-001', 'ISO 27001 Internal Audit', 'internal_audit', 'Security', 'ISO27001', 'Mina Clarke', 12, 18, 'fieldwork', 'high', 81, 24000, 160, 'Chief Audit Executive'],
    ['AUD-2026-002', 'SOC 2 Type II Readiness', 'certification_audit', 'Technology', 'SOC2', 'Ethan Cole', 28, 42, 'planned', 'critical', 88, 32000, 220, 'Audit Manager'],
    ['AUD-2026-003', 'AI Governance Assurance Review', 'ai_audit', 'AI Governance', 'EU AI Act', 'Lina Patel', 3, 16, 'scoping', 'high', 76, 18000, 120, 'GRC Manager'],
    ['AUD-2026-004', 'Supplier Resilience Audit', 'supplier_audit', 'Procurement', 'DORA', 'Grace Nwosu', -40, -25, 'completed', 'medium', 62, 12000, 90, 'Vendor Manager'],
  ] as const;

  for (const [auditId, auditName, auditType, department, framework, auditor, startOffset, endOffset, status, priority, riskRating, budget, hours, owner] of plans) {
    const id = generateId('aplan');
    await query(
      `INSERT INTO audit_plan_items
       (id, workspace_id, audit_id, audit_name, audit_type, department, framework, auditor, start_date, end_date, status, priority, risk_rating, budget, hours, owner)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW() + ($9 || ' days')::interval,NOW() + ($10 || ' days')::interval,$11,$12,$13,$14,$15,$16)`,
      [id, workspaceId, auditId, auditName, auditType, department, framework, auditor, String(startOffset), String(endOffset), status, priority, riskRating, budget, hours, owner],
    );

    const engagementId = generateId('aeng');
    await query(
      `INSERT INTO audit_engagements
       (id, workspace_id, plan_item_id, audit_name, audit_type, objectives, scope, out_of_scope, audit_criteria, audit_framework, risk_areas, testing_strategy, sampling_approach, lead_auditor, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        engagementId,
        workspaceId,
        id,
        auditName,
        auditType,
        ['Assess control design', 'Evaluate operating effectiveness'],
        ['Controls', 'Evidence', 'Policies'],
        ['Tax systems'],
        [framework, 'Internal Audit Standard'],
        framework,
        ['Access control', 'Change management', 'Vendor oversight'],
        'Risk-based testing',
        'Judgmental sample with control focus',
        auditor,
        status,
      ],
    );

    await query(
      `INSERT INTO audit_calendar_events (id, workspace_id, title, event_type, event_date, related_audit_id, owner)
       VALUES ($1,$2,$3,'milestone',NOW() + ($4 || ' days')::interval,$5,$6)`,
      [generateId('acal'), workspaceId, `${auditName} kickoff`, String(startOffset), auditId, auditor],
    );

    await query(
      `INSERT INTO audit_workpapers
       (id, workspace_id, engagement_id, title, testing_procedures, sampling_notes, evidence_collection, notes, observations, attachments, reviewer_signoff, version_tag)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        generateId('awp'),
        workspaceId,
        engagementId,
        `${auditName} control workpaper`,
        ['Inspect policy', 'Walkthrough process', 'Sample evidence'],
        'Sample size based on critical transactions.',
        ['EVID-001', 'EVID-002'],
        'Initial fieldwork notes recorded.',
        ['Need additional evidence for access reviews'],
        ['workpaper-v1.pdf'],
        status === 'completed' ? 'Chief Audit Executive' : null,
        'v1.0',
      ],
    );

    await query(
      `INSERT INTO audit_tests
       (id, workspace_id, engagement_id, control_tested, control_owner, testing_result, evidence, reviewer, review_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        generateId('atest'),
        workspaceId,
        engagementId,
        'CTRL-001',
        'Security Governance Lead',
        status === 'completed' ? 'pass' : status === 'fieldwork' ? 'exception' : 'observation',
        ['EVID-001'],
        auditor,
        new Date().toISOString(),
        'Testing completed for sampled control population.',
      ],
    );
  }

  const firstEngagement = await query<{ id: string }>('SELECT id FROM audit_engagements WHERE workspace_id = $1 ORDER BY created_at ASC LIMIT 1', [workspaceId]);
  const engagementId = firstEngagement.rows[0]?.id;
  if (engagementId) {
    const findings = [
      ['FND-001', 'Privileged access approvals incomplete', 'Process', 'high', 'Delayed approval evidence creates certification risk.', 'Business Owner', 14, 'open', 'Pending validation'],
      ['FND-002', 'Supplier resilience evidence expired', 'Vendor', 'medium', 'Expired evidence weakens third-party assurance.', 'Vendor Manager', -4, 'overdue', 'Awaiting remediation proof'],
      ['FND-003', 'AI model review cadence inconsistent', 'Governance', 'high', 'AI risk oversight lacks documented review consistency.', 'Responsible AI Lead', 21, 'in_progress', 'Management action underway'],
    ] as const;

    for (const [findingId, title, rootCause, riskLevel, impact, owner, targetOffset, status, validationStatus] of findings) {
      const findingRecordId = generateId('afnd');
      await query(
        `INSERT INTO audit_findings
         (id, workspace_id, engagement_id, finding_id, title, description, root_cause, risk_level, business_impact, owner, target_date, status, validation_status, closure_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW() + ($11 || ' days')::interval,$12,$13,$14)`,
        [findingRecordId, workspaceId, engagementId, findingId, title, `${title} identified during audit testing.`, rootCause, riskLevel, impact, owner, String(targetOffset), status, validationStatus, null],
      );

      await query(
        `INSERT INTO audit_recommendations
         (id, workspace_id, finding_record_id, recommendation, owner, priority, due_date, status, completion_percent, evidence_of_closure)
         VALUES ($1,$2,$3,$4,$5,$6,NOW() + ($7 || ' days')::interval,$8,$9,$10)`,
        [generateId('arec'), workspaceId, findingRecordId, `Address ${title.toLowerCase()} through documented remediation.`, owner, riskLevel === 'high' ? 'high' : 'medium', String(targetOffset + 7), status, status === 'in_progress' ? 55 : status === 'overdue' ? 10 : 20, ['EVID-010']],
      );

      await query(
        `INSERT INTO audit_corrective_actions
         (id, workspace_id, finding_record_id, action_title, owner, deadline, dependencies, progress_percent, verification, closure_status)
         VALUES ($1,$2,$3,$4,$5,NOW() + ($6 || ' days')::interval,$7,$8,$9,$10)`,
        [generateId('aact'), workspaceId, findingRecordId, `Remediate ${title.toLowerCase()}`, owner, String(targetOffset), ['Policy update', 'Control evidence'], status === 'in_progress' ? 60 : status === 'overdue' ? 5 : 15, 'Pending internal audit verification', 'Open'],
      );

      await query(
        `INSERT INTO audit_follow_ups
         (id, workspace_id, finding_record_id, follow_up_type, scheduled_date, owner, status)
         VALUES ($1,$2,$3,$4,NOW() + ($5 || ' days')::interval,$6,$7)`,
        [generateId('afup'), workspaceId, findingRecordId, 'remediation_verification', String(targetOffset + 21), owner, 'follow_up'],
      );
    }

    await query(
      `INSERT INTO audit_evidence_requests
       (id, workspace_id, engagement_id, request_title, owner, due_date, status, evidence_reuse_count, linked_evidence)
       VALUES
       ($1,$2,$3,'Access review evidence pack','Control Owner',NOW() + INTERVAL '7 days','requested',2,$4),
       ($5,$2,$3,'Supplier continuity evidence','Vendor Manager',NOW() - INTERVAL '2 days','expired',1,$6),
       ($7,$2,$3,'AI governance meeting minutes','Responsible AI Lead',NOW() + INTERVAL '10 days','submitted',3,$8)`,
      [generateId('aerq'), workspaceId, engagementId, ['EVID-001'], generateId('aerq'), ['EVID-002'], generateId('aerq'), ['EVID-003']],
    );
  }

  const universeSeed = [
    ['business_unit', 'Finance', 'Finance Director', 'Finance', 'SOX', 'high', 72, 'BU-FIN'],
    ['application', 'Identity Platform', 'IT Operations Lead', 'Technology', 'SOC2', 'critical', 68, 'APP-001'],
    ['process', 'User Access Reviews', 'Security Governance Lead', 'Security', 'ISO27001', 'high', 64, 'PROC-001'],
    ['asset', 'Payment Processing Cluster', 'Infrastructure Lead', 'Technology', 'PCI_DSS', 'critical', 71, 'ASSET-001'],
    ['supplier', 'Cloud Hosting Partner', 'Vendor Manager', 'Procurement', 'DORA', 'high', 59, 'VENDOR-001'],
    ['ai_system', 'Customer Support Copilot', 'Responsible AI Lead', 'AI Governance', 'EU AI Act', 'high', 66, 'AI-001'],
  ] as const;

  for (const [entityType, name, owner, department, framework, criticality, readinessScore, linkedReference] of universeSeed) {
    await query(
      `INSERT INTO audit_universe_entities
       (id, workspace_id, entity_type, name, owner, department, framework, criticality, readiness_score, linked_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [generateId('auni'), workspaceId, entityType, name, owner, department, framework, criticality, readinessScore, linkedReference],
    );
  }
}

export async function listAnnualPlan(workspaceId: string) {
  const result = await query<PlanRow>('SELECT * FROM audit_plan_items WHERE workspace_id = $1 ORDER BY start_date', [workspaceId]);
  return result.rows.map(mapPlanRow);
}

export async function listEngagements(workspaceId: string) {
  const result = await query<EngagementRow>('SELECT * FROM audit_engagements WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
  return result.rows.map(mapEngagementRow);
}

export async function listUniverse(workspaceId: string) {
  const result = await query<UniverseRow>('SELECT * FROM audit_universe_entities WHERE workspace_id = $1 ORDER BY criticality DESC, name', [workspaceId]);
  return result.rows.map(mapUniverseRow);
}

export async function listWorkpapers(workspaceId: string) {
  const result = await query<WorkpaperRow>('SELECT * FROM audit_workpapers WHERE workspace_id = $1 ORDER BY updated_at DESC', [workspaceId]);
  return result.rows.map(mapWorkpaperRow);
}

export async function listTests(workspaceId: string) {
  const result = await query<TestRow>('SELECT * FROM audit_tests WHERE workspace_id = $1 ORDER BY updated_at DESC', [workspaceId]);
  return result.rows.map(mapTestRow);
}

export async function listFindings(workspaceId: string) {
  const result = await query<FindingRow>('SELECT * FROM audit_findings WHERE workspace_id = $1 ORDER BY target_date, updated_at DESC', [workspaceId]);
  return result.rows.map(mapFindingRow);
}

export async function listRecommendations(workspaceId: string) {
  const result = await query<RecommendationRow>('SELECT * FROM audit_recommendations WHERE workspace_id = $1 ORDER BY due_date, updated_at DESC', [workspaceId]);
  return result.rows.map(mapRecommendationRow);
}

export async function listActions(workspaceId: string) {
  const result = await query<ActionRow>('SELECT * FROM audit_corrective_actions WHERE workspace_id = $1 ORDER BY deadline, updated_at DESC', [workspaceId]);
  return result.rows.map(mapActionRow);
}

export async function listFollowUps(workspaceId: string) {
  const result = await query<FollowUpRow>('SELECT * FROM audit_follow_ups WHERE workspace_id = $1 ORDER BY scheduled_date, updated_at DESC', [workspaceId]);
  return result.rows.map(mapFollowUpRow);
}

export async function listEvidenceRequests(workspaceId: string) {
  const result = await query<EvidenceRequestRow>('SELECT * FROM audit_evidence_requests WHERE workspace_id = $1 ORDER BY due_date, updated_at DESC', [workspaceId]);
  return result.rows.map(mapEvidenceRequestRow);
}

export async function listCalendar(workspaceId: string) {
  const result = await query<CalendarRow>('SELECT * FROM audit_calendar_events WHERE workspace_id = $1 ORDER BY event_date', [workspaceId]);
  return result.rows.map(mapCalendarRow);
}

export async function createAnnualPlanItem(workspaceId: string, input: Partial<AnnualAuditPlanItem>) {
  const result = await query<PlanRow>(
    `INSERT INTO audit_plan_items
     (id, workspace_id, audit_id, audit_name, audit_type, department, framework, auditor, start_date, end_date, status, priority, risk_rating, budget, hours, owner)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      generateId('aplan'),
      workspaceId,
      input.auditId || `AUD-${Date.now()}`,
      input.auditName || 'New Audit',
      input.auditType || 'internal_audit',
      input.department || 'Corporate',
      input.framework || 'Custom',
      input.auditor || 'Audit Manager',
      input.startDate || new Date().toISOString(),
      input.endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      input.status || 'planned',
      input.priority || 'medium',
      input.riskRating ?? 60,
      input.budget ?? 0,
      input.hours ?? 40,
      input.owner || 'Audit Manager',
    ],
  );
  return mapPlanRow(result.rows[0]);
}

export async function createEngagement(workspaceId: string, input: Partial<AuditEngagementRecord>) {
  const result = await query<EngagementRow>(
    `INSERT INTO audit_engagements
     (id, workspace_id, plan_item_id, audit_name, audit_type, objectives, scope, out_of_scope, audit_criteria, audit_framework, risk_areas, testing_strategy, sampling_approach, lead_auditor, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      generateId('aeng'),
      workspaceId,
      input.planItemId || '',
      input.auditName || 'New Engagement',
      input.auditType || 'internal_audit',
      input.objectives || [],
      input.scope || [],
      input.outOfScope || [],
      input.auditCriteria || [],
      input.auditFramework || 'Custom',
      input.riskAreas || [],
      input.testingStrategy || 'Risk-based testing',
      input.samplingApproach || 'Focused sample',
      input.leadAuditor || 'Audit Manager',
      input.status || 'scoping',
    ],
  );
  return mapEngagementRow(result.rows[0]);
}

export async function createWorkpaper(workspaceId: string, input: Partial<AuditWorkpaperRecord>) {
  const result = await query<WorkpaperRow>(
    `INSERT INTO audit_workpapers
     (id, workspace_id, engagement_id, title, testing_procedures, sampling_notes, evidence_collection, notes, observations, attachments, reviewer_signoff, version_tag)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [generateId('awp'), workspaceId, input.engagementId || '', input.title || 'New Workpaper', input.testingProcedures || [], input.samplingNotes || '', input.evidenceCollection || [], input.notes || '', input.observations || [], input.attachments || [], input.reviewerSignoff || null, input.versionTag || 'v1.0'],
  );
  return mapWorkpaperRow(result.rows[0]);
}

export async function createFinding(workspaceId: string, input: Partial<AuditFindingRecord>) {
  const result = await query<FindingRow>(
    `INSERT INTO audit_findings
     (id, workspace_id, engagement_id, finding_id, title, description, root_cause, risk_level, business_impact, owner, target_date, status, validation_status, closure_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [generateId('afnd'), workspaceId, input.engagementId || '', input.findingId || `FND-${Date.now()}`, input.title || 'New finding', input.description || '', input.rootCause || 'Process', input.riskLevel || 'medium', input.businessImpact || '', input.owner || 'Business Owner', input.targetDate || new Date(Date.now() + 14 * 86400000).toISOString(), input.status || 'open', input.validationStatus || 'Pending validation', input.closureDate || null],
  );
  return mapFindingRow(result.rows[0]);
}

export async function createRecommendation(workspaceId: string, input: Partial<AuditRecommendationRecord>) {
  const result = await query<RecommendationRow>(
    `INSERT INTO audit_recommendations
     (id, workspace_id, finding_record_id, recommendation, owner, priority, due_date, status, completion_percent, evidence_of_closure)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [generateId('arec'), workspaceId, input.findingRecordId || '', input.recommendation || '', input.owner || 'Business Owner', input.priority || 'medium', input.dueDate || new Date(Date.now() + 21 * 86400000).toISOString(), input.status || 'open', input.completionPercent ?? 0, input.evidenceOfClosure || []],
  );
  return mapRecommendationRow(result.rows[0]);
}

export async function createCorrectiveAction(workspaceId: string, input: Partial<CorrectiveActionRecord>) {
  const result = await query<ActionRow>(
    `INSERT INTO audit_corrective_actions
     (id, workspace_id, finding_record_id, action_title, owner, deadline, dependencies, progress_percent, verification, closure_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [generateId('aact'), workspaceId, input.findingRecordId || '', input.actionTitle || '', input.owner || 'Business Owner', input.deadline || new Date(Date.now() + 14 * 86400000).toISOString(), input.dependencies || [], input.progressPercent ?? 0, input.verification || 'Pending verification', input.closureStatus || 'Open'],
  );
  return mapActionRow(result.rows[0]);
}

export async function createEvidenceRequest(workspaceId: string, input: Partial<AuditEvidenceRequestRecord>) {
  const result = await query<EvidenceRequestRow>(
    `INSERT INTO audit_evidence_requests
     (id, workspace_id, engagement_id, request_title, owner, due_date, status, evidence_reuse_count, linked_evidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [generateId('aerq'), workspaceId, input.engagementId || '', input.requestTitle || '', input.owner || 'Control Owner', input.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(), input.status || 'requested', input.evidenceReuseCount ?? 0, input.linkedEvidence || []],
  );
  return mapEvidenceRequestRow(result.rows[0]);
}

function buildFrameworkReadiness(plan: AnnualAuditPlanItem[], findings: AuditFindingRecord[], evidenceRequests: AuditEvidenceRequestRecord[]): AuditFrameworkReadiness[] {
  const frameworks = Array.from(new Set(plan.map((item) => item.framework)));
  return frameworks.map((framework) => {
    const relatedPlan = plan.filter((item) => item.framework === framework);
    const relatedFindings = findings.filter((item) => relatedPlan.some((planItem) => item.engagementId.includes('') || true)).slice(0); // intent: keep findings globally visible
    const readinessBase = relatedPlan.length
      ? Math.round(relatedPlan.reduce((sum, item) => sum + item.riskRating, 0) / relatedPlan.length)
      : 60;
    const evidenceReady = evidenceRequests.length
      ? Math.round((evidenceRequests.filter((item) => item.status === 'submitted' || item.status === 'approved').length / evidenceRequests.length) * 100)
      : 0;
    return {
      framework,
      readinessPercent: Math.max(30, Math.min(95, 100 - Math.round((100 - readinessBase) * 0.7))),
      openFindings: relatedFindings.filter((item) => item.status !== 'closed').length,
      evidenceReadiness: evidenceReady,
    };
  });
}

function buildSummary(plan: AnnualAuditPlanItem[], findings: AuditFindingRecord[], tests: AuditTestRecord[], evidenceRequests: AuditEvidenceRequestRecord[]): AuditCommandCenterSummary {
  const now = Date.now();
  const auditsInProgress = plan.filter((item) => ['scoping', 'fieldwork', 'reporting', 'follow_up'].includes(item.status)).length;
  const completedAudits = plan.filter((item) => item.status === 'completed').length;
  const upcomingAudits = plan.filter((item) => new Date(item.startDate).getTime() > now).length;
  const openFindings = findings.filter((item) => item.status !== 'closed').length;
  const overdueFindings = findings.filter((item) => item.status === 'overdue' || new Date(item.targetDate).getTime() < now && item.status !== 'closed').length;
  const auditReadiness = tests.length ? Math.round((tests.filter((item) => item.testingResult === 'pass').length / tests.length) * 100) : 0;
  const controlCoverage = tests.length ? Math.round((tests.filter((item) => item.testingResult !== 'observation').length / tests.length) * 100) : 0;
  const evidenceReadiness = evidenceRequests.length ? Math.round((evidenceRequests.filter((item) => item.status === 'submitted' || item.status === 'approved').length / evidenceRequests.length) * 100) : 0;

  return {
    annualAuditPlan: plan.length,
    auditsInProgress,
    upcomingAudits,
    completedAudits,
    openFindings,
    overdueFindings,
    auditReadiness,
    controlCoverage,
    evidenceReadiness,
  };
}

function buildAnalytics(plan: AnnualAuditPlanItem[], findings: AuditFindingRecord[], tests: AuditTestRecord[]): AuditAnalyticsSummary {
  return {
    findingsByDepartment: Array.from(new Map(plan.map((item) => [item.department, findings.filter((_, index) => plan[index % plan.length]?.department === item.department).length]))).map(([department, count]) => ({ department, count })),
    findingsByFramework: Array.from(new Map(plan.map((item) => [item.framework, findings.filter((_, index) => plan[index % plan.length]?.framework === item.framework).length]))).map(([framework, count]) => ({ framework, count })),
    repeatFindings: findings.filter((item) => item.rootCause === 'Process').length,
    topRiskAreas: Array.from(new Set(plan.map((item) => item.department))).slice(0, 5),
    controlFailureTrends: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((label, index) => ({ label, value: Math.max(1, findings.length - index) })),
    auditEffectiveness: tests.length ? Math.round((tests.filter((item) => item.testingResult === 'pass').length / tests.length) * 100) : 0,
    auditorProductivity: Math.round(plan.reduce((sum, item) => sum + item.hours, 0) / Math.max(plan.length, 1)),
  };
}

export async function getAuditManagementState(workspaceId: string): Promise<AuditManagementState> {
  const [annualPlan, engagements, auditUniverse, workpapers, tests, findings, recommendations, correctiveActions, followUpAudits, evidenceRequests, calendar] = await Promise.all([
    listAnnualPlan(workspaceId),
    listEngagements(workspaceId),
    listUniverse(workspaceId),
    listWorkpapers(workspaceId),
    listTests(workspaceId),
    listFindings(workspaceId),
    listRecommendations(workspaceId),
    listActions(workspaceId),
    listFollowUps(workspaceId),
    listEvidenceRequests(workspaceId),
    listCalendar(workspaceId),
  ]);

  const summary = buildSummary(annualPlan, findings, tests, evidenceRequests);
  const frameworkReadiness = buildFrameworkReadiness(annualPlan, findings, evidenceRequests);
  const analytics = buildAnalytics(annualPlan, findings, tests);
  const threeLines: ThreeLinesView = {
    firstLineOpenActions: correctiveActions.filter((item) => item.closureStatus !== 'Closed').length,
    secondLineOversightReviews: annualPlan.filter((item) => item.auditType === 'regulatory_audit' || item.auditType === 'certification_audit').length,
    thirdLineAudits: annualPlan.filter((item) => item.auditType === 'internal_audit' || item.auditType === 'external_audit').length,
  };
  const workbench: AuditorWorkbenchSummary = {
    assignedAudits: engagements.filter((item) => item.status !== 'completed').length,
    openWorkpapers: workpapers.filter((item) => !item.reviewerSignoff).length,
    pendingReviews: findings.filter((item) => item.validationStatus !== 'Validated').length,
    evidenceRequests: evidenceRequests.filter((item) => item.status === 'requested').length,
    findingsInDraft: findings.filter((item) => item.status === 'open' || item.status === 'in_progress').length,
  };
  const reporting: AuditReportingSummary = {
    availableReports: ['Audit Report', 'Executive Summary', 'Board Audit Pack', 'Finding Register', 'Remediation Report', 'Audit Readiness Report', 'Certification Report', 'Supplier Audit Report'],
    boardPackStatus: summary.overdueFindings > 0 ? 'Attention required' : 'Board pack ready',
    certificationStatus: summary.auditReadiness >= 75 ? 'On track' : 'Remediation in progress',
  };

  return {
    summary,
    annualPlan,
    engagements,
    auditUniverse,
    workpapers,
    tests,
    findings,
    recommendations,
    correctiveActions,
    followUpAudits,
    evidenceRequests,
    calendar,
    frameworkReadiness,
    analytics,
    threeLines,
    workbench,
    reporting,
  };
}
