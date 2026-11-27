import { generateId, pool, query } from '../db.js';
import type {
  AssuranceException,
  AssuranceNotification,
  AssuranceSetting,
  AssuranceReport,
  AssuranceReportSnapshot,
  AutomatedTest,
  ControlMonitor,
  RemediationTask,
  NotificationPreference,
  NotificationStatus,
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
    archivedAt: iso(row.archived_at), archivedByUserId: row.archived_by_user_id || null,
    archiveReason: row.archive_reason || null,
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

function mapReport(row: any): AssuranceReport {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    type: row.report_type,
    generatedAt: iso(row.generated_at)!,
    generatedBy: row.generated_by_name,
    formatSupport: ['json', 'csv'],
    summary: row.summary,
    snapshot: row.snapshot as AssuranceReportSnapshot,
  };
}

function mapNotification(row: any): AssuranceNotification {
  const snoozedUntil = iso(row.snoozed_until);
  const status = row.status === 'snoozed' && snoozedUntil && new Date(snoozedUntil).getTime() <= Date.now()
    ? 'unread'
    : row.status;
  return {
    id: row.id, workspaceId: row.workspace_id, type: row.notification_type,
    title: row.title, detail: row.detail, severity: row.severity, status,
    routeKey: row.route_key, createdAt: iso(row.created_at)!, assignedTo: row.assigned_to || null,
    snoozedUntil,
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
     WHERE workspace_id=$1 AND id=$2 AND status <> 'archived' RETURNING *`,
    [workspaceId, id, input.name ?? null, input.controlName ?? null, input.framework ?? null,
      input.controlObjective ?? null, input.frequency ?? null, input.owner ?? null, input.status ?? null, input.nextRun ?? null],
  );
  return result.rows[0] ? mapMonitor({ ...result.rows[0], exception_count: 0 }) : null;
}

export async function archiveMonitor(workspaceId: string, id: string, reason: string, actor: Actor): Promise<ControlMonitor | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query(
      `SELECT * FROM ccm_control_monitors WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [workspaceId, id],
    )).rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }
    if (current.status === 'archived') throw Object.assign(new Error('Control monitor is already archived'), { status: 409 });
    if (current.status !== 'disabled') throw Object.assign(new Error('Disable the control monitor before archiving it'), { status: 409 });
    const archived = (await client.query(
      `UPDATE ccm_control_monitors SET status='archived', archived_at=NOW(), archived_by_user_id=$3,
         archive_reason=$4, next_run=NULL, updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 RETURNING *`,
      [workspaceId, id, actor.userId, reason],
    )).rows[0];
    await client.query(
      `UPDATE ccm_automated_tests SET enabled=FALSE, updated_at=NOW() WHERE workspace_id=$1 AND monitor_id=$2`,
      [workspaceId, id],
    );
    await client.query('COMMIT');
    return mapMonitor({ ...archived, exception_count: 0 });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listReports(workspaceId: string): Promise<AssuranceReport[]> {
  const result = await query(
    `SELECT * FROM ccm_assurance_reports WHERE workspace_id=$1 ORDER BY generated_at DESC LIMIT 100`,
    [workspaceId],
  );
  return result.rows.map(mapReport);
}

export async function getReport(workspaceId: string, id: string): Promise<AssuranceReport | null> {
  const result = await query(`SELECT * FROM ccm_assurance_reports WHERE workspace_id=$1 AND id=$2`, [workspaceId, id]);
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

export async function createReport(workspaceId: string, input: {
  title: string;
  reportType: string;
  summary: string;
  snapshot: AssuranceReportSnapshot;
}, actor: Actor): Promise<AssuranceReport> {
  const result = await query(
    `INSERT INTO ccm_assurance_reports
       (id,workspace_id,title,report_type,summary,snapshot,generated_by_user_id,generated_by_name)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`,
    [generateId('ccm-report'), workspaceId, input.title, input.reportType, input.summary,
      JSON.stringify(input.snapshot), actor.userId, actor.name],
  );
  return mapReport(result.rows[0]);
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
      const preference = (await client.query(
        `SELECT enabled FROM ccm_assurance_notification_preferences
         WHERE workspace_id=$1 AND channel='in_app' AND notification_type='failed_test'`,
        [workspaceId],
      )).rows[0];
      if (preference?.enabled !== false) {
        await client.query(
          `INSERT INTO ccm_assurance_notifications
           (id,workspace_id,notification_type,title,detail,severity,route_key,source_type,source_id,assigned_to,created_by_user_id)
           VALUES($1,$2,'failed_test',$3,$4,$5,'ccm-tests','test_run',$6,$7,$8)
           ON CONFLICT(workspace_id,notification_type,source_type,source_id) DO NOTHING`,
          [generateId('ccm-note'), workspaceId, `${testRow.name} ${input.status}`, input.summary,
            input.severity, runId, monitorRow.owner, actor.userId],
        );
      }
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

export async function listNotifications(workspaceId: string): Promise<AssuranceNotification[]> {
  const result = await query(
    `SELECT * FROM ccm_assurance_notifications
     WHERE workspace_id=$1
     ORDER BY created_at DESC LIMIT 100`,
    [workspaceId],
  );
  return result.rows.map(mapNotification);
}

export async function updateNotification(workspaceId: string, id: string, status: NotificationStatus, snoozedUntil: string | null, actorUserId: string): Promise<AssuranceNotification | null> {
  const result = await query(
    `UPDATE ccm_assurance_notifications SET status=$3,snoozed_until=$4,updated_by_user_id=$5,updated_at=NOW()
     WHERE workspace_id=$1 AND id=$2 AND status <> 'archived' RETURNING *`,
    [workspaceId, id, status, snoozedUntil, actorUserId],
  );
  return result.rows[0] ? mapNotification(result.rows[0]) : null;
}

export async function listNotificationPreferences(workspaceId: string): Promise<NotificationPreference[]> {
  const result = await query(
    `SELECT channel,notification_type,enabled FROM ccm_assurance_notification_preferences
     WHERE workspace_id=$1 ORDER BY notification_type`,
    [workspaceId],
  );
  return result.rows.map((row) => ({ channel: row.channel, type: row.notification_type, enabled: row.enabled }));
}

export async function updateNotificationPreference(workspaceId: string, type: NotificationPreference['type'], enabled: boolean, actorUserId: string): Promise<NotificationPreference[]> {
  await query(
    `INSERT INTO ccm_assurance_notification_preferences(workspace_id,channel,notification_type,enabled,updated_by_user_id)
     VALUES($1,'in_app',$2,$3,$4)
     ON CONFLICT(workspace_id,channel,notification_type) DO UPDATE SET enabled=$3,updated_by_user_id=$4,updated_at=NOW()`,
    [workspaceId, type, enabled, actorUserId],
  );
  return listNotificationPreferences(workspaceId);
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
  const target = input.linkedObjectType === 'test'
    ? await query<{ id: string; label: string }>(`SELECT id, name AS label FROM ccm_automated_tests WHERE workspace_id=$1 AND id=$2`, [workspaceId, input.linkedObjectId])
    : input.linkedObjectType === 'exception'
      ? await query<{ id: string; label: string }>(`SELECT id, type AS label FROM ccm_assurance_exceptions WHERE workspace_id=$1 AND id=$2`, [workspaceId, input.linkedObjectId])
      : null;
  if (!target?.rows[0]) throw Object.assign(new Error('Linked assurance record is unavailable in this workspace'), { status: 400 });
  const result = await query(
    `INSERT INTO ccm_remediation_tasks
     (id,workspace_id,source_type,source_id,linked_object_label,title,description,owner,priority,due_date,status,linked_object_type,linked_object_id,created_by_user_id)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [generateId('ccm-task'), workspaceId, input.sourceType, input.linkedObjectId, target.rows[0].label,
      input.title, input.description, input.owner, input.priority, input.dueDate || null, input.status,
      input.linkedObjectType, input.linkedObjectId, actor.userId],
  );
  return mapTask(result.rows[0]);
}

export async function updateTask(workspaceId: string, id: string, input: Partial<RemediationTask>): Promise<RemediationTask | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ status: RemediationTask['status'] }>(
      `SELECT status FROM ccm_remediation_tasks WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,
      [workspaceId, id],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    if (input.status && input.status !== current.rows[0].status) {
      const allowed: Record<RemediationTask['status'], RemediationTask['status'][]> = {
        open: ['in_progress', 'blocked', 'resolved'],
        in_progress: ['blocked', 'resolved'],
        blocked: ['in_progress', 'resolved'],
        resolved: ['closed'],
        closed: [],
      };
      if (!allowed[current.rows[0].status].includes(input.status)) {
        throw Object.assign(new Error(`Remediation task cannot move from ${current.rows[0].status} to ${input.status}`), { status: 409 });
      }
    }
    const result = await client.query(
      `UPDATE ccm_remediation_tasks SET title=COALESCE($3,title),description=COALESCE($4,description),owner=COALESCE($5,owner),
        priority=COALESCE($6,priority),due_date=CASE WHEN $9 THEN $7 ELSE due_date END,status=COALESCE($8,status),updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 RETURNING *`,
      [workspaceId, id, input.title ?? null, input.description ?? null, input.owner ?? null,
        input.priority ?? null, input.dueDate ?? null, input.status ?? null, Object.prototype.hasOwnProperty.call(input, 'dueDate')],
    );
    await client.query('COMMIT');
    return mapTask(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getSettings(workspaceId: string): Promise<AssuranceSetting> {
  const row = (await query(`SELECT * FROM ccm_settings WHERE workspace_id=$1`, [workspaceId])).rows[0];
  if (!row) {
    return {
      defaultTestFrequency: 'Weekly',
      evidenceFreshnessPeriodDays: 30,
      driftSeverityThreshold: 'medium',
      exceptionSlaDays: 14,
      notificationRules: [],
      connectorSyncFrequency: 'Disabled',
      autoCreateRemediationTask: false,
      autoLinkEvidence: false,
    };
  }
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
  const result = await query(
    `INSERT INTO ccm_settings
      (workspace_id,default_test_frequency,evidence_freshness_period_days,drift_severity_threshold,exception_sla_days,updated_by_user_id)
     VALUES($1,COALESCE($2,'Weekly'),COALESCE($3,30),COALESCE($4,'medium'),COALESCE($5,14),$6)
     ON CONFLICT(workspace_id) DO UPDATE SET
      default_test_frequency=COALESCE($2,ccm_settings.default_test_frequency),
      evidence_freshness_period_days=COALESCE($3,ccm_settings.evidence_freshness_period_days),
      drift_severity_threshold=COALESCE($4,ccm_settings.drift_severity_threshold),
      exception_sla_days=COALESCE($5,ccm_settings.exception_sla_days),updated_by_user_id=$6,updated_at=NOW()
     RETURNING *`,
    [workspaceId, input.defaultTestFrequency ?? null, input.evidenceFreshnessPeriodDays ?? null,
      input.driftSeverityThreshold ?? null, input.exceptionSlaDays ?? null, actorUserId],
  );
  const row = result.rows[0];
  return {
    defaultTestFrequency: row.default_test_frequency,
    evidenceFreshnessPeriodDays: row.evidence_freshness_period_days,
    driftSeverityThreshold: row.drift_severity_threshold,
    exceptionSlaDays: row.exception_sla_days,
    notificationRules: [],
    connectorSyncFrequency: row.connector_sync_frequency,
    autoCreateRemediationTask: row.auto_create_remediation_task,
    autoLinkEvidence: row.auto_link_evidence,
  };
}
