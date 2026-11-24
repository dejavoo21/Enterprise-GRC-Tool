import { generateId, pool, query } from '../db.js';
import type {
  AssuranceException,
  AssuranceSetting,
  AutomatedTest,
  ControlMonitor,
  RemediationTask,
  Severity,
  TestResultStatus,
  TestRun,
} from '../types/continuousAssurance.js';

type Actor = { userId: string; name: string };

const iso = (value: unknown) => value ? new Date(value as string | Date).toISOString() : null;

function mapMonitor(row: any): ControlMonitor {
  return {
    id: row.id, workspaceId: row.workspace_id, name: row.name, controlId: row.control_id,
    controlName: row.control_name, framework: row.framework, frameworkId: row.framework_id || undefined,
    controlObjective: row.control_objective, testType: row.test_type, frequency: row.frequency,
    owner: row.owner, status: row.status, lastRun: iso(row.last_run), nextRun: iso(row.next_run),
    result: row.result, evidenceOutput: row.evidence_output,
    evidenceRequirementId: row.evidence_requirement_id || null, evidenceJobId: null,
    exceptionCount: Number(row.exception_count || 0),
  };
}

function mapTest(row: any): AutomatedTest {
  return {
    id: row.id, workspaceId: row.workspace_id, monitorId: row.monitor_id, name: row.name,
    description: row.description, schedule: row.schedule, enabled: row.enabled, owner: row.owner,
    lastRun: iso(row.last_run), lastResult: row.last_result,
  };
}

function mapRun(row: any): TestRun {
  return {
    id: row.id, workspaceId: row.workspace_id, automatedTestId: row.automated_test_id,
    monitorId: row.monitor_id, startedAt: iso(row.started_at)!, completedAt: iso(row.completed_at),
    status: row.status, summary: row.summary, details: row.details,
    evidenceGenerated: Array.isArray(row.evidence_ids) ? row.evidence_ids : [],
  };
}

function mapException(row: any): AssuranceException {
  const evidenceIds = Array.isArray(row.evidence_ids) ? row.evidence_ids : [];
  return {
    id: row.id, workspaceId: row.workspace_id, type: row.type, severity: row.severity,
    source: row.source, linkedControlId: row.linked_control_id || null,
    linkedFramework: row.linked_framework || null, linkedRiskId: row.linked_risk_id || null,
    owner: row.owner, dueDate: iso(row.due_date), status: row.status,
    remediationAction: row.remediation_action, evidence: evidenceIds.join(', ') || null,
    evidenceIds, resolutionRationale: row.resolution_rationale || null,
    resolvedBy: row.resolved_by_name || null, resolvedAt: iso(row.resolved_at),
  } as AssuranceException;
}

function mapTask(row: any): RemediationTask {
  return {
    id: row.id, workspaceId: row.workspace_id, sourceType: row.source_type, sourceId: row.source_id,
    linkedObjectLabel: row.linked_object_label, title: row.title, description: row.description,
    owner: row.owner, priority: row.priority, dueDate: iso(row.due_date), status: row.status,
    linkedObjectType: row.linked_object_type, linkedObjectId: row.linked_object_id,
    createdAt: iso(row.created_at)!,
  };
}

const monitorSelect = `SELECT m.*,
  (SELECT COUNT(*) FROM ccm_assurance_exceptions e WHERE e.workspace_id=m.workspace_id AND e.linked_control_id=m.control_id AND e.status NOT IN ('resolved','accepted')) AS exception_count
  FROM ccm_control_monitors m`;

export async function listMonitors(workspaceId: string): Promise<ControlMonitor[]> {
  const result = await query(`${monitorSelect} WHERE m.workspace_id=$1 ORDER BY m.updated_at DESC`, [workspaceId]);
  return result.rows.map(mapMonitor);
}

export async function getMonitor(workspaceId: string, id: string): Promise<ControlMonitor | null> {
  const result = await query(`${monitorSelect} WHERE m.workspace_id=$1 AND m.id=$2`, [workspaceId, id]);
  return result.rows[0] ? mapMonitor(result.rows[0]) : null;
}

export async function createMonitorWithTest(workspaceId: string, input: {
  name: string; controlId: string; controlName: string; framework: string; frameworkId?: string | null;
  controlObjective: string; testType: string; frequency: string; owner: string; nextRun?: string | null;
}, actor: Actor): Promise<ControlMonitor> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const monitorId = generateId('ccm-mon');
    const monitor = (await client.query(
      `INSERT INTO ccm_control_monitors
       (id,workspace_id,name,control_id,control_name,framework,framework_id,control_objective,test_type,frequency,owner,next_run,created_by_user_id,created_by_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [monitorId, workspaceId, input.name, input.controlId, input.controlName, input.framework, input.frameworkId || null,
        input.controlObjective, input.testType, input.frequency, input.owner, input.nextRun || null, actor.userId, actor.name],
    )).rows[0];
    await client.query(
      `INSERT INTO ccm_automated_tests
       (id,workspace_id,monitor_id,name,description,schedule,owner,created_by_user_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [generateId('ccm-test'), workspaceId, monitorId, `${input.name} test`, input.controlObjective, input.frequency, input.owner, actor.userId],
    );
    await client.query('COMMIT');
    return mapMonitor({ ...monitor, exception_count: 0 });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function updateMonitor(workspaceId: string, id: string, input: Partial<ControlMonitor>): Promise<ControlMonitor | null> {
  const result = await query(
    `UPDATE ccm_control_monitors SET
       name=COALESCE($3,name), control_name=COALESCE($4,control_name), framework=COALESCE($5,framework),
       control_objective=COALESCE($6,control_objective), frequency=COALESCE($7,frequency), owner=COALESCE($8,owner),
       status=COALESCE($9,status), next_run=COALESCE($10,next_run), updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 RETURNING *`,
    [workspaceId, id, input.name ?? null, input.controlName ?? null, input.framework ?? null,
      input.controlObjective ?? null, input.frequency ?? null, input.owner ?? null, input.status ?? null, input.nextRun ?? null],
  );
  return result.rows[0] ? mapMonitor({ ...result.rows[0], exception_count: 0 }) : null;
}

export async function listTests(workspaceId: string): Promise<AutomatedTest[]> {
  const result = await query(`SELECT * FROM ccm_automated_tests WHERE workspace_id=$1 ORDER BY updated_at DESC`, [workspaceId]);
  return result.rows.map(mapTest);
}

export async function listRuns(workspaceId: string): Promise<TestRun[]> {
  const result = await query(`SELECT * FROM ccm_test_runs WHERE workspace_id=$1 ORDER BY completed_at DESC LIMIT 200`, [workspaceId]);
  return result.rows.map(mapRun);
}

export async function updateTest(workspaceId: string, id: string, input: Partial<AutomatedTest>): Promise<AutomatedTest | null> {
  const result = await query(
    `UPDATE ccm_automated_tests SET name=COALESCE($3,name),description=COALESCE($4,description),schedule=COALESCE($5,schedule),
      enabled=COALESCE($6,enabled),owner=COALESCE($7,owner),updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 RETURNING *`,
    [workspaceId, id, input.name ?? null, input.description ?? null, input.schedule ?? null, input.enabled ?? null, input.owner ?? null],
  );
  return result.rows[0] ? mapTest(result.rows[0]) : null;
}

export async function recordTestRun(workspaceId: string, testId: string, input: {
  status: TestResultStatus; summary: string; details: string; evidenceIds: string[]; severity: Severity;
}, actor: Actor): Promise<{ test: AutomatedTest; run: TestRun; exception: AssuranceException | null }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const testRow = (await client.query(`SELECT * FROM ccm_automated_tests WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, testId])).rows[0];
    if (!testRow) throw new Error('Automated test not found in this workspace');
    if (!testRow.enabled) throw new Error('Disabled tests cannot be executed');
    const monitorRow = (await client.query(`SELECT * FROM ccm_control_monitors WHERE workspace_id=$1 AND id=$2 FOR UPDATE`, [workspaceId, testRow.monitor_id])).rows[0];
    if (!monitorRow) throw new Error('Linked monitor not found in this workspace');
    const runId = generateId('ccm-run');
    const runRow = (await client.query(
      `INSERT INTO ccm_test_runs
       (id,workspace_id,automated_test_id,monitor_id,status,summary,details,evidence_ids,executed_by_user_id,executed_by_name)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`,
      [runId, workspaceId, testId, testRow.monitor_id, input.status, input.summary, input.details,
        JSON.stringify(input.evidenceIds), actor.userId, actor.name],
    )).rows[0];
    await client.query(`UPDATE ccm_automated_tests SET last_run=NOW(),last_result=$3,updated_at=NOW() WHERE workspace_id=$1 AND id=$2`, [workspaceId, testId, input.status]);
    await client.query(
      `UPDATE ccm_control_monitors SET last_run=NOW(),result=$3,status=$4,updated_at=NOW() WHERE workspace_id=$1 AND id=$2`,
      [workspaceId, testRow.monitor_id, input.status, input.status === 'failed' ? 'failed' : input.status === 'warning' ? 'warning' : 'active'],
    );
    let exceptionRow: any = null;
    if (input.status === 'failed' || input.status === 'warning') {
      exceptionRow = (await client.query(
        `INSERT INTO ccm_assurance_exceptions
         (id,workspace_id,type,severity,source,source_run_id,linked_control_id,linked_framework,owner,status,remediation_action,created_by_user_id,created_by_name)
         VALUES($1,$2,$3,$4,'control_test',$5,$6,$7,$8,'open',$9,$10,$11) RETURNING *`,
        [generateId('ccm-exc'), workspaceId, `${testRow.name} ${input.status}`, input.severity, runId,
          monitorRow.control_id, monitorRow.framework, monitorRow.owner, input.details, actor.userId, actor.name],
      )).rows[0];
    }
    await client.query('COMMIT');
    return {
      test: mapTest({ ...testRow, last_run: runRow.completed_at, last_result: input.status }),
      run: mapRun(runRow), exception: exceptionRow ? mapException(exceptionRow) : null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function listExceptions(workspaceId: string): Promise<AssuranceException[]> {
  const result = await query(`SELECT * FROM ccm_assurance_exceptions WHERE workspace_id=$1 ORDER BY updated_at DESC`, [workspaceId]);
  return result.rows.map(mapException);
}

export async function createException(workspaceId: string, input: {
  type: string; severity: Severity; source: string; linkedControlId?: string | null; linkedFramework?: string | null;
  linkedRiskId?: string | null; owner: string; dueDate?: string | null; remediationAction: string;
}, actor: Actor): Promise<AssuranceException> {
  const result = await query(
    `INSERT INTO ccm_assurance_exceptions
     (id,workspace_id,type,severity,source,linked_control_id,linked_framework,linked_risk_id,owner,due_date,status,remediation_action,created_by_user_id,created_by_name)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',$11,$12,$13) RETURNING *`,
    [generateId('ccm-exc'), workspaceId, input.type, input.severity, input.source, input.linkedControlId || null,
      input.linkedFramework || null, input.linkedRiskId || null, input.owner, input.dueDate || null,
      input.remediationAction, actor.userId, actor.name],
  );
  return mapException(result.rows[0]);
}

export async function updateException(workspaceId: string, id: string, input: {
  owner?: string; dueDate?: string | null; status?: AssuranceException['status']; remediationAction?: string;
  evidenceIds?: string[]; resolutionRationale?: string; actor?: Actor;
}): Promise<AssuranceException | null> {
  const terminal = input.status === 'resolved' || input.status === 'accepted';
  if (terminal && (!input.actor || !input.resolutionRationale?.trim() || !input.evidenceIds?.length)) {
    throw new Error('Resolution requires an authenticated reviewer, rationale and evidence references');
  }
  const result = await query(
    `UPDATE ccm_assurance_exceptions SET owner=COALESCE($3,owner),due_date=COALESCE($4,due_date),
      status=COALESCE($5,status),remediation_action=COALESCE($6,remediation_action),
      evidence_ids=CASE WHEN $7::jsonb IS NULL THEN evidence_ids ELSE $7::jsonb END,
      resolution_rationale=CASE WHEN $8::text IS NULL THEN resolution_rationale ELSE $8 END,
      resolved_by_user_id=CASE WHEN $5 IN ('resolved','accepted') THEN $9 ELSE resolved_by_user_id END,
      resolved_by_name=CASE WHEN $5 IN ('resolved','accepted') THEN $10 ELSE resolved_by_name END,
      resolved_at=CASE WHEN $5 IN ('resolved','accepted') THEN NOW() ELSE resolved_at END,updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 RETURNING *`,
    [workspaceId, id, input.owner ?? null, input.dueDate ?? null, input.status ?? null,
      input.remediationAction ?? null, input.evidenceIds ? JSON.stringify(input.evidenceIds) : null,
      input.resolutionRationale ?? null, input.actor?.userId ?? null, input.actor?.name ?? null],
  );
  return result.rows[0] ? mapException(result.rows[0]) : null;
}

export async function listTasks(workspaceId: string): Promise<RemediationTask[]> {
  const result = await query(`SELECT * FROM ccm_remediation_tasks WHERE workspace_id=$1 ORDER BY due_date NULLS LAST,created_at DESC`, [workspaceId]);
  return result.rows.map(mapTask);
}

export async function createTask(workspaceId: string, input: Omit<RemediationTask, 'id'|'workspaceId'|'createdAt'>, actor: Actor): Promise<RemediationTask> {
  const targetTable = input.linkedObjectType === 'test' ? 'ccm_automated_tests' : input.linkedObjectType === 'exception' ? 'ccm_assurance_exceptions' : null;
  if (!targetTable) throw new Error('Only persisted test and exception remediation targets are currently supported');
  const target = await query(`SELECT id FROM ${targetTable} WHERE workspace_id=$1 AND id=$2`, [workspaceId, input.linkedObjectId]);
  if (!target.rows[0]) throw new Error('Linked assurance record is unavailable in this workspace');
  const result = await query(
    `INSERT INTO ccm_remediation_tasks
     (id,workspace_id,source_type,source_id,linked_object_label,title,description,owner,priority,due_date,status,linked_object_type,linked_object_id,created_by_user_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [generateId('ccm-task'), workspaceId, input.sourceType, input.sourceId, input.linkedObjectLabel,
      input.title, input.description, input.owner, input.priority, input.dueDate || null, input.status,
      input.linkedObjectType, input.linkedObjectId, actor.userId],
  );
  return mapTask(result.rows[0]);
}

export async function updateTask(workspaceId: string, id: string, input: Partial<RemediationTask>): Promise<RemediationTask | null> {
  const result = await query(
    `UPDATE ccm_remediation_tasks SET title=COALESCE($3,title),description=COALESCE($4,description),owner=COALESCE($5,owner),
      priority=COALESCE($6,priority),due_date=COALESCE($7,due_date),status=COALESCE($8,status),updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 RETURNING *`,
    [workspaceId, id, input.title ?? null, input.description ?? null, input.owner ?? null,
      input.priority ?? null, input.dueDate ?? null, input.status ?? null],
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

export async function getSettings(workspaceId: string): Promise<AssuranceSetting> {
  await query(`INSERT INTO ccm_settings(workspace_id) VALUES($1) ON CONFLICT(workspace_id) DO NOTHING`, [workspaceId]);
  const row = (await query(`SELECT * FROM ccm_settings WHERE workspace_id=$1`, [workspaceId])).rows[0];
  return {
    defaultTestFrequency: row.default_test_frequency,
    evidenceFreshnessPeriodDays: row.evidence_freshness_period_days,
    driftSeverityThreshold: row.drift_severity_threshold,
    exceptionSlaDays: row.exception_sla_days,
    notificationRules: [], connectorSyncFrequency: row.connector_sync_frequency,
    autoCreateRemediationTask: row.auto_create_remediation_task, autoLinkEvidence: row.auto_link_evidence,
  };
}

export async function updateSettings(workspaceId: string, input: Partial<AssuranceSetting>, actorUserId: string): Promise<AssuranceSetting> {
  await getSettings(workspaceId);
  await query(
    `UPDATE ccm_settings SET default_test_frequency=COALESCE($2,default_test_frequency),
      evidence_freshness_period_days=COALESCE($3,evidence_freshness_period_days),drift_severity_threshold=COALESCE($4,drift_severity_threshold),
      exception_sla_days=COALESCE($5,exception_sla_days),updated_by_user_id=$6,updated_at=NOW() WHERE workspace_id=$1`,
    [workspaceId, input.defaultTestFrequency ?? null, input.evidenceFreshnessPeriodDays ?? null,
      input.driftSeverityThreshold ?? null, input.exceptionSlaDays ?? null, actorUserId],
  );
  return getSettings(workspaceId);
}
