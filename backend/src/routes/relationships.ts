import { Router, type NextFunction, type Request, type Response } from 'express';
import { requirePermission, resolveEnterpriseRole } from '../middleware/permissionMiddleware.js';
import * as governanceRepo from '../repositories/accessGovernanceRepo.js';
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
  ai_system: 'AI',
  data_asset: 'Reports',
};

export function relationshipPermissionModule(type: string): PermissionModule {
  const moduleName = relationshipModules[type as RelationshipEntityType];
  if (!moduleName) throw Object.assign(new Error('Unsupported relationship entity type'), { status: 400 });
  return moduleName;
}

type RelationshipData = Awaited<ReturnType<typeof getEntityRelationships>>;

function relatedEntityType(relationship: RelationshipData['relationships'][number]) {
  return relationship.direction === 'incoming' ? relationship.sourceEntityType : relationship.targetEntityType;
}

export function filterRelationshipDataByModules(data: RelationshipData, readableModules: ReadonlySet<PermissionModule>) {
  const relationships = data.relationships.filter(relationship => readableModules.has(relationshipPermissionModule(relatedEntityType(relationship))));
  const counts = relationships.reduce<Record<string, number>>((result, relationship) => {
    const type = relatedEntityType(relationship);
    result[type] = (result[type] || 0) + 1;
    return result;
  }, {});
  return { ...data, relationships, counts };
}

async function readableRelationshipModules(req: Request, data: RelationshipData) {
  const requestedModule = relationshipPermissionModule(data.entity.type);
  const readable = new Set<PermissionModule>([requestedModule]);
  const roleId = await resolveEnterpriseRole(req);
  if (!roleId || !req.authUser) return readable;
  const modules = new Set(data.relationships.map(relationship => relationshipPermissionModule(relatedEntityType(relationship))));
  await Promise.all([...modules].filter(moduleName => moduleName !== requestedModule).map(async moduleName => {
    if (await governanceRepo.hasPermission(req.authUser!.workspaceId, roleId as Parameters<typeof governanceRepo.hasPermission>[1], moduleName, 'view')) readable.add(moduleName);
  }));
  return readable;
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

const relationshipAuthorization = new WeakMap<Request, ReturnType<typeof getRelationshipAuthorizationContext>>();
const relationshipAuthorizationContext = (req: Request) => {
  const existing = relationshipAuthorization.get(req);
  if (existing) return existing;
  const pending = getRelationshipAuthorizationContext(workspace(req), req.params.id);
  relationshipAuthorization.set(req, pending);
  return pending;
};
const sourceTypeFromRelationship = async (req: Request) => (await relationshipAuthorizationContext(req)).sourceEntityType;
const targetTypeFromRelationship = async (req: Request) => (await relationshipAuthorizationContext(req)).targetEntityType;

router.get('/types', requireEntityPermission('view', req => String(req.query.sourceEntityType || '')), (req, res) => {
  const source = String(req.query.sourceEntityType || '');
  return res.json({ data: Object.fromEntries(Object.entries(supportedRelationships).filter(([, pair]) => pair[0] === source)), error: null });
});
router.get('/search/:entityType', requireEntityPermission('view', req => String(req.query.sourceEntityType || '')), requireEntityPermission('view', req => req.params.entityType), async (req, res) => {
  try { return res.json({ data: await searchRelationshipEntities(workspace(req), String(req.query.sourceEntityType || '') as RelationshipEntityType, req.params.entityType as RelationshipEntityType, String(req.query.q || '')), error: null }); }
  catch (error) { return handle(error, res); }
});
router.get('/history/:id', requireEntityPermission('view', sourceTypeFromRelationship), requireEntityPermission('view', targetTypeFromRelationship), async (req, res) => {
  try { return res.json({ data: await getRelationshipHistory(workspace(req), req.params.id), error: null }); }
  catch (error) { return handle(error, res); }
});
router.get('/:entityType/:entityId', requireEntityPermission('view', req => req.params.entityType), async (req, res) => {
  try {
    const data = await getEntityRelationships(workspace(req), req.params.entityType as RelationshipEntityType, req.params.entityId, req.query.includeArchived === 'true');
    return res.json({ data: filterRelationshipDataByModules(data, await readableRelationshipModules(req, data)), error: null });
  }
  catch (error) { return handle(error, res); }
});
router.post('/', requireEntityPermission('edit', req => String(req.body?.sourceEntityType || '')), requireEntityPermission('view', req => String(req.body?.targetEntityType || '')), async (req, res) => {
  try { return res.status(201).json({ data: await createEnterpriseRelationship(workspace(req), req.body || {}, actor(req)), error: null }); }
  catch (error) { return handle(error, res); }
});
router.delete('/:id', requireEntityPermission('edit', sourceTypeFromRelationship), async (req, res) => {
  try { return res.json({ data: await archiveEnterpriseRelationship(workspace(req), req.params.id, actor(req)), error: null }); }
  catch (error) { return handle(error, res); }
});
export default router;
