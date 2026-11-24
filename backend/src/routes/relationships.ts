import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { getWorkspaceId } from '../workspace.js';
import { archiveEnterpriseRelationship, createEnterpriseRelationship, getEntityRelationships, getRelationshipHistory, searchRelationshipEntities, supportedRelationships } from '../services/relationships.js';
import type { RelationshipEntityType } from '../types/relationships.js';

const router = Router();
const workspace = (req: Request) => getWorkspaceId(req);
const actor = (req: Request) => ({
  userId: req.authUser?.userId || 'unknown-user',
  name: String(req.authUser?.email || 'Workspace Operator'),
  role: String(req.authUser?.role || 'viewer'),
});
const handle = (error: unknown, res: Response) => {
  const typed = error as Error & { status?: number; code?: string };
  const status = typed.status || (typed.code === '23505' ? 409 : 500);
  return res.status(status).json({ data: null, error: { code: status === 409 ? 'RELATIONSHIP_EXISTS' : status === 404 ? 'NOT_FOUND' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', message: typed.message } });
};

router.get('/types', requirePermission('Controls', 'view'), (_req, res) => res.json({ data: supportedRelationships, error: null }));
router.get('/search/:entityType', requirePermission('Controls', 'view'), async (req, res) => {
  try { return res.json({ data: await searchRelationshipEntities(workspace(req), req.params.entityType as RelationshipEntityType, String(req.query.q || '')), error: null }); }
  catch (error) { return handle(error, res); }
});
router.get('/history/:id', requirePermission('Controls', 'view'), async (req, res) => {
  try { return res.json({ data: await getRelationshipHistory(workspace(req), req.params.id), error: null }); }
  catch (error) { return handle(error, res); }
});
router.get('/:entityType/:entityId', requirePermission('Controls', 'view'), async (req, res) => {
  try { return res.json({ data: await getEntityRelationships(workspace(req), req.params.entityType as RelationshipEntityType, req.params.entityId, req.query.includeArchived === 'true'), error: null }); }
  catch (error) { return handle(error, res); }
});
router.post('/', requirePermission('Controls', 'edit'), async (req, res) => {
  try { return res.status(201).json({ data: await createEnterpriseRelationship(workspace(req), req.body || {}, actor(req)), error: null }); }
  catch (error) { return handle(error, res); }
});
router.delete('/:id', requirePermission('Controls', 'edit'), async (req, res) => {
  try { return res.json({ data: await archiveEnterpriseRelationship(workspace(req), req.params.id, actor(req)), error: null }); }
  catch (error) { return handle(error, res); }
});
export default router;
