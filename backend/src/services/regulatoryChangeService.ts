import * as regulatoryRepo from '../repositories/regulatoryRepo.js';
import type {
  RegulatoryChangeLogEntry,
  RegulatoryImpactAssessment,
  RegulatoryWorkspaceState,
} from '../types/regulatory.js';

function computePriority(score: number): 'low' | 'medium' | 'high' | 'urgent' {
  if (score >= 85) return 'urgent';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export async function ensureRegulatoryWorkspaceState(workspaceId: string): Promise<RegulatoryWorkspaceState> {
  await regulatoryRepo.seedRegulatoryData(workspaceId);
  return regulatoryRepo.getRegulatoryWorkspaceState(workspaceId);
}

export async function runImpactAssessment(
  workspaceId: string,
  change: RegulatoryChangeLogEntry,
): Promise<RegulatoryImpactAssessment> {
  const controlWeight = change.affectedControls.length * 8;
  const policyWeight = change.affectedPolicies.length * 10;
  const riskWeight = change.affectedRisks.length * 12;
  const vendorWeight = change.affectedVendors.length * 8;
  const assetWeight = change.affectedAssets.length * 6;
  const aiWeight = change.affectedAiSystems.length * 10;

  const rawScore = Math.min(
    100,
    25 +
      controlWeight +
      policyWeight +
      riskWeight +
      vendorWeight +
      assetWeight +
      aiWeight +
      (change.severity === 'critical' ? 18 : change.severity === 'high' ? 12 : change.severity === 'medium' ? 6 : 0),
  );

  const priority = computePriority(rawScore);
  const affectedProcesses = [
    change.affectedPolicies.length > 0 ? 'Policy lifecycle' : null,
    change.affectedControls.length > 0 ? 'Control operations' : null,
    change.affectedRisks.length > 0 ? 'Risk governance' : null,
    change.affectedVendors.length > 0 ? 'Third-party oversight' : null,
  ].filter(Boolean) as string[];

  return regulatoryRepo.createImpactAssessment(workspaceId, change.id, {
    impactScore: rawScore,
    severity: change.severity,
    priority,
    affectedControls: change.affectedControls,
    affectedPolicies: change.affectedPolicies,
    affectedRisks: change.affectedRisks,
    affectedVendors: change.affectedVendors,
    affectedAssets: change.affectedAssets,
    affectedProcesses,
    affectedAiSystems: change.affectedAiSystems,
    requiredActions: change.requiredActions.length > 0
      ? change.requiredActions
      : ['Review impacted controls', 'Update linked policies', 'Notify accountable stakeholders'],
  });
}

export async function buildRegulatoryReportSummary(workspaceId: string) {
  const state = await ensureRegulatoryWorkspaceState(workspaceId);
  return {
    generatedAt: new Date().toISOString(),
    boardReport: {
      regulatoryExposureScore: state.dashboard.complianceExposure,
      highImpactChanges: state.dashboard.highImpactChanges,
      upcomingDeadlines: state.dashboard.upcomingDeadlines,
      topJurisdictions: state.dashboard.jurisdictionBreakdown.slice(0, 5),
    },
    obligationsReport: {
      activeObligations: state.dashboard.activeObligations,
      overdueActions: state.dashboard.overdueActions,
      owners: Array.from(new Set(state.obligations.map((item) => item.owner))).slice(0, 10),
    },
    complianceImpactReport: {
      totalRegulations: state.dashboard.totalRegulations,
      frameworkCoverage: state.dashboard.frameworkCoverage,
      impactHeatmap: state.dashboard.impactHeatmap,
    },
    readinessReport: {
      pendingReviews: state.dashboard.pendingReviews,
      newRegulatoryChanges: state.dashboard.newRegulatoryChanges,
      highImpactChanges: state.dashboard.highImpactChanges,
      executiveSummary: state.dashboard.executiveSummary,
    },
  };
}
