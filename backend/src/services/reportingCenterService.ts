import { query } from '../db.js';
import * as tprmRepo from '../repositories/tprmRepo.js';
import {
  createAttestation,
  createDistribution,
  createGeneratedReport,
  createSchedule,
  getGeneratedReport,
  listAttestations,
  listDistributions,
  listGeneratedReports,
  listSchedules,
  listTemplates,
  seedReportingTemplates,
  updateSchedule,
  updateTemplateSections,
} from '../repositories/reportingCenterRepo.js';
import { buildBoardReportData } from '../routes/boardReports.js';
import { getRiskIntelligenceState } from './riskIntelligenceService.js';
import { buildRegulatoryReportSummary } from './regulatoryChangeService.js';
import { recordActivity, type RecordActivityInput } from './activityLedger/activityLedger.js';
import type {
  BoardDashboardData,
  GeneratedReportRecord,
  ReportAttestationRecord,
  ReportDistributionRecord,
  ReportScheduleRecord,
  ReportSectionKey,
  ReportingCenterState,
  ReportTemplateRecord,
  ReportFormat,
  ReportScopeType,
  ScheduleFrequency,
  DeliveryMethod,
  AttestationDecision,
  RecipientType,
} from '../types/reportingCenter.js';

type ReportContext = Awaited<ReturnType<typeof buildReportContext>>;

const SECTION_HEADINGS: Record<ReportSectionKey, string> = {
  executive_summary: 'Executive Summary',
  enterprise_risk_posture: 'Enterprise Risk Posture',
  risk_appetite_status: 'Risk Appetite Status',
  risk_tolerance_breaches: 'Risk Tolerance Breaches',
  risk_capacity_utilization: 'Risk Capacity Utilization',
  top_risks: 'Top Risks',
  top_kris: 'Top KRIs',
  emerging_risks: 'Emerging Risks',
  control_effectiveness: 'Control Effectiveness',
  audit_readiness: 'Audit Readiness',
  vendor_exposure: 'Vendor Exposure',
  critical_assets: 'Critical Assets',
  training_metrics: 'Training Metrics',
  regulatory_status: 'Regulatory Status',
  strategic_recommendations: 'Strategic Recommendations',
  forecasted_issues: 'Forecasted Issues',
  loss_events: 'Loss Events',
  near_misses: 'Near Misses',
  compliance_coverage: 'Compliance Coverage',
  management_actions: 'Management Actions',
};

async function ensureTemplates(workspaceId: string) {
  const current = await listTemplates(workspaceId);
  if (current.length === 0) {
    await seedReportingTemplates(workspaceId);
  }
}

async function buildAssetSummary(workspaceId: string) {
  const [assetTotals, assetByCriticality] = await Promise.all([
    query<{ total: string; retired: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE lifecycle_status = 'retired')::text AS retired
       FROM assets
       WHERE workspace_id = $1`,
      [workspaceId],
    ),
    query<{ criticality: string | null; count: string }>(
      `SELECT COALESCE(NULLIF(criticality, ''), 'unrated') AS criticality, COUNT(*)::text AS count
       FROM assets
       WHERE workspace_id = $1
       GROUP BY 1`,
      [workspaceId],
    ),
  ]);

  const byCriticality = assetByCriticality.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.criticality || 'unrated'] = Number(row.count || 0);
    return acc;
  }, {});

  return {
    total: Number(assetTotals.rows[0]?.total || 0),
    retired: Number(assetTotals.rows[0]?.retired || 0),
    critical: (byCriticality.critical || 0) + (byCriticality.high || 0),
    byCriticality,
  };
}

async function buildReportContext(workspaceId: string) {
  const [boardData, riskState, regulatorySummary, tprmSummary, assetSummary] = await Promise.all([
    buildBoardReportData(workspaceId),
    getRiskIntelligenceState(workspaceId),
    buildRegulatoryReportSummary(workspaceId),
    tprmRepo.getTPRMSummary(workspaceId),
    buildAssetSummary(workspaceId),
  ]);

  const highestRisk = boardData.riskSummary.topRisks[0];
  const appetiteBreaches = riskState.dashboard.summary.appetiteBreaches;
  const capacityBreaches = riskState.dashboard.summary.capacityBreaches;
  const criticalKris = riskState.dashboard.summary.criticalKris;
  const topKri = riskState.dashboard.committeeView?.topKris?.[0];
  const forecast = riskState.dashboard.forecasts?.[0];
  const emergingRisks = riskState.dashboard.emergingRisks || [];
  const regulatoryExposure = regulatorySummary.boardReport.regulatoryExposureScore;
  const highImpactChanges = regulatorySummary.boardReport.highImpactChanges;
  const newRegulatoryChanges = regulatorySummary.readinessReport.newRegulatoryChanges;
  const activeObligations = regulatorySummary.obligationsReport.activeObligations;
  const complianceCoverage = boardData.frameworks.length > 0
    ? Math.round(
        boardData.frameworks.reduce((sum, framework) => sum + (framework.totalControls > 0 ? framework.implemented / framework.totalControls : 0), 0) /
          boardData.frameworks.length *
          100,
      )
    : 0;
  const boardDashboard: BoardDashboardData = {
    enterpriseScore: Math.max(0, Math.min(100, Math.round(
        100 -
        appetiteBreaches * 6 -
        capacityBreaches * 5 -
        highImpactChanges * 3 -
        tprmSummary.overdueAssessments * 2,
    ))),
    riskPosture: appetiteBreaches > 0 || capacityBreaches > 0 ? 'Heightened attention' : 'Within expected tolerance',
    appetiteBreaches,
    capacityUtilization: riskState.capacities.map((profile) => ({
      label: profile.capacityType,
      utilizationPercent: profile.utilizationPercent,
    })),
    topRisks: boardData.riskSummary.topRisks.map((risk) => ({
      title: risk.title,
      score: risk.severityScore,
      status: risk.status,
    })),
    topKris: (riskState.dashboard.committeeView?.topKris || []).map((kri) => ({
      name: kri.name,
      status: kri.status,
      value: kri.currentValue,
    })),
    forecastedIssues: (riskState.dashboard.forecasts || []).map((item) => ({
      label: item.scopeLabel,
      forecastScore: item.predicted90DayScore,
    })),
    emergingRisks: emergingRisks.map((item) => ({
      title: item.title,
      status: item.monitoringStatus,
    })),
    complianceCoverage,
    vendorExposure: `${tprmSummary.vendorsByRiskTier.high + tprmSummary.vendorsByRiskTier.critical} elevated vendors`,
    auditReadiness: boardData.frameworks.length > 0
      ? Math.round(boardData.frameworks.reduce((sum, framework) => sum + (framework.totalControls > 0 ? framework.implemented / framework.totalControls : 0), 0) / boardData.frameworks.length * 100)
      : 0,
    boardPackStatus: appetiteBreaches > 0 || highImpactChanges > 0 ? 'Refresh required' : 'Current',
  };

  return {
    boardData,
    riskState,
    regulatorySummary,
    tprmSummary,
    assetSummary,
    boardDashboard,
    highestRisk,
    topKri,
    forecast,
    appetiteBreaches,
    capacityBreaches,
    criticalKris,
    regulatoryExposure,
    highImpactChanges,
    newRegulatoryChanges,
    activeObligations,
  };
}

function buildSectionBullets(section: ReportSectionKey, context: ReportContext): string[] {
  const {
    boardData,
    riskState,
    regulatorySummary,
    tprmSummary,
    assetSummary,
    boardDashboard,
    highestRisk,
    topKri,
    forecast,
  } = context;

  switch (section) {
    case 'executive_summary':
      return [
        `Enterprise score is ${boardDashboard.enterpriseScore} with posture ${boardDashboard.riskPosture.toLowerCase()}.`,
        `${boardData.riskSummary.openRisks} risks remain open, including ${boardData.riskSummary.highRisks} high-severity items.`,
        `${context.highImpactChanges} high-impact regulatory changes and ${tprmSummary.overdueAssessments} overdue vendor assessments need follow-through.`,
      ];
    case 'enterprise_risk_posture':
      return [
        `Top current risk is ${highestRisk?.title || 'not yet identified'} with score ${highestRisk?.severityScore || 0}.`,
        `Weighted risk engine shows ${riskState.dashboard.summary.appetiteBreaches} appetite breaches and ${riskState.dashboard.summary.capacityBreaches} capacity breaches.`,
        `${riskState.dashboard.executiveSummary[0] || 'Risk posture remains measurable but should be refreshed by committee review.'}`,
      ];
    case 'risk_appetite_status':
      return [
        `${riskState.dashboard.summary.appetiteBreaches} categories are outside appetite thresholds.`,
        `${riskState.dashboard.appetiteBreaches.length} specific risk records are outside appetite.`,
      ];
    case 'risk_tolerance_breaches':
      return riskState.dashboard.appetiteBreaches
        .slice(0, 3)
        .map((risk) => `${risk.title} sits ${risk.appetiteStatus.replace(/_/g, ' ')} with residual score ${risk.residualScore}.`);
    case 'risk_capacity_utilization':
      return riskState.capacities.slice(0, 4).map((profile) => `${profile.capacityType} is at ${profile.utilizationPercent}% utilization.`);
    case 'top_risks':
      return boardData.riskSummary.topRisks.slice(0, 5).map((risk) => `${risk.title} is scored ${risk.severityScore} and currently ${risk.status}.`);
    case 'top_kris':
      return (riskState.dashboard.committeeView?.topKris || []).slice(0, 5).map((kri) => `${kri.name} is ${kri.status} at ${kri.currentValue}.`);
    case 'emerging_risks':
      return (riskState.dashboard.emergingRisks || []).slice(0, 4).map((risk) => `${risk.title} is ${risk.monitoringStatus}.`);
    case 'control_effectiveness':
      return boardData.frameworks.slice(0, 4).map((framework) => {
        const coverage = framework.totalControls > 0 ? Math.round((framework.implemented / framework.totalControls) * 100) : 0;
        return `${framework.frameworkCode} controls are ${coverage}% implemented with ${framework.controlsWithEvidence} controls supported by evidence.`;
      });
    case 'audit_readiness':
      return [
        `Average audit readiness is ${boardDashboard.auditReadiness}%.`,
        `${boardData.policySummary.overdueReviews} governance reviews are overdue and ${boardData.policySummary.dueNext30Days} are due in the next 30 days.`,
      ];
    case 'vendor_exposure':
      return [
        `${tprmSummary.totalVendors} vendors are in scope with ${tprmSummary.vendorsByRiskTier.high + tprmSummary.vendorsByRiskTier.critical} elevated-risk vendors.`,
        `${tprmSummary.overdueAssessments} assessments are overdue and ${tprmSummary.openIncidents} incidents remain open.`,
      ];
    case 'critical_assets':
      return [
        `${assetSummary.critical} critical or high-criticality assets are tracked across ${assetSummary.total} assets.`,
        `${assetSummary.retired} assets are retired; location and lifecycle reviews should focus on remaining critical assets.`,
      ];
    case 'training_metrics':
      return [
        `Training completion is ${boardData.trainingSummary.overallCompletionRate}% with ${boardData.trainingSummary.overdueAssignments} overdue assignments.`,
        `${boardData.trainingSummary.activeCampaigns} campaigns are active and the last phishing click rate is ${boardData.trainingSummary.lastPhishClickRate ?? 0}%.`,
      ];
    case 'regulatory_status':
      return [
        `${context.newRegulatoryChanges} new regulatory changes and ${context.highImpactChanges} high-impact changes are active.`,
        `${context.activeObligations} obligations are being tracked with compliance exposure at ${context.regulatoryExposure}%.`,
      ];
    case 'strategic_recommendations':
      return [
        appetiteBreachesToRecommendation(context),
        vendorExposureRecommendation(context),
        regulatoryRecommendation(context),
      ];
    case 'forecasted_issues':
      return forecast ? [`${forecast.scopeLabel} is forecast to reach ${Math.round(forecast.predicted90DayScore)} in the next 90 days.`] : ['No forecasted issue spikes are currently predicted.'];
    case 'loss_events':
      return riskState.lossEvents.slice(0, 3).map((event) => `${event.eventId} recorded ${event.actualLoss} in actual loss tied to ${event.eventType}.`);
    case 'near_misses':
      return riskState.nearMisses.slice(0, 3).map((event) => `${event.nearMissType} registered as a ${event.severity} near miss.`);
    case 'compliance_coverage':
      return [
        `Framework compliance coverage is ${boardDashboard.complianceCoverage}%.`,
        `${boardData.frameworks.filter((framework) => framework.controlsWithEvidence < framework.totalControls).length} frameworks still have evidence gaps.`,
      ];
    case 'management_actions':
      return [
        `${boardData.policySummary.overdueReviews + tprmSummary.overdueAssessments} governance and vendor items require owner follow-through.`,
        `${boardData.riskSummary.openRisks} open risks should be reviewed against active treatment plans.`,
      ];
    default:
      return [];
  }
}

function appetiteBreachesToRecommendation(context: ReportContext) {
  return context.appetiteBreaches > 0
    ? `Prioritize committee review of the ${context.appetiteBreaches} appetite breaches before the next board cycle.`
    : 'Maintain current risk treatment cadence and continue monitoring appetite thresholds.';
}

function vendorExposureRecommendation(context: ReportContext) {
  return context.tprmSummary.overdueAssessments > 0
    ? `Escalate overdue vendor assessments and focus on ${context.tprmSummary.vendorsByRiskTier.high + context.tprmSummary.vendorsByRiskTier.critical} elevated vendors.`
    : 'Vendor oversight is stable; continue quarterly assessments and incident monitoring.';
}

function regulatoryRecommendation(context: ReportContext) {
  return context.highImpactChanges > 0
    ? `Run targeted impact reviews for ${context.highImpactChanges} high-impact regulatory changes.`
    : 'No high-impact regulatory changes require immediate escalation.';
}

function buildReportContent(template: ReportTemplateRecord, context: ReportContext): GeneratedReportRecord['content'] {
  const sections = template.sections.map((sectionKey) => ({
    key: sectionKey,
    heading: SECTION_HEADINGS[sectionKey],
    bullets: buildSectionBullets(sectionKey, context),
  }));

  const metrics = [
    { label: 'Enterprise Score', value: context.boardDashboard.enterpriseScore, detail: context.boardDashboard.riskPosture },
    { label: 'Open Risks', value: context.boardData.riskSummary.openRisks, detail: `${context.boardData.riskSummary.highRisks} high severity` },
    { label: 'Critical KRIs', value: context.criticalKris, detail: context.topKri ? `Lead indicator: ${context.topKri.name}` : 'No critical KRIs' },
    { label: 'Compliance Exposure', value: `${context.regulatoryExposure}%`, detail: `${context.highImpactChanges} high-impact changes` },
    { label: 'Vendor Exposure', value: context.tprmSummary.vendorsByRiskTier.high + context.tprmSummary.vendorsByRiskTier.critical, detail: `${context.tprmSummary.overdueAssessments} overdue assessments` },
  ];

  return { sections, metrics };
}

export async function getReportingCenterState(workspaceId: string): Promise<ReportingCenterState> {
  await ensureTemplates(workspaceId);
  const [templates, generatedReports, schedules, distributions, attestations, context] = await Promise.all([
    listTemplates(workspaceId),
    listGeneratedReports(workspaceId),
    listSchedules(workspaceId),
    listDistributions(workspaceId),
    listAttestations(workspaceId),
    buildReportContext(workspaceId),
  ]);

  const awaitingAttestation = generatedReports.filter((report) => report.status === 'generated').length;
  const currentMonth = new Date().toISOString().slice(0, 7);

  return {
    templates,
    generatedReports,
    schedules,
    distributions,
    attestations,
    boardDashboard: context.boardDashboard,
    recentReports: generatedReports.slice(0, 5),
    upcomingReports: [...schedules].sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt)).slice(0, 5),
    summary: {
      totalTemplates: templates.length,
      generatedThisMonth: generatedReports.filter((report) => report.createdAt.startsWith(currentMonth)).length,
      scheduledReports: schedules.filter((schedule) => schedule.isActive).length,
      awaitingAttestation,
      distributedReports: distributions.filter((distribution) => Boolean(distribution.sentAt)).length,
    },
  };
}

export async function updateReportingTemplateSections(
  workspaceId: string,
  templateId: string,
  sections: ReportSectionKey[],
) {
  return updateTemplateSections(workspaceId, templateId, sections);
}

export async function generateReportingCenterReport(input: {
  workspaceId: string;
  templateId: string;
  scopeType: ReportScopeType;
  scopeValue: string;
  format?: ReportFormat;
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
}): Promise<GeneratedReportRecord> {
  await ensureTemplates(input.workspaceId);
  const templates = await listTemplates(input.workspaceId);
  const template = templates.find((item) => item.id === input.templateId);
  if (!template) {
    throw new Error('Reporting template not found');
  }

  const context = await buildReportContext(input.workspaceId);
  const report = await createGeneratedReport({
    workspaceId: input.workspaceId,
    templateId: template.id,
    templateKey: template.templateKey,
    reportType: template.category,
    title: `${template.title} - ${new Date().toLocaleDateString('en-GB')}`,
    classification: template.classification,
    version: template.version,
    authorName: input.actorName,
    format: input.format || template.defaultFormat,
    scopeType: input.scopeType,
    scopeValue: input.scopeValue,
    status: 'generated',
    generatedByUserId: input.actorUserId,
    generatedByName: input.actorName,
    content: buildReportContent(template, context),
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'report_generated',
    category: 'report',
    targetType: 'executive_report',
    targetId: report.id,
    targetName: report.title,
    newValue: { templateKey: template.templateKey, format: report.format, scopeType: report.scopeType },
    outcome: 'success',
    severity: template.category === 'board_reports' ? 'high' : 'medium',
    source: 'backend',
    notes: `Generated ${template.title} for ${input.scopeValue}`,
  });

  return report;
}

export async function createReportingSchedule(input: {
  workspaceId: string;
  templateId: string;
  name: string;
  frequency: ScheduleFrequency;
  recipients: Array<{ type: RecipientType; value: string }>;
  deliveryMethods: DeliveryMethod[];
  scopeType: ReportScopeType;
  scopeValue: string;
  nextRunAt: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
}): Promise<ReportScheduleRecord> {
  await ensureTemplates(input.workspaceId);
  const templates = await listTemplates(input.workspaceId);
  const template = templates.find((item) => item.id === input.templateId);
  if (!template) {
    throw new Error('Reporting template not found');
  }

  const schedule = await createSchedule({
    workspaceId: input.workspaceId,
    templateId: template.id,
    templateKey: template.templateKey,
    name: input.name,
    frequency: input.frequency,
    recipients: input.recipients,
    deliveryMethods: input.deliveryMethods,
    scopeType: input.scopeType,
    scopeValue: input.scopeValue,
    nextRunAt: input.nextRunAt,
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'report_schedule_created',
    category: 'report',
    targetType: 'report_schedule',
    targetId: schedule.id,
    targetName: schedule.name,
    newValue: { templateKey: template.templateKey, frequency: schedule.frequency, recipients: schedule.recipients },
    outcome: 'success',
    severity: 'medium',
    source: 'backend',
    notes: `Scheduled ${template.title} on ${schedule.frequency} cadence`,
  });

  return schedule;
}

export async function updateReportingSchedule(input: {
  workspaceId: string;
  scheduleId: string;
  updates: Partial<ReportScheduleRecord>;
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
}): Promise<ReportScheduleRecord | null> {
  const schedule = await updateSchedule(input.workspaceId, input.scheduleId, input.updates);
  if (!schedule) return null;

  await recordActivity({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'report_schedule_updated',
    category: 'report',
    targetType: 'report_schedule',
    targetId: schedule.id,
    targetName: schedule.name,
    newValue: schedule,
    outcome: 'success',
    severity: 'medium',
    source: 'backend',
    notes: `Updated schedule ${schedule.name}`,
  });

  return schedule;
}

export async function distributeReportingCenterReport(input: {
  workspaceId: string;
  reportId: string;
  recipientType: RecipientType;
  recipientValue: string;
  deliveryMethod: DeliveryMethod;
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
}): Promise<ReportDistributionRecord> {
  const report = await getGeneratedReport(input.workspaceId, input.reportId);
  if (!report) {
    throw new Error('Generated report not found');
  }

  const distribution = await createDistribution({
    workspaceId: input.workspaceId,
    reportId: report.id,
    recipientType: input.recipientType,
    recipientValue: input.recipientValue,
    deliveryMethod: input.deliveryMethod,
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: 'report_distributed',
    category: 'report',
    targetType: 'executive_report',
    targetId: report.id,
    targetName: report.title,
    newValue: { recipientType: distribution.recipientType, recipientValue: distribution.recipientValue, deliveryMethod: distribution.deliveryMethod },
    outcome: 'success',
    severity: report.templateKey === 'board_pack' ? 'high' : 'medium',
    source: 'backend',
    notes: `Distributed report to ${distribution.recipientValue}`,
  });

  return distribution;
}

export async function attestReportingCenterReport(input: {
  workspaceId: string;
  reportId: string;
  approverUserId?: string | null;
  approverName: string;
  approverRole?: string | null;
  decision: AttestationDecision;
  comments?: string | null;
}): Promise<ReportAttestationRecord> {
  const report = await getGeneratedReport(input.workspaceId, input.reportId);
  if (!report) {
    throw new Error('Generated report not found');
  }

  const attestation = await createAttestation({
    workspaceId: input.workspaceId,
    reportId: report.id,
    approverUserId: input.approverUserId,
    approverName: input.approverName,
    decision: input.decision,
    comments: input.comments,
  });

  await recordActivity({
    workspaceId: input.workspaceId,
    actorUserId: input.approverUserId,
    actorName: input.approverName,
    actorRole: input.approverRole,
    action: `report_${input.decision}`,
    category: 'report',
    targetType: 'executive_report',
    targetId: report.id,
    targetName: report.title,
    newValue: { decision: input.decision, comments: input.comments || null },
    outcome: input.decision === 'rejected' ? 'blocked' : 'success',
    severity: input.decision === 'rejected' ? 'high' : 'medium',
    source: 'backend',
    notes: `${input.approverName} marked report as ${input.decision}`,
  });

  return attestation;
}

export async function logReportingCenterActivity(input: RecordActivityInput) {
  await recordActivity(input);
}
