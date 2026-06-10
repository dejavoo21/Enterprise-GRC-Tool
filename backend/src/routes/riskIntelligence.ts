import { Router } from 'express';
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

const router = Router();

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
    const state = await getRiskIntelligenceState(workspaceId);
    const report = await generateRiskReport(
      state,
      req.params.reportType as any,
      (typeof req.query.format === 'string' ? req.query.format : 'pdf') as any,
    );
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
