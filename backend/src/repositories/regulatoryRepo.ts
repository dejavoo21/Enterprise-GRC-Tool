import { generateId, query } from '../db.js';
import type {
  ChangeSeverity,
  ChangeType,
  ObligationStatus,
  ObligationType,
  RegulatoryChangeLogEntry,
  RegulatoryDashboardSummary,
  RegulatoryImpactAssessment,
  RegulatoryJurisdiction,
  RegulatoryMapping,
  RegulatoryObligation,
  RegulatoryRequirement,
  RegulatoryTask,
  RegulatoryWorkspaceState,
  RegulationStatus,
  ReviewStatus,
  TaskStatus,
} from '../types/regulatory.js';

type RowBase = {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

type RequirementRow = RowBase & {
  requirement_id: string;
  regulation_name: string;
  clause: string | null;
  article: string | null;
  section: string | null;
  title: string;
  description: string;
  jurisdiction: string;
  regulator: string;
  category: string;
  effective_date: string | null;
  review_date: string | null;
  status: RegulationStatus;
  owner: string;
  business_unit: string;
  compliance_rating: number;
  risk_rating: number;
  linked_controls: string[] | null;
  linked_policies: string[] | null;
  linked_risks: string[] | null;
  linked_evidence: string[] | null;
  framework_codes: string[] | null;
};

type ObligationRow = RowBase & {
  obligation_type: ObligationType;
  title: string;
  description: string;
  owner: string;
  due_date: string | null;
  status: ObligationStatus;
  review_frequency: string;
  compliance_evidence: string[] | null;
  linked_controls: string[] | null;
  linked_policies: string[] | null;
  linked_risks: string[] | null;
  source_requirement_id: string | null;
};

type ChangeRow = RowBase & {
  requirement_id: string | null;
  regulation_name: string;
  change_type: ChangeType;
  change_summary: string;
  impact_assessment: string;
  version_tag: string;
  reviewer: string;
  approval_status: ReviewStatus;
  severity: ChangeSeverity;
  change_date: string;
  affected_controls: string[] | null;
  affected_policies: string[] | null;
  affected_risks: string[] | null;
  affected_vendors: string[] | null;
  affected_assets: string[] | null;
  affected_ai_systems: string[] | null;
  required_actions: string[] | null;
};

type TaskRow = RowBase & {
  change_log_id: string | null;
  title: string;
  owner: string;
  due_date: string | null;
  status: TaskStatus;
  escalation: string | null;
  workflow_stage: string;
};

type JurisdictionRow = {
  id: string;
  workspace_id: string;
  country: string;
  region: string | null;
  state: string | null;
  industry: string | null;
  regulator: string;
  applicability: string;
  compliance_status: string;
};

type MappingRow = {
  id: string;
  workspace_id: string;
  regulation_name: string;
  requirement_id: string;
  control_id: string | null;
  evidence_id: string | null;
  risk_id: string | null;
  framework_code: string | null;
};

type ImpactRow = {
  id: string;
  workspace_id: string;
  change_log_id: string;
  impact_score: number;
  severity: ChangeSeverity;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  affected_controls: string[] | null;
  affected_policies: string[] | null;
  affected_risks: string[] | null;
  affected_vendors: string[] | null;
  affected_assets: string[] | null;
  affected_processes: string[] | null;
  affected_ai_systems: string[] | null;
  required_actions: string[] | null;
  completed_at: string;
};

const SUPPORTED_REGULATIONS = [
  { requirementId: 'ISO27001-A.5.1', regulationName: 'ISO 27001', jurisdiction: 'Global', regulator: 'ISO', category: 'Information Security', title: 'Policies for information security', frameworkCodes: ['ISO27001'], businessUnit: 'Information Security', owner: 'Security Governance Lead' },
  { requirementId: 'GDPR-ART-32', regulationName: 'GDPR', jurisdiction: 'EU', regulator: 'European Data Protection Board', category: 'Privacy', title: 'Security of processing', frameworkCodes: ['GDPR'], businessUnit: 'Privacy Office', owner: 'Data Protection Officer' },
  { requirementId: 'EUAIACT-ART-9', regulationName: 'EU AI Act', jurisdiction: 'EU', regulator: 'European Commission', category: 'AI Governance', title: 'Risk management system', frameworkCodes: ['EU_AI_ACT', 'ISO42001'], businessUnit: 'AI Governance', owner: 'Responsible AI Lead' },
  { requirementId: 'DORA-ART-6', regulationName: 'DORA', jurisdiction: 'EU', regulator: 'European Supervisory Authorities', category: 'Operational Resilience', title: 'ICT risk management framework', frameworkCodes: ['DORA'], businessUnit: 'Resilience', owner: 'Operational Resilience Manager' },
  { requirementId: 'NIS2-ART-21', regulationName: 'NIS2', jurisdiction: 'EU', regulator: 'National Cyber Authorities', category: 'Cybersecurity', title: 'Cybersecurity risk-management measures', frameworkCodes: ['NIS2', 'NIST_CSF'], businessUnit: 'Security Operations', owner: 'Security Operations Manager' },
  { requirementId: 'HIPAA-164.312', regulationName: 'HIPAA', jurisdiction: 'US', regulator: 'HHS', category: 'Healthcare Privacy', title: 'Technical safeguards', frameworkCodes: ['HIPAA'], businessUnit: 'Healthcare Compliance', owner: 'Compliance Director' },
];

function toArray(value: string[] | null | undefined) {
  return value || [];
}

function mapRequirement(row: RequirementRow): RegulatoryRequirement {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requirementId: row.requirement_id,
    regulationName: row.regulation_name,
    clause: row.clause,
    article: row.article,
    section: row.section,
    title: row.title,
    description: row.description,
    jurisdiction: row.jurisdiction,
    regulator: row.regulator,
    category: row.category,
    effectiveDate: row.effective_date,
    reviewDate: row.review_date,
    status: row.status,
    owner: row.owner,
    businessUnit: row.business_unit,
    complianceRating: row.compliance_rating,
    riskRating: row.risk_rating,
    linkedControls: toArray(row.linked_controls),
    linkedPolicies: toArray(row.linked_policies),
    linkedRisks: toArray(row.linked_risks),
    linkedEvidence: toArray(row.linked_evidence),
    frameworkCodes: toArray(row.framework_codes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObligation(row: ObligationRow): RegulatoryObligation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    obligationType: row.obligation_type,
    title: row.title,
    description: row.description,
    owner: row.owner,
    dueDate: row.due_date,
    status: row.status,
    reviewFrequency: row.review_frequency,
    complianceEvidence: toArray(row.compliance_evidence),
    linkedControls: toArray(row.linked_controls),
    linkedPolicies: toArray(row.linked_policies),
    linkedRisks: toArray(row.linked_risks),
    sourceRequirementId: row.source_requirement_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChange(row: ChangeRow): RegulatoryChangeLogEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requirementId: row.requirement_id,
    regulationName: row.regulation_name,
    changeType: row.change_type,
    changeSummary: row.change_summary,
    impactAssessment: row.impact_assessment,
    versionTag: row.version_tag,
    reviewer: row.reviewer,
    approvalStatus: row.approval_status,
    severity: row.severity,
    changeDate: row.change_date,
    affectedControls: toArray(row.affected_controls),
    affectedPolicies: toArray(row.affected_policies),
    affectedRisks: toArray(row.affected_risks),
    affectedVendors: toArray(row.affected_vendors),
    affectedAssets: toArray(row.affected_assets),
    affectedAiSystems: toArray(row.affected_ai_systems),
    requiredActions: toArray(row.required_actions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: TaskRow): RegulatoryTask {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    changeLogId: row.change_log_id,
    title: row.title,
    owner: row.owner,
    dueDate: row.due_date,
    status: row.status,
    escalation: row.escalation,
    workflowStage: row.workflow_stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJurisdiction(row: JurisdictionRow): RegulatoryJurisdiction {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    country: row.country,
    region: row.region,
    state: row.state,
    industry: row.industry,
    regulator: row.regulator,
    applicability: row.applicability,
    complianceStatus: row.compliance_status,
  };
}

function mapMapping(row: MappingRow): RegulatoryMapping {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    regulationName: row.regulation_name,
    requirementId: row.requirement_id,
    controlId: row.control_id,
    evidenceId: row.evidence_id,
    riskId: row.risk_id,
    frameworkCode: row.framework_code,
  };
}

function mapImpact(row: ImpactRow): RegulatoryImpactAssessment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    changeLogId: row.change_log_id,
    impactScore: row.impact_score,
    severity: row.severity,
    priority: row.priority,
    affectedControls: toArray(row.affected_controls),
    affectedPolicies: toArray(row.affected_policies),
    affectedRisks: toArray(row.affected_risks),
    affectedVendors: toArray(row.affected_vendors),
    affectedAssets: toArray(row.affected_assets),
    affectedProcesses: toArray(row.affected_processes),
    affectedAiSystems: toArray(row.affected_ai_systems),
    requiredActions: toArray(row.required_actions),
    completedAt: row.completed_at,
  };
}

export async function ensureRegulatorySchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_requirements (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      regulation_name TEXT NOT NULL,
      clause TEXT,
      article TEXT,
      section TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      regulator TEXT NOT NULL,
      category TEXT NOT NULL,
      effective_date TIMESTAMPTZ,
      review_date TIMESTAMPTZ,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      compliance_rating INTEGER NOT NULL DEFAULT 50,
      risk_rating INTEGER NOT NULL DEFAULT 50,
      linked_controls TEXT[] NOT NULL DEFAULT '{}',
      linked_policies TEXT[] NOT NULL DEFAULT '{}',
      linked_risks TEXT[] NOT NULL DEFAULT '{}',
      linked_evidence TEXT[] NOT NULL DEFAULT '{}',
      framework_codes TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_obligations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      obligation_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date TIMESTAMPTZ,
      status TEXT NOT NULL,
      review_frequency TEXT NOT NULL,
      compliance_evidence TEXT[] NOT NULL DEFAULT '{}',
      linked_controls TEXT[] NOT NULL DEFAULT '{}',
      linked_policies TEXT[] NOT NULL DEFAULT '{}',
      linked_risks TEXT[] NOT NULL DEFAULT '{}',
      source_requirement_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_change_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      requirement_id TEXT,
      regulation_name TEXT NOT NULL,
      change_type TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      impact_assessment TEXT NOT NULL,
      version_tag TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      severity TEXT NOT NULL,
      change_date TIMESTAMPTZ NOT NULL,
      affected_controls TEXT[] NOT NULL DEFAULT '{}',
      affected_policies TEXT[] NOT NULL DEFAULT '{}',
      affected_risks TEXT[] NOT NULL DEFAULT '{}',
      affected_vendors TEXT[] NOT NULL DEFAULT '{}',
      affected_assets TEXT[] NOT NULL DEFAULT '{}',
      affected_ai_systems TEXT[] NOT NULL DEFAULT '{}',
      required_actions TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      change_log_id TEXT,
      title TEXT NOT NULL,
      owner TEXT NOT NULL,
      due_date TIMESTAMPTZ,
      status TEXT NOT NULL,
      escalation TEXT,
      workflow_stage TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_jurisdictions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT,
      state TEXT,
      industry TEXT,
      regulator TEXT NOT NULL,
      applicability TEXT NOT NULL,
      compliance_status TEXT NOT NULL
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_mappings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      regulation_name TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      control_id TEXT,
      evidence_id TEXT,
      risk_id TEXT,
      framework_code TEXT
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS regulatory_impact_assessments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      change_log_id TEXT NOT NULL,
      impact_score INTEGER NOT NULL,
      severity TEXT NOT NULL,
      priority TEXT NOT NULL,
      affected_controls TEXT[] NOT NULL DEFAULT '{}',
      affected_policies TEXT[] NOT NULL DEFAULT '{}',
      affected_risks TEXT[] NOT NULL DEFAULT '{}',
      affected_vendors TEXT[] NOT NULL DEFAULT '{}',
      affected_assets TEXT[] NOT NULL DEFAULT '{}',
      affected_processes TEXT[] NOT NULL DEFAULT '{}',
      affected_ai_systems TEXT[] NOT NULL DEFAULT '{}',
      required_actions TEXT[] NOT NULL DEFAULT '{}',
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function seedRegulatoryData(workspaceId: string): Promise<void> {
  const existing = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM regulatory_requirements WHERE workspace_id = $1', [workspaceId]);
  if (Number(existing.rows[0]?.count || 0) > 0) {
    return;
  }

  for (const regulation of SUPPORTED_REGULATIONS) {
    const requirementId = generateId('req');
    await query(
      `INSERT INTO regulatory_requirements
       (id, workspace_id, requirement_id, regulation_name, title, description, jurisdiction, regulator, category, effective_date, review_date, status, owner, business_unit, compliance_rating, risk_rating, linked_controls, linked_policies, linked_risks, linked_evidence, framework_codes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() - INTERVAL '120 days', NOW() + INTERVAL '120 days',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        requirementId,
        workspaceId,
        regulation.requirementId,
        regulation.regulationName,
        regulation.title,
        `${regulation.regulationName} requirement for ${regulation.title.toLowerCase()}.`,
        regulation.jurisdiction,
        regulation.regulator,
        regulation.category,
        'active',
        regulation.owner,
        regulation.businessUnit,
        72,
        64,
        ['CTRL-001', 'CTRL-002'],
        ['POL-001'],
        ['RISK-001'],
        ['EVID-001'],
        regulation.frameworkCodes,
      ],
    );

    const obligationId = generateId('obg');
    await query(
      `INSERT INTO regulatory_obligations
       (id, workspace_id, obligation_type, title, description, owner, due_date, status, review_frequency, compliance_evidence, linked_controls, linked_policies, linked_risks, source_requirement_id)
       VALUES ($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '45 days',$7,$8,$9,$10,$11,$12,$13)`,
      [
        obligationId,
        workspaceId,
        'regulatory',
        `${regulation.regulationName} control review`,
        `Confirm operational adherence to ${regulation.requirementId}.`,
        regulation.owner,
        'open',
        'Quarterly',
        ['EVID-001'],
        ['CTRL-001'],
        ['POL-001'],
        ['RISK-001'],
        requirementId,
      ],
    );

    await query(
      `INSERT INTO regulatory_mappings
       (id, workspace_id, regulation_name, requirement_id, control_id, evidence_id, risk_id, framework_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [generateId('map'), workspaceId, regulation.regulationName, regulation.requirementId, 'CTRL-001', 'EVID-001', 'RISK-001', regulation.frameworkCodes[0] || null],
    );
  }

  await query(
    `INSERT INTO regulatory_jurisdictions (id, workspace_id, country, region, state, industry, regulator, applicability, compliance_status)
     VALUES
     ($1,$2,'United Kingdom','EMEA',NULL,'Financial Services','FCA','Operational resilience and outsourcing obligations','In scope'),
     ($3,$2,'Germany','EMEA',NULL,'Technology','BfDI','Privacy and AI governance obligations','In scope'),
     ($4,$2,'United States','North America',NULL,'Healthcare','HHS','Healthcare privacy and security obligations','Partially in scope')`,
    [generateId('jur'), workspaceId, generateId('jur'), generateId('jur')],
  );

  const changeId = generateId('rchg');
  await query(
    `INSERT INTO regulatory_change_logs
     (id, workspace_id, requirement_id, regulation_name, change_type, change_summary, impact_assessment, version_tag, reviewer, approval_status, severity, change_date, affected_controls, affected_policies, affected_risks, affected_vendors, affected_assets, affected_ai_systems, required_actions)
     VALUES
     ($1,$2,$3,'EU AI Act','updated_regulation','New governance expectations for high-risk systems.','Initial review identifies governance, policy, and third-party changes.','v2026.06','Responsible AI Lead','pending','high',NOW() - INTERVAL '3 days',$4,$5,$6,$7,$8,$9,$10)`,
    [changeId, workspaceId, 'EUAIACT-ART-9', ['CTRL-001', 'CTRL-004'], ['POL-001', 'POL-003'], ['RISK-001'], ['VENDOR-001'], ['ASSET-001'], ['AI-001'], ['Review AI inventory', 'Update responsible AI policy', 'Collect supporting evidence']],
  );

  await query(
    `INSERT INTO regulatory_tasks
     (id, workspace_id, change_log_id, title, owner, due_date, status, escalation, workflow_stage)
     VALUES
     ($1,$2,$3,'Review EU AI Act change impact','Responsible AI Lead',NOW() + INTERVAL '10 days','in_progress','Escalate to ExCo if overdue','Impact Assessment'),
     ($4,$2,$3,'Update AI governance policy','Policy Manager',NOW() + INTERVAL '20 days','open','Notify policy committee','Policy Updates')`,
    [generateId('rtask'), workspaceId, changeId, generateId('rtask')],
  );
}

export async function listRequirements(workspaceId: string): Promise<RegulatoryRequirement[]> {
  const result = await query<RequirementRow>('SELECT * FROM regulatory_requirements WHERE workspace_id = $1 ORDER BY review_date NULLS LAST, regulation_name, requirement_id', [workspaceId]);
  return result.rows.map(mapRequirement);
}

export async function listObligations(workspaceId: string): Promise<RegulatoryObligation[]> {
  const result = await query<ObligationRow>('SELECT * FROM regulatory_obligations WHERE workspace_id = $1 ORDER BY due_date NULLS LAST, title', [workspaceId]);
  return result.rows.map(mapObligation);
}

export async function listChanges(workspaceId: string): Promise<RegulatoryChangeLogEntry[]> {
  const result = await query<ChangeRow>('SELECT * FROM regulatory_change_logs WHERE workspace_id = $1 ORDER BY change_date DESC, created_at DESC', [workspaceId]);
  return result.rows.map(mapChange);
}

export async function listTasks(workspaceId: string): Promise<RegulatoryTask[]> {
  const result = await query<TaskRow>('SELECT * FROM regulatory_tasks WHERE workspace_id = $1 ORDER BY due_date NULLS LAST, created_at DESC', [workspaceId]);
  return result.rows.map(mapTask);
}

export async function listJurisdictions(workspaceId: string): Promise<RegulatoryJurisdiction[]> {
  const result = await query<JurisdictionRow>('SELECT * FROM regulatory_jurisdictions WHERE workspace_id = $1 ORDER BY country, regulator', [workspaceId]);
  return result.rows.map(mapJurisdiction);
}

export async function listMappings(workspaceId: string): Promise<RegulatoryMapping[]> {
  const result = await query<MappingRow>('SELECT * FROM regulatory_mappings WHERE workspace_id = $1 ORDER BY regulation_name, requirement_id', [workspaceId]);
  return result.rows.map(mapMapping);
}

export async function listImpacts(workspaceId: string): Promise<RegulatoryImpactAssessment[]> {
  const result = await query<ImpactRow>('SELECT * FROM regulatory_impact_assessments WHERE workspace_id = $1 ORDER BY completed_at DESC', [workspaceId]);
  return result.rows.map(mapImpact);
}

export async function createRequirement(workspaceId: string, payload: Partial<RegulatoryRequirement>): Promise<RegulatoryRequirement> {
  const id = generateId('req');
  const result = await query<RequirementRow>(
    `INSERT INTO regulatory_requirements
     (id, workspace_id, requirement_id, regulation_name, clause, article, section, title, description, jurisdiction, regulator, category, effective_date, review_date, status, owner, business_unit, compliance_rating, risk_rating, linked_controls, linked_policies, linked_risks, linked_evidence, framework_codes)
     VALUES
     ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING *`,
    [
      id,
      workspaceId,
      payload.requirementId || `CUSTOM-${Date.now()}`,
      payload.regulationName || 'Custom Regulation',
      payload.clause || null,
      payload.article || null,
      payload.section || null,
      payload.title || 'New requirement',
      payload.description || '',
      payload.jurisdiction || 'Global',
      payload.regulator || 'Internal',
      payload.category || 'Custom',
      payload.effectiveDate || null,
      payload.reviewDate || null,
      payload.status || 'draft',
      payload.owner || 'Unassigned',
      payload.businessUnit || 'Corporate',
      payload.complianceRating ?? 50,
      payload.riskRating ?? 50,
      payload.linkedControls || [],
      payload.linkedPolicies || [],
      payload.linkedRisks || [],
      payload.linkedEvidence || [],
      payload.frameworkCodes || [],
    ],
  );
  return mapRequirement(result.rows[0]);
}

export async function updateRequirement(workspaceId: string, id: string, payload: Partial<RegulatoryRequirement>): Promise<RegulatoryRequirement | null> {
  const result = await query<RequirementRow>(
    `UPDATE regulatory_requirements
     SET title = COALESCE($3, title),
         description = COALESCE($4, description),
         owner = COALESCE($5, owner),
         status = COALESCE($6, status),
         review_date = COALESCE($7, review_date),
         compliance_rating = COALESCE($8, compliance_rating),
         risk_rating = COALESCE($9, risk_rating),
         linked_controls = COALESCE($10, linked_controls),
         linked_policies = COALESCE($11, linked_policies),
         linked_risks = COALESCE($12, linked_risks),
         linked_evidence = COALESCE($13, linked_evidence),
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, payload.title || null, payload.description || null, payload.owner || null, payload.status || null, payload.reviewDate || null, payload.complianceRating ?? null, payload.riskRating ?? null, payload.linkedControls || null, payload.linkedPolicies || null, payload.linkedRisks || null, payload.linkedEvidence || null],
  );
  return result.rows[0] ? mapRequirement(result.rows[0]) : null;
}

export async function createObligation(workspaceId: string, payload: Partial<RegulatoryObligation>): Promise<RegulatoryObligation> {
  const result = await query<ObligationRow>(
    `INSERT INTO regulatory_obligations
     (id, workspace_id, obligation_type, title, description, owner, due_date, status, review_frequency, compliance_evidence, linked_controls, linked_policies, linked_risks, source_requirement_id)
     VALUES
     ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [generateId('obg'), workspaceId, payload.obligationType || 'regulatory', payload.title || 'New obligation', payload.description || '', payload.owner || 'Unassigned', payload.dueDate || null, payload.status || 'open', payload.reviewFrequency || 'Quarterly', payload.complianceEvidence || [], payload.linkedControls || [], payload.linkedPolicies || [], payload.linkedRisks || [], payload.sourceRequirementId || null],
  );
  return mapObligation(result.rows[0]);
}

export async function updateObligation(workspaceId: string, id: string, payload: Partial<RegulatoryObligation>): Promise<RegulatoryObligation | null> {
  const result = await query<ObligationRow>(
    `UPDATE regulatory_obligations
     SET owner = COALESCE($3, owner),
         due_date = COALESCE($4, due_date),
         status = COALESCE($5, status),
         review_frequency = COALESCE($6, review_frequency),
         linked_controls = COALESCE($7, linked_controls),
         linked_policies = COALESCE($8, linked_policies),
         linked_risks = COALESCE($9, linked_risks),
         compliance_evidence = COALESCE($10, compliance_evidence),
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, payload.owner || null, payload.dueDate || null, payload.status || null, payload.reviewFrequency || null, payload.linkedControls || null, payload.linkedPolicies || null, payload.linkedRisks || null, payload.complianceEvidence || null],
  );
  return result.rows[0] ? mapObligation(result.rows[0]) : null;
}

export async function createChangeLog(workspaceId: string, payload: Partial<RegulatoryChangeLogEntry>): Promise<RegulatoryChangeLogEntry> {
  const result = await query<ChangeRow>(
    `INSERT INTO regulatory_change_logs
     (id, workspace_id, requirement_id, regulation_name, change_type, change_summary, impact_assessment, version_tag, reviewer, approval_status, severity, change_date, affected_controls, affected_policies, affected_risks, affected_vendors, affected_assets, affected_ai_systems, required_actions)
     VALUES
     ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [generateId('rchg'), workspaceId, payload.requirementId || null, payload.regulationName || 'Custom Regulation', payload.changeType || 'updated_regulation', payload.changeSummary || '', payload.impactAssessment || '', payload.versionTag || 'v1', payload.reviewer || 'Unassigned', payload.approvalStatus || 'pending', payload.severity || 'medium', payload.changeDate || new Date().toISOString(), payload.affectedControls || [], payload.affectedPolicies || [], payload.affectedRisks || [], payload.affectedVendors || [], payload.affectedAssets || [], payload.affectedAiSystems || [], payload.requiredActions || []],
  );
  return mapChange(result.rows[0]);
}

export async function updateChangeLog(workspaceId: string, id: string, payload: Partial<RegulatoryChangeLogEntry>): Promise<RegulatoryChangeLogEntry | null> {
  const result = await query<ChangeRow>(
    `UPDATE regulatory_change_logs
     SET reviewer = COALESCE($3, reviewer),
         approval_status = COALESCE($4, approval_status),
         severity = COALESCE($5, severity),
         impact_assessment = COALESCE($6, impact_assessment),
         required_actions = COALESCE($7, required_actions),
         updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, payload.reviewer || null, payload.approvalStatus || null, payload.severity || null, payload.impactAssessment || null, payload.requiredActions || null],
  );
  return result.rows[0] ? mapChange(result.rows[0]) : null;
}

export async function createTask(workspaceId: string, payload: Partial<RegulatoryTask>): Promise<RegulatoryTask> {
  const result = await query<TaskRow>(
    `INSERT INTO regulatory_tasks
     (id, workspace_id, change_log_id, title, owner, due_date, status, escalation, workflow_stage)
     VALUES
     ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [generateId('rtask'), workspaceId, payload.changeLogId || null, payload.title || 'Regulatory task', payload.owner || 'Unassigned', payload.dueDate || null, payload.status || 'open', payload.escalation || null, payload.workflowStage || 'Review Assigned'],
  );
  return mapTask(result.rows[0]);
}

export async function createImpactAssessment(workspaceId: string, changeLogId: string, payload: Omit<RegulatoryImpactAssessment, 'id' | 'workspaceId' | 'changeLogId' | 'completedAt'>): Promise<RegulatoryImpactAssessment> {
  const result = await query<ImpactRow>(
    `INSERT INTO regulatory_impact_assessments
     (id, workspace_id, change_log_id, impact_score, severity, priority, affected_controls, affected_policies, affected_risks, affected_vendors, affected_assets, affected_processes, affected_ai_systems, required_actions, completed_at)
     VALUES
     ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     RETURNING *`,
    [generateId('rimp'), workspaceId, changeLogId, payload.impactScore, payload.severity, payload.priority, payload.affectedControls, payload.affectedPolicies, payload.affectedRisks, payload.affectedVendors, payload.affectedAssets, payload.affectedProcesses, payload.affectedAiSystems, payload.requiredActions],
  );
  return mapImpact(result.rows[0]);
}

export async function getRegulatoryDashboard(workspaceId: string): Promise<RegulatoryDashboardSummary> {
  const [requirements, obligations, changes, tasks, mappings] = await Promise.all([
    listRequirements(workspaceId),
    listObligations(workspaceId),
    listChanges(workspaceId),
    listTasks(workspaceId),
    listMappings(workspaceId),
  ]);

  const now = Date.now();
  const newChanges = changes.filter((entry) => (now - new Date(entry.changeDate).getTime()) / 86400000 <= 30);
  const pendingReviews = changes.filter((entry) => entry.approvalStatus === 'pending' || entry.approvalStatus === 'in_review');
  const overdueActions = tasks.filter((task) => task.status === 'overdue' || (task.dueDate ? new Date(task.dueDate).getTime() < now && task.status !== 'completed' : false));
  const highImpactChanges = changes.filter((entry) => entry.severity === 'high' || entry.severity === 'critical');
  const businessUnits = new Set(requirements.map((item) => item.businessUnit).filter(Boolean));
  const upcomingDeadlines = obligations.filter((item) => item.dueDate && new Date(item.dueDate).getTime() <= now + 30 * 86400000).length;
  const complianceExposure = obligations.length
    ? Math.round((obligations.filter((item) => item.status === 'at_risk' || item.status === 'overdue').length / obligations.length) * 100)
    : 0;

  return {
    totalRegulations: requirements.length,
    activeObligations: obligations.filter((item) => item.status !== 'compliant').length,
    newRegulatoryChanges: newChanges.length,
    pendingReviews: pendingReviews.length,
    overdueActions: overdueActions.length,
    highImpactChanges: highImpactChanges.length,
    complianceExposure,
    affectedBusinessUnits: businessUnits.size,
    upcomingDeadlines,
    trendPoints: changes.slice(0, 6).reverse().map((entry) => ({
      label: new Date(entry.changeDate).toLocaleDateString('en-GB', { month: 'short', day: '2-digit' }),
      changes: 1,
      obligations: obligations.filter((item) => item.sourceRequirementId === entry.requirementId).length,
    })),
    obligationStatusChart: ['open', 'in_progress', 'compliant', 'at_risk', 'overdue'].map((status) => ({
      status,
      count: obligations.filter((item) => item.status === status).length,
    })),
    impactHeatmap: ['Controls', 'Policies', 'Risks', 'Vendors', 'Assets', 'AI Systems'].map((area) => ({
      area,
      severity: highImpactChanges.length > 0 ? 'high' : 'medium',
      count:
        area === 'Controls' ? changes.reduce((sum, entry) => sum + entry.affectedControls.length, 0) :
        area === 'Policies' ? changes.reduce((sum, entry) => sum + entry.affectedPolicies.length, 0) :
        area === 'Risks' ? changes.reduce((sum, entry) => sum + entry.affectedRisks.length, 0) :
        area === 'Vendors' ? changes.reduce((sum, entry) => sum + entry.affectedVendors.length, 0) :
        area === 'Assets' ? changes.reduce((sum, entry) => sum + entry.affectedAssets.length, 0) :
        changes.reduce((sum, entry) => sum + entry.affectedAiSystems.length, 0),
    })),
    jurisdictionBreakdown: Array.from(new Map(requirements.map((item) => [item.jurisdiction, requirements.filter((req) => req.jurisdiction === item.jurisdiction).length]))).map(([jurisdiction, count]) => ({ jurisdiction, count })),
    frameworkCoverage: Array.from(new Map(mappings.map((mapping) => [mapping.frameworkCode || 'Custom', mappings.filter((item) => (item.frameworkCode || 'Custom') === (mapping.frameworkCode || 'Custom')).length]))).map(([framework, mappedRequirements]) => ({ framework, mappedRequirements })),
    executiveSummary: [
      `${highImpactChanges.length} high-impact regulatory changes require leadership attention.`,
      `${overdueActions.length} regulatory actions are currently overdue or blocked.`,
      `${complianceExposure}% of tracked obligations are at risk or overdue.`,
    ],
  };
}

export async function getRegulatoryWorkspaceState(workspaceId: string): Promise<RegulatoryWorkspaceState> {
  const [dashboard, requirements, obligations, changes, tasks, jurisdictions, mappings, impacts] = await Promise.all([
    getRegulatoryDashboard(workspaceId),
    listRequirements(workspaceId),
    listObligations(workspaceId),
    listChanges(workspaceId),
    listTasks(workspaceId),
    listJurisdictions(workspaceId),
    listMappings(workspaceId),
    listImpacts(workspaceId),
  ]);

  return {
    dashboard,
    requirements,
    obligations,
    changes,
    tasks,
    jurisdictions,
    mappings,
    impacts,
  };
}
