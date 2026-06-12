import { generateId, query } from '../db.js';
import { getAccessGovernanceState } from '../services/accessGovernanceService.js';
import { getActivitiesForTarget, listActivities } from '../services/activityLedger/activityLedger.js';
import { getAiGovernanceState } from '../services/aiGovernanceService.js';
import { getAuditManagementState } from '../repositories/auditManagementRepo.js';
import { getBusinessContinuityState } from '../services/bcmService.js';
import { getControls } from './controlsRepo.js';
import { getEsgState } from './esgRepo.js';
import { getGovernanceDocuments } from './governanceDocumentsRepo.js';
import { getPrivacyState } from './privacyRepo.js';
import { getRegulatoryWorkspaceState } from './regulatoryRepo.js';
import { getReviewTasks } from './reviewTasksRepo.js';
import { getRiskIntelligenceState } from '../services/riskIntelligenceService.js';
import { getRisks } from './risksRepo.js';
import { getVendors } from './vendorsRepo.js';
import type {
  EnterpriseApprovalItem,
  EnterpriseAnalytics,
  EnterpriseEntity360,
  EnterpriseEntityNode,
  EnterpriseEntityType,
  EnterpriseExecutiveSummary,
  EnterpriseNotificationItem,
  EnterpriseOpsState,
  EnterpriseReferenceRecord,
  EnterpriseRelationshipEdge,
  EnterpriseTaskItem,
  EnterpriseWorkflowTemplate,
} from '../types/enterpriseOps.js';

type AssetRow = {
  id: string;
  workspace_id: string;
  asset_tag: string;
  name: string;
  owner: string | null;
  business_unit: string | null;
  status: string | null;
  risk_rating: string | null;
  linked_risk_ids: string[] | null;
  linked_control_ids: string[] | null;
  linked_evidence_ids: string[] | null;
  linked_policy_ids: string[] | null;
  linked_issue_ids: string[] | null;
  linked_audit_ids: string[] | null;
  linked_vendor_id: string | null;
};

type RefRow = {
  id: string;
  workspace_id: string;
  reference_type: EnterpriseReferenceRecord['referenceType'];
  code: string;
  label: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type WorkflowRow = {
  id: string;
  workspace_id: string;
  workflow_key: EnterpriseWorkflowTemplate['workflowKey'];
  title: string;
  stages: string[];
  approvals_required: string[];
  status: EnterpriseWorkflowTemplate['status'];
  created_at: string;
  updated_at: string;
};

const REF_SEED: Array<Pick<EnterpriseReferenceRecord, 'referenceType' | 'code' | 'label'>> = [
  { referenceType: 'business_unit', code: 'GRC', label: 'GRC Office' },
  { referenceType: 'business_unit', code: 'SECOPS', label: 'Security Operations' },
  { referenceType: 'business_unit', code: 'PRIV', label: 'Privacy Office' },
  { referenceType: 'business_unit', code: 'RISK', label: 'Enterprise Risk' },
  { referenceType: 'department', code: 'IT', label: 'Technology' },
  { referenceType: 'department', code: 'LEGAL', label: 'Legal' },
  { referenceType: 'department', code: 'FIN', label: 'Finance' },
  { referenceType: 'region', code: 'EMEA', label: 'EMEA' },
  { referenceType: 'region', code: 'NA', label: 'North America' },
  { referenceType: 'country', code: 'UK', label: 'United Kingdom' },
  { referenceType: 'country', code: 'US', label: 'United States' },
  { referenceType: 'framework', code: 'ISO27001', label: 'ISO 27001' },
  { referenceType: 'framework', code: 'ISO27701', label: 'ISO 27701' },
  { referenceType: 'framework', code: 'GDPR', label: 'GDPR' },
  { referenceType: 'framework', code: 'EU_AI_ACT', label: 'EU AI Act' },
  { referenceType: 'framework', code: 'CSRD', label: 'CSRD' },
  { referenceType: 'risk_type', code: 'PRIVACY', label: 'Privacy Risk' },
  { referenceType: 'risk_type', code: 'THIRD_PARTY', label: 'Third-Party Risk' },
  { referenceType: 'risk_type', code: 'AI', label: 'AI Risk' },
  { referenceType: 'control_type', code: 'PREVENTIVE', label: 'Preventive Control' },
  { referenceType: 'control_type', code: 'DETECTIVE', label: 'Detective Control' },
];

const WORKFLOW_SEED: Array<Pick<EnterpriseWorkflowTemplate, 'workflowKey' | 'title' | 'stages' | 'approvalsRequired' | 'status'>> = [
  { workflowKey: 'risk', title: 'Risk Workflow', stages: ['Identify', 'Assess', 'Treat', 'Monitor', 'Close'], approvalsRequired: ['Risk acceptance'], status: 'active' },
  { workflowKey: 'audit', title: 'Audit Workflow', stages: ['Plan', 'Fieldwork', 'Report', 'Remediate', 'Validate'], approvalsRequired: ['Audit approval'], status: 'active' },
  { workflowKey: 'vendor', title: 'Vendor Workflow', stages: ['Intake', 'Assess', 'Approve', 'Monitor', 'Renew'], approvalsRequired: ['Vendor approval'], status: 'active' },
  { workflowKey: 'policy', title: 'Policy Workflow', stages: ['Draft', 'Review', 'Approve', 'Publish', 'Review Cycle'], approvalsRequired: ['Policy approval'], status: 'active' },
  { workflowKey: 'dpia', title: 'DPIA Workflow', stages: ['Intake', 'Assessment', 'Review', 'Approve', 'Monitor'], approvalsRequired: ['Privacy approval'], status: 'active' },
  { workflowKey: 'incident', title: 'Incident Workflow', stages: ['Triage', 'Investigate', 'Contain', 'Remediate', 'Close'], approvalsRequired: ['Closure review'], status: 'active' },
  { workflowKey: 'control_review', title: 'Control Review Workflow', stages: ['Design', 'Implement', 'Test', 'Approve', 'Monitor'], approvalsRequired: ['Control approval'], status: 'active' },
];

function mapReference(row: RefRow): EnterpriseReferenceRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    referenceType: row.reference_type,
    code: row.code,
    label: row.label,
    metadata: row.metadata,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapWorkflow(row: WorkflowRow): EnterpriseWorkflowTemplate {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workflowKey: row.workflow_key,
    title: row.title,
    stages: row.stages || [],
    approvalsRequired: row.approvals_required || [],
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function pushEntity(store: Map<string, EnterpriseEntityNode>, entity: EnterpriseEntityNode) {
  store.set(`${entity.entityType}:${entity.id}`, entity);
}

function pushRelationship(store: EnterpriseRelationshipEdge[], workspaceId: string, source: EnterpriseEntityNode, target: EnterpriseEntityNode, relationshipType: string, strength = 1, metadata?: Record<string, unknown>) {
  store.push({
    id: `${source.entityType}:${source.id}:${relationshipType}:${target.entityType}:${target.id}`,
    workspaceId,
    sourceType: source.entityType,
    sourceId: source.id,
    sourceName: source.name,
    targetType: target.entityType,
    targetId: target.id,
    targetName: target.name,
    relationshipType,
    strength,
    metadata,
  });
}

function classifyPriority(value: number, criticalThreshold = 80, highThreshold = 60): EnterpriseTaskItem['priority'] {
  if (value >= criticalThreshold) return 'critical';
  if (value >= highThreshold) return 'high';
  if (value >= 35) return 'medium';
  return 'low';
}

function normalizePriority(label?: string | null): EnterpriseTaskItem['priority'] {
  if (label === 'critical' || label === 'high' || label === 'medium' || label === 'low') return label;
  return 'medium';
}

function normalizeSortableDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toString' in value) {
    const stringValue = String(value);
    return stringValue === '[object Object]' ? '' : stringValue;
  }
  return '';
}

async function listAssetRelationshipRows(workspaceId: string): Promise<AssetRow[]> {
  const result = await query<AssetRow>(
    `SELECT id, workspace_id, asset_tag, name, owner, business_unit, status, risk_rating, linked_risk_ids, linked_control_ids, linked_evidence_ids, linked_policy_ids, linked_issue_ids, linked_audit_ids, linked_vendor_id
     FROM assets
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return result.rows;
}

async function listReferenceData(workspaceId: string) {
  const result = await query<RefRow>(
    `SELECT * FROM enterprise_reference_data WHERE workspace_id = $1 ORDER BY reference_type, label`,
    [workspaceId],
  );
  return result.rows.map(mapReference);
}

async function listWorkflowTemplates(workspaceId: string) {
  const result = await query<WorkflowRow>(
    `SELECT * FROM enterprise_workflow_templates WHERE workspace_id = $1 ORDER BY workflow_key`,
    [workspaceId],
  );
  return result.rows.map(mapWorkflow);
}

export async function ensureEnterpriseOpsSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS enterprise_reference_data (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, reference_type, code)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS enterprise_workflow_templates (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      workflow_key TEXT NOT NULL,
      title TEXT NOT NULL,
      stages JSONB NOT NULL DEFAULT '[]'::jsonb,
      approvals_required JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, workflow_key)
    )
  `);
}

async function seedEnterpriseOpsDefaults(workspaceId: string) {
  const existingRefs = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM enterprise_reference_data WHERE workspace_id = $1`, [workspaceId]);
  if (Number(existingRefs.rows[0]?.count || 0) === 0) {
    for (const item of REF_SEED) {
      await query(
        `INSERT INTO enterprise_reference_data (id, workspace_id, reference_type, code, label, metadata)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [generateId('eref'), workspaceId, item.referenceType, item.code, item.label, JSON.stringify({ seeded: true })],
      );
    }
  }

  const existingWorkflows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM enterprise_workflow_templates WHERE workspace_id = $1`, [workspaceId]);
  if (Number(existingWorkflows.rows[0]?.count || 0) === 0) {
    for (const item of WORKFLOW_SEED) {
      await query(
        `INSERT INTO enterprise_workflow_templates (id, workspace_id, workflow_key, title, stages, approvals_required, status)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
        [generateId('ewf'), workspaceId, item.workflowKey, item.title, JSON.stringify(item.stages), JSON.stringify(item.approvalsRequired), item.status],
      );
    }
  }
}

function entityLabel(entityType: EnterpriseEntityType) {
  return entityType.replace(/_/g, ' ');
}

function addMappedRelationship(
  relationships: EnterpriseRelationshipEdge[],
  workspaceId: string,
  entityMap: Map<string, EnterpriseEntityNode>,
  sourceType: EnterpriseEntityType,
  sourceId: string,
  targetType: EnterpriseEntityType,
  targetId: string,
  relationshipType: string,
  metadata?: Record<string, unknown>,
) {
  const source = entityMap.get(`${sourceType}:${sourceId}`);
  const target = entityMap.get(`${targetType}:${targetId}`);
  if (!source || !target) return;
  pushRelationship(relationships, workspaceId, source, target, relationshipType, 1, metadata);
}

function buildAnalytics(
  relationships: EnterpriseRelationshipEdge[],
  regulatoryState: Awaited<ReturnType<typeof getRegulatoryWorkspaceState>>,
  privacyState: Awaited<ReturnType<typeof getPrivacyState>>,
  esgState: Awaited<ReturnType<typeof getEsgState>>,
  auditState: Awaited<ReturnType<typeof getAuditManagementState>>,
): EnterpriseAnalytics {
  const aggregate = <T extends string>(items: T[]) => Object.entries(items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {})).map(([key, count]) => ({ key, count }));

  return {
    riskByVendor: aggregate(relationships.filter((item) => item.relationshipType.includes('risk') && item.targetType === 'vendor').map((item) => item.targetName)).map((item) => ({ vendor: item.key, count: item.count })),
    riskByAsset: aggregate(relationships.filter((item) => item.relationshipType.includes('risk') && item.targetType === 'asset').map((item) => item.targetName)).map((item) => ({ asset: item.key, count: item.count })),
    riskByAiSystem: aggregate(relationships.filter((item) => item.targetType === 'ai_system' && item.relationshipType.includes('risk')).map((item) => item.targetName)).map((item) => ({ aiSystem: item.key, count: item.count })),
    findingsByFramework: aggregate(auditState.annualPlan.map((item) => item.framework)).map((item) => ({ framework: item.key, count: item.count })),
    controlsByRegulation: regulatoryState.requirements.map((item) => ({ regulation: item.regulationName, count: item.linkedControls.length })).slice(0, 8),
    privacyByBusinessUnit: Object.entries(privacyState.dataInventory.reduce<Record<string, number>>((acc, item) => {
      acc[item.department] = (acc[item.department] || 0) + 1;
      return acc;
    }, {})).map(([businessUnit, count]) => ({ businessUnit, count })),
    esgBySupplier: esgState.suppliers.map((item) => ({ supplier: item.supplierName, score: item.supplierEsgRating })).slice(0, 8),
    auditByDepartment: aggregate(auditState.annualPlan.map((item) => item.department)).map((item) => ({ department: item.key, count: item.count })),
  };
}

function buildExecutiveSummary(
  risks: Awaited<ReturnType<typeof getRisks>>,
  controls: Awaited<ReturnType<typeof getControls>>,
  vendors: Awaited<ReturnType<typeof getVendors>>,
  privacyState: Awaited<ReturnType<typeof getPrivacyState>>,
  esgState: Awaited<ReturnType<typeof getEsgState>>,
  aiState: Awaited<ReturnType<typeof getAiGovernanceState>>,
  auditState: Awaited<ReturnType<typeof getAuditManagementState>>,
  relationships: EnterpriseRelationshipEdge[],
): EnterpriseExecutiveSummary {
  const implementedControls = controls.filter((item) => item.status === 'implemented').length;
  const highVendorExposure = vendors.filter((item) => item.riskLevel === 'high' || item.riskLevel === 'critical').length;
  const crossDomainImpact = new Set(
    relationships
      .filter((item) => ['risk', 'vendor', 'asset', 'ai_system', 'data_asset'].includes(item.sourceType) || ['risk', 'vendor', 'asset', 'ai_system', 'data_asset'].includes(item.targetType))
      .map((item) => item.sourceId),
  ).size;

  return {
    topRisks: risks
      .slice()
      .sort((left, right) => right.residualLikelihood * right.residualImpact - left.residualLikelihood * left.residualImpact)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        score: item.residualLikelihood * item.residualImpact,
        routeKey: 'risks',
      })),
    controlCoverage: controls.length ? Math.round((implementedControls / controls.length) * 100) : 0,
    openFindings: auditState.summary.openFindings,
    vendorExposure: highVendorExposure,
    privacyExposure: privacyState.summary.openPrivacyRisks,
    esgExposure: esgState.summary.esgRiskExposure,
    aiExposure: aiState.summary.aiRiskScore,
    crossDomainImpact,
  };
}

export async function getEnterpriseOpsState(workspaceId: string): Promise<EnterpriseOpsState> {
  await seedEnterpriseOpsDefaults(workspaceId);

  const [
    risks,
    controls,
    vendors,
    governanceDocuments,
    reviewTasks,
    accessState,
    aiState,
    auditState,
    bcmState,
    esgState,
    privacyState,
    regulatoryState,
    riskIntelligenceState,
    references,
    workflows,
    assets,
    activities,
  ] = await Promise.all([
    getRisks(workspaceId),
    getControls(workspaceId),
    getVendors(workspaceId),
    getGovernanceDocuments(workspaceId),
    getReviewTasks(workspaceId),
    getAccessGovernanceState(workspaceId),
    getAiGovernanceState(workspaceId),
    getAuditManagementState(workspaceId),
    getBusinessContinuityState(workspaceId),
    getEsgState(workspaceId),
    getPrivacyState(workspaceId),
    getRegulatoryWorkspaceState(workspaceId),
    getRiskIntelligenceState(workspaceId),
    listReferenceData(workspaceId),
    listWorkflowTemplates(workspaceId),
    listAssetRelationshipRows(workspaceId),
    listActivities({ workspaceId, limit: 25 }),
  ]);

  const entityMap = new Map<string, EnterpriseEntityNode>();
  const relationships: EnterpriseRelationshipEdge[] = [];

  pushEntity(entityMap, { id: workspaceId, entityType: 'organization', name: 'Organization', routeKey: 'dashboard', status: 'active' });

  for (const ref of references) {
    if (ref.referenceType === 'business_unit') {
      pushEntity(entityMap, { id: ref.code, entityType: 'business_unit', name: ref.label, routeKey: 'dashboard', status: 'active', metadata: { referenceType: ref.referenceType } });
    }
    if (ref.referenceType === 'framework') {
      pushEntity(entityMap, { id: ref.code, entityType: 'framework', name: ref.label, routeKey: 'compliance-tracker', status: 'active' });
    }
  }

  for (const item of accessState.users) {
    pushEntity(entityMap, { id: item.id, entityType: 'user', name: item.fullName, routeKey: 'workspace-members', owner: item.email, status: item.status, businessUnit: item.workspaceName });
  }
  for (const item of accessState.roles) {
    pushEntity(entityMap, {
      id: item.id,
      entityType: 'role',
      name: item.name,
      routeKey: 'admin-roles',
      status: item.status,
      metadata: { isDefault: item.isDefault, inheritedFrom: item.inheritedFrom, userCount: item.userCount },
    });
  }
  for (const item of risks) {
    pushEntity(entityMap, { id: item.id, entityType: 'risk', name: item.title, routeKey: 'risks', owner: item.owner, status: item.status, severity: String(item.residualLikelihood * item.residualImpact), domain: item.category });
  }
  for (const item of controls) {
    pushEntity(entityMap, { id: item.id, entityType: 'control', name: item.title, routeKey: 'controls', owner: item.owner, status: item.status, framework: item.primaryFramework || undefined, domain: item.domain || undefined });
  }
  for (const item of governanceDocuments) {
    pushEntity(entityMap, { id: item.id, entityType: item.docType === 'procedure' ? 'procedure' : 'policy', name: item.title, routeKey: 'governance-documents', owner: item.owner, status: item.status });
  }
  for (const item of vendors) {
    pushEntity(entityMap, { id: item.id, entityType: 'vendor', name: item.name, routeKey: 'vendors', owner: item.owner, status: item.status, severity: item.riskLevel });
  }
  for (const item of assets) {
    pushEntity(entityMap, { id: item.id, entityType: 'asset', name: item.name, routeKey: 'assets', owner: item.owner, status: item.status, businessUnit: item.business_unit, severity: item.risk_rating || undefined, metadata: { assetTag: item.asset_tag } });
  }
  for (const item of regulatoryState.requirements) {
    pushEntity(entityMap, { id: item.id, entityType: 'regulation', name: item.title, routeKey: 'regulatory-change', owner: item.owner, status: item.status, businessUnit: item.businessUnit, framework: item.frameworkCodes[0] });
  }
  for (const item of regulatoryState.obligations) {
    pushEntity(entityMap, { id: item.id, entityType: 'obligation', name: item.title, routeKey: 'regulatory-change', owner: item.owner, status: item.status });
  }
  for (const item of aiState.inventory) {
    pushEntity(entityMap, { id: item.id, entityType: 'ai_system', name: item.systemName, routeKey: 'ai-governance', owner: item.owner, status: item.lifecycleStatus, businessUnit: item.businessUnit, severity: item.riskRating });
  }
  for (const item of privacyState.dataInventory) {
    pushEntity(entityMap, { id: item.id, entityType: 'data_asset', name: item.dataAssetName, routeKey: 'privacy-data-governance', owner: item.businessOwner, status: item.status, businessUnit: item.department, severity: String(item.classificationRiskScore) });
  }
  for (const item of privacyState.dpias) {
    pushEntity(entityMap, { id: item.id, entityType: 'dpia', name: item.assessmentName, routeKey: 'privacy-data-governance', owner: item.owner, status: item.approvalStatus, severity: item.riskRating });
  }
  for (const item of [...esgState.environmentalMetrics, ...esgState.socialMetrics, ...esgState.governanceMetrics].slice(0, 40)) {
    pushEntity(entityMap, { id: item.id, entityType: 'esg_metric', name: item.metricName, routeKey: 'esg-management', owner: item.owner, status: item.status });
  }
  for (const item of auditState.engagements) {
    pushEntity(entityMap, { id: item.id, entityType: 'audit', name: item.auditName, routeKey: 'audit-readiness', owner: item.leadAuditor, status: item.status, framework: item.auditFramework });
  }
  for (const item of auditState.findings) {
    pushEntity(entityMap, { id: item.id, entityType: 'finding', name: item.title, routeKey: 'audit-readiness', owner: item.owner, status: item.status, severity: item.riskLevel });
  }
  for (const item of auditState.correctiveActions) {
    pushEntity(entityMap, { id: item.id, entityType: 'action', name: item.actionTitle, routeKey: 'audit-readiness', owner: item.owner, status: item.closureStatus });
  }
  for (const item of reviewTasks) {
    pushEntity(entityMap, { id: item.id, entityType: 'task', name: item.title, routeKey: 'review-tasks', owner: item.assignee, status: item.status });
  }
  for (const item of bcmState.crisisEvents) {
    pushEntity(entityMap, { id: item.id, entityType: 'incident', name: item.eventTitle, routeKey: 'business-continuity', owner: item.owner, status: item.status, severity: item.severity });
  }
  for (const item of activities) {
    pushEntity(entityMap, { id: item.id, entityType: 'activity', name: item.action, routeKey: 'activity-ledger', owner: item.actorName, status: item.outcome, domain: item.category });
  }
  for (const item of accessState.accessReviews) {
    pushEntity(entityMap, { id: item.id, entityType: 'review', name: item.name, routeKey: 'admin-access-reviews', owner: item.reviewers.join(', '), status: item.status });
  }

  for (const user of accessState.users) {
    addMappedRelationship(relationships, workspaceId, entityMap, 'role', user.assignedRoleId, 'user', user.id, 'role_assignment');
  }

  for (const control of controls) {
    if (control.primaryFramework) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'control', control.id, 'framework', control.primaryFramework, 'control_framework');
    }
  }

  for (const document of governanceDocuments) {
    if (document.docType === 'procedure') {
      addMappedRelationship(relationships, workspaceId, entityMap, 'organization', workspaceId, 'procedure', document.id, 'governs');
    } else {
      addMappedRelationship(relationships, workspaceId, entityMap, 'organization', workspaceId, 'policy', document.id, 'governs');
    }
  }

  for (const asset of assets) {
    for (const riskId of asset.linked_risk_ids || []) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'risk', riskId, 'asset_risk');
    }
    for (const controlId of asset.linked_control_ids || []) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'control', controlId, 'asset_control');
    }
    for (const policyId of asset.linked_policy_ids || []) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'policy', policyId, 'asset_policy');
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'procedure', policyId, 'asset_procedure');
    }
    for (const auditId of asset.linked_audit_ids || []) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'audit', auditId, 'asset_audit');
    }
    if (asset.linked_vendor_id) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'vendor', asset.linked_vendor_id, 'asset_vendor');
    }
    if (asset.business_unit) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'asset', asset.id, 'business_unit', asset.business_unit, 'asset_business_unit');
    }
  }

  for (const requirement of regulatoryState.requirements) {
    for (const controlId of requirement.linkedControls) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', requirement.id, 'control', controlId, 'regulation_control');
    }
    for (const riskId of requirement.linkedRisks) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', requirement.id, 'risk', riskId, 'regulation_risk');
    }
    for (const frameworkCode of requirement.frameworkCodes) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', requirement.id, 'framework', frameworkCode, 'regulation_framework');
    }
    if (requirement.businessUnit) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', requirement.id, 'business_unit', requirement.businessUnit, 'regulation_business_unit');
    }
  }

  for (const obligation of regulatoryState.obligations) {
    for (const controlId of obligation.linkedControls) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'obligation', obligation.id, 'control', controlId, 'obligation_control');
    }
    for (const riskId of obligation.linkedRisks) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'obligation', obligation.id, 'risk', riskId, 'obligation_risk');
    }
    for (const policyId of obligation.linkedPolicies) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'obligation', obligation.id, 'policy', policyId, 'obligation_policy');
    }
  }

  for (const change of regulatoryState.changes) {
    for (const assetId of change.affectedAssets) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', change.id, 'asset', assetId, 'change_asset');
    }
    for (const vendorId of change.affectedVendors) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', change.id, 'vendor', vendorId, 'change_vendor');
    }
    for (const aiId of change.affectedAiSystems) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'regulation', change.id, 'ai_system', aiId, 'change_ai_system');
    }
  }

  for (const dpia of privacyState.dpias) {
    for (const riskId of dpia.linkedRiskIds) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'dpia', dpia.id, 'risk', riskId, 'dpia_risk');
    }
    for (const controlId of dpia.linkedControlIds) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'dpia', dpia.id, 'control', controlId, 'dpia_control');
    }
    for (const assetId of dpia.linkedAssetIds) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'dpia', dpia.id, 'asset', assetId, 'dpia_asset');
    }
    for (const aiSystemId of dpia.linkedAiSystemIds) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'dpia', dpia.id, 'ai_system', aiSystemId, 'dpia_ai_system');
    }
    for (const vendorId of dpia.linkedVendorIds) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'dpia', dpia.id, 'vendor', vendorId, 'dpia_vendor');
    }
  }

  for (const item of privacyState.dataInventory) {
    if (item.department) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'data_asset', item.id, 'business_unit', item.department, 'data_asset_business_unit');
    }
  }

  for (const model of aiState.models) {
    if (model.systemId) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'ai_system', model.systemId, 'assessment', model.id, 'ai_model');
    }
  }
  for (const assessment of aiState.assessments) {
    pushEntity(entityMap, { id: assessment.id, entityType: 'assessment', name: assessment.assessmentName, routeKey: 'ai-governance', owner: assessment.owner, status: assessment.status, severity: String(assessment.overallRiskScore) });
    if (assessment.systemId) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'ai_system', assessment.systemId, 'assessment', assessment.id, 'ai_assessment');
    }
  }
  for (const control of aiState.controls) {
    pushEntity(entityMap, { id: control.id, entityType: 'control', name: control.controlName, routeKey: 'ai-governance', owner: control.owner, status: control.status, domain: control.category });
    for (const frameworkCode of control.mappedFrameworks) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'control', control.id, 'framework', frameworkCode, 'control_framework');
    }
  }
  for (const program of aiState.compliancePrograms) {
    addMappedRelationship(relationships, workspaceId, entityMap, 'ai_system', aiState.inventory[0]?.id || '', 'framework', program.frameworkCode, 'ai_framework');
  }

  for (const item of esgState.suppliers) {
    const vendorMatch = vendors.find((vendor) => vendor.name.toLowerCase() === item.supplierName.toLowerCase());
    if (vendorMatch) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'vendor', vendorMatch.id, 'esg_metric', item.id, 'vendor_esg');
    }
  }

  for (const item of auditState.findings) {
    const engagement = auditState.engagements.find((engagementRecord) => engagementRecord.id === item.engagementId);
    if (engagement) {
      addMappedRelationship(relationships, workspaceId, entityMap, 'audit', engagement.id, 'finding', item.id, 'audit_finding');
    }
  }
  for (const item of auditState.recommendations) {
    pushEntity(entityMap, { id: item.id, entityType: 'action', name: item.recommendation, routeKey: 'audit-readiness', owner: item.owner, status: item.status, severity: item.priority });
    addMappedRelationship(relationships, workspaceId, entityMap, 'finding', item.findingRecordId, 'action', item.id, 'finding_recommendation');
  }
  for (const item of auditState.correctiveActions) {
    addMappedRelationship(relationships, workspaceId, entityMap, 'finding', item.findingRecordId, 'action', item.id, 'finding_action');
  }

  const taskCenter: EnterpriseTaskItem[] = [
    ...reviewTasks.map((item) => ({
      id: item.id,
      workspaceId,
      sourceModule: 'governance',
      sourceType: 'task' as const,
      sourceId: item.id,
      title: item.title,
      owner: item.assignee,
      dueDate: item.dueAt,
      priority: item.status === 'overdue' ? 'high' as const : 'medium' as const,
      status: item.status,
      progressPercent: item.status === 'completed' ? 100 : item.status === 'in_progress' ? 55 : 0,
      routeKey: 'review-tasks',
    })),
    ...auditState.correctiveActions.map((item) => ({
      id: item.id,
      workspaceId,
      sourceModule: 'audit',
      sourceType: 'action' as const,
      sourceId: item.id,
      title: item.actionTitle,
      owner: item.owner,
      dueDate: item.deadline,
      priority: item.progressPercent >= 100 ? 'low' as const : item.progressPercent >= 60 ? 'medium' as const : 'high' as const,
      status: item.closureStatus,
      progressPercent: item.progressPercent,
      routeKey: 'audit-readiness',
    })),
    ...regulatoryState.tasks.map((item) => ({
      id: item.id,
      workspaceId,
      sourceModule: 'regulatory',
      sourceType: 'task' as const,
      sourceId: item.id,
      title: item.title,
      owner: item.owner,
      dueDate: item.dueDate,
      priority: item.status === 'overdue' ? 'high' as const : 'medium' as const,
      status: item.status,
      progressPercent: item.status === 'completed' ? 100 : item.status === 'in_progress' ? 50 : item.status === 'blocked' ? 20 : 0,
      routeKey: 'regulatory-change',
    })),
    ...privacyState.dsars.map((item) => ({
      id: item.id,
      workspaceId,
      sourceModule: 'privacy',
      sourceType: 'task' as const,
      sourceId: item.id,
      title: `DSAR ${item.requestId}`,
      owner: item.owner,
      dueDate: item.dueDate,
      priority: item.status === 'overdue' ? 'critical' as const : 'medium' as const,
      status: item.status,
      progressPercent: item.status === 'completed' ? 100 : item.status === 'in_progress' ? 60 : 10,
      routeKey: 'privacy-data-governance',
    })),
    ...riskIntelligenceState.treatments.map((item) => ({
      id: item.id,
      workspaceId,
      sourceModule: 'risk',
      sourceType: 'action' as const,
      sourceId: item.id,
      title: item.treatmentName,
      owner: item.owner,
      dueDate: item.dueDate,
      priority: classifyPriority(item.expectedRiskReduction),
      status: item.status,
      progressPercent: item.treatmentEffectivenessPercent,
      routeKey: 'risks',
    })),
  ].sort((left, right) => normalizeSortableDate(left.dueDate).localeCompare(normalizeSortableDate(right.dueDate)));

  const approvalQueue: EnterpriseApprovalItem[] = [
    ...accessState.accessRequests
      .filter((item) => item.status === 'pending' || item.status === 'needs_info')
      .map((item) => ({
        id: item.id,
        workspaceId,
        approvalType: 'Access Request',
        title: `${item.requesterName} · ${item.requestedRoleName}`,
        requester: item.requesterName,
        approver: item.reviewer,
        status: item.status === 'pending' ? 'pending' as const : 'in_review' as const,
        dueDate: item.requestDate,
        routeKey: 'workspace-members',
        entityType: 'review' as const,
        entityId: item.id,
        notes: item.businessReason,
      })),
    ...privacyState.dpias
      .filter((item) => item.approvalStatus === 'in_review')
      .map((item) => ({
        id: item.id,
        workspaceId,
        approvalType: 'Privacy DPIA',
        title: item.assessmentName,
        requester: item.owner,
        approver: 'Privacy Review Board',
        status: 'in_review' as const,
        dueDate: item.reviewDate,
        routeKey: 'privacy-data-governance',
        entityType: 'dpia' as const,
        entityId: item.id,
        notes: item.purpose,
      })),
    ...aiState.models
      .filter((item) => item.approvalStatus === 'pending')
      .map((item) => ({
        id: item.id,
        workspaceId,
        approvalType: 'AI Model Approval',
        title: item.modelName,
        requester: item.owner,
        approver: 'Responsible AI Committee',
        status: 'pending' as const,
        dueDate: item.updatedAt,
        routeKey: 'ai-governance',
        entityType: 'ai_system' as const,
        entityId: item.systemId || item.id,
        notes: `Validation status: ${item.validationStatus}`,
      })),
  ];

  const notifications: EnterpriseNotificationItem[] = [
    ...taskCenter.filter((item) => item.status === 'overdue').slice(0, 4).map((item) => ({
      id: `notif-task-${item.id}`,
      channel: 'in_app' as const,
      title: 'Overdue task',
      message: `${item.title} is overdue for ${item.owner}.`,
      severity: item.priority === 'critical' ? 'critical' as const : 'high' as const,
      routeKey: item.routeKey,
    })),
    ...approvalQueue.slice(0, 4).map((item) => ({
      id: `notif-approval-${item.id}`,
      channel: 'in_app' as const,
      title: 'Approval pending',
      message: `${item.approvalType} requires review: ${item.title}.`,
      severity: 'medium' as const,
      routeKey: item.routeKey,
    })),
    ...privacyState.breaches.filter((item) => item.status !== 'closed').slice(0, 2).map((item) => ({
      id: `notif-breach-${item.id}`,
      channel: 'in_app' as const,
      title: 'Privacy incident active',
      message: `${item.breachType} remains ${item.status}.`,
      severity: item.riskLevel === 'critical' ? 'critical' as const : 'high' as const,
      routeKey: 'privacy-data-governance',
    })),
  ];

  const entities = Array.from(entityMap.values());
  const analytics = buildAnalytics(relationships, regulatoryState, privacyState, esgState, auditState);
  const executiveSummary = buildExecutiveSummary(risks, controls, vendors, privacyState, esgState, aiState, auditState, relationships);

  return {
    summary: {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      openTasks: taskCenter.filter((item) => item.status !== 'completed' && item.status !== 'closed').length,
      pendingApprovals: approvalQueue.filter((item) => item.status === 'pending' || item.status === 'in_review').length,
      criticalNotifications: notifications.filter((item) => item.severity === 'critical' || item.severity === 'high').length,
      crossDomainImpact: executiveSummary.crossDomainImpact,
    },
    entities,
    relationships,
    workflows,
    taskCenter,
    approvalQueue,
    notifications,
    analytics,
    executiveSummary,
    references,
  };
}

export async function searchEnterpriseEntities(workspaceId: string, q: string): Promise<EnterpriseEntityNode[]> {
  const state = await getEnterpriseOpsState(workspaceId);
  const queryText = q.trim().toLowerCase();
  if (!queryText) return state.entities.slice(0, 25);
  return state.entities.filter((item) =>
    item.name.toLowerCase().includes(queryText) ||
    item.entityType.toLowerCase().includes(queryText) ||
    (item.owner || '').toLowerCase().includes(queryText) ||
    (item.businessUnit || '').toLowerCase().includes(queryText) ||
    (item.framework || '').toLowerCase().includes(queryText),
  ).slice(0, 50);
}

export async function getEnterpriseEntity360(workspaceId: string, entityType: EnterpriseEntityType, entityId: string): Promise<EnterpriseEntity360 | null> {
  const state = await getEnterpriseOpsState(workspaceId);
  const entity = state.entities.find((item) => item.entityType === entityType && item.id === entityId);
  if (!entity) return null;

  const relatedRelationships = state.relationships.filter((item) =>
    (item.sourceType === entityType && item.sourceId === entityId) ||
    (item.targetType === entityType && item.targetId === entityId),
  );

  const relatedEntities = relatedRelationships.map((item) =>
    item.sourceType === entityType && item.sourceId === entityId
      ? state.entities.find((candidate) => candidate.entityType === item.targetType && candidate.id === item.targetId)
      : state.entities.find((candidate) => candidate.entityType === item.sourceType && candidate.id === item.sourceId),
  ).filter((item): item is EnterpriseEntityNode => Boolean(item));

  const activity = await getActivitiesForTarget(workspaceId, entityType, entityId);

  const overview: Array<{ label: string; value: string | number }> = [
    { label: 'Entity Type', value: entityLabel(entity.entityType) },
    { label: 'Status', value: entity.status || 'Not set' },
    { label: 'Owner', value: entity.owner || 'Not assigned' },
    { label: 'Business Unit', value: entity.businessUnit || 'Not mapped' },
    { label: 'Relationships', value: relatedRelationships.length },
    { label: 'Activity Entries', value: activity.length },
  ];

  return {
    entity,
    overview,
    relatedEntities,
    relatedRelationships,
    activity: activity.slice(0, 20),
  };
}
