import { generateId, pool, query } from '../db.js';
import type { DashboardIssueRecord, DashboardIssuePriority, DashboardIssueSourceType, DashboardIssueStatus } from '../types/models.js';

type Row = Record<string, unknown>;
const OPEN_STATUSES: DashboardIssueStatus[] = ['Open', 'In Progress', 'Blocked', 'Awaiting Evidence', 'Awaiting Review', 'Deferred', 'Pending'];

function strings(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
function iso(value: unknown): string | undefined { return value ? new Date(String(value)).toISOString() : undefined; }
function dateOnly(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}
function map(row: Row): DashboardIssueRecord {
  const dueDate = dateOnly(row.due_date);
  return {
    id: String(row.id), actionRef: String(row.action_ref), workspaceId: String(row.workspace_id),
    sourceType: row.source_type as DashboardIssueSourceType, sourceReference: String(row.source_reference), sourceStatus: row.source_status ? String(row.source_status) : undefined,
    title: String(row.title), description: row.description ? String(row.description) : undefined, owner: String(row.owner), dueDate,
    status: row.status as DashboardIssueStatus, priority: row.priority as DashboardIssuePriority, domain: String(row.domain || row.source_type),
    isOverdue: Boolean(dueDate && OPEN_STATUSES.includes(row.status as DashboardIssueStatus) && new Date(`${dueDate}T00:00:00Z`).getTime() < new Date().setUTCHours(0,0,0,0)),
    linkedLibraryRiskId: row.linked_library_risk_id ? String(row.linked_library_risk_id) : undefined,
    linkedRiskId: row.linked_risk_id ? String(row.linked_risk_id) : undefined, linkedRiskRef: row.linked_risk_ref ? String(row.linked_risk_ref) : undefined,
    linkedTreatmentPlanId: row.linked_treatment_plan_id ? String(row.linked_treatment_plan_id) : undefined,
    linkedControlIds: strings(row.linked_control_ids), linkedEvidenceIds: strings(row.linked_evidence_ids),
    linkedReviewTaskIds: strings(row.linked_review_task_ids), linkedTrainingAssignmentIds: strings(row.linked_training_assignment_ids), ciaImpacts: strings(row.cia_impacts) as DashboardIssueRecord['ciaImpacts'],
    blockerReason: row.blocker_reason ? String(row.blocker_reason) : undefined, evidenceRequired: row.evidence_required ? String(row.evidence_required) : undefined,
    completedAt: iso(row.completion_date), updatedAt: iso(row.updated_at), notes: row.notes ? String(row.notes) : undefined,
    outsideAppetite: row.outside_appetite == null ? undefined : Boolean(row.outside_appetite), sourceManaged: Boolean(row.source_managed),
    treatmentProgress: row.treatment_progress == null ? undefined : Number(row.treatment_progress),
    targetRiskScore: row.target_risk_score == null ? null : Number(row.target_risk_score),
    targetRiskRating: row.target_risk_rating == null ? null : String(row.target_risk_rating),
    expectedResidualScore: row.expected_residual_score == null ? null : Number(row.expected_residual_score),
    expectedResidualRating: row.expected_residual_rating == null ? null : String(row.expected_residual_rating),
  };
}

export async function ensureRiskActionsSchema() {
  await query(`CREATE TABLE IF NOT EXISTS risk_actions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, action_ref TEXT NOT NULL, source_type TEXT NOT NULL, source_reference TEXT NOT NULL, source_status TEXT, domain TEXT, linked_library_risk_id TEXT, linked_risk_id TEXT, linked_risk_ref TEXT, linked_treatment_plan_id TEXT, linked_control_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_review_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb, linked_training_assignment_ids JSONB NOT NULL DEFAULT '[]'::jsonb, cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb, title TEXT NOT NULL, description TEXT, owner TEXT NOT NULL, due_date DATE, status TEXT NOT NULL, priority TEXT NOT NULL, blocker_reason TEXT, evidence_required TEXT, completion_date TIMESTAMPTZ, notes TEXT, outside_appetite BOOLEAN, source_managed BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(workspace_id,action_ref), UNIQUE(workspace_id,source_type,source_reference))`);
  await query(`CREATE INDEX IF NOT EXISTS idx_risk_actions_workspace_status ON risk_actions(workspace_id,status,updated_at DESC)`);
  await query(`ALTER TABLE risk_actions ADD COLUMN IF NOT EXISTS treatment_progress INTEGER, ADD COLUMN IF NOT EXISTS target_risk_score NUMERIC(8,2), ADD COLUMN IF NOT EXISTS target_risk_rating TEXT, ADD COLUMN IF NOT EXISTS expected_residual_score NUMERIC(8,2), ADD COLUMN IF NOT EXISTS expected_residual_rating TEXT`);
}

export async function syncDerived(workspaceId: string, records: DashboardIssueRecord[]): Promise<void> {
  await ensureRiskActionsSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`risk-actions:${workspaceId}`]);
    const existingResult = await client.query<{ id:string; action_ref:string; source_type:string; source_reference:string }>(
      'SELECT id,action_ref,source_type,source_reference FROM risk_actions WHERE workspace_id=$1',
      [workspaceId],
    );
    const existing = new Map(existingResult.rows.map(row => [`${row.source_type}:\0${row.source_reference}`, row]));
    let next = existingResult.rows.reduce((maximum, row) => {
      const value = Number(row.action_ref.replace(/\D/g, ''));
      return Number.isFinite(value) ? Math.max(maximum, value) : maximum;
    }, 0) + 1;
    const payload = records.map(item => {
      const found = existing.get(`${item.sourceType}:\0${item.id}`);
      return {
        id: found?.id || generateId('raction'),
        actionRef: found?.action_ref || `ACT-${String(next++).padStart(4,'0')}`,
        sourceType:item.sourceType, sourceReference:item.id, sourceStatus:item.sourceStatus || null, domain:item.domain,
        linkedLibraryRiskId:item.linkedLibraryRiskId || null, linkedRiskId:item.linkedRiskId || null, linkedRiskRef:item.linkedRiskRef || null,
        linkedTreatmentPlanId:item.linkedTreatmentPlanId || null, linkedControlIds:item.linkedControlIds, linkedEvidenceIds:item.linkedEvidenceIds,
        linkedReviewTaskIds:item.linkedReviewTaskIds, linkedTrainingAssignmentIds:item.linkedTrainingAssignmentIds, ciaImpacts:item.ciaImpacts,
        title:item.title, description:item.description || null, owner:item.owner, dueDate:item.dueDate || null, status:item.status,
        priority:item.priority, notes:item.notes || null, outsideAppetite:item.outsideAppetite ?? null, treatmentProgress:item.treatmentProgress ?? null,
        targetRiskScore:item.targetRiskScore ?? null, targetRiskRating:item.targetRiskRating ?? null,
        expectedResidualScore:item.expectedResidualScore ?? null, expectedResidualRating:item.expectedResidualRating ?? null,
      };
    });
    if (payload.length) {
      await client.query(`WITH incoming AS (SELECT value AS item FROM jsonb_array_elements($2::jsonb))
        INSERT INTO risk_actions(id,workspace_id,action_ref,source_type,source_reference,source_status,domain,linked_library_risk_id,linked_risk_id,linked_risk_ref,linked_treatment_plan_id,linked_control_ids,linked_evidence_ids,linked_review_task_ids,linked_training_assignment_ids,cia_impacts,title,description,owner,due_date,status,priority,notes,outside_appetite,treatment_progress,target_risk_score,target_risk_rating,expected_residual_score,expected_residual_rating,source_managed)
        SELECT item->>'id',$1,item->>'actionRef',item->>'sourceType',item->>'sourceReference',item->>'sourceStatus',item->>'domain',item->>'linkedLibraryRiskId',item->>'linkedRiskId',item->>'linkedRiskRef',item->>'linkedTreatmentPlanId',
          COALESCE(item->'linkedControlIds','[]'::jsonb),COALESCE(item->'linkedEvidenceIds','[]'::jsonb),COALESCE(item->'linkedReviewTaskIds','[]'::jsonb),COALESCE(item->'linkedTrainingAssignmentIds','[]'::jsonb),COALESCE(item->'ciaImpacts','[]'::jsonb),
          item->>'title',item->>'description',item->>'owner',NULLIF(item->>'dueDate','')::date,item->>'status',item->>'priority',item->>'notes',NULLIF(item->>'outsideAppetite','')::boolean,NULLIF(item->>'treatmentProgress','')::int,
          NULLIF(item->>'targetRiskScore','')::numeric,item->>'targetRiskRating',NULLIF(item->>'expectedResidualScore','')::numeric,item->>'expectedResidualRating',TRUE
        FROM incoming
        ON CONFLICT(workspace_id,source_type,source_reference) DO UPDATE SET
          source_status=EXCLUDED.source_status,domain=EXCLUDED.domain,linked_library_risk_id=EXCLUDED.linked_library_risk_id,linked_risk_id=EXCLUDED.linked_risk_id,linked_risk_ref=EXCLUDED.linked_risk_ref,
          linked_treatment_plan_id=EXCLUDED.linked_treatment_plan_id,linked_control_ids=EXCLUDED.linked_control_ids,linked_evidence_ids=EXCLUDED.linked_evidence_ids,linked_review_task_ids=EXCLUDED.linked_review_task_ids,
          linked_training_assignment_ids=EXCLUDED.linked_training_assignment_ids,cia_impacts=EXCLUDED.cia_impacts,title=EXCLUDED.title,description=EXCLUDED.description,
          owner=CASE WHEN risk_actions.source_managed THEN EXCLUDED.owner ELSE risk_actions.owner END,
          due_date=CASE WHEN risk_actions.source_managed THEN EXCLUDED.due_date ELSE risk_actions.due_date END,
          priority=CASE WHEN risk_actions.source_managed THEN EXCLUDED.priority ELSE risk_actions.priority END,
          status=CASE WHEN EXCLUDED.status IN ('Completed','Cancelled') THEN EXCLUDED.status WHEN risk_actions.source_managed THEN EXCLUDED.status ELSE risk_actions.status END,
          completion_date=CASE WHEN EXCLUDED.status IN ('Completed','Cancelled') THEN COALESCE(risk_actions.completion_date,NOW()) WHEN risk_actions.source_managed THEN NULL ELSE risk_actions.completion_date END,
          outside_appetite=EXCLUDED.outside_appetite,treatment_progress=EXCLUDED.treatment_progress,target_risk_score=EXCLUDED.target_risk_score,target_risk_rating=EXCLUDED.target_risk_rating,
          expected_residual_score=EXCLUDED.expected_residual_score,expected_residual_rating=EXCLUDED.expected_residual_rating,updated_at=NOW()`, [workspaceId, JSON.stringify(payload)]);
    }
    await client.query(`UPDATE risk_actions SET status='Completed', completion_date=COALESCE(completion_date,NOW()), updated_at=NOW()
      WHERE workspace_id=$1 AND source_managed=TRUE AND status NOT IN ('Completed','Cancelled')
      AND source_type <> 'Manual'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements($2::jsonb) incoming
        WHERE incoming->>'sourceType'=risk_actions.source_type
          AND incoming->>'sourceReference'=risk_actions.source_reference
      )`, [workspaceId, JSON.stringify(payload)]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export type RiskActionFilters = { source?: DashboardIssueSourceType; status?: DashboardIssueStatus; priority?: DashboardIssuePriority; overdue?: boolean };
export async function list(workspaceId: string, filters: RiskActionFilters = {}): Promise<DashboardIssueRecord[]> {
  await ensureRiskActionsSchema();
  const values: unknown[] = [workspaceId]; const conditions = ['workspace_id=$1'];
  for (const [column,value] of [['source_type',filters.source],['status',filters.status],['priority',filters.priority]] as const) {
    if (value) { values.push(value); conditions.push(`${column}=$${values.length}`); }
  }
  if (filters.overdue) conditions.push(`due_date < CURRENT_DATE AND status IN ('Open','In Progress','Blocked','Awaiting Evidence','Awaiting Review','Deferred','Pending')`);
  return (await query(`SELECT * FROM risk_actions WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`,values)).rows.map(map);
}
export async function get(workspaceId:string,id:string):Promise<DashboardIssueRecord|null>{await ensureRiskActionsSchema();const r=await query('SELECT * FROM risk_actions WHERE workspace_id=$1 AND (id=$2 OR action_ref=$2)',[workspaceId,id]);return r.rows[0]?map(r.rows[0]):null;}
export async function createManual(workspaceId:string,input:Partial<DashboardIssueRecord>):Promise<DashboardIssueRecord>{
  await ensureRiskActionsSchema(); const client=await pool.connect();
  try { await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`risk-actions:${workspaceId}`]);
    const ref=await client.query<{next:number}>(`SELECT COALESCE(MAX(NULLIF(regexp_replace(action_ref,'\\D','','g'),'')::int),0)+1 AS next FROM risk_actions WHERE workspace_id=$1`,[workspaceId]);
    const actionRef=`ACT-${String(ref.rows[0]?.next||1).padStart(4,'0')}`; const id=generateId('raction');
    await client.query(`INSERT INTO risk_actions(id,workspace_id,action_ref,source_type,source_reference,domain,title,description,owner,due_date,status,priority,blocker_reason,evidence_required,notes,source_managed) VALUES($1,$2,$3,'Manual',$3,'Manual',$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE)`,[id,workspaceId,actionRef,input.title,input.description||null,input.owner,input.dueDate||null,input.status||'Open',input.priority||'Medium',input.blockerReason||null,input.evidenceRequired||null,input.notes||null]);
    await client.query('COMMIT'); return (await get(workspaceId,id))!;
  } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
}
export async function update(workspaceId:string,id:string,input:Partial<DashboardIssueRecord>):Promise<DashboardIssueRecord|null>{const existing=await get(workspaceId,id);if(!existing)return null;const allowed:Record<string,string>={status:'status',priority:'priority',owner:'owner',dueDate:'due_date',blockerReason:'blocker_reason',evidenceRequired:'evidence_required',notes:'notes'};const values:unknown[]=[workspaceId,existing.id];const sets:string[]=[];for(const [key,column] of Object.entries(allowed)){const value=input[key as keyof DashboardIssueRecord];if(value!==undefined){values.push(value||null);sets.push(`${column}=$${values.length}`);}}if(input.status==='Completed')sets.push('completion_date=COALESCE(completion_date,NOW())');else if(input.status)sets.push('completion_date=NULL');if(!sets.length)return existing;sets.push('source_managed=FALSE','updated_at=NOW()');await query(`UPDATE risk_actions SET ${sets.join(',')} WHERE workspace_id=$1 AND id=$2`,values);return get(workspaceId,existing.id);}
