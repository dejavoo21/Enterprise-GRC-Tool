import { Router, Request, Response } from 'express';
import * as regulatoryRepo from '../repositories/regulatoryRepo.js';
import { buildRegulatoryReportSummary, ensureRegulatoryWorkspaceState, runImpactAssessment } from '../services/regulatoryChangeService.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { assertWorkspaceLinks, WorkspaceLinkValidationError } from '../services/workspaceLinkValidation.js';
import { getWorkspaceId } from '../workspace.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { assertChangeTransition, assertIndependentApproval, assertTaskTransition } from '../services/regulatoryLifecycleRules.js';

const router = Router();

function requireWorkspace(req: Request, res: Response) {
  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({
      data: null,
      error: { code: 'WORKSPACE_REQUIRED', message: 'Workspace context is required' },
    });
    return null;
  }
  return workspaceId;
}

async function validateRegulatoryLinks(workspaceId: string, body: Record<string, unknown>) {
  await assertWorkspaceLinks(workspaceId, {
    controls: body.linkedControls,
    policies: body.linkedPolicies,
    risks: body.linkedRisks,
    evidence: body.linkedEvidence,
  });
}

async function validateRegulatoryChangeLinks(workspaceId: string, body: Record<string, unknown>) {
  await assertWorkspaceLinks(workspaceId, {
    controls: body.affectedControls,
    policies: body.affectedPolicies,
    risks: body.affectedRisks,
    vendors: body.affectedVendors,
    assets: body.affectedAssets,
    aiSystems: body.affectedAiSystems,
  });
}

function sendLinkValidationError(res: Response, error: unknown) {
  if (!(error instanceof WorkspaceLinkValidationError)) return false;
  res.status(400).json({ data: null, error: { code: 'INVALID_LINK_TARGET', message: error.message } });
  return true;
}

function requireFields(res: Response, body: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((field) => typeof body[field] !== 'string' || !(body[field] as string).trim());
  if (!missing.length) return true;
  res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: `Required fields: ${missing.join(', ')}` } });
  return false;
}

router.get('/dashboard', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;

  try {
    const state = await ensureRegulatoryWorkspaceState(workspaceId);
    return res.json({ data: state.dashboard, error: null });
  } catch (error) {
    console.error('Regulatory dashboard error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load regulatory dashboard' } });
  }
});

router.get('/state', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;

  try {
    return res.json({ data: await ensureRegulatoryWorkspaceState(workspaceId), error: null });
  } catch (error) {
    console.error('Regulatory state error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load regulatory state' } });
  }
});

router.get('/requirements', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listRequirements(workspaceId), error: null });
});

router.post('/requirements', requirePermission('Regulatory', 'create'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;

  if (!requireFields(res, req.body || {}, ['requirementId', 'regulationName', 'title', 'description', 'jurisdiction', 'regulator', 'category', 'owner', 'businessUnit'])) return;
  try {
    await validateRegulatoryLinks(workspaceId, req.body || {});
  } catch (error) {
    if (sendLinkValidationError(res, error)) return;
    throw error;
  }
  const created = await regulatoryRepo.createRequirement(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.regulation_added',
    category: 'regulatory',
    targetType: 'regulation_requirement',
    targetId: created.id,
    targetName: created.requirementId,
    newValue: created,
    outcome: 'success',
    severity: 'medium',
    source: 'backend',
    notes: `Requirement added for ${created.regulationName}.`,
  }));
  return res.status(201).json({ data: created, error: null });
});

router.patch('/requirements/:id', requirePermission('Regulatory', 'edit'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;

  try {
    await validateRegulatoryLinks(workspaceId, req.body || {});
  } catch (error) {
    if (sendLinkValidationError(res, error)) return;
    throw error;
  }
  const existing = (await regulatoryRepo.listRequirements(workspaceId)).find((item) => item.id === req.params.id);
  const updated = await regulatoryRepo.updateRequirement(workspaceId, req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Requirement not found' } });
  }
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.regulation_updated',
    category: 'regulatory',
    targetType: 'regulation_requirement',
    targetId: updated.id,
    targetName: updated.requirementId,
    previousValue: existing || null,
    newValue: updated,
    outcome: 'success',
    severity: 'medium',
    source: 'backend',
    notes: `Requirement updated for ${updated.regulationName}.`,
  }));
  return res.json({ data: updated, error: null });
});

router.get('/obligations', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listObligations(workspaceId), error: null });
});

router.post('/obligations', requirePermission('Regulatory', 'create'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  if (!requireFields(res, req.body || {}, ['title', 'description', 'owner', 'reviewFrequency', 'sourceRequirementId'])) return;
  try {
    await validateRegulatoryLinks(workspaceId, req.body || {});
    const sourceExists = (await regulatoryRepo.listRequirements(workspaceId)).some((item) => item.requirementId === req.body.sourceRequirementId);
    if (!sourceExists) throw new WorkspaceLinkValidationError();
  } catch (error) {
    if (sendLinkValidationError(res, error)) return;
    throw error;
  }
  const created = await regulatoryRepo.createObligation(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.obligation_added',
    category: 'regulatory',
    targetType: 'obligation',
    targetId: created.id,
    targetName: created.title,
    newValue: created,
    outcome: 'success',
    severity: 'medium',
    source: 'backend',
    notes: 'Obligation added to register.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.patch('/obligations/:id', requirePermission('Regulatory', 'edit'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  try {
    await validateRegulatoryLinks(workspaceId, req.body || {});
  } catch (error) {
    if (sendLinkValidationError(res, error)) return;
    throw error;
  }
  const existing = (await regulatoryRepo.listObligations(workspaceId)).find((item) => item.id === req.params.id);
  const updated = await regulatoryRepo.updateObligation(workspaceId, req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Obligation not found' } });
  }
  if (updated.status === 'at_risk' || updated.status === 'overdue') {
    await regulatoryRepo.createAlert(workspaceId, {
      alertType: 'compliance_risk',
      title: updated.title,
      message: `Obligation is now ${updated.status.replace('_', ' ')} and requires escalation.`,
      severity: updated.status === 'overdue' ? 'critical' : 'high',
      relatedRequirementId: updated.sourceRequirementId,
      dueDate: updated.dueDate,
    });
  }
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.obligation_updated',
    category: 'regulatory',
    targetType: 'obligation',
    targetId: updated.id,
    targetName: updated.title,
    previousValue: existing || null,
    newValue: updated,
    outcome: 'success',
    severity: updated.status === 'overdue' || updated.status === 'at_risk' ? 'high' : 'medium',
    source: 'backend',
    notes: 'Obligation status or ownership updated.',
  }));
  return res.json({ data: updated, error: null });
});

router.get('/changes', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listChanges(workspaceId), error: null });
});

router.post('/changes', requirePermission('Regulatory', 'create'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  if (!requireFields(res, req.body || {}, ['regulationName', 'changeSummary', 'versionTag', 'reviewer', 'changeDate'])) return;
  try {
    await validateRegulatoryChangeLinks(workspaceId, req.body || {});
    if (req.body?.requirementId) {
      const requirementExists = (await regulatoryRepo.listRequirements(workspaceId)).some((item) => item.requirementId === req.body.requirementId);
      if (!requirementExists) throw new WorkspaceLinkValidationError();
    }
  } catch (error) {
    if (sendLinkValidationError(res, error)) return;
    throw error;
  }
  const created = await regulatoryRepo.createChangeLog(workspaceId, { ...(req.body || {}), createdBy: req.authUser?.userId || null });
  if (created.severity === 'high' || created.severity === 'critical') {
    await regulatoryRepo.createAlert(workspaceId, {
      alertType: 'regulation_updated',
      title: `${created.regulationName} requires review`,
      message: created.changeSummary,
      severity: created.severity,
      relatedChangeLogId: created.id,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
  }
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.change_logged',
    category: 'regulatory',
    targetType: 'regulatory_change',
    targetId: created.id,
    targetName: created.regulationName,
    newValue: created,
    outcome: 'success',
    severity: created.severity === 'critical' ? 'critical' : created.severity,
    source: 'backend',
    notes: 'Regulatory change logged.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.patch('/changes/:id', requirePermission('Regulatory', 'edit'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  if ('approvalStatus' in (req.body || {}) || 'approvedBy' in (req.body || {})) {
    return res.status(400).json({ data: null, error: { code: 'CONTROLLED_TRANSITION_REQUIRED', message: 'Use the dedicated review endpoints' } });
  }
  const existing = (await regulatoryRepo.listChanges(workspaceId)).find((item) => item.id === req.params.id);
  const updated = await regulatoryRepo.updateChangeLog(workspaceId, req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Change log entry not found' } });
  }
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.change_review_updated',
    category: 'regulatory',
    targetType: 'regulatory_change',
    targetId: updated.id,
    targetName: updated.regulationName,
    previousValue: existing || null,
    newValue: updated,
    outcome: 'success',
    severity: updated.severity === 'critical' ? 'critical' : updated.severity,
    source: 'backend',
    notes: 'Regulatory change review updated.',
  }));
  return res.json({ data: updated, error: null });
});

router.post('/changes/:id/submit', requirePermission('Regulatory', 'edit'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res); if (!workspaceId) return;
  const existing = (await regulatoryRepo.listChanges(workspaceId)).find((item) => item.id === req.params.id);
  if (!existing) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Change not found' } });
  try { assertChangeTransition(existing.approvalStatus, 'in_review'); } catch (error) { return res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: (error as Error).message } }); }
  const updated = await regulatoryRepo.transitionChangeReview(workspaceId, existing.id, existing.approvalStatus, 'in_review', req.authUser!.userId, 'Submitted for review');
  await recordActivity(buildActivityFromRequest(req, { action: 'framework.change_submitted', category: 'regulatory', targetType: 'regulatory_change', targetId: existing.id, targetName: existing.regulationName, previousValue: existing, newValue: updated, outcome: 'success', severity: 'medium', source: 'backend' }));
  return res.json({ data: updated, error: null });
});

router.post('/changes/:id/decision', requirePermission('Regulatory', 'approve'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res); if (!workspaceId) return;
  const decision = req.body?.decision;
  if (!['approved', 'rejected'].includes(decision) || !String(req.body?.notes || '').trim()) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Decision and review notes are required' } });
  const existing = (await regulatoryRepo.listChanges(workspaceId)).find((item) => item.id === req.params.id);
  if (!existing) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Change not found' } });
  try { assertChangeTransition(existing.approvalStatus, decision); assertIndependentApproval(existing.createdBy, req.authUser!.userId); } catch (error) { return res.status(409).json({ data: null, error: { code: 'INVALID_DECISION', message: (error as Error).message } }); }
  const updated = await regulatoryRepo.transitionChangeReview(workspaceId, existing.id, existing.approvalStatus, decision, req.authUser!.userId, req.body.notes);
  await recordActivity(buildActivityFromRequest(req, { action: `framework.change_${decision}`, category: 'regulatory', targetType: 'regulatory_change', targetId: existing.id, targetName: existing.regulationName, previousValue: existing, newValue: updated, outcome: 'success', severity: decision === 'rejected' ? 'high' : 'medium', source: 'backend' }));
  return res.json({ data: updated, error: null });
});

router.post('/changes/:id/impact-assessment', requirePermission('Regulatory', 'edit'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const change = (await regulatoryRepo.listChanges(workspaceId)).find((item) => item.id === req.params.id);
  if (!change) {
    return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Change log entry not found' } });
  }
  const impact = await runImpactAssessment(workspaceId, change);
  await regulatoryRepo.createAlert(workspaceId, {
    alertType: impact.priority === 'urgent' ? 'compliance_risk' : 'audit_impact',
    title: `${change.regulationName} impact assessment completed`,
    message: `Modelled impact index ${impact.impactScore} with ${impact.priority} priority actions.`,
    severity: impact.severity,
    relatedChangeLogId: change.id,
  });
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.impact_assessment_completed',
    category: 'regulatory',
    targetType: 'regulatory_change',
    targetId: change.id,
    targetName: change.regulationName,
    newValue: impact,
    outcome: 'success',
    severity: impact.severity === 'critical' ? 'critical' : impact.severity,
    source: 'backend',
    notes: `Deterministic impact model completed with index ${impact.impactScore}.`,
  }));
  return res.status(201).json({ data: impact, error: null });
});

router.get('/tasks', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listTasks(workspaceId), error: null });
});

router.post('/tasks', requirePermission('Regulatory', 'create'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  if (!requireFields(res, req.body || {}, ['changeLogId', 'title', 'owner', 'dueDate', 'workflowStage'])) return;
  try {
    await assertWorkspaceLinks(workspaceId, {
      regulatoryChanges: req.body?.changeLogId ? [req.body.changeLogId] : undefined,
    });
  } catch (error) {
    if (sendLinkValidationError(res, error)) return;
    throw error;
  }
  const created = await regulatoryRepo.createTask(workspaceId, req.body || {});
  if (created.status === 'overdue' || created.workflowStage === 'Evidence Collection') {
    await regulatoryRepo.createAlert(workspaceId, {
      alertType: created.workflowStage === 'Evidence Collection' ? 'evidence_missing' : 'review_due',
      title: created.title,
      message: `Task in stage ${created.workflowStage} needs attention.`,
      severity: created.status === 'overdue' ? 'high' : 'medium',
      relatedTaskId: created.id,
      relatedChangeLogId: created.changeLogId,
      dueDate: created.dueDate,
    });
  }
  await recordActivity(buildActivityFromRequest(req, {
    action: 'framework.task_created',
    category: 'regulatory',
    targetType: 'regulatory_task',
    targetId: created.id,
    targetName: created.title,
    newValue: created,
    outcome: 'success',
    severity: created.status === 'overdue' ? 'high' : 'medium',
    source: 'backend',
    notes: 'Regulatory workflow task created.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/tasks/:id/status', requirePermission('Regulatory', 'edit'), async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res); if (!workspaceId) return;
  const next = req.body?.status;
  const existing = (await regulatoryRepo.listTasks(workspaceId)).find((item) => item.id === req.params.id);
  if (!existing) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  try { assertTaskTransition(existing.status, next); } catch (error) { return res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: (error as Error).message } }); }
  const updated = await regulatoryRepo.updateTaskStatus(workspaceId, existing.id, existing.status, next);
  await recordActivity(buildActivityFromRequest(req, { action: 'framework.task_status_changed', category: 'regulatory', targetType: 'regulatory_task', targetId: existing.id, targetName: existing.title, previousValue: existing, newValue: updated, outcome: 'success', severity: 'medium', source: 'backend' }));
  return res.json({ data: updated, error: null });
});

router.get('/alerts', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listAlerts(workspaceId), error: null });
});

router.get('/jurisdictions', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listJurisdictions(workspaceId), error: null });
});

router.get('/mappings', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listMappings(workspaceId), error: null });
});

router.get('/impacts', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listImpacts(workspaceId), error: null });
});

router.get('/reports/summary', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await buildRegulatoryReportSummary(workspaceId), error: null });
});

export default router;
