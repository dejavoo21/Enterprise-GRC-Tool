import { Router, Request, Response } from 'express';
import {
  exportActivities,
  filterActivities,
  getActivitiesForTarget,
  getActivitiesForUser,
  getActivityById,
  summarizeActivity,
} from '../services/activityLedger/activityLedger.js';
import { ActivityLedgerCategory, ActivityLedgerOutcome, ActivityLedgerSeverity } from '../types/activityLedger.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.authUser!.workspaceId;
    const { dateFrom, dateTo, category, action, actor, targetType, severity, outcome, framework, limit } = req.query;
    const [entries, summary] = await Promise.all([
      filterActivities({
        workspaceId,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        category: category as ActivityLedgerCategory | undefined,
        action: action as string | undefined,
        actor: actor as string | undefined,
        targetType: targetType as string | undefined,
        severity: severity as ActivityLedgerSeverity | undefined,
        outcome: outcome as ActivityLedgerOutcome | undefined,
        framework: framework as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
      }),
      summarizeActivity(workspaceId),
    ]);
    return res.json({ data: { entries, summary }, error: null });
  } catch (error) {
    console.error('List activity ledger error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load activity ledger' } });
  }
});

router.get('/target/:targetType/:targetId', async (req: Request, res: Response) => {
  try {
    const entries = await getActivitiesForTarget(req.authUser!.workspaceId, req.params.targetType, req.params.targetId);
    return res.json({ data: entries, error: null });
  } catch (error) {
    console.error('Get target activity ledger error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load target activity' } });
  }
});

router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const entries = await getActivitiesForUser(req.authUser!.workspaceId, req.params.userId);
    return res.json({ data: entries, error: null });
  } catch (error) {
    console.error('Get user activity ledger error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load user activity' } });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const payload = await exportActivities({
      workspaceId: req.authUser!.workspaceId,
      dateFrom: req.body?.dateFrom,
      dateTo: req.body?.dateTo,
      category: req.body?.category,
      action: req.body?.action,
      actor: req.body?.actor,
      targetType: req.body?.targetType,
      severity: req.body?.severity,
      outcome: req.body?.outcome,
      framework: req.body?.framework,
      limit: req.body?.limit,
    });
    return res.json({ data: payload, error: null });
  } catch (error) {
    console.error('Export activity ledger error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to export activity ledger' } });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const entry = await getActivityById(req.authUser!.workspaceId, req.params.id);
    if (!entry) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Activity ledger entry not found' } });
    }
    return res.json({ data: entry, error: null });
  } catch (error) {
    console.error('Get activity ledger entry error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load activity entry' } });
  }
});

export default router;
