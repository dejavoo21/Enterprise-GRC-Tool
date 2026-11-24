import { Router, type NextFunction, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { getWorkspaceId } from '../workspace.js';
import { archiveEnterpriseRelationship, createEnterpriseRelationship, getEntityRelationships, getRelationshipAuthorizationContext, getRelationshipHistory, searchRelationshipEntities, supportedRelationships } from '../services/relationships.js';
import type { RelationshipEntityType } from '../types/relationships.js';
import type { PermissionAction, PermissionModule } from '../types/accessGovernance.js';

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

const relationshipModules: Record<RelationshipEntityType, PermissionModule> = {
  risk: 'Risks',
  asset: 'Controls',
  control: 'Controls',
  evidence: 'Evidence',
  supplier: 'Vendors',
  contract: 'Vendors',
  policy: 'Policies',
  framework: 'Controls',
  finding: 'Audits',
  remediation: 'Audits',
  business_process: 'Resilience',
};

export function relationshipPermissionModule(type: string): PermissionModule {
  const moduleName = relationshipModules[type as RelationshipEntityType];
  if (!moduleName) throw Object.assign(new Error('Unsupported relationship entity type'), { status: 400 });
  return moduleName;
}

function requireEntityPermission(
  action: PermissionAction,
  resolveType: (req: Request) => string | Promise<string>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const moduleName = relationshipPermissionModule(await resolveType(req));
      return requirePermission(moduleName, action)(req, res, next);
    } catch (error) {
      return handle(error, res);
    }
  };
}

const sourceTypeFromRelationship = async (req: Request) => (
  await getRelationshipAuthorizationContext(workspace(req), req.params.id)
).sourceEntityType;

router.get('/types', requireEntityPermission('view', req => String(req.query.sourceEntityType || '')), (req, res) => {
  const source = String(req.query.sourceEntityType || '');
  return res.json({ data: Object.fromEntries(Object.entries(supportedRelationships).filter(([, pair]) => pair[0] === source)), error: null });
});
router.get('/search/:entityType', requireEntityPermission('view', req => String(req.query.sourceEntityType || '')), async (req, res) => {
  try { return res.json({ data: await searchRelationshipEntities(workspace(req), String(req.query.sourceEntityType || '') as RelationshipEntityType, req.params.entityType as RelationshipEntityType, String(req.query.q || '')), error: null }); }
  catch (error) { return handle(error, res); }
});
router.get('/history/:id', requireEntityPermission('view', sourceTypeFromRelationship), async (req, res) => {
  try { return res.json({ data: await getRelationshipHistory(workspace(req), req.params.id), error: null }); }
  catch (error) { return handle(error, res); }
});
router.get('/:entityType/:entityId', requireEntityPermission('view', req => req.params.entityType), async (req, res) => {
  try { return res.json({ data: await getEntityRelationships(workspace(req), req.params.entityType as RelationshipEntityType, req.params.entityId, req.query.includeArchived === 'true'), error: null }); }
  catch (error) { return handle(error, res); }
});
router.post('/', requireEntityPermission('edit', req => String(req.body?.sourceEntityType || '')), async (req, res) => {
  try { return res.status(201).json({ data: await createEnterpriseRelationship(workspace(req), req.body || {}, actor(req)), error: null }); }
  catch (error) { return handle(error, res); }
});
router.delete('/:id', requireEntityPermission('edit', sourceTypeFromRelationship), async (req, res) => {
  try { return res.json({ data: await archiveEnterpriseRelationship(workspace(req), req.params.id, actor(req)), error: null }); }
  catch (error) { return handle(error, res); }
});
export default router;
