import { generateId, pool, query } from '../db.js';
import { canTransitionIncident, canTransitionVulnerability } from '../lib/incidentLifecycle.js';
import type { IncidentStatus, SecurityCaseEvent, SecurityIncident, SecurityVulnerability, VulnerabilityStatus } from '../types/incidentManagement.js';

type Row = Record<string, any>;
const array = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

function mapIncident(row: Row): SecurityIncident {
  return {
    id: row.id, workspaceId: row.workspace_id, incidentRef: row.incident_ref, title: row.title,
    description: row.description || '', incidentType: row.incident_type, severity: row.severity, status: row.status,
    source: row.source, owner: row.owner, detectedAt: row.detected_at, targetResolutionAt: row.target_resolution_at,
    resolvedAt: row.resolved_at, resolutionSummary: row.resolution_summary, linkedRiskIds: array(row.linked_risk_ids),
    linkedAssetIds: array(row.linked_asset_ids), linkedControlIds: array(row.linked_control_ids),
    linkedEvidenceIds: array(row.linked_evidence_ids), createdBy: row.created_by, updatedBy: row.updated_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapVulnerability(row: Row): SecurityVulnerability {
  return {
    id: row.id, workspaceId: row.workspace_id, vulnerabilityRef: row.vulnerability_ref, title: row.title,
    description: row.description || '', externalReference: row.external_reference, severity: row.severity,
    cvssScore: row.cvss_score == null ? null : Number(row.cvss_score), status: row.status, source: row.source,
    owner: row.owner, discoveredAt: row.discovered_at, dueAt: row.due_at, remediatedAt: row.remediated_at,
    remediationSummary: row.remediation_summary, linkedIncidentIds: array(row.linked_incident_ids),
    linkedRiskIds: array(row.linked_risk_ids), linkedAssetIds: array(row.linked_asset_ids),
    linkedControlIds: array(row.linked_control_ids), linkedEvidenceIds: array(row.linked_evidence_ids),
    createdBy: row.created_by, updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapEvent(row: Row): SecurityCaseEvent {
  return { id: row.id, workspaceId: row.workspace_id, entityType: row.entity_type, entityId: row.entity_id,
    action: row.action, actorId: row.actor_id, previousStatus: row.previous_status, newStatus: row.new_status,
    notes: row.notes, createdAt: row.created_at };
}

function filtersSql(filters: { search?: string; status?: string; severity?: string }, values: unknown[], reference: string) {
  const clauses = ['workspace_id=$1'];
  if (filters.status) { values.push(filters.status); clauses.push(`status=$${values.length}`); }
  if (filters.severity) { values.push(filters.severity); clauses.push(`severity=$${values.length}`); }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    clauses.push(`(${reference} ILIKE $${values.length} OR title ILIKE $${values.length} OR description ILIKE $${values.length} OR owner ILIKE $${values.length})`);
  }
  return clauses.join(' AND ');
}

export async function listIncidents(workspaceId: string, filters: { search?: string; status?: string; severity?: string } = {}) {
  const values: unknown[] = [workspaceId];
  const result = await query(`SELECT * FROM security_incidents WHERE ${filtersSql(filters, values, 'incident_ref')} ORDER BY detected_at DESC, created_at DESC LIMIT 500`, values);
  return result.rows.map(mapIncident);
}

export async function listVulnerabilities(workspaceId: string, filters: { search?: string; status?: string; severity?: string } = {}) {
  const values: unknown[] = [workspaceId];
  const result = await query(`SELECT * FROM security_vulnerabilities WHERE ${filtersSql(filters, values, 'vulnerability_ref')} ORDER BY discovered_at DESC, created_at DESC LIMIT 500`, values);
  return result.rows.map(mapVulnerability);
}

export async function getIncident(workspaceId: string, id: string) {
  const result = await query('SELECT * FROM security_incidents WHERE workspace_id=$1 AND (id=$2 OR incident_ref=$2)', [workspaceId, id]);
  return result.rows[0] ? mapIncident(result.rows[0]) : null;
}

export async function getVulnerability(workspaceId: string, id: string) {
  const result = await query('SELECT * FROM security_vulnerabilities WHERE workspace_id=$1 AND (id=$2 OR vulnerability_ref=$2)', [workspaceId, id]);
  return result.rows[0] ? mapVulnerability(result.rows[0]) : null;
}

export async function listEvents(workspaceId: string, entityType: 'incident' | 'vulnerability', entityId: string) {
  const result = await query('SELECT * FROM security_case_events WHERE workspace_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY created_at DESC', [workspaceId, entityType, entityId]);
  return result.rows.map(mapEvent);
}

export async function assertIncidentIds(workspaceId: string, ids: unknown) {
  const requested = Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : [];
  if (!requested.length) return;
  const result = await query('SELECT id FROM security_incidents WHERE workspace_id=$1 AND id=ANY($2::text[])', [workspaceId, requested]);
  if (result.rows.length !== requested.length) throw Object.assign(new Error('One or more linked incidents are unavailable in this workspace.'), { code: 'INVALID_LINK_TARGET' });
}

export async function createIncident(workspaceId: string, actor: string, input: Record<string, any>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`incident-ref:${workspaceId}`]);
    const sequence = await client.query(`SELECT COALESCE(MAX((substring(incident_ref from '[0-9]+$'))::int),0)+1 AS next FROM security_incidents WHERE workspace_id=$1`, [workspaceId]);
    const incidentRef = `INC-${String(sequence.rows[0].next).padStart(5, '0')}`;
    const id = generateId('inc');
    const result = await client.query(`INSERT INTO security_incidents
      (id,workspace_id,incident_ref,title,description,incident_type,severity,status,source,owner,detected_at,target_resolution_at,linked_risk_ids,linked_asset_ids,linked_control_ids,linked_evidence_ids,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,'open',$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16,$16) RETURNING *`,
      [id, workspaceId, incidentRef, input.title.trim(), input.description?.trim() || '', input.incidentType,
        input.severity, input.source?.trim() || 'manual', input.owner.trim(), input.detectedAt,
        input.targetResolutionAt || null, JSON.stringify(input.linkedRiskIds || []), JSON.stringify(input.linkedAssetIds || []),
        JSON.stringify(input.linkedControlIds || []), JSON.stringify(input.linkedEvidenceIds || []), actor]);
    await client.query(`INSERT INTO security_case_events(id,workspace_id,entity_type,entity_id,action,actor_id,new_status,notes)
      VALUES($1,$2,'incident',$3,'created',$4,'open',$5)`, [generateId('sce'), workspaceId, id, actor, input.notes?.trim() || null]);
    await client.query('COMMIT');
    return mapIncident(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function createVulnerability(workspaceId: string, actor: string, input: Record<string, any>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`vulnerability-ref:${workspaceId}`]);
    const sequence = await client.query(`SELECT COALESCE(MAX((substring(vulnerability_ref from '[0-9]+$'))::int),0)+1 AS next FROM security_vulnerabilities WHERE workspace_id=$1`, [workspaceId]);
    const vulnerabilityRef = `VUL-${String(sequence.rows[0].next).padStart(5, '0')}`;
    const id = generateId('vul');
    const result = await client.query(`INSERT INTO security_vulnerabilities
      (id,workspace_id,vulnerability_ref,title,description,external_reference,severity,cvss_score,status,source,owner,discovered_at,due_at,linked_incident_ids,linked_risk_ids,linked_asset_ids,linked_control_ids,linked_evidence_ids,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'identified',$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18,$18) RETURNING *`,
      [id, workspaceId, vulnerabilityRef, input.title.trim(), input.description?.trim() || '', input.externalReference?.trim() || null,
        input.severity, input.cvssScore ?? null, input.source?.trim() || 'manual', input.owner.trim(), input.discoveredAt,
        input.dueAt || null, JSON.stringify(input.linkedIncidentIds || []), JSON.stringify(input.linkedRiskIds || []),
        JSON.stringify(input.linkedAssetIds || []), JSON.stringify(input.linkedControlIds || []), JSON.stringify(input.linkedEvidenceIds || []), actor]);
    await client.query(`INSERT INTO security_case_events(id,workspace_id,entity_type,entity_id,action,actor_id,new_status,notes)
      VALUES($1,$2,'vulnerability',$3,'created',$4,'identified',$5)`, [generateId('sce'), workspaceId, id, actor, input.notes?.trim() || null]);
    await client.query('COMMIT');
    return mapVulnerability(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function transitionIncident(workspaceId: string, id: string, actor: string, status: IncidentStatus, notes?: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT * FROM security_incidents WHERE workspace_id=$1 AND (id=$2 OR incident_ref=$2) FOR UPDATE', [workspaceId, id]);
    const current = locked.rows[0];
    if (!current) { await client.query('ROLLBACK'); return null; }
    if (!canTransitionIncident(current.status, status)) throw Object.assign(new Error(`Incident cannot move from ${current.status} to ${status}.`), { code: 'INVALID_TRANSITION' });
    if (['resolved', 'closed'].includes(status) && !notes?.trim()) throw Object.assign(new Error('Resolution notes are required before resolving or closing an incident.'), { code: 'RESOLUTION_REQUIRED' });
    const result = await client.query(`UPDATE security_incidents SET status=$3,resolution_summary=CASE WHEN $3 IN('resolved','closed') THEN $4 ELSE resolution_summary END,resolved_at=CASE WHEN $3='resolved' THEN NOW() WHEN $3='investigating' THEN NULL ELSE resolved_at END,updated_by=$5,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId, current.id, status, notes?.trim() || null, actor]);
    await client.query(`INSERT INTO security_case_events(id,workspace_id,entity_type,entity_id,action,actor_id,previous_status,new_status,notes) VALUES($1,$2,'incident',$3,'status_changed',$4,$5,$6,$7)`, [generateId('sce'), workspaceId, current.id, actor, current.status, status, notes?.trim() || null]);
    await client.query('COMMIT');
    return mapIncident(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function transitionVulnerability(workspaceId: string, id: string, actor: string, status: VulnerabilityStatus, notes?: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query('SELECT * FROM security_vulnerabilities WHERE workspace_id=$1 AND (id=$2 OR vulnerability_ref=$2) FOR UPDATE', [workspaceId, id]);
    const current = locked.rows[0];
    if (!current) { await client.query('ROLLBACK'); return null; }
    if (!canTransitionVulnerability(current.status, status)) throw Object.assign(new Error(`Vulnerability cannot move from ${current.status} to ${status}.`), { code: 'INVALID_TRANSITION' });
    if (['mitigated', 'accepted', 'closed', 'false_positive'].includes(status) && !notes?.trim()) throw Object.assign(new Error('Decision or remediation notes are required for this status.'), { code: 'DECISION_REQUIRED' });
    const result = await client.query(`UPDATE security_vulnerabilities SET status=$3,remediation_summary=CASE WHEN $3 IN('mitigated','accepted','closed','false_positive') THEN $4 ELSE remediation_summary END,remediated_at=CASE WHEN $3='mitigated' THEN NOW() WHEN $3='in_progress' THEN NULL ELSE remediated_at END,updated_by=$5,updated_at=NOW() WHERE workspace_id=$1 AND id=$2 RETURNING *`, [workspaceId, current.id, status, notes?.trim() || null, actor]);
    await client.query(`INSERT INTO security_case_events(id,workspace_id,entity_type,entity_id,action,actor_id,previous_status,new_status,notes) VALUES($1,$2,'vulnerability',$3,'status_changed',$4,$5,$6,$7)`, [generateId('sce'), workspaceId, current.id, actor, current.status, status, notes?.trim() || null]);
    await client.query('COMMIT');
    return mapVulnerability(result.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
