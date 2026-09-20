import { Router } from 'express';
import * as repo from '../repositories/frameworkAssessmentScopeRepo.js';
import { validateScopeControlUpdate } from '../services/frameworkAssessmentScopeRules.js';

const router = Router();

router.get('/', async (req, res) => {
  const scopes = await repo.listScopes(req.authUser!.workspaceId, typeof req.query.frameworkCode === 'string' ? req.query.frameworkCode : undefined);
  res.json({ data: scopes, error: null });
});
router.post('/', async (req, res) => {
  if (!req.body.frameworkCode || !req.body.frameworkName || !req.body.name) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Framework and scope name are required.' } });
  const scope = await repo.createScope(req.authUser!.workspaceId, req.authUser!.email, req.body);
  res.status(201).json({ data: await repo.getScope(req.authUser!.workspaceId, scope.id), error: null });
});
router.get('/:id', async (req, res) => {
  const scope = await repo.getScope(req.authUser!.workspaceId, req.params.id);
  return scope ? res.json({ data: scope, error: null }) : res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Assessment scope not found.' } });
});
router.patch('/:id/controls/:controlId', async (req, res) => {
  const { inclusionStatus, exclusionReason, justification, reviewDate } = req.body;
  const validationError = validateScopeControlUpdate({ inclusionStatus, exclusionReason, justification, reviewDate });
  if (validationError) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: validationError } });
  const control = await repo.updateScopeControl(req.authUser!.workspaceId, req.params.id, req.params.controlId, req.authUser!.email, req.body);
  return control ? res.json({ data: control, error: null }) : res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Scoped control not found.' } });
});
router.post('/:id/include-all', async (req, res) => {
  await repo.includeAll(req.authUser!.workspaceId, req.params.id, req.authUser!.email);
  res.json({ data: await repo.getScope(req.authUser!.workspaceId, req.params.id), error: null });
});
router.post('/:id/approve', async (req, res) => {
  try {
    const approved = await repo.approveScope(req.authUser!.workspaceId, req.params.id, req.authUser!.email);
    return approved ? res.json({ data: await repo.getScope(req.authUser!.workspaceId, req.params.id), error: null }) : res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Assessment scope not found.' } });
  } catch (error) {
    return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Scope cannot be approved.' } });
  }
});

export default router;
