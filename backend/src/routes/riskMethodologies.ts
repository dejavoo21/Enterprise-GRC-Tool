import { Router, type Request, type Response } from 'express';
import { getWorkspaceId } from '../workspace.js';
import * as repo from '../repositories/riskMethodologyRepo.js';
import { legacyMethodology, MethodologyValidationError, previewMatrix, scoreProfile, validateMethodology } from '../services/riskMethodologyRules.js';

const router = Router();
router.use((req, res, next) => {
  if (!req.authUser) return res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
  if (getWorkspaceId(req) !== req.authUser.workspaceId) return res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Workspace does not match your session.' } });
  if (req.method !== 'GET' && !['owner', 'admin'].includes(req.authUser.role)) return res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Workspace owner or administrator required.' } });
  next();
});
function failed(res: Response, error: unknown) {
  const validation = error instanceof MethodologyValidationError;
  return res.status(validation ? 400 : 503).json({ data: null, error: { code: validation ? 'VALIDATION_ERROR' : 'METHODOLOGY_UNAVAILABLE', message: validation ? error.message : 'Risk methodology storage is unavailable. Contact your administrator.' } });
}
router.get('/', async (req, res) => {
  try { res.json({ data: await repo.list(getWorkspaceId(req)), error: null }); } catch (error) { failed(res, error); }
});
router.get('/active', async (req, res) => {
  try { res.json({ data: (await repo.list(getWorkspaceId(req))).find(item => item.status === 'Active') || null, error: null }); } catch (error) { failed(res, error); }
});
router.get('/state', async (req, res) => {
  try { res.json({data: await repo.workspaceState(getWorkspaceId(req)), error: null}); } catch (error) { failed(res,error); }
});
router.get('/template', (_req, res) => res.json({ data: legacyMethodology, error: null }));
async function save(req: Request, res: Response) {
  try {
    const config = validateMethodology(req.body.config);
    const row = await repo.saveDraft(getWorkspaceId(req), req.authUser!.userId, config, req.params.id, req.body.expectedUpdatedAt);
    res.status(req.params.id ? 200 : 201).json({ data: row, error: null });
  } catch (error) { failed(res, error); }
}
router.post('/', save);
router.patch('/:id', save);
router.get('/:id/matrix', async (req, res) => {
  try {
    const item = await repo.get(getWorkspaceId(req), req.params.id);
    if (!item) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Methodology not found.' } });
    res.json({ data: { methodology: item, cells: previewMatrix(item.config), scope: 'Configuration preview; no risk counts' }, error: null });
  } catch (error) { failed(res, error); }
});
router.post('/preview', (req, res) => {
  try {
    const config = validateMethodology(req.body.config);
    res.json({ data: { cells: previewMatrix(config), profile: req.body.profile ? scoreProfile(config, req.body.profile) : null }, error: null });
  } catch (error) { failed(res, error); }
});
// Fail closed until every risk-writing path supports the versioned methodology.
router.post('/:id/activate', async (req, res) => {
  try {
    if (!await repo.get(getWorkspaceId(req), req.params.id)) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Methodology not found.' } });
    if (process.env.RISK_METHODOLOGY_ACTIVATION_ENABLED !== 'true') return res.status(409).json({ data: null, error: { code: 'VALIDATION_GATE', message: 'Activation is disabled until PostgreSQL and frontend validation is signed off.' } });
    res.json({ data: await repo.activate(getWorkspaceId(req), req.params.id, req.authUser!.userId, req.body.confirmPreserveExisting === true), error: null });
  } catch (error) { failed(res, error); }
});
export default router;
