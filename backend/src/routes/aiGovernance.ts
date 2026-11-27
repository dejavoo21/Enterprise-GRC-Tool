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
  decideAiSystem,
  decideAiModelReview,
  generateAiReport,
  getAiGovernanceState,
  getAiModelHistory,
  submitAiModelForReview,
  transitionAiAssessment,
  transitionAiControl,
  transitionAiIncident,
  updateAiModel,
  updateAiSystem,
  upsertAiComplianceProgram,
} from '../services/aiGovernanceService.js';
import type { AiReportType } from '../types/aiGovernance.js';
import { AiComplianceValidationError, assertAiComplianceProgram } from '../services/aiComplianceRules.js';

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
    if (!req.body?.systemName || !req.body?.owner || !req.body?.businessUnit || !req.body?.purpose || !req.body?.description) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'systemName, owner, businessUnit, purpose, and description are required.' } });
    if (req.body.inventoryCoveragePercent !== undefined && (typeof req.body.inventoryCoveragePercent !== 'number' || !Number.isFinite(req.body.inventoryCoveragePercent) || req.body.inventoryCoveragePercent < 0 || req.body.inventoryCoveragePercent > 100)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Inventory coverage must be a recorded number from 0 to 100.' } });
    const record = await createAiSystem(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_SYSTEM_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI system' } });
  }
});

router.patch('/inventory/:id', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    if (['approved','active','production','rejected'].includes(req.body?.lifecycleStatus)) return res.status(400).json({ data: null, error: { code: 'CONTROLLED_DECISION_REQUIRED', message: 'Use the inventory decision workflow for approval changes.' } });
    if (req.body?.inventoryCoveragePercent !== undefined && (typeof req.body.inventoryCoveragePercent !== 'number' || !Number.isFinite(req.body.inventoryCoveragePercent) || req.body.inventoryCoveragePercent < 0 || req.body.inventoryCoveragePercent > 100)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Inventory coverage must be a recorded number from 0 to 100.' } });
    const record = await updateAiSystem(getWorkspaceId(req), req.params.id, req.body || {}, actorFromRequest(req));
    if (!record) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI system not found' } });
    }
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_SYSTEM_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update AI system' } });
  }
});

router.post('/inventory/:id/decision', requirePermission('AI', 'approve'), async (req, res) => {
  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Decision must be approved or rejected.' } });
  try {
    const record = await decideAiSystem(getWorkspaceId(req), req.params.id, decision, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI system not found.' } });
    res.json({ data: record, error: null });
  } catch (error) {
    res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'System decision failed.' } });
  }
});

router.post('/models', requirePermission('AI', 'create'), async (req, res) => {
  try {
    if (!req.body?.modelName || !req.body?.version || !req.body?.owner || !req.body?.purpose) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'modelName, version, owner, and purpose are required.' } });
    const record = await createAiModel(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_MODEL_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI model' } });
  }
});

router.get('/models/:id/history', requirePermission('AI', 'view'), async (req, res) => {
  res.json({ data: await getAiModelHistory(getWorkspaceId(req), req.params.id), error: null });
});

router.post('/models/:id/submit', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    const record = await submitAiModelForReview(getWorkspaceId(req), req.params.id, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI model not found or state changed.' } });
    res.json({ data: record, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'AI_MODEL_SUBMIT_FAILED';
    res.status(409).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Failed to submit AI model.' } });
  }
});

router.post('/models/:id/decision', requirePermission('AI', 'approve'), async (req, res) => {
  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Decision must be approved or rejected.' } });
  try {
    const record = await decideAiModelReview(getWorkspaceId(req), req.params.id, decision, req.body?.notes, actorFromRequest(req));
    if (!record) return res.status(409).json({ data: null, error: { code: 'MODEL_STATE_CHANGED', message: 'AI model was not found or its review state changed.' } });
    res.json({ data: record, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'AI_MODEL_DECISION_FAILED';
    res.status(409).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Failed to decide AI model.' } });
  }
});

router.patch('/models/:id', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    if (req.body?.approvalStatus !== undefined || req.body?.reviewedBy !== undefined) return res.status(400).json({ data: null, error: { code: 'CONTROLLED_REVIEW_REQUIRED', message: 'Use the model submission and decision workflow for approval changes.' } });
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
    if (!req.body?.systemId || !req.body?.assessmentName || !req.body?.owner) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'systemId, assessmentName, and owner are required.' } });
    const record = await createAiAssessment(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_ASSESSMENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI assessment' } });
  }
});

router.post('/assessments/:id/status', requirePermission('AI', 'edit'), async (req, res) => {
  const status = req.body?.status;
  const allowed = ['draft','in_progress','awaiting_information','under_review','remediation_required','completed','reassessment_required'];
  if (!allowed.includes(status)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported assessment status.' } });
  try {
    const record = await transitionAiAssessment(getWorkspaceId(req), req.params.id, status, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI assessment not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'Assessment transition failed.' } }); }
});

router.post('/assessments/:id/decision', requirePermission('AI', 'approve'), async (req, res) => {
  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Decision must be approved or rejected.' } });
  try {
    const record = await transitionAiAssessment(getWorkspaceId(req), req.params.id, decision, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI assessment not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'Assessment decision failed.' } }); }
});

router.post('/controls', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    if (!req.body?.controlName || !req.body?.owner || !req.body?.description) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'controlName, owner, and description are required.' } });
    const record = await createAiControl(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_CONTROL_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI control' } });
  }
});

router.post('/controls/:id/status', requirePermission('AI', 'edit'), async (req, res) => {
  const status = req.body?.status;
  if (!['planned','needs_attention','implemented'].includes(status)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported control status.' } });
  try {
    const record = await transitionAiControl(getWorkspaceId(req), req.params.id, status, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI control not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'Control transition failed.' } }); }
});

router.post('/incidents', requirePermission('AI', 'edit'), async (req, res) => {
  try {
    if (!req.body?.systemId || !req.body?.title || !req.body?.owner || !req.body?.summary) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'systemId, title, owner, and summary are required.' } });
    const record = await createAiIncident(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_INCIDENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create AI incident' } });
  }
});

router.post('/incidents/:id/status', requirePermission('AI', 'edit'), async (req, res) => {
  const status = req.body?.status;
  if (!['open','investigating','resolved','reported'].includes(status)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported incident status.' } });
  try {
    const record = await transitionAiIncident(getWorkspaceId(req), req.params.id, status, actorFromRequest(req));
    if (!record) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'AI incident not found.' } });
    res.json({ data: record, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'INVALID_TRANSITION', message: error instanceof Error ? error.message : 'Incident transition failed.' } }); }
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
    assertAiComplianceProgram(req.body || {});
    const record = await upsertAiComplianceProgram(getWorkspaceId(req), req.body || {}, actorFromRequest(req));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    const validation = error instanceof AiComplianceValidationError;
    res.status(validation ? 400 : 500).json({ data: null, error: { code: validation ? 'VALIDATION_ERROR' : 'AI_COMPLIANCE_PROGRAM_FAILED', message: error instanceof Error ? error.message : 'Failed to update AI compliance program' } });
  }
});

router.post('/reports/:reportType', requirePermission('AI', 'export'), async (req, res) => {
  try {
    const reportType = req.params.reportType as AiReportType;
    const validReportTypes: AiReportType[] = ['ai_governance_report','ai_risk_report','model_risk_report','eu_ai_act_report','iso42001_report','executive_ai_dashboard','board_ai_risk_pack'];
    if (!validReportTypes.includes(reportType)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported AI report type.' } });
    const report = await generateAiReport(getWorkspaceId(req), reportType, actorFromRequest(req));
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'AI_REPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to generate AI report' } });
  }
});

export default router;
