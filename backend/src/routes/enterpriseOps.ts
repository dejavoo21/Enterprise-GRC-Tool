import { Router } from 'express';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { getEnterpriseEntity360, getEnterpriseOpsState, searchEnterpriseEntities } from '../repositories/enterpriseOpsRepo.js';

const router = Router();

router.get('/state', async (req, res) => {
  try {
    const state = await getEnterpriseOpsState(req.authUser!.workspaceId);
    res.json({ data: state, error: null });
  } catch (error) {
    console.error('Enterprise ops state error:', error);
    res.status(500).json({ data: null, error: { code: 'ENTERPRISE_OPS_STATE_FAILED', message: error instanceof Error ? error.message : 'Failed to load enterprise operating system state' } });
  }
});

router.get('/search', requirePermission('Dashboard', 'view'), async (req, res) => {
  try {
    const entries = await searchEnterpriseEntities(req.authUser!.workspaceId, String(req.query.q || ''));
    res.json({ data: entries, error: null });
  } catch (error) {
    console.error('Enterprise ops search error:', error);
    res.status(500).json({ data: null, error: { code: 'ENTERPRISE_OPS_SEARCH_FAILED', message: error instanceof Error ? error.message : 'Failed to search enterprise entities' } });
  }
});

router.get('/entity/:entityType/:entityId', requirePermission('Dashboard', 'view'), async (req, res) => {
  try {
    const view = await getEnterpriseEntity360(req.authUser!.workspaceId, req.params.entityType as any, req.params.entityId);
    if (!view) {
      return res.status(404).json({ data: null, error: { code: 'ENTERPRISE_ENTITY_NOT_FOUND', message: 'Enterprise entity not found' } });
    }
    res.json({ data: view, error: null });
  } catch (error) {
    console.error('Enterprise ops entity view error:', error);
    res.status(500).json({ data: null, error: { code: 'ENTERPRISE_ENTITY_VIEW_FAILED', message: error instanceof Error ? error.message : 'Failed to load entity 360 view' } });
  }
});

export default router;
