import { generateId, query } from '../db.js';
import { summarizeScopedControls } from '../services/frameworkAssessmentScopeRules.js';

export async function ensureFrameworkAssessmentScopeSchema() {
  await query(`CREATE TABLE IF NOT EXISTS framework_assessment_scopes (
    id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, framework_code TEXT NOT NULL, framework_name TEXT NOT NULL,
    framework_version TEXT, name TEXT NOT NULL, description TEXT, organisation_unit TEXT, period_start DATE, period_end DATE,
    approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','pending_review','approved','rejected','expired')),
    approved_by TEXT, approved_at TIMESTAMPTZ, review_date DATE, created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS framework_scope_controls (
    scope_id TEXT NOT NULL REFERENCES framework_assessment_scopes(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE RESTRICT, control_title TEXT NOT NULL,
    framework_reference TEXT, inclusion_status TEXT NOT NULL DEFAULT 'included' CHECK (inclusion_status IN ('included','excluded','not_applicable','inherited','deferred','out_of_scope')),
    exclusion_reason TEXT, justification TEXT, evidence_reference TEXT, review_date DATE,
    created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (scope_id, control_id)
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_framework_scopes_workspace ON framework_assessment_scopes(workspace_id, framework_code)');
  await query('CREATE INDEX IF NOT EXISTS idx_framework_scope_controls_status ON framework_scope_controls(scope_id, inclusion_status)');
}

const mapScope = (row: any) => ({
  id: row.id, workspaceId: row.workspace_id, frameworkCode: row.framework_code, frameworkName: row.framework_name,
  frameworkVersion: row.framework_version, name: row.name, description: row.description, organisationUnit: row.organisation_unit,
  periodStart: row.period_start, periodEnd: row.period_end, approvalStatus: row.approval_status, approvedBy: row.approved_by,
  approvedAt: row.approved_at, reviewDate: row.review_date, createdBy: row.created_by, updatedBy: row.updated_by,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
const mapControl = (row: any) => ({
  controlId: row.control_id, controlTitle: row.control_title, frameworkReference: row.framework_reference,
  inclusionStatus: row.inclusion_status, exclusionReason: row.exclusion_reason, justification: row.justification,
  evidenceReference: row.evidence_reference, reviewDate: row.review_date, implementationStatus: row.implementation_status,
});

export async function listScopes(workspaceId: string, frameworkCode?: string) {
  const result = await query(`SELECT * FROM framework_assessment_scopes WHERE workspace_id=$1 ${frameworkCode ? 'AND framework_code=$2' : ''} ORDER BY updated_at DESC`, frameworkCode ? [workspaceId, frameworkCode] : [workspaceId]);
  return result.rows.map(mapScope);
}

export async function createScope(workspaceId: string, actor: string, input: any) {
  const id = generateId('FAS');
  const created = await query(`INSERT INTO framework_assessment_scopes
    (id,workspace_id,framework_code,framework_name,framework_version,name,description,organisation_unit,period_start,period_end,review_date,created_by,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
    [id, workspaceId, input.frameworkCode, input.frameworkName, input.frameworkVersion || null, input.name, input.description || null, input.organisationUnit || null, input.periodStart || null, input.periodEnd || null, input.reviewDate || null, actor]);
  await query(`INSERT INTO framework_scope_controls(scope_id,control_id,control_title,framework_reference,created_by,updated_by)
    SELECT $1,c.id,c.title,cm.reference,$2,$2 FROM controls c JOIN control_mappings cm ON cm.control_id=c.id
    WHERE c.workspace_id=$3 AND cm.framework=$4 ON CONFLICT DO NOTHING`, [id, actor, workspaceId, input.frameworkCode]);
  return mapScope(created.rows[0]);
}

export async function getScope(workspaceId: string, id: string) {
  const scopeResult = await query('SELECT * FROM framework_assessment_scopes WHERE id=$1 AND workspace_id=$2', [id, workspaceId]);
  if (!scopeResult.rows[0]) return null;
  const controlsResult = await query(`SELECT fsc.*,c.status AS implementation_status FROM framework_scope_controls fsc JOIN controls c ON c.id=fsc.control_id WHERE fsc.scope_id=$1 ORDER BY fsc.framework_reference,fsc.control_title`, [id]);
  const controls = controlsResult.rows.map(mapControl);
  return { ...mapScope(scopeResult.rows[0]), controls, summary: summarizeScopedControls(controls) };
}

export async function updateScopeControl(workspaceId: string, scopeId: string, controlId: string, actor: string, input: any) {
  const result = await query(`UPDATE framework_scope_controls fsc SET inclusion_status=$1,exclusion_reason=$2,justification=$3,evidence_reference=$4,review_date=$5,updated_by=$6,updated_at=NOW()
    FROM framework_assessment_scopes fas WHERE fsc.scope_id=fas.id AND fas.workspace_id=$7 AND fsc.scope_id=$8 AND fsc.control_id=$9 RETURNING fsc.*`,
    [input.inclusionStatus, input.exclusionReason || null, input.justification || null, input.evidenceReference || null, input.reviewDate || null, actor, workspaceId, scopeId, controlId]);
  return result.rows[0] ? mapControl(result.rows[0]) : null;
}

export async function includeAll(workspaceId: string, scopeId: string, actor: string) {
  await query(`UPDATE framework_scope_controls fsc SET inclusion_status='included',exclusion_reason=NULL,justification=NULL,evidence_reference=NULL,review_date=NULL,updated_by=$1,updated_at=NOW() FROM framework_assessment_scopes fas WHERE fsc.scope_id=fas.id AND fas.workspace_id=$2 AND fsc.scope_id=$3`, [actor, workspaceId, scopeId]);
}

export async function approveScope(workspaceId: string, scopeId: string, actor: string) {
  const invalid = await query(`SELECT COUNT(*)::int AS count FROM framework_scope_controls fsc JOIN framework_assessment_scopes fas ON fas.id=fsc.scope_id WHERE fas.workspace_id=$1 AND fas.id=$2 AND fsc.inclusion_status<>'included' AND (fsc.exclusion_reason IS NULL OR BTRIM(COALESCE(fsc.justification,''))='')`, [workspaceId, scopeId]);
  if (Number(invalid.rows[0]?.count || 0) > 0) throw new Error('All non-included controls require a reason and justification before approval.');
  const result = await query(`UPDATE framework_assessment_scopes SET approval_status='approved',approved_by=$1,approved_at=NOW(),updated_by=$1,updated_at=NOW() WHERE workspace_id=$2 AND id=$3 RETURNING *`, [actor, workspaceId, scopeId]);
  return result.rows[0] ? mapScope(result.rows[0]) : null;
}
