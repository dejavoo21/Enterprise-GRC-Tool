import { Router } from 'express';
import { getWorkspaceId } from '../workspace.js';
import { requirePermission, requireStepUp } from '../middleware/permissionMiddleware.js';
import {
  createBiaProcess,
  createCriticalService,
  createCrisisEvent,
  createCorrectiveAction,
  createDependency,
  createExercise,
  createRecoveryPlan,
  approveRecoveryPlan,
  createResilienceScenario,
  closeCorrectiveAction,
  generateBcmReport,
  getBusinessContinuityState,
  submitRecoveryPlan,
  updateBiaProcess,
  updateRecoveryPlan,
  transitionCorrectiveAction,
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
    if (!req.body?.processName || !req.body?.processOwner || !req.body?.businessUnit) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'processName, processOwner, and businessUnit are required.' } });
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
    if (!req.body?.serviceName || !req.body?.owner || !req.body?.businessUnit) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'serviceName, owner, and businessUnit are required.' } });
    const record = await createCriticalService(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_SERVICE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create critical service' } });
  }
});

router.post('/recovery-plans', requirePermission('Resilience', 'create'), async (req, res) => {
  try {
    if (!req.body?.title || !req.body?.planType || !Array.isArray(req.body?.owners) || !req.body.owners.length) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'title, planType, and at least one owner are required.' } });
    const record = await createRecoveryPlan(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_PLAN_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create recovery plan' } });
  }
});

router.patch('/recovery-plans/:id', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    if (req.body?.status || req.body?.approvedAt || req.body?.approvedBy) return res.status(400).json({ data: null, error: { code: 'CONTROLLED_TRANSITION_REQUIRED', message: 'Use the recovery-plan submission and approval workflows for lifecycle changes.' } });
    const record = await updateRecoveryPlan(getWorkspaceId(req), req.params.id, req.body || {}, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Recovery plan not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_PLAN_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update recovery plan' } });
  }
});

router.post('/recovery-plans/:id/submit', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const record = await submitRecoveryPlan(getWorkspaceId(req), req.params.id, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Recovery plan not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'Recovery plan submission failed.' } }); }
});

router.post('/recovery-plans/:id/approve', requirePermission('Resilience', 'approve'), requireStepUp('change_permissions'), async (req, res) => {
  try {
    const record = await approveRecoveryPlan(getWorkspaceId(req), req.params.id, actorFromRequest(req));
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
    if (!req.body?.title || !req.body?.exerciseType || !req.body?.exerciseDate || !req.body?.scenario) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'title, exerciseType, exerciseDate, and scenario are required.' } });
    if (typeof req.body.performanceScore !== 'number' || !Number.isFinite(req.body.performanceScore) || req.body.performanceScore < 0 || req.body.performanceScore > 100) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'performanceScore must be an explicitly recorded number from 0 to 100.' } });
    const record = await createExercise(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_EXERCISE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create exercise' } });
  }
});

router.post('/corrective-actions', requirePermission('Resilience', 'create'), async (req, res) => {
  try {
    if (!req.body?.exerciseId || !req.body?.title || !req.body?.description || !req.body?.owner) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'exerciseId, title, description, and owner are required.' } });
    const record = await createCorrectiveAction(getWorkspaceId(req), req.body, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) { res.status(400).json({ data: null, error: { code: 'BCM_CORRECTIVE_ACTION_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create corrective action.' } }); }
});

router.post('/corrective-actions/:id/status', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    const status = req.body?.status;
    if (!['in_progress','blocked','awaiting_review'].includes(status)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported corrective-action status.' } });
    const record = await transitionCorrectiveAction(getWorkspaceId(req), req.params.id, status, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Corrective action not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'Failed to transition corrective action.' } }); }
});

router.post('/corrective-actions/:id/close', requirePermission('Resilience', 'approve'), async (req, res) => {
  try {
    const evidenceIds = Array.isArray(req.body?.evidenceIds) ? req.body.evidenceIds.filter((item: unknown) => typeof item === 'string' && item.trim()) : [];
    if (!evidenceIds.length || !req.body?.closureNotes) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Evidence references and closure notes are required.' } });
    const record = await closeCorrectiveAction(getWorkspaceId(req), req.params.id, evidenceIds, req.body.closureNotes, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Corrective action not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'CLOSURE_REJECTED', message: error instanceof Error ? error.message : 'Corrective action closure failed.' } }); }
});

router.post('/crisis-events', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    if (!req.body?.eventTitle || !req.body?.owner) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'eventTitle and owner are required.' } });
    const record = await createCrisisEvent(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_CRISIS_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to log crisis event' } });
  }
});

router.post('/dependencies', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    if (!req.body?.sourceType || !req.body?.sourceId || !req.body?.targetType || !req.body?.targetId) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A persisted source and target are required.' } });
    const record = await createDependency(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_DEPENDENCY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create dependency' } });
  }
});

router.post('/resilience-scenarios', requirePermission('Resilience', 'edit'), async (req, res) => {
  try {
    if (!req.body?.title || !req.body?.criticalServiceId || !req.body?.disruptionScenario) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'title, criticalServiceId, and disruptionScenario are required.' } });
    const record = await createResilienceScenario(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_SCENARIO_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create resilience scenario' } });
  }
});

router.post('/reports/:reportType', requirePermission('Resilience', 'export'), async (req, res) => {
  try {
    const allowedReports: BcmReportType[] = ['business_continuity_report','recovery_readiness_report','dora_report','operational_resilience_report','executive_bcm_summary','board_bcm_pack'];
    if (!allowedReports.includes(req.params.reportType as BcmReportType)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported BCM report type.' } });
    const report = await generateBcmReport(getWorkspaceId(req), req.params.reportType as BcmReportType, actorFromRequest(req));
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'BCM_REPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to generate BCM report' } });
  }
});

export default router;
