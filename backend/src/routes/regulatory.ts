import { Router, Request, Response } from 'express';
import * as regulatoryRepo from '../repositories/regulatoryRepo.js';
import { buildRegulatoryReportSummary, ensureRegulatoryWorkspaceState, runImpactAssessment } from '../services/regulatoryChangeService.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';

const router = Router();

function getWorkspaceId(req: Request) {
  return req.authUser?.workspaceId || (req.headers['x-workspace-id'] as string | undefined) || '';
}

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

router.post('/requirements', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;

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

router.patch('/requirements/:id', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;

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

router.post('/obligations', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
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

router.patch('/obligations/:id', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
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

router.post('/changes', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await regulatoryRepo.createChangeLog(workspaceId, req.body || {});
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

router.patch('/changes/:id', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
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

router.post('/changes/:id/impact-assessment', async (req: Request, res: Response) => {
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
    message: `Impact score ${impact.impactScore} with ${impact.priority} priority actions.`,
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
    notes: `Impact assessment completed with score ${impact.impactScore}.`,
  }));
  return res.status(201).json({ data: impact, error: null });
});

router.get('/tasks', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await regulatoryRepo.listTasks(workspaceId), error: null });
});

router.post('/tasks', async (req: Request, res: Response) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
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
