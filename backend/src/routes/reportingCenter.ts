import { Router } from 'express';
import { getWorkspaceId } from '../workspace.js';
import {
  attestReportingCenterReport,
  createReportingSchedule,
  distributeReportingCenterReport,
  generateReportingCenterReport,
  getReportingCenterState,
  updateReportingSchedule,
  updateReportingTemplateSections,
} from '../services/reportingCenterService.js';

const router = Router();

router.get('/state', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const state = await getReportingCenterState(workspaceId);
    res.json({ data: state, error: null });
  } catch (error) {
    console.error('Reporting center state error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORTING_CENTER_STATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load reporting center',
      },
    });
  }
});

router.patch('/templates/:templateId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : [];
    const template = await updateReportingTemplateSections(workspaceId, req.params.templateId, sections);
    if (!template) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    res.json({ data: template, error: null });
  } catch (error) {
    console.error('Reporting template update error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORT_TEMPLATE_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update report template',
      },
    });
  }
});

router.post('/reports/generate', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const report = await generateReportingCenterReport({
      workspaceId,
      templateId: req.body?.templateId,
      scopeType: req.body?.scopeType || 'workspace',
      scopeValue: req.body?.scopeValue || 'Enterprise',
      format: req.body?.format,
      actorUserId: req.authUser?.userId || null,
      actorName: req.authUser?.email || 'System',
      actorRole: req.authUser?.role || null,
    });
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate report',
      },
    });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const schedule = await createReportingSchedule({
      workspaceId,
      templateId: req.body?.templateId,
      name: req.body?.name || 'Scheduled report',
      frequency: req.body?.frequency || 'monthly',
      recipients: Array.isArray(req.body?.recipients) ? req.body.recipients : [],
      deliveryMethods: Array.isArray(req.body?.deliveryMethods) ? req.body.deliveryMethods : ['portal_access'],
      scopeType: req.body?.scopeType || 'workspace',
      scopeValue: req.body?.scopeValue || 'Enterprise',
      nextRunAt: req.body?.nextRunAt || new Date().toISOString(),
      actorUserId: req.authUser?.userId || null,
      actorName: req.authUser?.email || 'System',
      actorRole: req.authUser?.role || null,
    });
    res.status(201).json({ data: schedule, error: null });
  } catch (error) {
    console.error('Report schedule create error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORT_SCHEDULE_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create schedule',
      },
    });
  }
});

router.patch('/schedules/:scheduleId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const schedule = await updateReportingSchedule({
      workspaceId,
      scheduleId: req.params.scheduleId,
      updates: req.body || {},
      actorUserId: req.authUser?.userId || null,
      actorName: req.authUser?.email || 'System',
      actorRole: req.authUser?.role || null,
    });
    if (!schedule) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Schedule not found' } });
    }
    res.json({ data: schedule, error: null });
  } catch (error) {
    console.error('Report schedule update error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORT_SCHEDULE_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update schedule',
      },
    });
  }
});

router.post('/reports/:reportId/distribute', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const distribution = await distributeReportingCenterReport({
      workspaceId,
      reportId: req.params.reportId,
      recipientType: req.body?.recipientType || 'committee',
      recipientValue: req.body?.recipientValue || 'Board Committee',
      deliveryMethod: req.body?.deliveryMethod || 'portal_access',
      actorUserId: req.authUser?.userId || null,
      actorName: req.authUser?.email || 'System',
      actorRole: req.authUser?.role || null,
    });
    res.status(201).json({ data: distribution, error: null });
  } catch (error) {
    console.error('Report distribution error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORT_DISTRIBUTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to distribute report',
      },
    });
  }
});

router.post('/reports/:reportId/attest', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const attestation = await attestReportingCenterReport({
      workspaceId,
      reportId: req.params.reportId,
      approverUserId: req.authUser?.userId || null,
      approverName: req.authUser?.email || 'System',
      approverRole: req.authUser?.role || null,
      decision: req.body?.decision || 'approved',
      comments: req.body?.comments || null,
    });
    res.status(201).json({ data: attestation, error: null });
  } catch (error) {
    console.error('Report attestation error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'REPORT_ATTESTATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to attest report',
      },
    });
  }
});

export default router;
