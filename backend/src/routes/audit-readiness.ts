import { Router, Request, Response } from 'express';
import * as auditRepo from '../repositories/auditManagementRepo.js';
import {
  ensureAuditManagementWorkspaceState,
  getLegacyReadinessAreas,
  getLegacyReadinessGaps,
  getLegacyReadinessSummary,
} from '../services/auditManagementService.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';

const router = Router();

function getWorkspaceId(req: Request) {
  return req.authUser?.workspaceId || (req.headers['x-workspace-id'] as string | undefined) || '';
}

function requireWorkspace(req: Request, res: Response) {
  const workspaceId = getWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ data: null, error: { code: 'WORKSPACE_REQUIRED', message: 'Workspace context is required' } });
    return null;
  }
  return workspaceId;
}

router.get('/state', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  try {
    const state = await ensureAuditManagementWorkspaceState(workspaceId);
    return res.json({ data: state, error: null });
  } catch (error) {
    console.error('Audit management state error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load audit command center' } });
  }
});

router.get('/summary', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  return res.json({ data: await getLegacyReadinessSummary(workspaceId), error: null });
});

router.get('/areas', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const framework = typeof req.query.framework === 'string' ? req.query.framework : undefined;
  return res.json({ data: await getLegacyReadinessAreas(workspaceId, framework), error: null });
});

router.get('/gaps', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const framework = typeof req.query.framework === 'string' ? req.query.framework : undefined;
  return res.json({ data: await getLegacyReadinessGaps(workspaceId, framework), error: null });
});

router.post('/annual-plan', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createAnnualPlanItem(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.created',
    category: 'audit',
    targetType: 'audit_plan_item',
    targetId: created.id,
    targetName: created.auditName,
    newValue: created,
    outcome: 'success',
    severity: created.priority === 'critical' ? 'critical' : created.priority === 'high' ? 'high' : 'medium',
    source: 'backend',
    notes: 'Annual audit plan item created.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/engagements', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createEngagement(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.approved',
    category: 'audit',
    targetType: 'audit_engagement',
    targetId: created.id,
    targetName: created.auditName,
    newValue: created,
    outcome: 'success',
    severity: 'medium',
    source: 'backend',
    notes: 'Audit engagement created.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/workpapers', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createWorkpaper(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.workpaper_added',
    category: 'audit',
    targetType: 'audit_workpaper',
    targetId: created.id,
    targetName: created.title,
    newValue: created,
    outcome: 'success',
    severity: 'info',
    source: 'backend',
    notes: 'Audit workpaper added.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/findings', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createFinding(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.finding_raised',
    category: 'audit',
    targetType: 'audit_finding',
    targetId: created.id,
    targetName: created.title,
    newValue: created,
    outcome: 'success',
    severity: created.riskLevel === 'critical' ? 'critical' : created.riskLevel === 'high' ? 'high' : 'medium',
    source: 'backend',
    notes: 'Audit finding raised.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/recommendations', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createRecommendation(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.recommendation_issued',
    category: 'audit',
    targetType: 'audit_recommendation',
    targetId: created.id,
    targetName: created.recommendation.slice(0, 80),
    newValue: created,
    outcome: 'success',
    severity: created.priority === 'critical' ? 'critical' : created.priority === 'high' ? 'high' : 'medium',
    source: 'backend',
    notes: 'Audit recommendation issued.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/actions', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createCorrectiveAction(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.action_closed',
    category: 'audit',
    targetType: 'audit_action',
    targetId: created.id,
    targetName: created.actionTitle,
    newValue: created,
    outcome: 'success',
    severity: created.progressPercent >= 100 ? 'info' : 'medium',
    source: 'backend',
    notes: 'Corrective action recorded.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.post('/evidence-requests', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const created = await auditRepo.createEvidenceRequest(workspaceId, req.body || {});
  await recordActivity(buildActivityFromRequest(req, {
    action: 'audit.evidence_uploaded',
    category: 'audit',
    targetType: 'audit_evidence_request',
    targetId: created.id,
    targetName: created.requestTitle,
    newValue: created,
    outcome: 'success',
    severity: created.status === 'expired' ? 'high' : 'medium',
    source: 'backend',
    notes: 'Audit evidence request logged.',
  }));
  return res.status(201).json({ data: created, error: null });
});

router.get('/reports/:reportType', async (req, res) => {
  const workspaceId = requireWorkspace(req, res);
  if (!workspaceId) return;
  const state = await ensureAuditManagementWorkspaceState(workspaceId);
  return res.json({
    data: {
      reportType: req.params.reportType,
      generatedAt: new Date().toISOString(),
      summary: state.summary,
      findings: state.findings.slice(0, 10),
      correctiveActions: state.correctiveActions.slice(0, 10),
      frameworkReadiness: state.frameworkReadiness,
      reporting: state.reporting,
    },
    error: null,
  });
});

export default router;
