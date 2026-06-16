import { Router, type Request, type Response } from 'express';
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

function getWorkspaceId(req: Request) {
  return req.authUser?.workspaceId || String(req.headers['x-workspace-id'] || '');
}

function getActorRole(req: Request) {
  const authUser = req.authUser as Record<string, unknown> | undefined;
  return String(authUser?.role || authUser?.workspaceRole || authUser?.userRole || 'viewer');
}

function getActorName(req: Request) {
  const authUser = req.authUser as Record<string, unknown> | undefined;
  return String(authUser?.fullName || authUser?.name || authUser?.email || 'Workspace Operator');
}

function handleRouteError(error: unknown, res: Response, fallbackMessage: string) {
  const typed = error as Error & { status?: number };
  const status = typed.status || (typed.message.includes('permission') ? 403 : 500);
  return res.status(status).json({
    data: null,
    error: {
      code: status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      message: typed.message || fallbackMessage,
    },
  });
}

router.get('/state', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await getContinuousAssuranceState(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance state');
  }
});

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const state = await getContinuousAssuranceState(getWorkspaceId(req));
    return res.json({ data: state.overview, error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance overview');
  }
});

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await getContinuousAssuranceAnalytics(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance analytics');
  }
});

router.get('/monitors', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listControlMonitors(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load control monitors');
  }
});

router.post('/monitors', async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await createControlMonitor(getWorkspaceId(req), getActorRole(req), req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to create control monitor');
  }
});

router.patch('/monitors/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateControlMonitor(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update control monitor');
  }
});

router.get('/tests', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listAutomatedTests(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load automated tests');
  }
});

router.post('/tests/:id/run', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await runAutomatedTest(getWorkspaceId(req), getActorRole(req), req.params.id, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to run automated test');
  }
});

router.patch('/tests/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateAutomatedTest(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update automated test');
  }
});

router.get('/evidence-jobs', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listEvidenceJobs(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load evidence collection jobs');
  }
});

router.post('/evidence-jobs/:id/decision', async (req: Request, res: Response) => {
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

router.get('/exceptions', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listAssuranceExceptions(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load assurance exceptions');
  }
});

router.post('/exceptions', async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await createAssuranceException(getWorkspaceId(req), getActorRole(req), req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to create assurance exception');
  }
});

router.patch('/exceptions/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateAssuranceException(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update assurance exception');
  }
});

router.get('/drift', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listComplianceDrift(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load drift items');
  }
});

router.patch('/drift/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateDriftItem(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update drift item');
  }
});

router.post('/drift/:id/close', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await closeDrift(getWorkspaceId(req), getActorRole(req), req.params.id, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to close drift item');
  }
});

router.get('/connectors', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listConnectors(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load connectors');
  }
});

router.patch('/connectors/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateConnector(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update connector');
  }
});

router.post('/connectors/:id/configure', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await configureConnector(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to configure connector');
  }
});

router.get('/reports', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listContinuousAssuranceReports(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance reports');
  }
});

router.post('/reports', async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await generateContinuousAssuranceReport(getWorkspaceId(req), getActorRole(req), req.body?.title || 'Continuous Assurance Report', getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to generate continuous assurance report');
  }
});

router.get('/settings', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await getContinuousAssuranceSettings(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance settings');
  }
});

router.patch('/settings', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateContinuousAssuranceSettings(getWorkspaceId(req), getActorRole(req), req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update continuous assurance settings');
  }
});

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listAssuranceNotifications(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load continuous assurance notifications');
  }
});

router.patch('/notifications/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateAssuranceNotification(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update continuous assurance notification');
  }
});

router.patch('/notification-preferences', async (req: Request, res: Response) => {
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

router.get('/remediation-tasks', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await listRemediationTasks(getWorkspaceId(req)), error: null });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to load remediation tasks');
  }
});

router.post('/remediation-tasks', async (req: Request, res: Response) => {
  try {
    return res.status(201).json({
      data: await createRemediationTask(getWorkspaceId(req), getActorRole(req), req.body, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to create remediation task');
  }
});

router.patch('/remediation-tasks/:id', async (req: Request, res: Response) => {
  try {
    return res.json({
      data: await updateRemediationTask(getWorkspaceId(req), getActorRole(req), req.params.id, req.body ?? {}, getActorName(req)),
      error: null,
    });
  } catch (error) {
    return handleRouteError(error, res, 'Unable to update remediation task');
  }
});

export default router;
