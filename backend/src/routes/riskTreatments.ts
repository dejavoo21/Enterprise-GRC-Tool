import { InvalidTreatmentControl } from '../repositories/treatmentControlRepo.js';
import { Router } from 'express';
import * as repo from '../repositories/riskTreatmentRepo.js';
import * as risksRepo from '../repositories/risksRepo.js';
import { validateRiskTreatment } from '../services/riskTreatmentValidation.js';
import { riskTreatmentActivityAction } from '../services/riskTreatmentActivity.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.authUser) return res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  if (getWorkspaceId(req) !== req.authUser.workspaceId) return res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Workspace does not match the authenticated session' } });
  next();
});

async function log(req: Parameters<typeof buildActivityFromRequest>[0], action: string, plan: Awaited<ReturnType<typeof repo.get>>, previousValue?: unknown) {
  if (!plan) return;
  await recordActivity(buildActivityFromRequest(req, { action, category: 'risk', targetType: 'risk_treatment_plan', targetId: plan.id, targetName: plan.riskRef ? `${plan.riskRef} | ${plan.title}` : plan.title, previousValue, newValue: plan, outcome: 'success', severity: plan.priority === 'critical' ? 'high' : 'medium', notes: `${action.replaceAll('_', ' ')} for ${plan.riskRef || plan.riskId} | ${plan.riskTitle || 'Untitled risk'}`, source: 'backend' }));
}

async function logControlChanges(req: Parameters<typeof buildActivityFromRequest>[0], plan: Awaited<ReturnType<typeof repo.get>>, previous?: Awaited<ReturnType<typeof repo.get>>) {
  if (!plan) return;
  const old = previous?.linkedControls || [];
  const next = plan.linkedControls || [];
  const changes: { action: string; before?: unknown; after?: unknown }[] = [];
  for (const link of next) {
    const prior = old.find(item => item.controlId === link.controlId);
    if (!prior) changes.push({ action: 'risk_treatment_control_linked', after: link });
    else {
      if (prior.role !== link.role) changes.push({ action: 'risk_treatment_control_role_updated', before: prior, after: link });
      if (prior.implementationNote !== link.implementationNote) changes.push({ action: 'risk_treatment_control_note_updated', before: prior, after: link });
    }
  }
  for (const link of old) if (!next.some(item => item.controlId === link.controlId)) changes.push({ action: 'risk_treatment_control_removed', before: link });
  for (const change of changes) await recordActivity(buildActivityFromRequest(req, { action: change.action, category: 'risk', targetType: 'risk_treatment_plan', targetId: plan.id, targetName: plan.riskRef ? `${plan.riskRef} | ${plan.title}` : plan.title, previousValue: change.before, newValue: change.after, outcome: 'success', source: 'backend' }));
}
router.get('/', async (req, res) => {
  try { const workspaceId = getWorkspaceId(req); res.json({ data: await repo.list(workspaceId, typeof req.query.riskId === 'string' ? req.query.riskId : undefined), error: null }); }
  catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P0001' && 'message' in error) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: String(error.message) } }); res.status(500).json({ data: null, error: { code: 'TREATMENTS_FETCH_FAILED', message: 'Failed to load treatment plans' } }); }
});

router.get('/summary', async (req, res) => {
  try { res.json({ data: await repo.summary(getWorkspaceId(req)), error: null }); }
  catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P0001' && 'message' in error) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: String(error.message) } }); res.status(500).json({ data: null, error: { code: 'TREATMENT_SUMMARY_FAILED', message: 'Failed to load treatment summary' } }); }
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
    await logControlChanges(req, plan);
    res.status(201).json({ data: plan, error: null });
  } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P0001' && 'message' in error) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: String(error.message) } }); if (error instanceof InvalidTreatmentControl) return res.status(400).json({ data: null, error: { code: 'INVALID_CONTROL', message: error.message } }); res.status(500).json({ data: null, error: { code: 'TREATMENT_CREATE_FAILED', message: 'Failed to create treatment plan' } }); }
});

router.patch('/:treatmentId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req); const existing = await repo.get(workspaceId, req.params.treatmentId);
    if (!existing) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Treatment plan not found' } });
    const updates = { ...req.body, createdBy: req.authUser?.userId }; delete updates.id; delete updates.workspaceId; delete updates.riskId; delete updates.createdAt; delete updates.updatedAt; delete updates.riskTitle;
    const validationError = validateRiskTreatment(updates, existing);
    if (validationError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: validationError } });
    const plan = await repo.update(workspaceId, existing.id, updates);
    const action = plan ? riskTreatmentActivityAction(existing, plan) : 'risk_treatment_updated';
    await log(req, action, plan, existing);
    await logControlChanges(req, plan, existing);
    res.json({ data: plan, error: null });
  } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P0001' && 'message' in error) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: String(error.message) } }); if (error instanceof InvalidTreatmentControl) return res.status(400).json({ data: null, error: { code: 'INVALID_CONTROL', message: error.message } }); res.status(500).json({ data: null, error: { code: 'TREATMENT_UPDATE_FAILED', message: 'Failed to update treatment plan' } }); }
});

export default router;
