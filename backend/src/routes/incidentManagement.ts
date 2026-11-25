import { Router } from 'express';
import { incidentStatuses, vulnerabilityStatuses } from '../lib/incidentLifecycle.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import * as repo from '../repositories/incidentManagementRepo.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { validateIncidentCaseContext } from '../services/incidentContextRules.js';
import { assertWorkspaceLinks, WorkspaceLinkValidationError } from '../services/workspaceLinkValidation.js';
import type { IncidentStatus, VulnerabilityStatus } from '../types/incidentManagement.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();
const severities = new Set(['low', 'medium', 'high', 'critical']);

function actor(req: Parameters<typeof buildActivityFromRequest>[0]) {
  return req.authUser?.userId || req.authUser?.email || 'unknown';
}

function filters(req: Parameters<typeof buildActivityFromRequest>[0]) {
  return {
    search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
    caseCategory: typeof req.query.caseCategory === 'string' ? req.query.caseCategory : undefined,
  };
}

function validateCommon(body: Record<string, any>, dateField: string) {
  if (!body.title?.trim() || !body.owner?.trim() || !body[dateField]) return 'Title, owner and record date are required.';
  if (!severities.has(body.severity)) return 'A valid severity is required.';
  if (Number.isNaN(Date.parse(body[dateField]))) return 'Record date must be valid.';
  return null;
}

async function validateLinks(workspaceId: string, body: Record<string, any>, includeIncidents = false) {
  await assertWorkspaceLinks(workspaceId, {
    risks: body.linkedRiskIds,
    assets: body.linkedAssetIds,
    controls: body.linkedControlIds,
    evidence: body.linkedEvidenceIds,
  });
  if (includeIncidents) await repo.assertIncidentIds(workspaceId, body.linkedIncidentIds);
}

function sendError(res: any, error: any, fallback: string) {
  if (error instanceof WorkspaceLinkValidationError || ['INVALID_LINK_TARGET', 'INVALID_SUBJECT'].includes(error?.code)) {
    return res.status(400).json({ data: null, error: { code: error?.code === 'INVALID_SUBJECT' ? 'INVALID_SUBJECT' : 'INVALID_LINK_TARGET', message: error.message } });
  }
  if (['INVALID_TRANSITION', 'RESOLUTION_REQUIRED', 'DECISION_REQUIRED'].includes(error?.code)) {
    return res.status(409).json({ data: null, error: { code: error.code, message: error.message } });
  }
  return res.status(500).json({ data: null, error: { code: 'INCIDENT_MANAGEMENT_ERROR', message: error instanceof Error ? error.message : fallback } });
}

function validEntityType(value: string): value is 'incident' | 'vulnerability' {
  return value === 'incident' || value === 'vulnerability';
}

router.get('/state', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const [incidents, vulnerabilities] = await Promise.all([repo.listIncidents(workspaceId, filters(req)), repo.listVulnerabilities(workspaceId, filters(req))]);
    const now = Date.now();
    return res.json({ data: {
      incidents, vulnerabilities,
      summary: {
        openIncidents: incidents.filter(item => !['closed', 'cancelled'].includes(item.status)).length,
        criticalIncidents: incidents.filter(item => item.severity === 'critical' && !['closed', 'cancelled'].includes(item.status)).length,
        openVulnerabilities: vulnerabilities.filter(item => !['closed', 'false_positive'].includes(item.status)).length,
        overdueVulnerabilities: vulnerabilities.filter(item => item.dueAt && new Date(item.dueAt).getTime() < now && !['mitigated', 'closed', 'false_positive'].includes(item.status)).length,
      },
    }, error: null });
  } catch (error) { return sendError(res, error, 'Unable to load incident management.'); }
});

router.get('/:entityType/:id/history', async (req, res) => {
  if (!validEntityType(req.params.entityType)) return res.status(400).json({ data: null, error: { code: 'INVALID_ENTITY_TYPE', message: 'Invalid case type.' } });
  const workspaceId = getWorkspaceId(req);
  const record = req.params.entityType === 'incident' ? await repo.getIncident(workspaceId, req.params.id) : await repo.getVulnerability(workspaceId, req.params.id);
  if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Record not found.' } });
  return res.json({ data: await repo.listEvents(workspaceId, req.params.entityType as 'incident' | 'vulnerability', record.id), error: null });
});

router.patch('/:entityType/:id/assignment', requirePermission('Incidents', 'edit'), async (req, res) => {
  if (!validEntityType(req.params.entityType)) return res.status(400).json({ data: null, error: { code: 'INVALID_ENTITY_TYPE', message: 'Invalid case type.' } });
  const owner = typeof req.body?.owner === 'string' ? req.body.owner.trim() : '';
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  if (!owner || owner.length > 200 || !notes || notes.length > 4000) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Owner and assignment rationale are required and must stay within their field limits.' } });
  try {
    const updated = await repo.assignCase(getWorkspaceId(req), req.params.entityType, req.params.id, actor(req), owner, notes);
    if (!updated) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Record not found.' } });
    await recordActivity(buildActivityFromRequest(req, { action: 'security_case_assigned', category: 'issue', targetType: `security_${req.params.entityType}`, targetId: updated.id, targetName: 'incidentRef' in updated ? updated.incidentRef : updated.vulnerabilityRef, newValue: { owner: updated.owner }, outcome: 'success', severity: updated.severity, source: 'backend', notes: 'Case owner changed through reviewed assignment.' }));
    return res.json({ data: updated, error: null });
  } catch (error) { return sendError(res, error, 'Unable to assign case.'); }
});

router.post('/:entityType/:id/comments', requirePermission('Incidents', 'edit'), async (req, res) => {
  if (!validEntityType(req.params.entityType)) return res.status(400).json({ data: null, error: { code: 'INVALID_ENTITY_TYPE', message: 'Invalid case type.' } });
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
  if (!comment || comment.length > 4000) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Comment is required and must not exceed 4,000 characters.' } });
  try {
    const event = await repo.addCaseComment(getWorkspaceId(req), req.params.entityType, req.params.id, actor(req), comment);
    if (!event) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Record not found.' } });
    await recordActivity(buildActivityFromRequest(req, { action: 'security_case_commented', category: 'issue', targetType: `security_${req.params.entityType}`, targetId: req.params.id, newValue: { eventId: event.id }, outcome: 'success', source: 'backend', notes: 'Investigation comment recorded in case history.' }));
    return res.status(201).json({ data: event, error: null });
  } catch (error) { return sendError(res, error, 'Unable to add comment.'); }
});

router.post('/incidents', requirePermission('Incidents', 'create'), async (req, res) => {
  const body = req.body || {};
  const invalid = validateCommon(body, 'detectedAt');
  const caseCategory = body.caseCategory || 'security_incident';
  const contextError = validateIncidentCaseContext({ ...body, caseCategory });
  if (invalid || !body.incidentType?.trim() || contextError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: invalid || contextError || 'Incident type is required.' } });
  try {
    const workspaceId = getWorkspaceId(req);
    await validateLinks(workspaceId, body);
    await repo.assertWorkspaceMember(workspaceId, body.subjectUserId);
    const created = await repo.createIncident(workspaceId, actor(req), body);
    await recordActivity(buildActivityFromRequest(req, { action: 'security_incident_created', category: 'issue', targetType: 'security_incident', targetId: created.id, targetName: created.incidentRef, newValue: created, outcome: 'success', severity: created.severity, source: 'backend', notes: 'Incident recorded through reviewed entry.' }));
    return res.status(201).json({ data: created, error: null });
  } catch (error) { return sendError(res, error, 'Unable to create incident.'); }
});

router.patch('/incidents/:id/case-context', requirePermission('Incidents', 'edit'), async (req, res) => {
  const body = req.body || {};
  const contextError = validateIncidentCaseContext(body, true);
  if (contextError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: contextError } });
  try {
    const workspaceId = getWorkspaceId(req);
    await repo.assertWorkspaceMember(workspaceId, body.subjectUserId);
    const updated = await repo.updateIncidentCaseContext(workspaceId, req.params.id, actor(req), body);
    if (!updated) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Incident not found.' } });
    await recordActivity(buildActivityFromRequest(req, { action: 'security_incident_case_context_updated', category: 'issue', targetType: 'security_incident', targetId: updated.id, targetName: updated.incidentRef, newValue: { caseCategory: updated.caseCategory, subjectUserId: updated.subjectUserId, riskGroupLabels: updated.riskGroupLabels, reviewDueAt: updated.reviewDueAt }, outcome: 'success', severity: updated.severity, source: 'backend', notes: body.notes }));
    return res.json({ data: updated, error: null });
  } catch (error) { return sendError(res, error, 'Unable to update case context.'); }
});

router.post('/vulnerabilities', requirePermission('Incidents', 'create'), async (req, res) => {
  const body = req.body || {};
  const invalid = validateCommon(body, 'discoveredAt');
  const score = body.cvssScore == null || body.cvssScore === '' ? null : Number(body.cvssScore);
  if (invalid || (score != null && (Number.isNaN(score) || score < 0 || score > 10))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: invalid || 'CVSS score must be between 0 and 10.' } });
  try {
    const workspaceId = getWorkspaceId(req);
    await validateLinks(workspaceId, body, true);
    const created = await repo.createVulnerability(workspaceId, actor(req), { ...body, cvssScore: score });
    await recordActivity(buildActivityFromRequest(req, { action: 'security_vulnerability_created', category: 'issue', targetType: 'security_vulnerability', targetId: created.id, targetName: created.vulnerabilityRef, newValue: created, outcome: 'success', severity: created.severity, source: 'backend', notes: 'Vulnerability recorded through reviewed entry.' }));
    return res.status(201).json({ data: created, error: null });
  } catch (error) { return sendError(res, error, 'Unable to create vulnerability.'); }
});

router.patch('/incidents/:id/status', requirePermission('Incidents', 'edit'), async (req, res) => {
  if (!incidentStatuses.includes(req.body?.status)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Valid incident status is required.' } });
  try {
    const updated = await repo.transitionIncident(getWorkspaceId(req), req.params.id, actor(req), req.body.status as IncidentStatus, req.body.notes);
    if (!updated) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Incident not found.' } });
    await recordActivity(buildActivityFromRequest(req, { action: 'security_incident_status_changed', category: 'issue', targetType: 'security_incident', targetId: updated.id, targetName: updated.incidentRef, newValue: updated, outcome: 'success', severity: updated.severity, source: 'backend', notes: req.body.notes || `Incident moved to ${updated.status}.` }));
    return res.json({ data: updated, error: null });
  } catch (error) { return sendError(res, error, 'Unable to update incident.'); }
});

router.patch('/vulnerabilities/:id/status', requirePermission('Incidents', 'edit'), async (req, res) => {
  if (!vulnerabilityStatuses.includes(req.body?.status)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Valid vulnerability status is required.' } });
  try {
    const updated = await repo.transitionVulnerability(getWorkspaceId(req), req.params.id, actor(req), req.body.status as VulnerabilityStatus, req.body.notes);
    if (!updated) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Vulnerability not found.' } });
    await recordActivity(buildActivityFromRequest(req, { action: 'security_vulnerability_status_changed', category: 'issue', targetType: 'security_vulnerability', targetId: updated.id, targetName: updated.vulnerabilityRef, newValue: updated, outcome: 'success', severity: updated.severity, source: 'backend', notes: req.body.notes || `Vulnerability moved to ${updated.status}.` }));
    return res.json({ data: updated, error: null });
  } catch (error) { return sendError(res, error, 'Unable to update vulnerability.'); }
});

export default router;
