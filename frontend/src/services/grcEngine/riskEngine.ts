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
  metadata?: {
    title?: string;
    status?: string;
    severity?: string;
  };
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

export type RiskEngineContext = {
  risks: Risk[];
  previousEnterpriseScore?: number;
  appetite?: Partial<AppetiteConfig>;
  training?: { completionScore?: number };
  audit?: { readinessScore?: number };
  weights?: Partial<RiskEngineWeights>;
  frameworks?: string[];
  evidenceFreshnessDays?: number;
  vendorAssessmentMaxAgeDays?: number;
};

export type EnterpriseRiskPosture = {
  enterpriseScore: number;
  trend: number;
  appetiteStatus: AppetiteStatus;
  topRiskDrivers: string[];
  topControlGaps: string[];
  frameworkScores: Record<string, number>;
  exceptions: EnterpriseExceptions;
};

export type RiskEvaluation = {
  residualScore: number;
  appetiteStatus: AppetiteStatus;
  frameworkScore: number;
  controlEffectivenessScore: number;
  evidenceConfidenceScore: number;
  vendorRiskScore: number;
};

const DEFAULT_FRAMEWORKS = [
  'CIS',
  'COBIT',
  'CUSTOM',
  'EU_AI_ACT',
  'GDPR',
  'HIPAA',
  'HITRUST',
  'ISO27001',
  'ISO27701',
  'ISO42001',
  'NIST_800_53',
  'NIST_CSF',
  'PCI_DSS',
  'SOC1',
  'SOC2',
] as const;

const FRAMEWORK_ALIASES: Record<string, string> = {
  'CIS Controls': 'CIS',
  CIS: 'CIS',
  COBIT: 'COBIT',
  Custom: 'CUSTOM',
  CUSTOM: 'CUSTOM',
  'EU AI Act': 'EU_AI_ACT',
  EU_AI_ACT: 'EU_AI_ACT',
  GDPR: 'GDPR',
  HIPAA: 'HIPAA',
  'HITRUST CSF': 'HITRUST',
  HITRUST: 'HITRUST',
  'ISO 27001': 'ISO27001',
  ISO27001: 'ISO27001',
  'ISO 27701': 'ISO27701',
  ISO27701: 'ISO27701',
  'ISO 42001 (AI)': 'ISO42001',
  'ISO 42001': 'ISO42001',
  ISO42001: 'ISO42001',
  'NIST 800-53': 'NIST_800_53',
  NIST_800_53: 'NIST_800_53',
  'NIST CSF': 'NIST_CSF',
  NIST_CSF: 'NIST_CSF',
  'PCI DSS': 'PCI_DSS',
  PCI_DSS: 'PCI_DSS',
  'SOC 1': 'SOC1',
  SOC1: 'SOC1',
  'SOC 2': 'SOC2',
  SOC2: 'SOC2',
};

const DEFAULT_WEIGHTS: RiskEngineWeights = {
  residualRisk: 0.24,
  controlEffectiveness: 0.18,
  evidenceConfidence: 0.14,
  complianceCoverage: 0.14,
  vendorRisk: 0.1,
  auditReadiness: 0.1,
  trainingScore: 0.1,
};

const DEFAULT_APPETITE: AppetiteConfig = {
  defaultThreshold: 45,
  categoryThresholds: {
    information_security: 40,
    privacy: 38,
    vendor: 42,
    operational: 48,
    compliance: 40,
    strategic: 50,
    ai: 35,
    financial: 42,
  },
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeLikelihoodOrImpact(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function normalizeFrameworkName(framework: string): string {
  const trimmed = framework.trim();
  return FRAMEWORK_ALIASES[trimmed] || trimmed.replace(/\s+/g, '_').toUpperCase();
}

function calculateSeverityScore(vector: { likelihood: number; impact: number }): number {
  return normalizeLikelihoodOrImpact(vector.likelihood) * normalizeLikelihoodOrImpact(vector.impact);
}

function normalizeTo100(score: number): number {
  return clamp((score / 25) * 100);
}

function evaluateControlEffectiveness(controls: Control[]) {
  if (controls.length === 0) {
    return { score: 0, failedControls: 0 };
  }

  const implementedPercentage =
    (controls.filter((control) => control.status === 'implemented').length / controls.length) * 100;
  const effectivenessAverage =
    controls.reduce((sum, control) => sum + clamp(control.effectiveness), 0) / controls.length;
  const failedControls = controls.filter(
    (control) => control.status !== 'implemented' || control.effectiveness < 50,
  ).length;

  return {
    score: round(implementedPercentage * 0.45 + effectivenessAverage * 0.55),
    failedControls,
  };
}

function evaluateEvidenceConfidence(evidence: Evidence[], freshnessDays: number) {
  if (evidence.length === 0) {
    return { score: 0, expired: 0, missing: 0, expiringSoon: 0 };
  }

  const now = Date.now();
  let valid = 0;
  let expired = 0;
  let missing = 0;
  let expiringSoon = 0;

  evidence.forEach((item) => {
    if (item.status === 'missing') {
      missing += 1;
      return;
    }
    if (item.status === 'expired') {
      expired += 1;
      return;
    }

    const ageDays = (now - item.lastUpdated.getTime()) / 86400000;
    if (ageDays > freshnessDays) {
      expired += 1;
      return;
    }
    if (ageDays > freshnessDays * 0.75) {
      expiringSoon += 1;
    }
    valid += 1;
  });

  const score =
    (valid / evidence.length) * 100 -
    (expired / evidence.length) * 35 -
    (missing / evidence.length) * 45 -
    (expiringSoon / evidence.length) * 10;

  return {
    score: round(clamp(score)),
    expired,
    missing,
    expiringSoon,
  };
}

function evaluateComplianceCoverage(risk: Risk, frameworks: string[]) {
  const implementedControls = new Set(
    risk.controls.filter((control) => control.status === 'implemented').map((control) => control.id),
  );
  const normalizedFrameworks = frameworks.map(normalizeFrameworkName);
  const scores = normalizedFrameworks.map((framework) => {
    const mappings = risk.frameworks.filter(
      (mapping) => normalizeFrameworkName(mapping.framework) === framework,
    );
    if (mappings.length === 0) return { framework, score: 0, total: 0 };
    const implemented = mappings.filter((mapping) => implementedControls.has(mapping.controlId)).length;
    return {
      framework,
      score: round((implemented / mappings.length) * 100),
      total: mappings.length,
    };
  });

  const activeScores = scores.filter((score) => score.total > 0).map((score) => score.score);
  return {
    score: activeScores.length > 0 ? round(average(activeScores)) : 0,
    byFramework: scores,
  };
}

function calculateResidualRisk(risk: Risk, controlEffectivenessScore: number) {
  const inherentScore = calculateSeverityScore(risk.inherent);
  const statedResidual = calculateSeverityScore(risk.residual);
  const modeledResidual = inherentScore * clamp(1 - controlEffectivenessScore / 100, 0.05, 1);
  const weightedResidual = statedResidual * 0.55 + modeledResidual * 0.45;
  return {
    raw: round(weightedResidual),
    normalized: round(normalizeTo100(weightedResidual)),
  };
}

function evaluateVendorRisk(vendors: Vendor[] | undefined, maxAgeDays: number) {
  if (!vendors || vendors.length === 0) {
    return 100;
  }

  const now = Date.now();
  const scores = vendors.map((vendor) => {
    const base =
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
      return Math.max(0, base - 20);
    }

    const ageDays = (now - vendor.lastAssessmentDate.getTime()) / 86400000;
    if (ageDays <= maxAgeDays) {
      return base;
    }

    return clamp(base - Math.min(30, (ageDays - maxAgeDays) * 0.35));
  });

  return round(average(scores));
}

function resolveAppetiteThreshold(risk: Risk, appetiteConfig: AppetiteConfig) {
  return appetiteConfig.categoryThresholds?.[risk.category.trim().toLowerCase()] ?? appetiteConfig.defaultThreshold;
}

export function evaluateRiskAppetiteStatus(
  risk: Risk,
  options?: {
    appetite?: Partial<AppetiteConfig>;
    frameworks?: string[];
    evidenceFreshnessDays?: number;
    vendorAssessmentMaxAgeDays?: number;
  },
): RiskEvaluation {
  const appetite = {
    defaultThreshold: options?.appetite?.defaultThreshold ?? DEFAULT_APPETITE.defaultThreshold,
    categoryThresholds: {
      ...DEFAULT_APPETITE.categoryThresholds,
      ...(options?.appetite?.categoryThresholds || {}),
    },
  };
  const frameworks = (options?.frameworks && options.frameworks.length > 0
    ? options.frameworks
    : [...new Set(risk.frameworks.map((mapping) => normalizeFrameworkName(mapping.framework)))]
  ).map(normalizeFrameworkName);

  const controlEffectiveness = evaluateControlEffectiveness(risk.controls);
  const evidence = evaluateEvidenceConfidence(risk.evidence, Math.max(1, options?.evidenceFreshnessDays ?? 90));
  const compliance = evaluateComplianceCoverage(risk, frameworks);
  const residual = calculateResidualRisk(risk, controlEffectiveness.score);
  const vendorRiskScore = evaluateVendorRisk(risk.vendors, Math.max(1, options?.vendorAssessmentMaxAgeDays ?? 365));
  const threshold = resolveAppetiteThreshold(risk, appetite);

  return {
    residualScore: residual.normalized,
    appetiteStatus: residual.normalized > threshold ? 'Outside' : 'Within',
    frameworkScore: compliance.score,
    controlEffectivenessScore: controlEffectiveness.score,
    evidenceConfidenceScore: evidence.score,
    vendorRiskScore,
  };
}

function detectExceptions(
  risks: Risk[],
  appetite: AppetiteConfig,
  frameworks: string[],
  evidenceFreshnessDays: number,
  vendorAssessmentMaxAgeDays: number,
): EnterpriseExceptions {
  let risksOutsideAppetite = 0;
  let failedControls = 0;
  let expiringEvidence = 0;
  let auditBlockers = 0;
  let highRiskVendors = 0;

  risks.forEach((risk) => {
    const evaluation = evaluateRiskAppetiteStatus(risk, {
      appetite,
      frameworks,
      evidenceFreshnessDays,
      vendorAssessmentMaxAgeDays,
    });
    if (evaluation.appetiteStatus === 'Outside') {
      risksOutsideAppetite += 1;
    }

    failedControls += risk.controls.filter(
      (control) => control.status !== 'implemented' || control.effectiveness < 50,
    ).length;

    const evidence = evaluateEvidenceConfidence(risk.evidence, evidenceFreshnessDays);
    expiringEvidence += evidence.expired + evidence.missing + evidence.expiringSoon;

    auditBlockers += risk.issues.filter(
      (issue) => issue.status !== 'closed' && (issue.type === 'audit' || issue.status === 'blocked'),
    ).length;

    highRiskVendors += (risk.vendors || []).filter((vendor) => {
      const isHighTier = vendor.tier === 'high' || vendor.tier === 'critical';
      const staleAssessment =
        !vendor.lastAssessmentDate ||
        (Date.now() - vendor.lastAssessmentDate.getTime()) / 86400000 > vendorAssessmentMaxAgeDays;
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

function deriveTopRiskDrivers(risks: Risk[], appetite: AppetiteConfig, frameworks: string[]) {
  const pressure = new Map<string, number[]>();

  risks.forEach((risk) => {
    const evaluation = evaluateRiskAppetiteStatus(risk, { appetite, frameworks });
    const score =
      evaluation.residualScore * 0.45 +
      (100 - evaluation.controlEffectivenessScore) * 0.2 +
      (100 - evaluation.evidenceConfidenceScore) * 0.15 +
      (100 - evaluation.vendorRiskScore) * 0.2;
    const values = pressure.get(risk.category) || [];
    values.push(score);
    pressure.set(risk.category, values);
  });

  return [...pressure.entries()]
    .map(([category, scores]) => ({
      category,
      score: average(scores),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((item) => `${item.category}: ${round(item.score)} risk pressure`);
}

function deriveTopControlGaps(risks: Risk[]) {
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
  if (missingControls.size > 0) gaps.push(`${missingControls.size} controls not implemented`);
  if (weakControls.size > 0) gaps.push(`${weakControls.size} controls below effectiveness threshold`);
  if (evidenceGaps.size > 0) gaps.push(`${evidenceGaps.size} risks missing strong evidence support`);
  return gaps.slice(0, 5);
}

export function createEnterpriseRiskPosture(
  context: RiskEngineContext,
): EnterpriseRiskPosture {
  const appetite = {
    defaultThreshold: context.appetite?.defaultThreshold ?? DEFAULT_APPETITE.defaultThreshold,
    categoryThresholds: {
      ...DEFAULT_APPETITE.categoryThresholds,
      ...(context.appetite?.categoryThresholds || {}),
    },
  };
  const weights = { ...DEFAULT_WEIGHTS, ...(context.weights || {}) };
  const frameworks = (context.frameworks && context.frameworks.length > 0
    ? context.frameworks
    : DEFAULT_FRAMEWORKS
  ).map(normalizeFrameworkName);
  const evidenceFreshnessDays = Math.max(1, context.evidenceFreshnessDays ?? 90);
  const vendorAssessmentMaxAgeDays = Math.max(1, context.vendorAssessmentMaxAgeDays ?? 365);
  const trainingScore = clamp(context.training?.completionScore ?? 75);
  const auditScore = clamp(context.audit?.readinessScore ?? 70);

  const evaluated = context.risks.map((risk) => evaluateRiskAppetiteStatus(risk, {
    appetite,
    frameworks,
    evidenceFreshnessDays,
    vendorAssessmentMaxAgeDays,
  }));

  const residualComponent = 100 - average(evaluated.map((item) => item.residualScore));
  const controlComponent = average(evaluated.map((item) => item.controlEffectivenessScore));
  const evidenceComponent = average(evaluated.map((item) => item.evidenceConfidenceScore));
  const complianceComponent = average(evaluated.map((item) => item.frameworkScore));
  const vendorComponent = average(evaluated.map((item) => item.vendorRiskScore));
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);

  const enterpriseScore = round(
    clamp(
      (
        residualComponent * weights.residualRisk +
        controlComponent * weights.controlEffectiveness +
        evidenceComponent * weights.evidenceConfidence +
        complianceComponent * weights.complianceCoverage +
        vendorComponent * weights.vendorRisk +
        auditScore * weights.auditReadiness +
        trainingScore * weights.trainingScore
      ) / totalWeight,
    ),
  );

  const frameworkScores = frameworks.reduce<Record<string, number>>((accumulator, framework) => {
    const scores = context.risks
      .map((risk) => evaluateComplianceCoverage(risk, [framework]).score)
      .filter((score) => score > 0);
    accumulator[framework] = scores.length > 0 ? round(average(scores)) : 0;
    return accumulator;
  }, {});

  const exceptions = detectExceptions(
    context.risks,
    appetite,
    frameworks,
    evidenceFreshnessDays,
    vendorAssessmentMaxAgeDays,
  );

  return {
    enterpriseScore,
    trend: round(enterpriseScore - (context.previousEnterpriseScore ?? enterpriseScore)),
    appetiteStatus: exceptions.risksOutsideAppetite > 0 ? 'Outside' : 'Within',
    topRiskDrivers: deriveTopRiskDrivers(context.risks, appetite, frameworks),
    topControlGaps: deriveTopControlGaps(context.risks),
    frameworkScores,
    exceptions,
  };
}
