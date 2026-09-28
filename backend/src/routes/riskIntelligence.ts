import { Router } from 'express';
import { query } from '../db.js';
import { list as listTreatmentPlans } from '../repositories/riskTreatmentRepo.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { exportRiskReport, isRiskExportFormat, riskReportTypes } from '../services/riskReportExport.js';
import { isRiskReportEmailConfigured, sendRiskReportEmail } from '../services/emailService.js';
import { getWorkspaceId } from '../workspace.js';
import {
  createEmergingRisk,
  createKri,
  createLossEvent,
  createNearMiss,
  createTreatment,
  generateRiskReport,
  getRiskIntelligenceState,
  logRiskIntelligenceActivity,
  updateCapacityProfile,
  updateKri,
  updateToleranceProfile,
  updateWeightSet,
} from '../services/riskIntelligenceService.js';
import { buildActivityFromRequest } from '../services/activityLedger/activityLedger.js';
import { archiveReport, listReports, getReport, transitionReport } from '../repositories/riskReportArchiveRepo.js';
import { ReportWorkflowError, type ReportAction } from '../services/riskReportWorkflow.js';

const router = Router();
router.use((req,res,next) => {
  if (!req.authUser || getWorkspaceId(req) !== req.authUser.workspaceId) return res.status(403).json({error:{message:'Workspace session mismatch.'}});
  next();
});

router.get('/reports/history', async (req,res) => {
  const page = Number(req.query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return res.status(400).json({error:{message:'Invalid page.'}});
  try { res.setHeader('Cache-Control','no-store'); res.json({data:await listReports(getWorkspaceId(req),page),error:null}); }
  catch { res.status(500).json({error:{message:'Report history could not be loaded.'}}); }
});
router.get('/reports/history/:id', async (req,res) => {
  try { res.setHeader('Cache-Control','no-store'); res.json({data:await getReport(getWorkspaceId(req),req.params.id),error:null}); }
  catch(error) { res.status(error instanceof ReportWorkflowError ? error.status : 500).json({error:{message:error instanceof ReportWorkflowError ? error.message : 'Report could not be loaded.'}}); }
});
router.patch('/reports/history/:id', async (req,res,next) => {
  const action = req.body?.action;
  if (!['submit','review','approve','reject'].includes(action) || !Number.isSafeInteger(req.body?.revision)) return res.status(400).json({error:{message:'Invalid workflow action or revision.'}});
  return requirePermission('Risks',action === 'submit' ? 'edit' : 'approve')(req,res,next);
}, async (req,res) => {
  try { res.json({data:await transitionReport(getWorkspaceId(req),req.params.id,req.authUser!.userId,req.authUser!.email,req.body.action as ReportAction,req.body.revision,req.body.comment),error:null}); }
  catch(error) { res.status(error instanceof ReportWorkflowError ? error.status : 500).json({error:{message:error instanceof ReportWorkflowError ? error.message : 'Report workflow update failed.'}}); }
});
router.post('/reports/history/:id/download', requirePermission('Risks','export'), async (req,res) => {
  if (!isRiskExportFormat(req.body?.format)) return res.status(400).json({error:{message:'Choose PDF, CSV or JSON.'}});
  try {
    const report = await getReport(getWorkspaceId(req),req.params.id);
    const pack = structuredClone(report.pack);
    pack.reviewStatus = report.status;
    pack.sections.push({heading:'Recorded review and approval trail',bullets:[`Snapshot ${report.id}; workflow status: ${report.status}. Original generated content is preserved. This trail records application decisions, not a digital signature.`],table:{columns:['Action','User','Comment','Date'],rows:report.events.map(event=>[event.action,event.actor_email,event.comment,new Date(event.created_at).toISOString()])}});
    const file = await exportRiskReport(pack,req.body.format);
    res.setHeader('Cache-Control','no-store');
    res.json({data:{filename:file.filename,contentType:file.contentType,base64:file.content.toString('base64'),pack},error:null});
  } catch(error) { res.status(error instanceof ReportWorkflowError ? error.status : 500).json({error:{message:error instanceof ReportWorkflowError ? error.message : 'Archived export failed.'}}); }
});

async function prepareReport(workspaceId: string, reportType: typeof riskReportTypes[number], preparedBy: string) {
  const state = await getRiskIntelligenceState(workspaceId);
  if (reportType !== 'risk_committee_report') return generateRiskReport(state, reportType, 'json');
  const workspace = await query<{ name: string }>('SELECT name FROM workspaces WHERE id = $1', [workspaceId]);
  const treatmentPlans = await listTreatmentPlans(workspaceId);
  return generateRiskReport(state, reportType, 'json', { workspaceId, workspace: workspace.rows[0]?.name || workspaceId, preparedBy, treatmentPlans });
}

router.get('/reports/delivery-options', requirePermission('Risks', 'export'), (_req, res) => {
  res.json({ data: { emailEnabled: isRiskReportEmailConfigured() }, error: null });
});

const pendingEmails = new Set<string>();
const lastEmails = new Map<string, number>();
router.post('/reports/:reportType/deliver', requirePermission('Risks', 'export'), async (req, res) => {
  const { format, delivery, confirmed } = req.body || {};
  const reportType = riskReportTypes.find(type => type === req.params.reportType);
  if (!reportType || !isRiskExportFormat(format) || !['download', 'email'].includes(delivery)) {
    return res.status(400).json({ error: { message: 'Choose a supported report type, format and delivery method.' } });
  }
  const workspaceId = getWorkspaceId(req);
  if (!req.authUser || workspaceId !== req.authUser.workspaceId) return res.status(403).json({ error: { message: 'Workspace session mismatch.' } });
  const key = `${workspaceId}:${req.authUser.userId}`;
  if (delivery === 'email') {
    for (const [entry, sentAt] of lastEmails) if (Date.now() - sentAt >= 60000) lastEmails.delete(entry);
    if (confirmed !== true) return res.status(400).json({ error: { message: 'Confirm emailing this confidential report to your account address.' } });
    if (!isRiskReportEmailConfigured()) return res.status(503).json({ error: { message: 'Report email is not configured. Contact your administrator.' } });
    if (pendingEmails.has(key) || Date.now() - (lastEmails.get(key) || 0) < 60000) return res.status(429).json({ error: { message: 'Please wait one minute before emailing another report.' } });
    pendingEmails.add(key);
  }
  try {
    const pack = await prepareReport(workspaceId, reportType, req.authUser.email);
    const file = await exportRiskReport(pack, format);
    const reportId = await archiveReport(workspaceId,req.authUser.userId,req.authUser.email,pack);
    if (delivery === 'email') {
      await sendRiskReportEmail(req.authUser.email, pack.title, file);
      lastEmails.set(key, Date.now());
    }
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: delivery === 'email' ? 'risk_report_email_accepted' : 'risk_report_generated', category: 'report',
      targetType: 'risk_report', targetName: pack.title, newValue: { reportType, format, delivery },
      outcome: 'success', source: 'backend', notes: delivery === 'email' ? 'Mail server accepted the account-address delivery; inbox receipt is not confirmed.' : `Generated ${format.toUpperCase()} report`,
    }));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ data: delivery === 'email' ? { reportId, message: 'Mail server accepted the report. Inbox delivery is not guaranteed.' } : { reportId, filename: file.filename, contentType: file.contentType, base64: file.content.toString('base64'), pack }, error: null });
  } catch {
    return res.status(500).json({ error: { message: delivery === 'email' ? 'Email delivery could not be confirmed. Check with your administrator before retrying.' : 'Report generation failed.' } });
  } finally { if (delivery === 'email') pendingEmails.delete(key); }
});

router.get('/state', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const state = await getRiskIntelligenceState(workspaceId);
    res.json({ data: state, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'RISK_INTELLIGENCE_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load risk intelligence state',
      },
    });
  }
});

router.patch('/tolerance/:category', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const profile = await updateToleranceProfile(workspaceId, req.params.category, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'risk_tolerance_updated',
      category: 'risk',
      targetType: 'risk_tolerance_profile',
      targetId: profile.id,
      targetName: profile.category,
      newValue: profile,
      outcome: 'success',
      severity: 'medium',
      notes: `Updated tolerance profile for ${profile.category}`,
      source: 'backend',
    }));
    res.json({ data: profile, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'RISK_TOLERANCE_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update tolerance profile',
      },
    });
  }
});

router.patch('/capacity/:capacityType', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const capacity = await updateCapacityProfile(workspaceId, req.params.capacityType as any, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'risk_capacity_updated',
      category: 'risk',
      targetType: 'risk_capacity_profile',
      targetId: capacity.id,
      targetName: capacity.capacityType,
      newValue: capacity,
      outcome: 'success',
      severity: 'medium',
      notes: `Updated ${capacity.capacityType} capacity profile`,
      source: 'backend',
    }));
    res.json({ data: capacity, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'RISK_CAPACITY_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update capacity profile',
      },
    });
  }
});

router.post('/kris', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const kri = await createKri(workspaceId, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'kri_created',
      category: 'risk',
      targetType: 'kri',
      targetId: kri.id,
      targetName: kri.name,
      newValue: kri,
      outcome: 'success',
      severity: 'medium',
      notes: `Created KRI ${kri.name}`,
      source: 'backend',
    }));
    res.status(201).json({ data: kri, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'KRI_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create KRI',
      },
    });
  }
});

router.patch('/kris/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const kri = await updateKri(workspaceId, req.params.id, req.body);
    if (!kri) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'KRI not found' } });
    }
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'kri_updated',
      category: 'risk',
      targetType: 'kri',
      targetId: kri.id,
      targetName: kri.name,
      newValue: kri,
      outcome: 'success',
      severity: kri.status === 'red' ? 'high' : 'medium',
      notes: `Updated KRI ${kri.name}`,
      source: 'backend',
    }));
    res.json({ data: kri, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'KRI_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update KRI',
      },
    });
  }
});

router.patch('/weights', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const weights = await updateWeightSet(workspaceId, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'risk_weights_updated',
      category: 'risk',
      targetType: 'risk_quantification_weights',
      targetId: weights.id,
      targetName: 'Enterprise weight model',
      newValue: weights,
      outcome: 'success',
      severity: 'high',
      notes: 'Updated weighted risk quantification model',
      source: 'backend',
    }));
    res.json({ data: weights, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'RISK_WEIGHTS_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update risk weights',
      },
    });
  }
});

router.post('/loss-events', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const event = await createLossEvent(workspaceId, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'loss_event_created',
      category: 'risk',
      targetType: 'loss_event',
      targetId: event.id,
      targetName: event.eventId,
      newValue: event,
      outcome: 'success',
      severity: event.actualLoss > 50000 ? 'critical' : event.actualLoss > 10000 ? 'high' : 'medium',
      notes: `Recorded loss event ${event.eventId}`,
      source: 'backend',
    }));
    res.status(201).json({ data: event, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'LOSS_EVENT_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create loss event',
      },
    });
  }
});

router.post('/near-misses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const event = await createNearMiss(workspaceId, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'near_miss_recorded',
      category: 'risk',
      targetType: 'near_miss',
      targetId: event.id,
      targetName: event.nearMissType,
      newValue: event,
      outcome: 'success',
      severity: event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : 'medium',
      notes: `Recorded near miss ${event.nearMissType}`,
      source: 'backend',
    }));
    res.status(201).json({ data: event, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'NEAR_MISS_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create near miss',
      },
    });
  }
});

router.post('/emerging-risks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const emergingRisk = await createEmergingRisk(workspaceId, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'emerging_risk_created',
      category: 'risk',
      targetType: 'emerging_risk',
      targetId: emergingRisk.id,
      targetName: emergingRisk.title,
      newValue: emergingRisk,
      outcome: 'success',
      severity: 'high',
      notes: `Added emerging risk ${emergingRisk.title}`,
      source: 'backend',
    }));
    res.status(201).json({ data: emergingRisk, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'EMERGING_RISK_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create emerging risk',
      },
    });
  }
});

router.post('/treatments', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const treatment = await createTreatment(workspaceId, req.body);
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'treatment_effectiveness_recorded',
      category: 'risk',
      targetType: 'risk_treatment',
      targetId: treatment.id,
      targetName: treatment.treatmentName,
      newValue: treatment,
      outcome: 'success',
      severity: treatment.treatmentEffectivenessPercent < 60 ? 'high' : 'medium',
      notes: `Recorded treatment effectiveness for ${treatment.treatmentName}`,
      source: 'backend',
    }));
    res.status(201).json({ data: treatment, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'TREATMENT_CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record treatment effectiveness',
      },
    });
  }
});

router.get('/reports/:reportType', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!req.authUser || workspaceId !== req.authUser.workspaceId) return res.status(403).json({ error: { message: 'Workspace session mismatch.' } });
    const reportType = riskReportTypes.find(type => type === req.params.reportType);
    if (!reportType || (req.query.format && req.query.format !== 'json')) return res.status(400).json({ error: { message: 'This endpoint returns JSON. Use report delivery for PDF or CSV.' } });
    const report = await prepareReport(workspaceId, reportType, req.authUser.email);
    res.setHeader('Cache-Control', 'no-store');
    await logRiskIntelligenceActivity(buildActivityFromRequest(req, {
      action: 'risk_report_generated',
      category: 'report',
      targetType: 'risk_report',
      targetName: report.title,
      newValue: { reportType: report.reportType, format: report.format },
      outcome: 'success',
      severity: 'medium',
      notes: `Generated ${report.title}`,
      source: 'backend',
    }));
    res.json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'RISK_REPORT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate risk report',
      },
    });
  }
});

export default router;
