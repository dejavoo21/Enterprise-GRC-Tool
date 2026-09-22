import { Router } from 'express';
import * as repo from '../repositories/riskTreatmentRepo.js';
import * as risksRepo from '../repositories/risksRepo.js';
import { validateRiskTreatment } from '../services/riskTreatmentValidation.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

async function log(req: Parameters<typeof buildActivityFromRequest>[0], action: string, plan: Awaited<ReturnType<typeof repo.get>>, previousValue?: unknown) {
  if (!plan) return;
  await recordActivity(buildActivityFromRequest(req, { action, category: 'risk', targetType: 'risk_treatment_plan', targetId: plan.id, targetName: plan.title, previousValue, newValue: plan, outcome: 'success', severity: plan.priority === 'critical' ? 'high' : 'medium', notes: `${action.replaceAll('_', ' ')} for ${plan.riskTitle || plan.riskId}`, source: 'backend' }));
}

router.get('/', async (req, res) => {
  try { const workspaceId = getWorkspaceId(req); res.json({ data: await repo.list(workspaceId, typeof req.query.riskId === 'string' ? req.query.riskId : undefined), error: null }); }
  catch (error) { res.status(500).json({ data: null, error: { code: 'TREATMENTS_FETCH_FAILED', message: error instanceof Error ? error.message : 'Failed to load treatment plans' } }); }
});

router.get('/summary', async (req, res) => {
  try { res.json({ data: await repo.summary(getWorkspaceId(req)), error: null }); }
  catch (error) { res.status(500).json({ data: null, error: { code: 'TREATMENT_SUMMARY_FAILED', message: error instanceof Error ? error.message : 'Failed to load treatment summary' } }); }
});

router.post('/risk/:riskId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const risk = await risksRepo.getRiskById(workspaceId, req.params.riskId);
    if (!risk) return res.status(404).json({ data: null, error: { code: 'RISK_NOT_FOUND', message: 'The linked risk does not exist' } });
    const input = { ...req.body, riskId: req.params.riskId, createdBy: req.authUser?.userId };
    const validationError = validateRiskTreatment(input);
    if (validationError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: validationError } });
    const plan = await repo.create(workspaceId, input);
    await log(req, 'risk_treatment_created', plan);
    res.status(201).json({ data: plan, error: null });
  } catch (error) { res.status(500).json({ data: null, error: { code: 'TREATMENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create treatment plan' } }); }
});

router.patch('/:treatmentId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req); const existing = await repo.get(workspaceId, req.params.treatmentId);
    if (!existing) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Treatment plan not found' } });
    const updates = { ...req.body }; delete updates.id; delete updates.workspaceId; delete updates.riskId; delete updates.createdAt; delete updates.updatedAt; delete updates.riskTitle;
    const validationError = validateRiskTreatment(updates, existing);
    if (validationError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: validationError } });
    const plan = await repo.update(workspaceId, existing.id, updates);
    const action = plan?.status === 'completed' ? 'risk_treatment_completed' : plan?.status !== existing.status ? 'risk_treatment_status_changed' : plan?.progressPercent !== existing.progressPercent ? 'risk_treatment_progress_changed' : 'risk_treatment_updated';
    await log(req, action, plan, existing);
    res.json({ data: plan, error: null });
  } catch (error) { res.status(500).json({ data: null, error: { code: 'TREATMENT_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update treatment plan' } }); }
});

export default router;
