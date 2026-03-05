/**
 * Activity Log Routes
 *
 * API endpoints for querying the activity/audit trail.
 */

import { Router, Request, Response } from 'express';
import { getActivityLog, getActivityLogEntry } from '../services/activityLogService.js';
import { ActivityEntityType } from '../types/models.js';

const router = Router();

/**
 * GET /
 * Fetch activity log entries with optional filters
 *
 * Query params:
 * - entityType: Filter by entity type
 * - entityId: Filter by specific entity
 * - userId: Filter by user
 * - before: ISO date string, return entries before this
 * - limit: Number of entries to return (default 50, max 200)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const { entityType, entityId, userId, before, limit } = req.query;

    const entries = await getActivityLog({
      workspaceId: req.authUser.workspaceId,
      entityType: entityType as ActivityEntityType | undefined,
      entityId: entityId as string | undefined,
      userId: userId as string | undefined,
      before: before as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    return res.json({
      data: entries,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity log' },
    });
  }
});

/**
 * GET /:id
 * Fetch a single activity log entry by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const entry = await getActivityLogEntry(req.authUser.workspaceId, req.params.id);

    if (!entry) {
      return res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Activity log entry not found' },
      });
    }

    return res.json({
      data: entry,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching activity log entry:', error);
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity log entry' },
    });
  }
});

export default router;
