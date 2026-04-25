import type {
  AppetiteConfig,
  EnterpriseExceptions,
  Risk,
} from './riskEngine';
import { evaluateRiskAppetite } from './appetiteEngine';
import { evaluateControlEffectiveness } from './controlEffectivenessEngine';
import { evaluateEvidenceConfidence } from './evidenceEngine';
import { calculateResidualRiskScore } from './riskScoringEngine';

export type ExceptionEngineOptions = {
  appetiteConfig: AppetiteConfig;
  evidenceFreshnessDays?: number;
  vendorAssessmentMaxAgeDays?: number;
};

export function detectEnterpriseExceptions(
  risks: Risk[],
  options: ExceptionEngineOptions,
): EnterpriseExceptions {
  const evidenceFreshnessDays = Math.max(1, options.evidenceFreshnessDays ?? 90);
  const vendorAssessmentMaxAgeDays = Math.max(1, options.vendorAssessmentMaxAgeDays ?? 365);
  const now = Date.now();

  let risksOutsideAppetite = 0;
  let failedControls = 0;
  let expiringEvidence = 0;
  let auditBlockers = 0;
  let highRiskVendors = 0;

  risks.forEach((risk) => {
    const controls = evaluateControlEffectiveness(risk.controls);
    const residual = calculateResidualRiskScore(risk, controls.score);
    const appetite = evaluateRiskAppetite(
      risk,
      residual.normalizedScore,
      options.appetiteConfig,
    );

    if (appetite.status === 'Outside') {
      risksOutsideAppetite += 1;
    }

    failedControls += controls.failedControls;

    const evidence = evaluateEvidenceConfidence(risk.evidence, {
      freshnessDays: evidenceFreshnessDays,
    });
    expiringEvidence += evidence.expiredEvidence + evidence.missingEvidence + evidence.expiringSoon;

    auditBlockers += risk.issues.filter(
      (issue) =>
        issue.status !== 'closed' &&
        (issue.type === 'audit' || issue.status === 'blocked'),
    ).length;

    highRiskVendors += (risk.vendors || []).filter((vendor) => {
      const isHighTier = vendor.tier === 'high' || vendor.tier === 'critical';
      const staleAssessment =
        !vendor.lastAssessmentDate ||
        (now - vendor.lastAssessmentDate.getTime()) / 86400000 > vendorAssessmentMaxAgeDays;
      return isHighTier && staleAssessment;
    }).length;
  });

  return {
    risksOutsideAppetite,
    failedControls,
    expiringEvidence,
    auditBlockers,
    highRiskVendors,
  };
}
