import { evaluateRiskAppetite } from './appetiteEngine';
import { evaluateComplianceCoverage } from './complianceEngine';
import { evaluateControlEffectiveness } from './controlEffectivenessEngine';
import { evaluateEvidenceConfidence } from './evidenceEngine';
import { detectEnterpriseExceptions } from './exceptionEngine';
import {
  DEFAULT_FRAMEWORKS,
  aggregateFrameworkScores,
  normalizeFrameworkName,
} from './frameworkEngine';
import {
  calculateResidualRiskScore,
  calculateRiskExposureScore,
  calculateRiskSeverityScore,
} from './riskScoringEngine';

export type Risk = {
  id: string;
  category: string;
  inherent: { likelihood: number; impact: number };
  residual: { likelihood: number; impact: number };
  target?: { likelihood: number; impact: number };
  controls: Control[];
  evidence: Evidence[];
  issues: Issue[];
  vendors?: Vendor[];
  frameworks: FrameworkMapping[];
};

export type Control = {
  id: string;
  status: 'implemented' | 'in_progress' | 'not_implemented';
  effectiveness: number;
};

export type Evidence = {
  id: string;
  status: 'valid' | 'expired' | 'missing';
  lastUpdated: Date;
};

export type FrameworkMapping = {
  framework: string;
  controlId: string;
};

export type Issue = {
  id: string;
  status: 'open' | 'in_progress' | 'blocked' | 'closed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  type?: 'audit' | 'control' | 'risk' | 'vendor' | 'policy' | 'other';
};

export type Vendor = {
  id: string;
  name?: string;
  tier?: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  lastAssessmentDate?: Date;
};

export type AppetiteStatus = 'Within' | 'Outside';

export type EnterpriseExceptions = {
  risksOutsideAppetite: number;
  failedControls: number;
  expiringEvidence: number;
  auditBlockers: number;
  highRiskVendors: number;
};

export type FrameworkScores = Record<string, number>;

export type EnterpriseRiskEngineOutput = {
  enterpriseScore: number;
  trend: number;
  appetiteStatus: AppetiteStatus;
  topRiskDrivers: string[];
  topControlGaps: string[];
  frameworkScores: FrameworkScores;
  exceptions: EnterpriseExceptions;
};

export type RiskEngineWeights = {
  residualRisk: number;
  controlEffectiveness: number;
  evidenceConfidence: number;
  complianceCoverage: number;
  vendorRisk: number;
  auditReadiness: number;
  trainingScore: number;
};

export type AppetiteConfig = {
  defaultThreshold: number;
  categoryThresholds?: Partial<Record<string, number>>;
};

export type TrainingContext = {
  completionScore?: number;
};

export type AuditContext = {
  readinessScore?: number;
};

export type RiskEngineContext = {
  risks: Risk[];
  previousEnterpriseScore?: number;
  appetite?: Partial<AppetiteConfig>;
  training?: TrainingContext;
  audit?: AuditContext;
  weights?: Partial<RiskEngineWeights>;
  frameworks?: string[];
  evidenceFreshnessDays?: number;
  vendorAssessmentMaxAgeDays?: number;
};

export type RiskBreakdown = {
  riskId: string;
  category: string;
  inherentScore: number;
  exposureScore: number;
  residualScore: number;
  residualScoreNormalized: number;
  controlEffectivenessScore: number;
  evidenceConfidenceScore: number;
  complianceCoverageScore: number;
  appetiteStatus: AppetiteStatus;
  vendorRiskScore: number;
  auditReadinessScore: number;
  trainingScore: number;
};

export const DEFAULT_RISK_ENGINE_WEIGHTS: RiskEngineWeights = {
  residualRisk: 0.24,
  controlEffectiveness: 0.18,
  evidenceConfidence: 0.14,
  complianceCoverage: 0.14,
  vendorRisk: 0.1,
  auditReadiness: 0.1,
  trainingScore: 0.1,
};

export const DEFAULT_APPETITE_CONFIG: AppetiteConfig = {
  defaultThreshold: 45,
  categoryThresholds: {
    information_security: 40,
    privacy: 38,
    vendor: 42,
    compliance: 40,
    strategic: 50,
    operational: 48,
    ai: 35,
    financial: 42,
  },
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mergeWeights(overrides?: Partial<RiskEngineWeights>): RiskEngineWeights {
  return {
    ...DEFAULT_RISK_ENGINE_WEIGHTS,
    ...overrides,
  };
}

function mergeAppetiteConfig(overrides?: Partial<AppetiteConfig>): AppetiteConfig {
  return {
    defaultThreshold: overrides?.defaultThreshold ?? DEFAULT_APPETITE_CONFIG.defaultThreshold,
    categoryThresholds: {
      ...DEFAULT_APPETITE_CONFIG.categoryThresholds,
      ...(overrides?.categoryThresholds || {}),
    },
  };
}

function getVendorRiskScore(vendors: Vendor[] | undefined, vendorAssessmentMaxAgeDays: number): number {
  if (!vendors || vendors.length === 0) {
    return 100;
  }

  const now = Date.now();
  const scores = vendors.map((vendor) => {
    const baseScore =
      typeof vendor.riskScore === 'number'
        ? clamp(100 - vendor.riskScore)
        : vendor.tier === 'critical'
          ? 10
          : vendor.tier === 'high'
            ? 30
            : vendor.tier === 'medium'
              ? 65
              : 85;

    if (!vendor.lastAssessmentDate) {
      return Math.max(0, baseScore - 20);
    }

    const ageDays = (now - vendor.lastAssessmentDate.getTime()) / 86400000;
    if (ageDays <= vendorAssessmentMaxAgeDays) {
      return baseScore;
    }

    const penalty = Math.min(30, (ageDays - vendorAssessmentMaxAgeDays) * 0.35);
    return clamp(baseScore - penalty);
  });

  return round(average(scores));
}

function buildRiskBreakdown(
  risk: Risk,
  appetiteConfig: AppetiteConfig,
  frameworks: string[],
  evidenceFreshnessDays: number,
  vendorAssessmentMaxAgeDays: number,
  trainingScore: number,
  auditReadinessScore: number,
): RiskBreakdown {
  const controlEffectiveness = evaluateControlEffectiveness(risk.controls);
  const evidenceConfidence = evaluateEvidenceConfidence(risk.evidence, {
    freshnessDays: evidenceFreshnessDays,
  });
  const complianceCoverage = evaluateComplianceCoverage(risk, frameworks);
  const residualScore = calculateResidualRiskScore(risk, controlEffectiveness.score);
  const appetite = evaluateRiskAppetite(risk, residualScore.normalizedScore, appetiteConfig);
  const vendorRiskScore = getVendorRiskScore(risk.vendors, vendorAssessmentMaxAgeDays);

  return {
    riskId: risk.id,
    category: risk.category,
    inherentScore: calculateRiskSeverityScore(risk.inherent),
    exposureScore: calculateRiskExposureScore(risk),
    residualScore: residualScore.rawScore,
    residualScoreNormalized: residualScore.normalizedScore,
    controlEffectivenessScore: controlEffectiveness.score,
    evidenceConfidenceScore: evidenceConfidence.score,
    complianceCoverageScore: complianceCoverage.overallScore,
    appetiteStatus: appetite.status,
    vendorRiskScore,
    auditReadinessScore,
    trainingScore,
  };
}

function deriveTopRiskDrivers(breakdowns: RiskBreakdown[]): string[] {
  const categories = new Map<string, { count: number; total: number }>();

  breakdowns.forEach((item) => {
    const riskPressure =
      item.residualScoreNormalized * 0.45 +
      (100 - item.controlEffectivenessScore) * 0.2 +
      (100 - item.evidenceConfidenceScore) * 0.15 +
      (100 - item.vendorRiskScore) * 0.2;

    const current = categories.get(item.category) || { count: 0, total: 0 };
    current.count += 1;
    current.total += riskPressure;
    categories.set(item.category, current);
  });

  return [...categories.entries()]
    .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
    .slice(0, 5)
    .map(([category, data]) => `${category}: ${round(data.total / data.count)} risk pressure`);
}

function deriveTopControlGaps(risks: Risk[]): string[] {
  const missingControls = new Set<string>();
  const weakControls = new Set<string>();
  const evidenceGaps = new Set<string>();

  risks.forEach((risk) => {
    risk.controls.forEach((control) => {
      if (control.status !== 'implemented') {
        missingControls.add(control.id);
      }
      if (control.effectiveness < 60) {
        weakControls.add(control.id);
      }
    });

    if (risk.evidence.some((item) => item.status !== 'valid')) {
      evidenceGaps.add(risk.id);
    }
  });

  const gaps: string[] = [];

  if (missingControls.size > 0) {
    gaps.push(`${missingControls.size} controls not implemented`);
  }
  if (weakControls.size > 0) {
    gaps.push(`${weakControls.size} controls below effectiveness threshold`);
  }
  if (evidenceGaps.size > 0) {
    gaps.push(`${evidenceGaps.size} risks missing strong evidence support`);
  }

  return gaps.slice(0, 5);
}

function calculateEnterpriseScore(
  breakdowns: RiskBreakdown[],
  weights: RiskEngineWeights,
  trainingScore: number,
  auditReadinessScore: number,
): number {
  if (breakdowns.length === 0) {
    const weightSum = Object.values(weights).reduce((sum, value) => sum + value, 0);
    const emptyScore =
      100 * weights.residualRisk +
      100 * weights.controlEffectiveness +
      100 * weights.evidenceConfidence +
      100 * weights.complianceCoverage +
      100 * weights.vendorRisk +
      auditReadinessScore * weights.auditReadiness +
      trainingScore * weights.trainingScore;
    return round(clamp(emptyScore / weightSum));
  }

  const residualRiskScore = 100 - average(breakdowns.map((item) => item.residualScoreNormalized));
  const controlEffectivenessScore = average(breakdowns.map((item) => item.controlEffectivenessScore));
  const evidenceConfidenceScore = average(breakdowns.map((item) => item.evidenceConfidenceScore));
  const complianceCoverageScore = average(breakdowns.map((item) => item.complianceCoverageScore));
  const vendorRiskScore = average(breakdowns.map((item) => item.vendorRiskScore));

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const score =
    residualRiskScore * weights.residualRisk +
    controlEffectivenessScore * weights.controlEffectiveness +
    evidenceConfidenceScore * weights.evidenceConfidence +
    complianceCoverageScore * weights.complianceCoverage +
    vendorRiskScore * weights.vendorRisk +
    auditReadinessScore * weights.auditReadiness +
    trainingScore * weights.trainingScore;

  return round(clamp(score / totalWeight));
}

export function createEnterpriseRiskPosture(context: RiskEngineContext): EnterpriseRiskEngineOutput {
  const weights = mergeWeights(context.weights);
  const appetiteConfig = mergeAppetiteConfig(context.appetite);
  const frameworks = (context.frameworks && context.frameworks.length > 0
    ? context.frameworks
    : DEFAULT_FRAMEWORKS
  ).map(normalizeFrameworkName);
  const trainingScore = clamp(context.training?.completionScore ?? 75);
  const auditReadinessScore = clamp(context.audit?.readinessScore ?? 70);
  const evidenceFreshnessDays = Math.max(1, context.evidenceFreshnessDays ?? 90);
  const vendorAssessmentMaxAgeDays = Math.max(1, context.vendorAssessmentMaxAgeDays ?? 365);

  const breakdowns = context.risks.map((risk) =>
    buildRiskBreakdown(
      risk,
      appetiteConfig,
      frameworks,
      evidenceFreshnessDays,
      vendorAssessmentMaxAgeDays,
      trainingScore,
      auditReadinessScore,
    ),
  );

  const enterpriseScore = calculateEnterpriseScore(
    breakdowns,
    weights,
    trainingScore,
    auditReadinessScore,
  );

  const risksOutsideAppetite = breakdowns.filter((item) => item.appetiteStatus === 'Outside').length;
  const appetiteStatus: AppetiteStatus = risksOutsideAppetite > 0 ? 'Outside' : 'Within';
  const frameworkScores = aggregateFrameworkScores(context.risks, frameworks);
  const exceptions = detectEnterpriseExceptions(context.risks, {
    appetiteConfig,
    evidenceFreshnessDays,
    vendorAssessmentMaxAgeDays,
  });

  return {
    enterpriseScore,
    trend: round(enterpriseScore - (context.previousEnterpriseScore ?? enterpriseScore)),
    appetiteStatus,
    topRiskDrivers: deriveTopRiskDrivers(breakdowns),
    topControlGaps: deriveTopControlGaps(context.risks),
    frameworkScores,
    exceptions,
  };
}
