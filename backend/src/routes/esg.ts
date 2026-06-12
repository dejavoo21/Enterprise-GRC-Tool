import { Router } from 'express';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  createCarbonRecord,
  createEnvironmentalMetric,
  createEsgIncident,
  createEsgKpi,
  createEsgReport,
  createEsgRisk,
  createEsgTarget,
  createGovernanceMetric,
  createSocialMetric,
  createSupplierEsgRecord,
  getEsgState,
} from '../repositories/esgRepo.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { getWorkspaceId } from '../workspace.js';
import type { EsgReportType } from '../types/esg.js';

const router = Router();

router.get('/state', async (req, res) => {
  try {
    const state = await getEsgState(getWorkspaceId(req));
    res.json({ data: state, error: null });
  } catch (error) {
    console.error('ESG state error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'ESG_STATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load ESG state',
      },
    });
  }
});

router.post('/environmental-metrics', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createEnvironmentalMetric(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG environmental metric recorded',
      category: 'report',
      targetType: 'esg_environmental_metric',
      targetId: record.id,
      targetName: record.metricName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Environmental performance record added to ESG command center.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_ENVIRONMENTAL_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create environmental metric' } });
  }
});

router.post('/carbon-records', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createCarbonRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG carbon record updated',
      category: 'report',
      targetType: 'esg_carbon_record',
      targetId: record.id,
      targetName: `${record.scope} ${record.sourceName}`,
      newValue: record,
      outcome: 'success',
      severity: 'high',
      notes: 'Carbon accounting register updated.',
      frameworkCode: 'GHG',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_CARBON_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create carbon record' } });
  }
});

router.post('/social-metrics', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createSocialMetric(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG social metric recorded',
      category: 'report',
      targetType: 'esg_social_metric',
      targetId: record.id,
      targetName: record.metricName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Social performance metric added.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_SOCIAL_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create social metric' } });
  }
});

router.post('/governance-metrics', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createGovernanceMetric(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG governance metric recorded',
      category: 'rbac',
      targetType: 'esg_governance_metric',
      targetId: record.id,
      targetName: record.metricName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Governance oversight metric added.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_GOVERNANCE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create governance metric' } });
  }
});

router.post('/risks', requirePermission('Risks', 'create'), async (req, res) => {
  try {
    const record = await createEsgRisk(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG risk created',
      category: 'risk',
      targetType: 'esg_risk',
      targetId: record.id,
      targetName: record.title,
      newValue: record,
      outcome: 'success',
      severity: record.severity === 'critical' ? 'critical' : record.severity === 'high' ? 'high' : 'medium',
      notes: 'Risk was mapped into the ESG risk register.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_RISK_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create ESG risk' } });
  }
});

router.post('/kpis', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createEsgKpi(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG KPI recorded',
      category: 'report',
      targetType: 'esg_kpi',
      targetId: record.id,
      targetName: record.kpiName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'ESG KPI baseline updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_KPI_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create ESG KPI' } });
  }
});

router.post('/targets', requirePermission('Reports', 'edit'), async (req, res) => {
  try {
    const record = await createEsgTarget(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG target updated',
      category: 'report',
      targetType: 'esg_target',
      targetId: record.id,
      targetName: record.targetName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Sustainability target register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_TARGET_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create ESG target' } });
  }
});

router.post('/suppliers', requirePermission('Vendors', 'assign'), async (req, res) => {
  try {
    const record = await createSupplierEsgRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Supplier ESG review recorded',
      category: 'vendor',
      targetType: 'esg_supplier',
      targetId: record.id,
      targetName: record.supplierName,
      newValue: record,
      outcome: 'success',
      severity: record.supplierRiskLevel === 'high' || record.supplierRiskLevel === 'critical' ? 'high' : 'medium',
      notes: 'Supplier ESG assessment baseline updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_SUPPLIER_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create supplier ESG record' } });
  }
});

router.post('/incidents', requirePermission('Audits', 'create'), async (req, res) => {
  try {
    const record = await createEsgIncident(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG incident logged',
      category: 'issue',
      targetType: 'esg_incident',
      targetId: record.id,
      targetName: record.title,
      newValue: record,
      outcome: 'success',
      severity: record.severity === 'critical' ? 'critical' : record.severity === 'high' ? 'high' : 'medium',
      notes: record.summary,
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_INCIDENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create ESG incident' } });
  }
});

router.post('/reports/:reportType', requirePermission('Reports', 'export'), async (req, res) => {
  try {
    const reportType = req.params.reportType as EsgReportType;
    const report = await createEsgReport(getWorkspaceId(req), {
      reportType,
      title: reportTitle(reportType),
      generatedBy: req.authUser?.email || 'System',
      summary: reportSummary(reportType),
      status: 'generated',
    });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'ESG report generated',
      category: 'report',
      targetType: 'esg_report',
      targetId: report.id,
      targetName: report.title,
      newValue: report,
      outcome: 'success',
      severity: 'medium',
      notes: `Generated ${reportType} from the ESG reporting center.`,
      frameworkCode: reportType === 'csrd_report' ? 'CSRD' : reportType === 'issb_report' ? 'ISSB' : reportType === 'gri_report' ? 'GRI' : null,
    }));
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'ESG_REPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to generate ESG report' } });
  }
});

function reportTitle(reportType: EsgReportType) {
  switch (reportType) {
    case 'board_esg_report':
      return 'Board ESG Report';
    case 'carbon_report':
      return 'Carbon Accounting Report';
    case 'supplier_esg_report':
      return 'Supplier ESG Report';
    case 'csrd_report':
      return 'CSRD Readiness Report';
    case 'issb_report':
      return 'ISSB Disclosure Pack';
    case 'gri_report':
      return 'GRI Sustainability Report';
    case 'executive_summary':
      return 'Executive ESG Summary';
    case 'sustainability_report':
      return 'Sustainability Report';
    default:
      return 'Enterprise ESG Report';
  }
}

function reportSummary(reportType: EsgReportType) {
  if (reportType === 'carbon_report') {
    return ['Scope 1-3 emissions consolidated.', 'Intensity trend and reduction pathway refreshed.', 'Supplier emission disclosures highlighted for escalation.'];
  }
  if (reportType === 'board_esg_report') {
    return ['Board readiness, top ESG risks, and target progress summarized.', 'Supplier ESG exposure and carbon trends highlighted.', 'Open ESG findings and compliance gaps included.'];
  }
  return ['ESG program posture refreshed.', 'Framework readiness and gap analysis updated.', 'Key management actions prepared for review.'];
}

export default router;
