import * as repo from '../repositories/riskIntelligenceRepo.js';
import { recordActivity, type RecordActivityInput } from './activityLedger/activityLedger.js';
import type {
  EmergingRiskRecord,
  KriDefinition,
  LossEventRecord,
  NearMissRecord,
  RiskCapacityProfile,
  RiskForecast,
  RiskIntelligenceDashboard,
  RiskIntelligenceRiskSummary,
  RiskIntelligenceState,
  RiskQuantificationWeightSet,
  RiskToleranceProfile,
  RiskToleranceStatus,
  RiskTreatmentEffectiveness,
  RiskTrendDirection,
  RiskReportPack,
} from '../types/riskIntelligence.js';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeRiskScore(score: number) {
  return clamp((score / 25) * 100);
}

function getToleranceStatus(score: number, profile?: RiskToleranceProfile): RiskToleranceStatus {
  if (!profile) return score <= 45 ? 'within_appetite' : score <= 55 ? 'within_tolerance' : score <= 75 ? 'outside_tolerance' : 'beyond_capacity';
  if (score <= profile.appetite) return 'within_appetite';
  if (score <= profile.threshold) return 'within_tolerance';
  if (score <= profile.capacity) return 'outside_tolerance';
  return 'beyond_capacity';
}

function getTrendDirection(current: number, previous?: number): RiskTrendDirection {
  if (previous == null) return 'stable';
  const delta = current - previous;
  if (delta >= 5) return 'increasing';
  if (delta <= -5) return 'decreasing';
  return 'stable';
}

function mapCapacityCategory(capacityType: RiskCapacityProfile['capacityType']) {
  const mapping: Record<RiskCapacityProfile['capacityType'], string[]> = {
    financial: ['strategic', 'vendor'],
    operational: ['operational'],
    regulatory: ['compliance', 'privacy'],
    technology: ['information_security', 'operational'],
    vendor: ['vendor'],
    cyber: ['information_security'],
    privacy: ['privacy'],
    ai_governance: ['ai_governance', 'strategic'],
  };
  return mapping[capacityType];
}

function getKriStatus(currentValue: number, green: number, amber: number, red: number): KriDefinition['status'] {
  if (currentValue >= red) return 'red';
  if (currentValue >= amber) return 'amber';
  return currentValue >= green ? 'green' : 'green';
}

function categoryLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

type ComputedRiskSignal = {
  riskId: string;
  title: string;
  owner: string;
  category: string;
  status: string;
  dueDate?: string;
  treatmentPlan?: string;
  businessUnit?: string;
  frameworkCodes: string[];
  inherentScore: number;
  residualScore: number;
  dynamicScore: number;
  appetiteStatus: RiskToleranceStatus;
  trend: RiskTrendDirection;
  forecast30DayScore: number;
  forecast90DayScore: number;
  forecast180DayScore: number;
  forecastStatus: RiskToleranceStatus;
};

async function computeAutomatedKriValues(
  workspaceId: string,
  existing: KriDefinition[],
  risks: ComputedRiskSignal[],
  assets: any[],
  vendors: any[],
  trainingSignal: { completionRate: number; overdueAssignments: number },
  auditSignal: { openItems: number; averageReadiness: number },
) {
  const activeLossEvents = await repo.listLossEvents(workspaceId);
  const nearMisses = await repo.listNearMisses(workspaceId);

  const valuesByName = new Map<string, number>([
    ['Critical Vulnerabilities', assets.reduce((sum, asset) => sum + Number(asset.risk_score || 0 >= 80 ? 1 : 0), 0)],
    ['Open Audit Findings', auditSignal.openItems],
    ['Expired Evidence', risks.reduce((sum, risk) => sum + (risk.dynamicScore >= 65 ? 1 : 0), 0)],
    ['Failed Logins', nearMisses.filter((item) => item.nearMissType === 'unauthorized_access_attempt').length],
    ['Privileged Accounts', vendors.filter((vendor) => vendor.risk_level === 'critical').length + 2],
    ['Vendor SLA Breaches', nearMisses.filter((item) => item.nearMissType === 'vendor_sla_near_miss').length],
    ['Policy Exceptions', risks.filter((risk) => risk.category === 'compliance' && risk.dynamicScore > 55).length],
    ['Third-Party Findings', vendors.filter((vendor) => vendor.risk_level === 'high' || vendor.risk_level === 'critical').length],
    ['Training Completion', round(trainingSignal.completionRate)],
    ['Data Privacy Incidents', activeLossEvents.filter((item) => item.eventType === 'privacy_breach').length],
  ]);

  return existing.map((kri) => {
    const currentValue = valuesByName.has(kri.name) ? Number(valuesByName.get(kri.name)) : kri.currentValue;
    return {
      ...kri,
      currentValue,
      status: getKriStatus(currentValue, kri.greenThreshold, kri.amberThreshold, kri.redThreshold),
    };
  });
}

async function computeRiskSignals(workspaceId: string): Promise<ComputedRiskSignal[]> {
  await repo.seedRiskIntelligenceDefaults(workspaceId);
  const [rows, toleranceProfiles, weights, snapshots, vendors, assets, auditSignal] = await Promise.all([
    repo.listRiskDataRows(workspaceId),
    repo.listToleranceProfiles(workspaceId),
    repo.getWeightSet(workspaceId),
    repo.listRecentSnapshots(workspaceId, 365),
    repo.listVendorSignalRows(workspaceId),
    repo.listAssetSignalRows(workspaceId),
    repo.getAuditSignal(workspaceId),
  ]);

  const profileByCategory = new Map(toleranceProfiles.map((profile) => [profile.category, profile]));
  const previousByRisk = new Map<string, number>();
  snapshots.forEach((snapshot) => {
    if (snapshot.riskId && snapshot.scoreType === 'dynamic' && !previousByRisk.has(snapshot.riskId)) {
      previousByRisk.set(snapshot.riskId, snapshot.score);
    }
  });

  const vendorRiskByCategory = new Map<string, number>();
  vendors.forEach((vendor) => {
    const riskLevel = String(vendor.risk_level || 'low');
    const score = riskLevel === 'critical' ? 95 : riskLevel === 'high' ? 78 : riskLevel === 'medium' ? 52 : 28;
    vendorRiskByCategory.set(String(vendor.category || 'vendor'), Math.max(vendorRiskByCategory.get(String(vendor.category || 'vendor')) || 0, score));
  });

  return rows.map((row) => {
    const category = String(row.category);
    const profile = profileByCategory.get(category) || profileByCategory.get('strategic');
    const linkedAssets = assets.filter((asset) => Array.isArray(asset.linked_risk_ids) && asset.linked_risk_ids.includes(row.id));
    const assetPressure = linkedAssets.length === 0 ? 30 : average(linkedAssets.map((asset) => {
      const criticality = String(asset.criticality || 'low');
      return criticality === 'critical' ? 95 : criticality === 'high' ? 75 : criticality === 'medium' ? 55 : 30;
    }));

    const likelihoodSignal = normalizeRiskScore(Number(row.residual_likelihood) * Number(row.inherent_likelihood));
    const impactSignal = normalizeRiskScore(Number(row.residual_impact) * Number(row.inherent_impact));
    const controlSignal = clamp(100 - Number(row.failing_controls || 0) * 12);
    const evidenceSignal = clamp(100 - Number(row.stale_evidence_count || 0) * 18 - (Number(row.evidence_count || 0) === 0 ? 20 : 0));
    const vendorSignal = vendorRiskByCategory.get(category) ?? (category === 'vendor' ? 72 : 35);
    const auditSignalScore = clamp(100 - auditSignal.openItems * 4 - (100 - auditSignal.averageReadiness) * 0.35);
    const lossSignal = clamp(Number(row.loss_event_count || 0) * 22);
    const nearMissSignal = clamp(Number(row.near_miss_count || 0) * 12);

    const dynamicScore = clamp(
      likelihoodSignal * weights.likelihoodWeight +
      impactSignal * weights.impactWeight +
      (100 - controlSignal) * weights.controlEffectivenessWeight +
      (100 - evidenceSignal) * weights.evidenceConfidenceWeight +
      auditSignalScore * weights.auditFindingsWeight +
      vendorSignal * weights.vendorExposureWeight +
      assetPressure * weights.assetCriticalityWeight +
      lossSignal * weights.lossEventsWeight +
      nearMissSignal * weights.nearMissEventsWeight,
    );

    const forecast30 = clamp(dynamicScore + lossSignal * 0.08 + nearMissSignal * 0.06 + (100 - evidenceSignal) * 0.04);
    const forecast90 = clamp(dynamicScore + lossSignal * 0.16 + nearMissSignal * 0.09 + (100 - controlSignal) * 0.06 + vendorSignal * 0.05);
    const forecast180 = clamp(dynamicScore + lossSignal * 0.2 + nearMissSignal * 0.12 + vendorSignal * 0.08 + (100 - evidenceSignal) * 0.07);
    const appetiteStatus = getToleranceStatus(dynamicScore, profile);
    const forecastStatus = getToleranceStatus(forecast90, profile);
    const prior = previousByRisk.get(String(row.id));

    return {
      riskId: String(row.id),
      title: String(row.title),
      owner: String(row.owner),
      category,
      status: String(row.status),
      dueDate: row.due_date ? new Date(row.due_date).toISOString() : undefined,
      treatmentPlan: row.treatment_plan ? String(row.treatment_plan) : undefined,
      businessUnit: row.business_unit ? String(row.business_unit) : undefined,
      frameworkCodes: Array.isArray(row.framework_codes) ? row.framework_codes : [],
      inherentScore: Number(row.inherent_likelihood) * Number(row.inherent_impact),
      residualScore: Number(row.residual_likelihood) * Number(row.residual_impact),
      dynamicScore: round(dynamicScore),
      appetiteStatus,
      trend: getTrendDirection(dynamicScore, prior),
      forecast30DayScore: round(forecast30),
      forecast90DayScore: round(forecast90),
      forecast180DayScore: round(forecast180),
      forecastStatus,
    };
  });
}

async function persistComputedRiskState(workspaceId: string, signals: ComputedRiskSignal[]) {
  for (const signal of signals) {
    await repo.upsertForecast(workspaceId, {
      scopeType: 'risk',
      scopeKey: signal.riskId,
      scopeLabel: signal.title,
      riskId: signal.riskId,
      currentScore: signal.dynamicScore,
      predicted30DayScore: signal.forecast30DayScore,
      predicted90DayScore: signal.forecast90DayScore,
      predicted180DayScore: signal.forecast180DayScore,
      forecastStatus: signal.forecastStatus,
      trend: signal.trend,
    });

    await repo.recordScoreSnapshot({
      workspaceId,
      riskId: signal.riskId,
      category: signal.category,
      businessUnit: signal.businessUnit || null,
      frameworkCode: signal.frameworkCodes[0] || null,
      scoreType: 'dynamic',
      score: signal.dynamicScore,
      appetiteStatus: signal.appetiteStatus,
    });
  }
}

function buildHeatmapMatrix(signals: ComputedRiskSignal[], metric: 'inherentScore' | 'residualScore' | 'dynamicScore' | 'forecast90DayScore' | 'appetiteStatus') {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  signals.forEach((signal) => {
    const x = Math.max(0, Math.min(4, Math.ceil(signal.inherentScore / 5) - 1));
    const scoreValue =
      metric === 'dynamicScore'
        ? signal.dynamicScore
        : metric === 'forecast90DayScore'
          ? signal.forecast90DayScore
          : metric === 'appetiteStatus'
            ? signal.appetiteStatus === 'within_appetite'
              ? signal.residualScore
              : signal.forecast90DayScore
            : signal[metric];
    const y = Math.max(0, Math.min(4, Math.ceil((typeof scoreValue === 'number' ? scoreValue : signal.residualScore) / 20) - 1));
    matrix[y][x] += 1;
  });
  return matrix;
}

function summarizeExecutiveLines(dashboard: RiskIntelligenceDashboard): string[] {
  const topDriver = dashboard.topRiskDrivers[0];
  const topForecast = dashboard.forecasts[0];
  return [
    `${dashboard.summary.appetiteBreaches} risks are outside appetite, with ${dashboard.summary.capacityBreaches} now beyond capacity.`,
    topDriver ? `${categoryLabel(topDriver.label)} is the strongest current driver of enterprise exposure.` : 'No single category dominates current enterprise exposure.',
    topForecast ? `${topForecast.scopeLabel} is forecast to reach ${Math.round(topForecast.predicted90DayScore)} within 90 days.` : 'Forecasting is stable with no near-term breach acceleration.',
  ];
}

function toRiskSummary(signal: ComputedRiskSignal): RiskIntelligenceRiskSummary {
  return {
    id: signal.riskId,
    title: signal.title,
    owner: signal.owner,
    category: signal.category,
    status: signal.status,
    inherentScore: signal.inherentScore,
    residualScore: signal.residualScore,
    dynamicScore: signal.dynamicScore,
    appetiteStatus: signal.appetiteStatus,
    trend: signal.trend,
    forecast90DayScore: signal.forecast90DayScore,
    forecastStatus: signal.forecastStatus,
    treatmentPlan: signal.treatmentPlan,
    dueDate: signal.dueDate,
  };
}

export async function getRiskIntelligenceState(workspaceId: string): Promise<RiskIntelligenceState> {
  await repo.seedRiskIntelligenceDefaults(workspaceId);
  const signals = await computeRiskSignals(workspaceId);
  await persistComputedRiskState(workspaceId, signals);

  const [toleranceProfiles, capacitiesRaw, krisRaw, lossEvents, nearMisses, forecasts, emergingRisks, treatments, weights, vendors, assets, trainingSignal, auditSignal, reviewTaskSignal] = await Promise.all([
    repo.listToleranceProfiles(workspaceId),
    repo.listCapacityProfiles(workspaceId),
    repo.listKris(workspaceId),
    repo.listLossEvents(workspaceId),
    repo.listNearMisses(workspaceId),
    repo.listForecasts(workspaceId),
    repo.listEmergingRisks(workspaceId),
    repo.listTreatments(workspaceId),
    repo.getWeightSet(workspaceId),
    repo.listVendorSignalRows(workspaceId),
    repo.listAssetSignalRows(workspaceId),
    repo.getTrainingSignal(workspaceId),
    repo.getAuditSignal(workspaceId),
    repo.listReviewTaskSignal(workspaceId),
  ]);

  const kris = await computeAutomatedKriValues(workspaceId, krisRaw, signals, assets, vendors, trainingSignal, auditSignal);
  const criticalKris = kris.filter((kri) => kri.status === 'red').length;
  const risks = signals.map(toRiskSummary).sort((a, b) => b.dynamicScore - a.dynamicScore);
  const appetiteBreaches = risks.filter((risk) => risk.appetiteStatus !== 'within_appetite');
  const toleranceBreaches = risks.filter((risk) => risk.appetiteStatus === 'outside_tolerance' || risk.appetiteStatus === 'beyond_capacity');
  const capacityBreaches = risks.filter((risk) => risk.appetiteStatus === 'beyond_capacity');

  const capacities = capacitiesRaw.map((profile) => {
    const categories = mapCapacityCategory(profile.capacityType);
    const related = risks.filter((risk) => categories.includes(risk.category));
    const currentExposure = round(average(related.map((risk) => risk.dynamicScore)));
    const utilizationPercent = profile.capacityLimit > 0 ? round((currentExposure / profile.capacityLimit) * 100) : 0;
    return {
      ...profile,
      currentExposure,
      utilizationPercent,
    };
  });

  for (const capacity of capacities) {
    await repo.upsertCapacityProfile(workspaceId, capacity.capacityType, {
      currentExposure: capacity.currentExposure,
      capacityLimit: capacity.capacityLimit,
      utilizationPercent: capacity.utilizationPercent,
    });
  }

  const topRiskDrivers = [...new Map(
    risks.map((risk) => [risk.category, {
      label: risk.category,
      score: round(average(risks.filter((item) => item.category === risk.category).map((item) => item.dynamicScore))),
    }]),
  ).values()].sort((a, b) => b.score - a.score).slice(0, 5);

  const trendingCategories = [...new Map(
    risks.map((risk) => [risk.category, {
      category: risk.category,
      averageScore: round(average(risks.filter((item) => item.category === risk.category).map((item) => item.dynamicScore))),
      trend: risk.trend,
    }]),
  ).values()];

  const dashboard: RiskIntelligenceDashboard = {
    summary: {
      totalRisks: risks.length,
      appetiteBreaches: appetiteBreaches.length,
      toleranceBreaches: toleranceBreaches.length,
      capacityBreaches: capacityBreaches.length,
      criticalKris,
      totalLossEvents: lossEvents.length,
      totalNearMisses: nearMisses.length,
      emergingRisks: emergingRisks.length,
    },
    topRiskDrivers,
    appetiteBreaches: appetiteBreaches.slice(0, 10),
    kriStatus: kris,
    forecasts: forecasts
      .filter((forecast) => forecast.scopeType === 'risk')
      .sort((a, b) => b.predicted90DayScore - a.predicted90DayScore)
      .slice(0, 10),
    capacityUtilization: capacities.sort((a, b) => b.utilizationPercent - a.utilizationPercent),
    emergingRisks,
    lossEvents: lossEvents.slice(0, 10),
    nearMisses: nearMisses.slice(0, 10),
    trendingCategories,
    executiveSummary: summarizeExecutiveLines({
      summary: {
        totalRisks: risks.length,
        appetiteBreaches: appetiteBreaches.length,
        toleranceBreaches: toleranceBreaches.length,
        capacityBreaches: capacityBreaches.length,
        criticalKris,
        totalLossEvents: lossEvents.length,
        totalNearMisses: nearMisses.length,
        emergingRisks: emergingRisks.length,
      },
      topRiskDrivers,
      appetiteBreaches: appetiteBreaches.slice(0, 10),
      kriStatus: kris,
      forecasts: forecasts.filter((forecast) => forecast.scopeType === 'risk').sort((a, b) => b.predicted90DayScore - a.predicted90DayScore).slice(0, 10),
      capacityUtilization: capacities,
      emergingRisks,
      lossEvents,
      nearMisses,
      trendingCategories,
      executiveSummary: [],
      committeeView: {
        topRisks: risks.slice(0, 10),
        topKris: kris.filter((kri) => kri.status !== 'green').slice(0, 10),
        highRiskVendors: vendors.filter((vendor) => vendor.risk_level === 'high' || vendor.risk_level === 'critical').slice(0, 10).map((vendor) => ({ name: String(vendor.name), riskLevel: String(vendor.risk_level), score: undefined })),
        criticalAssets: assets.filter((asset) => asset.criticality === 'critical' || asset.criticality === 'high').slice(0, 10).map((asset) => ({ name: String(asset.name), criticality: String(asset.criticality), riskScore: Number(asset.risk_score || 0) })),
        auditFindings: auditSignal.openItems,
        openTreatmentPlans: reviewTaskSignal.openTreatmentPlans,
      },
      heatmap: { inherent: [], residual: [], target: [], forecast: [], appetiteBreaches: [] },
    }),
    committeeView: {
      topRisks: risks.slice(0, 10),
      topKris: kris.filter((kri) => kri.status !== 'green').slice(0, 10),
      highRiskVendors: vendors
        .filter((vendor) => vendor.risk_level === 'high' || vendor.risk_level === 'critical')
        .slice(0, 10)
        .map((vendor) => ({ name: String(vendor.name), riskLevel: String(vendor.risk_level), score: undefined })),
      criticalAssets: assets
        .filter((asset) => asset.criticality === 'critical' || asset.criticality === 'high')
        .slice(0, 10)
        .map((asset) => ({ name: String(asset.name), criticality: String(asset.criticality), riskScore: Number(asset.risk_score || 0) })),
      auditFindings: auditSignal.openItems,
      openTreatmentPlans: reviewTaskSignal.openTreatmentPlans,
    },
    heatmap: {
      inherent: buildHeatmapMatrix(signals, 'inherentScore'),
      residual: buildHeatmapMatrix(signals, 'residualScore'),
      target: buildHeatmapMatrix(signals, 'residualScore'),
      forecast: buildHeatmapMatrix(signals, 'forecast90DayScore'),
      appetiteBreaches: buildHeatmapMatrix(signals.filter((signal) => signal.appetiteStatus !== 'within_appetite'), 'appetiteStatus'),
    },
  };

  return {
    dashboard,
    toleranceProfiles,
    capacities,
    kris,
    lossEvents,
    nearMisses,
    forecasts,
    emergingRisks,
    treatments,
    weights,
    risks,
  };
}

export async function updateToleranceProfile(workspaceId: string, category: string, input: Pick<RiskToleranceProfile, 'appetite' | 'tolerance' | 'capacity'>) {
  return repo.upsertToleranceProfile(workspaceId, category, input);
}

export async function updateCapacityProfile(workspaceId: string, capacityType: RiskCapacityProfile['capacityType'], input: Pick<RiskCapacityProfile, 'currentExposure' | 'capacityLimit' | 'utilizationPercent'>) {
  return repo.upsertCapacityProfile(workspaceId, capacityType, input);
}

export async function createKri(workspaceId: string, input: Partial<KriDefinition>) {
  return repo.createKri(workspaceId, input);
}

export async function updateKri(workspaceId: string, id: string, input: Partial<KriDefinition>) {
  return repo.updateKri(workspaceId, id, input);
}

export async function createLossEvent(workspaceId: string, input: Partial<LossEventRecord>) {
  return repo.createLossEvent(workspaceId, input);
}

export async function createNearMiss(workspaceId: string, input: Partial<NearMissRecord>) {
  return repo.createNearMiss(workspaceId, input);
}

export async function createEmergingRisk(workspaceId: string, input: Partial<EmergingRiskRecord>) {
  return repo.createEmergingRisk(workspaceId, input);
}

export async function createTreatment(workspaceId: string, input: Partial<RiskTreatmentEffectiveness>) {
  return repo.createTreatment(workspaceId, input);
}

export async function updateWeightSet(workspaceId: string, input: Partial<RiskQuantificationWeightSet>) {
  return repo.updateWeightSet(workspaceId, input);
}

export async function generateRiskReport(state: RiskIntelligenceState, reportType: RiskReportPack['reportType'], format: RiskReportPack['format']): Promise<RiskReportPack> {
  const titleMap: Record<RiskReportPack['reportType'], string> = {
    risk_committee_report: 'Risk Committee Report',
    board_risk_report: 'Board Risk Report',
    executive_risk_summary: 'Executive Risk Summary',
    kri_report: 'KRI Report',
    loss_event_report: 'Loss Event Report',
  };

  const sections: RiskReportPack['sections'] = [];

  if (reportType === 'risk_committee_report' || reportType === 'board_risk_report' || reportType === 'executive_risk_summary') {
    sections.push(
      {
        heading: 'Executive Summary',
        bullets: state.dashboard.executiveSummary,
      },
      {
        heading: 'Top 10 Risks',
        bullets: state.dashboard.committeeView.topRisks.slice(0, 10).map((risk) => `${risk.title}: ${Math.round(risk.dynamicScore)} (${categoryLabel(risk.appetiteStatus)})`),
      },
      {
        heading: 'Capacity Utilization',
        bullets: state.capacities.map((capacity) => `${categoryLabel(capacity.capacityType)}: ${Math.round(capacity.currentExposure)}/${Math.round(capacity.capacityLimit)} (${Math.round(capacity.utilizationPercent)}%)`),
      },
    );
  }

  if (reportType === 'kri_report') {
    sections.push({
      heading: 'KRI Status',
      bullets: state.kris.map((kri) => `${kri.name}: ${kri.currentValue} ${kri.measurementUnit} (${kri.status})`),
    });
  }

  if (reportType === 'loss_event_report') {
    sections.push({
      heading: 'Loss Events',
      bullets: state.lossEvents.map((event) => `${event.eventId}: ${categoryLabel(event.eventType)} · actual ${event.actualLoss} · estimated ${event.estimatedLoss}`),
    });
  }

  return {
    reportType,
    generatedAt: new Date().toISOString(),
    format,
    title: titleMap[reportType],
    sections,
  };
}

export async function logRiskIntelligenceActivity(base: RecordActivityInput) {
  await recordActivity(base);
}
