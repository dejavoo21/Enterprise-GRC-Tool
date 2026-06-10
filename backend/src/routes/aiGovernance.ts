import { Router } from 'express';
import { getWorkspaceId } from '../workspace.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  createAiAssessment,
  createAiControl,
  createAiIncident,
  createAiModel,
  createAiSystem,
  createAiTrainingProgram,
  createAiVendor,
  generateAiReport,
  getAiGovernanceState,
  updateAiModel,
  updateAiSystem,
  upsertAiComplianceProgram,
} from '../services/aiGovernanceService.js';
import type { AiReportType } from '../types/aiGovernance.js';

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
    const state = await getAiGovernanceState(getWorkspaceId(req));
    res.json({ data: state, error: null });
  } catch (error) {
    console.error('AI governance state error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'AI_GOVERNANCE_STATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load AI governance state',
      },
    });
  }
});

router.post('/inventory', requirePermission('AI', 'create'), async (req, res) => {
  try {
    const record = await createAiSystem(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_SYSTEM_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI system' } });
  }
});

router.patch('/inventory/:id', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    const record = await updateAiSystem(getWorkspaceId(req), req.params.id, req.body || {}, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI system not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_SYSTEM_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update AI system' } });
  }
});

router.post('/models', requirePermission('AI', 'create'), async (req, res) => {
  try {
    const record = await createAiModel(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_MODEL_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI model' } });
  }
});

router.patch('/models/:id', requirePermission('AI', 'approve'), async (req, res) => {
  try {
    const record = await updateAiModel(getWorkspaceId(req), req.params.id, req.body || {}, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI model not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_MODEL_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update AI model' } });
  }
});

router.post('/assessments', requirePermission('AI', 'create'), async (req, res) => {
  try {
    const record = await createAiAssessment(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_ASSESSMENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI assessment' } });
  }
});

router.post('/controls', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    const record = await createAiControl(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_CONTROL_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI control' } });
  }
});

router.post('/incidents', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    const record = await createAiIncident(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_INCIDENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI incident' } });
  }
});

router.post('/vendors', requirePermission('AI', 'assign'), async (req, res) => {
  try {
    const record = await createAiVendor(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_VENDOR_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI vendor record' } });
  }
});

router.post('/training-programs', requirePermission('AI', 'assign'), async (req, res) => {
  try {
    const record = await createAiTrainingProgram(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_TRAINING_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI training program' } });
  }
});

router.post('/compliance-programs', requirePermission('AI', 'configure'), async (req, res) => {
  try {
    const record = await upsertAiComplianceProgram(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_COMPLIANCE_PROGRAM_FAILED', message: error instanceof Error ? error.message : 'Failed to update AI compliance program' } });
  }
});

router.post('/reports/:reportType', requirePermission('AI', 'export'), async (req, res) => {
  try {
    const report = await generateAiReport(getWorkspaceId(req), req.params.reportType as AiReportType, actorFromRequest(req));
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_REPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to generate AI report' } });
  }
});

export default router;
