import { Router } from 'express';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  createConsentRecord,
  createDataDiscoveryRecord,
  createDataGovernanceRecord,
  createDataInventoryRecord,
  createDataLineageRecord,
  createDataQualityRecord,
  createDpiaRecord,
  createDsarRecord,
  createPrivacyAuditRecord,
  createPrivacyBreachRecord,
  createPrivacyReportRecord,
  createPrivacyRiskRecord,
  createRetentionRecord,
  createRopaRecord,
  createThirdPartyPrivacyRecord,
  createTransferRecord,
  getPrivacyState,
} from '../repositories/privacyRepo.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { getWorkspaceId } from '../workspace.js';
import type { PrivacyReportType } from '../types/privacy.js';

const router = Router();

router.get('/state', async (req, res) => {
  try {
    const state = await getPrivacyState(getWorkspaceId(req));
    res.json({ data: state, error: null });
  } catch (error) {
    console.error('Privacy state error:', error);
    res.status(500).json({
      data: null,
      error: {
        code: 'PRIVACY_STATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load privacy state',
      },
    });
  }
});

router.post('/data-inventory', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createDataInventoryRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Privacy data inventory record created',
      category: 'policy',
      targetType: 'privacy_data_inventory',
      targetId: record.id,
      targetName: record.dataAssetName,
      newValue: record,
      outcome: 'success',
      severity: record.classificationRiskScore >= 75 ? 'high' : 'medium',
      notes: 'Data inventory and classification register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_INVENTORY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create data inventory record' } });
  }
});

router.post('/ropa', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createRopaRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'RoPA record created',
      category: 'policy',
      targetType: 'privacy_ropa',
      targetId: record.id,
      targetName: record.processingActivity,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Processing activity register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_ROPA_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create RoPA record' } });
  }
});

router.post('/dpias', requirePermission('Risks', 'create'), async (req, res) => {
  try {
    const record = await createDpiaRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'DPIA created',
      category: 'risk',
      targetType: 'privacy_dpia',
      targetId: record.id,
      targetName: record.assessmentName,
      newValue: record,
      outcome: 'success',
      severity: record.riskRating === 'critical' ? 'critical' : record.riskRating === 'high' ? 'high' : 'medium',
      notes: 'Privacy impact assessment added to the privacy command center.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_DPIA_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create DPIA' } });
  }
});

router.post('/risks', requirePermission('Risks', 'create'), async (req, res) => {
  try {
    const record = await createPrivacyRiskRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Privacy risk created',
      category: 'risk',
      targetType: 'privacy_risk',
      targetId: record.id,
      targetName: record.title,
      newValue: record,
      outcome: 'success',
      severity: record.severity === 'critical' ? 'critical' : record.severity === 'high' ? 'high' : 'medium',
      notes: 'Privacy risk register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_RISK_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create privacy risk' } });
  }
});

router.post('/consents', requirePermission('Users', 'edit'), async (req, res) => {
  try {
    const record = await createConsentRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Consent record updated',
      category: 'auth',
      targetType: 'privacy_consent',
      targetId: record.id,
      targetName: `${record.dataSubject} ${record.purpose}`,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Consent lifecycle register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_CONSENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create consent record' } });
  }
});

router.post('/dsars', requirePermission('Users', 'edit'), async (req, res) => {
  try {
    const record = await createDsarRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'DSAR created',
      category: 'user',
      targetType: 'privacy_dsar',
      targetId: record.id,
      targetName: record.requestId,
      newValue: record,
      outcome: 'success',
      severity: record.status === 'overdue' ? 'high' : 'medium',
      notes: 'Data subject request queue updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_DSAR_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create DSAR' } });
  }
});

router.post('/breaches', requirePermission('Audits', 'create'), async (req, res) => {
  try {
    const record = await createPrivacyBreachRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Privacy breach logged',
      category: 'issue',
      targetType: 'privacy_breach',
      targetId: record.id,
      targetName: record.breachType,
      newValue: record,
      outcome: 'success',
      severity: record.riskLevel === 'critical' ? 'critical' : record.riskLevel === 'high' ? 'high' : 'medium',
      notes: record.remediation,
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_BREACH_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create breach record' } });
  }
});

router.post('/retention', requirePermission('Policies', 'edit'), async (req, res) => {
  try {
    const record = await createRetentionRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Retention record updated',
      category: 'policy',
      targetType: 'privacy_retention',
      targetId: record.id,
      targetName: record.assetName,
      newValue: record,
      outcome: 'success',
      severity: record.violationStatus === 'critical' ? 'high' : 'medium',
      notes: 'Data retention schedule updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_RETENTION_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create retention record' } });
  }
});

router.post('/transfers', requirePermission('Vendors', 'assign'), async (req, res) => {
  try {
    const record = await createTransferRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Data transfer recorded',
      category: 'vendor',
      targetType: 'privacy_transfer',
      targetId: record.id,
      targetName: record.transferName,
      newValue: record,
      outcome: 'success',
      severity: record.transferRiskRating === 'critical' ? 'critical' : record.transferRiskRating === 'high' ? 'high' : 'medium',
      notes: 'Cross-border transfer register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_TRANSFER_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create transfer record' } });
  }
});

router.post('/third-parties', requirePermission('Vendors', 'assign'), async (req, res) => {
  try {
    const record = await createThirdPartyPrivacyRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Third-party privacy review created',
      category: 'vendor',
      targetType: 'privacy_third_party',
      targetId: record.id,
      targetName: record.vendorName,
      newValue: record,
      outcome: 'success',
      severity: record.dataTransferRisk === 'critical' ? 'critical' : record.dataTransferRisk === 'high' ? 'high' : 'medium',
      notes: 'Processor and subprocessor privacy oversight updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_THIRD_PARTY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create third-party privacy record' } });
  }
});

router.post('/governance', requirePermission('Policies', 'edit'), async (req, res) => {
  try {
    const record = await createDataGovernanceRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Data governance record created',
      category: 'policy',
      targetType: 'privacy_data_governance',
      targetId: record.id,
      targetName: record.dataDomain,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Data ownership and stewardship register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_GOVERNANCE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create governance record' } });
  }
});

router.post('/lineage', requirePermission('Policies', 'edit'), async (req, res) => {
  try {
    const record = await createDataLineageRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Data lineage recorded',
      category: 'system',
      targetType: 'privacy_lineage',
      targetId: record.id,
      targetName: record.lineageName,
      newValue: record,
      outcome: 'success',
      severity: 'low',
      notes: 'Lineage and processing flow map updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_LINEAGE_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create lineage record' } });
  }
});

router.post('/quality', requirePermission('Reports', 'edit'), async (req, res) => {
  try {
    const record = await createDataQualityRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Data quality record updated',
      category: 'system',
      targetType: 'privacy_quality',
      targetId: record.id,
      targetName: record.datasetName,
      newValue: record,
      outcome: 'success',
      severity: record.qualityScore < 60 ? 'high' : 'medium',
      notes: 'Data quality program baseline updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_QUALITY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create data quality record' } });
  }
});

router.post('/discovery', requirePermission('Reports', 'create'), async (req, res) => {
  try {
    const record = await createDataDiscoveryRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Data discovery record created',
      category: 'system',
      targetType: 'privacy_discovery',
      targetId: record.id,
      targetName: record.repositoryName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Sensitive data discovery register updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_DISCOVERY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create discovery record' } });
  }
});

router.post('/audits', requirePermission('Audits', 'create'), async (req, res) => {
  try {
    const record = await createPrivacyAuditRecord(getWorkspaceId(req), req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Privacy audit created',
      category: 'issue',
      targetType: 'privacy_audit',
      targetId: record.id,
      targetName: record.auditName,
      newValue: record,
      outcome: 'success',
      severity: 'medium',
      notes: 'Privacy audit center updated.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_AUDIT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create privacy audit' } });
  }
});

router.post('/reports/:reportType', requirePermission('Reports', 'export'), async (req, res) => {
  try {
    const reportType = req.params.reportType as PrivacyReportType;
    const report = await createPrivacyReportRecord(getWorkspaceId(req), {
      reportType,
      title: reportTitle(reportType),
      generatedBy: req.authUser?.email || 'System',
      summary: reportSummary(reportType),
      status: 'generated',
    });
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Privacy report generated',
      category: 'report',
      targetType: 'privacy_report',
      targetId: report.id,
      targetName: report.title,
      newValue: report,
      outcome: 'success',
      severity: 'medium',
      notes: `Generated ${reportType} from the privacy reporting center.`,
    }));
    res.status(201).json({ data: report, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_REPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to generate privacy report' } });
  }
});

function reportTitle(reportType: PrivacyReportType) {
  switch (reportType) {
    case 'gdpr_report':
      return 'GDPR Compliance Report';
    case 'popia_report':
      return 'POPIA Compliance Report';
    case 'iso27701_report':
      return 'ISO 27701 Readiness Report';
    case 'privacy_risk_report':
      return 'Privacy Risk Report';
    case 'dpia_report':
      return 'DPIA Oversight Report';
    case 'dsar_report':
      return 'DSAR Performance Report';
    case 'data_governance_report':
      return 'Data Governance Report';
    case 'board_privacy_pack':
      return 'Board Privacy Pack';
    case 'executive_summary':
      return 'Executive Privacy Summary';
    default:
      return 'Privacy Report';
  }
}

function reportSummary(reportType: PrivacyReportType) {
  if (reportType === 'board_privacy_pack') {
    return [
      'Privacy compliance, DSAR posture, and breach exposure consolidated for board review.',
      'Cross-border transfer and third-party processor concentration highlighted.',
      'DPIA backlog, retention compliance, and material privacy risks summarized.',
    ];
  }
  if (reportType === 'dsar_report') {
    return [
      'DSAR queue, SLA compliance, and response ownership refreshed.',
      'Outstanding access and deletion requests highlighted for escalation.',
      'Evidence and verification coverage summarized.',
    ];
  }
  return [
    'Privacy program posture refreshed.',
    'Framework readiness, transfer risk, and data governance signals updated.',
    'Management actions prepared for review.',
  ];
}

export default router;
