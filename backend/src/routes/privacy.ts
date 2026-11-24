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
  decideDpia,
  getDpiaById,
  getDpiaHistory,
  getPrivacyState,
  submitDpia,
} from '../repositories/privacyRepo.js';
import { buildActivityFromRequest, recordActivity } from '../services/activityLedger/activityLedger.js';
import { getWorkspaceId } from '../workspace.js';
import type { PrivacyReportType } from '../types/privacy.js';
import { assertWorkspaceLinks, WorkspaceLinkValidationError } from '../services/workspaceLinkValidation.js';
import { assertDpiaDecision, assertDpiaSubmission } from '../services/privacyDpiaRules.js';

const router = Router();

router.get('/state', requirePermission('Reports', 'view'), async (req, res) => {
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
    const required = ['dataAssetId', 'dataAssetName', 'businessOwner', 'systemName', 'dataCategory', 'classification', 'retentionRequirement', 'legalBasis'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Asset ID, name, owner, system, data category, classification, retention requirement, and legal basis are required.' } });
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
    const required = ['processingActivity', 'purpose', 'legalBasis', 'retentionPeriod'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Processing activity, purpose, legal basis, and retention period are required.' } });
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
    if (!req.body?.assessmentName || !req.body?.owner || !req.body?.purpose) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'assessmentName, owner, and purpose are required.' } });
    const workspaceId = getWorkspaceId(req);
    await assertWorkspaceLinks(workspaceId, {
      risks: req.body?.linkedRiskIds,
      controls: req.body?.linkedControlIds,
      assets: req.body?.linkedAssetIds,
      aiSystems: req.body?.linkedAiSystemIds,
      vendors: req.body?.linkedVendorIds,
      evidence: req.body?.linkedEvidenceIds,
    });
    const record = await createDpiaRecord(workspaceId, req.body || {}, req.authUser!.userId);
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
    if (error instanceof WorkspaceLinkValidationError) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_LINK_TARGET', message: error.message } });
    }
    res.status(500).json({ data: null, error: { code: 'PRIVACY_DPIA_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create DPIA' } });
  }
});

router.get('/dpias/:id/history', requirePermission('Risks', 'view'), async (req, res) => {
  res.json({ data: await getDpiaHistory(getWorkspaceId(req), req.params.id), error: null });
});

router.post('/dpias/:id/submit', requirePermission('Risks', 'edit'), async (req, res) => {
  const workspaceId = getWorkspaceId(req);
  const current = await getDpiaById(workspaceId, req.params.id);
  if (!current) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'DPIA not found.' } });
  try {
    assertDpiaSubmission(current.approvalStatus, current.linkedEvidenceIds);
    const data = await submitDpia(workspaceId, current.id, req.authUser!.userId);
    await recordActivity(buildActivityFromRequest(req, { action: 'DPIA submitted', category: 'risk', targetType: 'privacy_dpia', targetId: current.id, targetName: current.assessmentName, previousValue: current.approvalStatus, newValue: 'in_review', outcome: 'success', severity: 'medium', notes: 'DPIA submitted for independent review.' }));
    return res.json({ data, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'DPIA_SUBMIT_FAILED';
    return res.status(409).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Unable to submit DPIA.' } });
  }
});

router.post('/dpias/:id/decision', requirePermission('Risks', 'approve'), async (req, res) => {
  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Decision must be approved or rejected.' } });
  const workspaceId = getWorkspaceId(req);
  const current = await getDpiaById(workspaceId, req.params.id);
  if (!current) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'DPIA not found.' } });
  try {
    assertDpiaDecision(current.approvalStatus, current.createdBy, req.authUser!.userId);
    const data = await decideDpia(workspaceId, current.id, req.authUser!.userId, decision, req.body?.notes);
    if (!data) return res.status(409).json({ data: null, error: { code: 'DPIA_STATE_CHANGED', message: 'The DPIA state changed before the decision could be recorded.' } });
    await recordActivity(buildActivityFromRequest(req, { action: `DPIA ${decision}`, category: 'risk', targetType: 'privacy_dpia', targetId: current.id, targetName: current.assessmentName, previousValue: current.approvalStatus, newValue: decision, outcome: 'success', severity: decision === 'rejected' ? 'high' : 'medium', notes: req.body?.notes || 'Independent DPIA decision recorded.' }));
    return res.json({ data, error: null });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'DPIA_DECISION_FAILED';
    return res.status(code === 'SELF_APPROVAL' || code === 'INVALID_TRANSITION' ? 409 : 500).json({ data: null, error: { code, message: error instanceof Error ? error.message : 'Unable to decide DPIA.' } });
  }
});

router.post('/risks', requirePermission('Risks', 'create'), async (req, res) => {
  try {
    const required = ['title', 'category', 'severity', 'owner', 'mitigation'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Risk title, category, severity, owner, and proposed mitigation are required.' } });
    if (!['unauthorized_access', 'data_leakage', 'consent_violation', 'retention_failure', 'cross_border', 'third_party', 'ai_privacy', 'regulatory', 'data_accuracy', 'complaint'].includes(req.body.category) || !['low', 'medium', 'high', 'critical'].includes(req.body.severity)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Privacy risk category and severity must be valid.' } });
    if (req.body.status !== 'identified' || req.body.riskScore !== 0 || req.body.linkedEnterpriseRiskId) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'New privacy risks must begin identified, unscored, and without an inferred enterprise-risk link.' } });
    const workspaceId = getWorkspaceId(req);
    await assertWorkspaceLinks(workspaceId, {
      risks: req.body?.linkedEnterpriseRiskId ? [req.body.linkedEnterpriseRiskId] : undefined,
    });
    const record = await createPrivacyRiskRecord(workspaceId, req.body || {});
    await recordActivity(buildActivityFromRequest(req, {
      action: 'Privacy risk created',
      category: 'risk',
      targetType: 'privacy_risk',
      targetId: record.id,
      targetName: record.title,
      newValue: record,
      outcome: 'success',
      severity: record.severity === 'critical' ? 'critical' : record.severity === 'high' ? 'high' : 'medium',
      notes: 'Privacy risk identified with proposed mitigation; scoring, treatment completion and enterprise linkage remain unverified.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    if (error instanceof WorkspaceLinkValidationError) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_LINK_TARGET', message: error.message } });
    }
    res.status(500).json({ data: null, error: { code: 'PRIVACY_RISK_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create privacy risk' } });
  }
});

router.post('/consents', requirePermission('Users', 'edit'), async (req, res) => {
  try {
    const required = ['consentType', 'purpose', 'dataSubject', 'collectionMethod', 'dateCollected', 'evidence'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Consent type, purpose, data subject, collection method, collection date, and evidence reference are required.' } });
    if (Number.isNaN(Date.parse(req.body.dateCollected)) || (req.body.expirationDate && Number.isNaN(Date.parse(req.body.expirationDate)))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Consent dates must be valid.' } });
    if (req.body.status !== 'granted') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'New consent records must begin in granted status.' } });
    if (req.body.consentHistory && (!Array.isArray(req.body.consentHistory) || req.body.consentHistory.length > 0)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Consent history is system-managed and must be empty at intake.' } });
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
      notes: 'Consent register entry recorded from supplied facts and evidence reference; validity was not independently verified.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_CONSENT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create consent record' } });
  }
});

router.post('/dsars', requirePermission('Users', 'edit'), async (req, res) => {
  try {
    const required = ['requestId', 'requestType', 'dataSubject', 'owner', 'dueDate'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Request ID, request type, data subject, owner, and due date are required.' } });
    const validRequestTypes = ['access', 'correction', 'deletion', 'portability', 'restriction', 'objection'];
    if (!validRequestTypes.includes(req.body.requestType)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported DSAR request type.' } });
    if (Number.isNaN(Date.parse(req.body.dueDate))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A valid DSAR due date is required.' } });
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
    const required = ['breachType', 'discoveryDate', 'rootCause', 'riskLevel', 'remediation'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Breach type, discovery date, root cause, risk level, and remediation plan are required.' } });
    if (Number.isNaN(Date.parse(req.body.discoveryDate))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A valid discovery date is required.' } });
    if (![req.body.affectedRecords, req.body.affectedIndividuals].every((value) => Number.isInteger(Number(value)) && Number(value) >= 0)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Affected counts must be non-negative whole numbers.' } });
    if (!['low', 'medium', 'high', 'critical'].includes(req.body.riskLevel)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported breach risk level.' } });
    if (![req.body.regulatorNotificationStatus, req.body.customerNotificationStatus].every((value) => value === 'required' || value === 'not_required')) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Notification status must be required or not_required at intake.' } });
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
    const required = ['assetName', 'retentionPeriod', 'deletionSchedule', 'reviewDate'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Asset name, retention period, deletion schedule, and review date are required.' } });
    if (Number.isNaN(Date.parse(req.body.reviewDate))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A valid retention review date is required.' } });
    if (req.body.archiveStatus !== 'planned' || req.body.disposalStatus !== 'planned') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'New retention schedules must begin in planned archive and disposal states.' } });
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
    const required = ['transferName', 'transferType', 'transferMechanism', 'jurisdiction', 'transferRiskRating', 'reviewDate'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Transfer name, type, mechanism, jurisdiction, risk rating, and review date are required.' } });
    if (!['cross_border', 'international'].includes(req.body.transferType)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported transfer type.' } });
    if (!['low', 'medium', 'high', 'critical'].includes(req.body.transferRiskRating)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported transfer risk rating.' } });
    if (Number.isNaN(Date.parse(req.body.reviewDate))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A valid transfer review date is required.' } });
    if (typeof req.body.sccInPlace !== 'boolean' || typeof req.body.bcrInPlace !== 'boolean') return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Transfer safeguard indicators must be explicit boolean values.' } });
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
    if (!String(req.body?.vendorName ?? '').trim()) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Vendor or processor name is required.' } });
    if (!['processor', 'subprocessor', 'controller'].includes(req.body.role)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported third-party privacy role.' } });
    if (!['low', 'medium', 'high', 'critical'].includes(req.body.dataTransferRisk)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported data transfer risk rating.' } });
    if (req.body.privacyAssessmentStatus !== 'planned' || req.body.dpaStatus !== 'watch' || req.body.complianceRating !== 0 || req.body.privacyIncidentCount !== 0 || !Array.isArray(req.body.contractClauses) || req.body.contractClauses.length > 0) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'New processor records must begin unassessed without inferred clauses, incidents, or compliance results.' } });
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
      notes: 'Processor registered for privacy oversight; assessment, DPA and contractual assurance remain unverified.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_THIRD_PARTY_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create third-party privacy record' } });
  }
});

router.post('/governance', requirePermission('Policies', 'edit'), async (req, res) => {
  try {
    const required = ['dataDomain', 'dataOwner', 'dataSteward', 'dataCustodian', 'lifecycleStage', 'glossaryTerm'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Data domain, owner, steward, custodian, lifecycle stage, and glossary term are required.' } });
    if (req.body.status !== 'planned' || req.body.dataQualityScore !== 0) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'New governance records must begin planned with an unscored data quality result.' } });
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
      notes: 'Data ownership and stewardship recorded in planned status; quality was not assessed.',
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
    const required = ['auditName', 'auditType', 'owner', 'dueDate'] as const;
    if (required.some((field) => !String(req.body?.[field] ?? '').trim())) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Audit name, type, owner, and due date are required.' } });
    if (!['privacy', 'dpia_review', 'regulatory', 'consent', 'retention', 'third_party'].includes(req.body.auditType) || Number.isNaN(Date.parse(req.body.dueDate))) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Audit type and due date must be valid.' } });
    if (req.body.status !== 'planned' || req.body.findingsCount !== 0 || req.body.recommendationsCount !== 0) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'New privacy audits must begin planned without findings or recommendations.' } });
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
      notes: 'Privacy audit planned; no execution, findings, recommendations, or assurance outcome was recorded.',
    }));
    res.status(201).json({ data: record, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'PRIVACY_AUDIT_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create privacy audit' } });
  }
});

router.post('/reports/:reportType', requirePermission('Reports', 'export'), async (req, res) => {
  try {
    const reportType = req.params.reportType as PrivacyReportType;
    const validReportTypes: PrivacyReportType[] = ['gdpr_report','popia_report','iso27701_report','privacy_risk_report','dpia_report','dsar_report','data_governance_report','board_privacy_pack','executive_summary'];
    if (!validReportTypes.includes(reportType)) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Unsupported privacy report type.' } });
    const state = await getPrivacyState(getWorkspaceId(req));
    const report = await createPrivacyReportRecord(getWorkspaceId(req), {
      reportType,
      title: reportTitle(reportType),
      generatedBy: req.authUser?.email || 'System',
      summary: reportSummary(reportType, state),
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

function reportSummary(reportType: PrivacyReportType, state: Awaited<ReturnType<typeof getPrivacyState>>) {
  return [
    `${state.summary.complianceScore}% privacy compliance across ${state.compliancePrograms.length} recorded programs.`,
    `${state.summary.openDpias} open DPIAs, ${state.summary.openPrivacyRisks} open privacy risks, and ${state.summary.dataBreaches} open breach records.`,
    `${state.summary.dsarRequests} DSAR records and ${state.summary.retentionCompliance}% retention compliance in the current workspace snapshot.`,
    `Report scope: ${reportType.replace(/_/g, ' ')}. No distribution or approval is implied.`,
  ];
}

export default router;
