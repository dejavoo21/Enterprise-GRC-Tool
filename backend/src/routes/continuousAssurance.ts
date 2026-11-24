import { Router, type Request, type Response } from 'express';
import { getWorkspaceId } from '../workspace.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  configureConnector,
  createAssuranceException,
  createControlMonitor,
  createRemediationTask,
  generateContinuousAssuranceReport,
  getContinuousAssuranceAnalytics,
  getContinuousAssuranceSettings,
  getContinuousAssuranceState,
  listAssuranceExceptions,
  listAssuranceNotifications,
  listComplianceDrift,
  listConnectors,
  listContinuousAssuranceReports,
  listControlMonitors,
  listEvidenceJobs,
  listRemediationTasks,
  listAutomatedTests,
  recordEvidenceDecision,
  runAutomatedTest,
  updateAssuranceException,
  updateAssuranceNotification,
  updateConnector,
  updateContinuousAssuranceSettings,
  updateControlMonitor,
  updateDriftItem,
  updateNotificationPreference,
  updateRemediationTask,
  closeDrift,
  updateAutomatedTest,
} from '../services/continuousAssurance/continuousAssurance.js';

const router = Router();

function getActorRole(req: Request) {
  const authUser = req.authUser as Record<string, unknown> | undefined;
  return String(authUser?.role || authUser?.workspaceRole || authUser?.userRole || 'viewer');
}

function getActorName(req: Request) {
  const authUser = req.authUser as Record<string, unknown> | undefined;
  return String(authUser?.fullName || authUser?.name || authUser?.email || 'Workspace Operator');
}

function getActorUserId(req: Request) { return req.authUser?.userId || 'unknown-user'; }

function handleRouteError(error: unknown, res: Response, fallbackMessage: string) {
  const typed = error as Error & { status?: number };
  const status = typed.status || (typed.message.includes('permission') ? 403 : 500);
  return res.status(status).json({
    data: null,
    error: {
      code: status === 403 ? 'FORBIDDEN' : status === 501 ? 'INTEGRATION_UNAVAILABLE' : status === 400 ? 'VALIDATION_ERROR' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message: typed.message || fallbackMessage,
    },
  });
}

router.get('/state', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await getContinuousAssuranceState(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance state');
  }
});

router.get('/overview', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    const state = await getContinuousAssuranceState(getWorkspaceId(req));
    return res.json({ data: state.overview, error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance overview');
  }
});

router.get('/analytics', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await getContinuousAssuranceAnalytics(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance analytics');
  }
});

router.get('/monitors', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listControlMonitors(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load control monitors');
  }
});

router.post('/monitors', requirePermission('Controls', 'create'), async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await createControlMonitor(getWorkspaceId(req), getActorRole(req), req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to create control monitor');
  }
});

router.patch('/monitors/:id', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateControlMonitor(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update control monitor');
  }
});

router.get('/tests', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listAutomatedTests(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load automated tests');
  }
});

router.post('/tests/:id/run', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await runAutomatedTest(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to run automated test');
  }
});

router.patch('/tests/:id', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateAutomatedTest(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update automated test');
  }
});

router.get('/evidence-jobs', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listEvidenceJobs(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load evidence collection jobs');
  }
});

router.post('/evidence-jobs/:id/decision', requirePermission('Evidence', 'approve'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await recordEvidenceDecision(
        getWorkspaceId(req),
        getActorRole(req),
        req.params.id,
        req.body?.action,
        req.body?.note,
        getActorName(req),
      ),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to record evidence decision');
  }
});

router.get('/exceptions', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listAssuranceExceptions(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load assurance exceptions');
  }
});

router.post('/exceptions', requirePermission('Controls', 'create'), async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await createAssuranceException(getWorkspaceId(req), getActorRole(req), req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to create assurance exception');
  }
});

router.patch('/exceptions/:id', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateAssuranceException(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update assurance exception');
  }
});

router.get('/drift', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listComplianceDrift(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load drift items');
  }
});

router.patch('/drift/:id', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateDriftItem(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update drift item');
  }
});

router.post('/drift/:id/close', requirePermission('Controls', 'approve'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await closeDrift(getWorkspaceId(req), getActorRole(req), req.params.id, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to close drift item');
  }
});

router.get('/connectors', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listConnectors(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load connectors');
  }
});

router.patch('/connectors/:id', requirePermission('Controls', 'configure'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateConnector(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update connector');
  }
});

router.post('/connectors/:id/configure', requirePermission('Controls', 'configure'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await configureConnector(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to configure connector');
  }
});

router.get('/reports', requirePermission('Reports', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listContinuousAssuranceReports(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance reports');
  }
});

router.post('/reports', requirePermission('Reports', 'export'), async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await generateContinuousAssuranceReport(getWorkspaceId(req), getActorRole(req), req.body?.title || 'Continuous Assurance Report', getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to generate continuous assurance report');
  }
});

router.get('/settings', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await getContinuousAssuranceSettings(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance settings');
  }
});

router.patch('/settings', requirePermission('Controls', 'configure'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateContinuousAssuranceSettings(getWorkspaceId(req), getActorRole(req), req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update continuous assurance settings');
  }
});

router.get('/notifications', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listAssuranceNotifications(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance notifications');
  }
});

router.patch('/notifications/:id', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateAssuranceNotification(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update continuous assurance notification');
  }
});

router.patch('/notification-preferences', requirePermission('Controls', 'configure'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateNotificationPreference(
        getWorkspaceId(req),
        getActorRole(req),
        req.body?.channel,
        req.body?.type,
        Boolean(req.body?.enabled),
      ),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update continuous assurance notification preference');
  }
});

router.get('/remediation-tasks', requirePermission('Controls', 'view'), async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listRemediationTasks(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load remediation tasks');
  }
});

router.post('/remediation-tasks', requirePermission('Controls', 'create'), async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await createRemediationTask(getWorkspaceId(req), getActorRole(req), req.body, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to create remediation task');
  }
});

router.patch('/remediation-tasks/:id', requirePermission('Controls', 'edit'), async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateRemediationTask(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req), getActorUserId(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update remediation task');
  }
});

export default router;
