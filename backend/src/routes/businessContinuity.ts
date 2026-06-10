import { Router } from 'express';
import { getWorkspaceId } from '../workspace.js';
import { requirePermission, requireStepUp } from '../middleware/permissionMiddleware.js';
import {
  createBiaProcess,
  createCriticalService,
  createCrisisEvent,
  createDependency,
  createExercise,
  createRecoveryPlan,
  createResilienceScenario,
  generateBcmReport,
  getBusinessContinuityState,
  updateBiaProcess,
  updateRecoveryPlan,
} from '../services/bcmService.js';
import type { BcmReportType } from '../types/resilience.js';

const router = Router();

function actorFromRequest(req: any) {
  return {
    actorUserId: req.authUser?.userId || null,
    actorName: req.authUser?.email || 'System',
    actorRole: req.authUser?.role || null,
    ipAddress: req.ip || null,
    userAgent: (req.headers['user-agent'] as string | undefined) || null,
    device: (req.headers['sec-ch-ua-platform'] as string | undefined) || null,
  };
}

router.get('/state', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const state = await getBusinessContinuityState(workspaceId);
    res.json({ data: state, error: null });
  } catch (error) {
    console.error('Business continuity state error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'BCM_STATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load BCM state',
      },
    });
  }
});

router.post('/bia-processes', requirePermission('Resilience', 'create'), async (req, res) => {
  try {
    const record = await createBiaProcess(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_BIA_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create BIA process' } });
  }
});

router.patch('/bia-processes/:id', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const record = await updateBiaProcess(getWorkspaceId(req), req.params.id, req.body || {}, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'BIA process not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_BIA_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update BIA process' } });
  }
});

router.post('/critical-services', requirePermission('Resilience', 'create'), async (req, res) => {
  try {
    const record = await createCriticalService(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_SERVICE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create critical service' } });
  }
});

router.post('/recovery-plans', requirePermission('Resilience', 'create'), async (req, res) => {
  try {
    const record = await createRecoveryPlan(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_PLAN_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create recovery plan' } });
  }
});

router.patch('/recovery-plans/:id', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const record = await updateRecoveryPlan(getWorkspaceId(req), req.params.id, req.body || {}, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Recovery plan not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_PLAN_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update recovery plan' } });
  }
});

router.post('/recovery-plans/:id/approve', requirePermission('Resilience', 'approve'), requireStepUp('change_permissions'), async (req, res) => {
  try {
    const record = await updateRecoveryPlan(getWorkspaceId(req), req.params.id, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      lastReviewedAt: new Date().toISOString(),
    }, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Recovery plan not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_PLAN_APPROVE_FAILED', message: error instanceof Error ? error.message : 'Failed to approve recovery plan' } });
  }
});

router.post('/exercises', requirePermission('Resilience', 'create'), async (req, res) => {
  try {
    const record = await createExercise(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_EXERCISE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create exercise' } });
  }
});

router.post('/crisis-events', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const record = await createCrisisEvent(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_CRISIS_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to log crisis event' } });
  }
});

router.post('/dependencies', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const record = await createDependency(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_DEPENDENCY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create dependency' } });
  }
});

router.post('/resilience-scenarios', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const record = await createResilienceScenario(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_SCENARIO_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create resilience scenario' } });
  }
});

router.post('/reports/:reportType', requirePermission('Resilience', 'export'), async (req, res) => {
  try {
    const report = await generateBcmReport(getWorkspaceId(req), req.params.reportType as BcmReportType, actorFromRequest(req));
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_REPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to generate BCM report' } });
  }
});

export default router;
