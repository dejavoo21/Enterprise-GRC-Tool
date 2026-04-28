import type { ControlWithFrameworks } from '@/types/control';
import type { EvidenceItem } from '@/types/evidence';
import {
  RISK_CATEGORY_LABELS,
  RISK_STATUS_LABELS,
  type Risk as AppRisk,
} from '@/types/risk';
import type { VendorRiskAssessment } from '@/types/tprm';
import type { DashboardIssue, DashboardVendor } from '@/services/grcEngine/dashboardRiskAdapter';
import {
  evaluateRiskAppetiteStatus,
  type EnterpriseRiskPosture,
  type Risk as EngineRisk,
} from '@/services/grcEngine/riskEngine';
import type { Tone } from '@/pages/dashboard/DashboardSections';

export type Snapshot = {
  score: number;
  risksOutsideAppetite: number;
  failedControls: number;
  expiringEvidence: number;
  highRiskVendors: number;
  coverage: number;
};

export type AppetiteRow = {
  label: string;
  appetiteLevel: string;
  threshold: number;
  residualScore: number;
  variance: number;
  status: 'Within Appetite' | 'Breaching' | 'Exceeded';
  owner: string;
  nextAction: string;
};

export type WeightedFactor = {
  label: string;
  weight: number;
  score: number;
  contribution: number;
};

export type WeightedRiskProfile = {
  factors: WeightedFactor[];
  finalScore: number;
  driverExplanation: string;
};

export type InfoSecRow = {
  label: string;
  linkedRisks: number;
  controlGaps: number;
  evidenceGaps: number;
  remediation: number;
  status: Tone;
};

export type RemediationRow = {
  id: string;
  action: string;
  owner: string;
  linkedRisk: string;
  residualScore: number;
  targetScore: number;
  dueDate: string;
  progress: number;
  status: 'Overdue' | 'Due Soon' | 'In Progress' | 'Blocked';
  escalation: string;
};

export type FrameworkRow = {
  framework: string;
  coverage: number;
  controlsMapped: number;
  evidenceAvailable: number;
  risksLinked: number;
  appetiteBreaches: number;
  posture: Tone;
};

export type ChangeSignal = {
  label: string;
  delta: number;
  action: string;
  tone: Tone;
};

export type DashboardDecision = {
  label: string;
  count: number;
  reason: string;
  owner: string;
  nextAction: string;
  tone: Tone;
};

export type PriorityRiskRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  severity: string;
  residual: string;
  appetiteStatus: 'Within' | 'Outside';
  residualScore: number;
};

export type CompactKpi = {
  title: string;
  metric: string | number;
  trend: string;
  status: Tone;
  driver: string;
  action: string;
  path: string;
};

export type DashboardMetrics = {
  complianceCoverage: number;
  criticalIssueCount: number;
  remediationProgress: number;
  vendorExposure: 'Low' | 'Medium' | 'High';
  inherentAverage: number;
  residualAverage: number;
  targetAverage: number;
  appetiteThresholdAverage: number;
  kpis: CompactKpi[];
  decisions: DashboardDecision[];
  priorityRisks: PriorityRiskRow[];
};

export type MetricsInput = {
  controls: ControlWithFrameworks[];
  risks: AppRisk[];
  evidence: EvidenceItem[];
  issues: DashboardIssue[];
  vendors: DashboardVendor[];
  vendorAssessments: VendorRiskAssessment[];
  enterprisePosture: EnterpriseRiskPosture;
  filteredEngineRisks: EngineRisk[];
  selectedFrameworks: string[];
  previousSnapshot: Snapshot | null;
  auditAverage: number;
  trainingCompletion: number;
  frameworkOptions: Array<{ value: string; label: string }>;
};

const APPETITE_CATEGORIES = [
  { key: 'information_security', label: 'Information Security', threshold: 40, owner: 'Security Leadership' },
  { key: 'privacy', label: 'Privacy', threshold: 38, owner: 'Privacy Office' },
  { key: 'vendor', label: 'Third Party', threshold: 42, owner: 'TPRM Lead' },
  { key: 'compliance', label: 'Compliance', threshold: 40, owner: 'Compliance Lead' },
  { key: 'operational', label: 'Operational', threshold: 48, owner: 'Operations' },
  { key: 'ai_governance', label: 'AI Governance', threshold: 35, owner: 'AI Governance Board' },
  { key: 'financial', label: 'Financial / Reporting', threshold: 42, owner: 'Finance Controls' },
] as const;

const INFOSEC_AREAS = [
  { label: 'Access Control', terms: ['access', 'identity', 'privileged', 'authentication'] },
  { label: 'Asset Management', terms: ['asset', 'inventory', 'device', 'endpoint'] },
  { label: 'Vulnerability Management', terms: ['vulnerability', 'patch', 'configuration', 'exposure'] },
  { label: 'Incident Management', terms: ['incident', 'detection', 'response', 'monitor'] },
  { label: 'Supplier Security', terms: ['vendor', 'supplier', 'third', 'subprocessor'] },
  { label: 'Data Protection', terms: ['privacy', 'data', 'gdpr', 'classification'] },
  { label: 'Business Continuity', terms: ['continuity', 'recovery', 'resilience', 'availability'] },
  { label: 'Awareness & Training', terms: ['training', 'awareness', 'phishing', 'human'] },
] as const;

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function scoreFromLikelihoodImpact(likelihood: number, impact: number) {
  return Math.max(1, Math.min(25, Math.round(likelihood) * Math.round(impact)));
}

function normalizeRiskScore(score: number) {
  return Math.round((score / 25) * 100);
}

function matchesArea(text: string, terms: readonly string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function getFrameworkDisplayName(
  key: string,
  options: Array<{ value: string; label: string }>,
) {
  const match = options.find(
    (option) =>
      option.value === key ||
      option.value.toUpperCase().replace(/\s+/g, '_') === key,
  );
  return match?.label || titleCase(key);
}

function getVendorExposure(highRiskVendors: number): 'Low' | 'Medium' | 'High' {
  if (highRiskVendors >= 3) return 'High';
  if (highRiskVendors >= 1) return 'Medium';
  return 'Low';
}

function getRiskStatusTone(score: number) {
  if (score >= 75) return 'critical' as Tone;
  if (score >= 55) return 'warning' as Tone;
  return 'success' as Tone;
}

export function buildAppetiteRows(
  filteredEngineRisks: EngineRisk[],
  selectedFrameworks: string[],
): AppetiteRow[] {
  return APPETITE_CATEGORIES.map((category) => {
    const categoryRisks = filteredEngineRisks.filter((risk) =>
      category.key === 'ai_governance'
        ? risk.frameworks.some((mapping) => mapping.framework === 'EU AI Act' || mapping.framework === 'ISO 42001 (AI)')
        : category.key === 'financial'
          ? risk.category === 'strategic' || risk.category === 'compliance'
          : risk.category === category.key,
    );
    const residualScore = avg(
      categoryRisks.map((risk) =>
        evaluateRiskAppetiteStatus(risk, { frameworks: selectedFrameworks }).residualScore,
      ),
    );
    const variance = residualScore - category.threshold;
    const status: AppetiteRow['status'] =
      variance > 10 ? 'Exceeded' : variance > 0 ? 'Breaching' : 'Within Appetite';
    return {
      label: category.label,
      appetiteLevel: category.threshold <= 38 ? 'Conservative' : category.threshold <= 42 ? 'Moderate' : 'Measured',
      threshold: category.threshold,
      residualScore,
      variance,
      status,
      owner: category.owner,
      nextAction:
        status === 'Exceeded'
          ? 'Escalate and accelerate plan'
          : status === 'Breaching'
            ? 'Open treatment plan'
            : 'Maintain cadence',
    };
  }).sort((left, right) => {
    if (left.status === right.status) {
      return right.residualScore - left.residualScore;
    }
    if (left.status === 'Exceeded') return -1;
    if (right.status === 'Exceeded') return 1;
    if (left.status === 'Breaching') return -1;
    if (right.status === 'Breaching') return 1;
    return 0;
  });
}

export function buildWeightedRiskProfile(input: {
  controls: ControlWithFrameworks[];
  risks: AppRisk[];
  evidence: EvidenceItem[];
  vendors: DashboardVendor[];
  enterprisePosture: EnterpriseRiskPosture;
  filteredEngineRisks: EngineRisk[];
  auditAverage: number;
  complianceCoverage: number;
}): WeightedRiskProfile {
  const { controls, risks, evidence, vendors, enterprisePosture, filteredEngineRisks, auditAverage, complianceCoverage } = input;
  const notImplemented = controls.filter((control) => control.status === 'not_implemented').length;
  const inProgress = controls.filter((control) => control.status === 'in_progress').length;
  const factors: WeightedFactor[] = [
    {
      label: 'Likelihood weight',
      weight: 0.18,
      score: avg(filteredEngineRisks.map((risk) => Math.round((risk.residual.likelihood / 5) * 100))),
      contribution: 0,
    },
    {
      label: 'Impact weight',
      weight: 0.2,
      score: avg(filteredEngineRisks.map((risk) => Math.round((risk.residual.impact / 5) * 100))),
      contribution: 0,
    },
    {
      label: 'Asset criticality weight',
      weight: 0.15,
      score: clamp(risks.length ? (risks.filter((risk) => ['critical', 'high'].includes(risk.severity)).length / risks.length) * 100 : 0),
      contribution: 0,
    },
    {
      label: 'Control weakness weight',
      weight: 0.15,
      score: clamp(controls.length ? ((notImplemented + inProgress) / controls.length) * 100 : 0),
      contribution: 0,
    },
    {
      label: 'Evidence confidence weight',
      weight: 0.1,
      score: clamp((enterprisePosture.exceptions.expiringEvidence / Math.max(1, evidence.length || 1)) * 100),
      contribution: 0,
    },
    {
      label: 'Vendor exposure weight',
      weight: 0.1,
      score: clamp(vendors.length ? (enterprisePosture.exceptions.highRiskVendors / vendors.length) * 100 : 0),
      contribution: 0,
    },
    {
      label: 'Regulatory impact weight',
      weight: 0.12,
      score: clamp(100 - avg([complianceCoverage, auditAverage])),
      contribution: 0,
    },
  ].map((factor) => ({
    ...factor,
    contribution: Math.round(factor.score * factor.weight),
  }));

  const finalScore = Math.round(factors.reduce((sum, factor) => sum + factor.contribution, 0));
  return {
    factors,
    finalScore,
    driverExplanation:
      finalScore >= 70
        ? 'Priority is high because impact, control weakness, and regulatory exposure are elevated.'
        : finalScore >= 50
          ? 'Priority is moderate because residual exposure and assurance weakness require treatment.'
          : 'Priority is lower because residual exposure is trending within manageable operating levels.',
  };
}

export function buildInfoSecRows(input: {
  controls: ControlWithFrameworks[];
  risks: AppRisk[];
  evidence: EvidenceItem[];
}): InfoSecRow[] {
  const { controls, risks, evidence } = input;
  return INFOSEC_AREAS.map((area) => {
    const linkedRisks = risks.filter((risk) =>
      matchesArea(`${risk.title} ${risk.description} ${risk.category}`, area.terms),
    );
    const linkedControls = controls.filter((control) =>
      matchesArea(`${control.title} ${control.description} ${control.domain || ''}`, area.terms),
    );
    const relatedEvidence = evidence.filter((item) =>
      matchesArea(`${item.name} ${item.description || ''} ${item.type}`, area.terms),
    );
    const treated = linkedRisks.filter((risk) =>
      ['treated', 'accepted', 'closed'].includes(risk.status),
    ).length;
    const remediation = clamp(linkedRisks.length ? (treated / linkedRisks.length) * 100 : 100);
    return {
      label: area.label,
      linkedRisks: linkedRisks.length,
      controlGaps: linkedControls.filter((control) => control.status !== 'implemented').length,
      evidenceGaps: Math.max(0, linkedControls.length - relatedEvidence.length),
      remediation,
      status: remediation >= 75 ? 'success' : remediation >= 50 ? 'warning' : 'critical',
    };
  });
}

export function buildRemediationRows(input: {
  risks: AppRisk[];
  filteredEngineRisks: EngineRisk[];
}): RemediationRow[] {
  return input.risks
    .map((risk) => {
      const engineRisk = input.filteredEngineRisks.find((item) => item.id === risk.id);
      if (!engineRisk) return null;
      const residualScore = normalizeRiskScore(
        scoreFromLikelihoodImpact(engineRisk.residual.likelihood, engineRisk.residual.impact),
      );
      const targetScore = normalizeRiskScore(
        scoreFromLikelihoodImpact(
          (engineRisk.target || engineRisk.residual).likelihood,
          (engineRisk.target || engineRisk.residual).impact,
        ),
      );
      const inherentScore = normalizeRiskScore(
        scoreFromLikelihoodImpact(engineRisk.inherent.likelihood, engineRisk.inherent.impact),
      );
      const progress = clamp(
        inherentScore === targetScore
          ? 100
          : ((inherentScore - residualScore) / Math.max(1, inherentScore - targetScore)) * 100,
      );
      const dueDate = risk.dueDate ? new Date(risk.dueDate) : null;
      const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
      const status: RemediationRow['status'] =
        daysUntilDue === null
          ? 'Blocked'
          : daysUntilDue < 0
            ? 'Overdue'
            : daysUntilDue <= 30
              ? 'Due Soon'
              : 'In Progress';
      return {
        id: risk.id,
        action: risk.treatmentPlan || `Reduce ${risk.title} to target threshold`,
        owner: risk.owner,
        linkedRisk: risk.title,
        residualScore,
        targetScore,
        dueDate: risk.dueDate || 'No due date',
        progress,
        status,
        escalation:
          status === 'Overdue'
            ? 'Escalate to leadership'
            : status === 'Blocked'
              ? 'Resolve dependency'
              : progress < 50
                ? 'Increase treatment pace'
                : 'Track to target',
      };
    })
    .filter((row): row is RemediationRow => Boolean(row));
}

export function buildFrameworkRows(input: {
  controls: ControlWithFrameworks[];
  evidence: EvidenceItem[];
  filteredEngineRisks: EngineRisk[];
  frameworkScores: Record<string, number>;
  frameworkOptions: Array<{ value: string; label: string }>;
  selectedFramework: string;
}): FrameworkRow[] {
  const frameworks =
    input.selectedFramework === 'ALL'
      ? input.frameworkOptions.map((option) => option.label).filter((label) => label !== 'All Frameworks')
      : [input.selectedFramework];

  return frameworks
    .map((framework) => {
      const controlsMapped = input.controls.filter((control) => control.frameworks?.includes(framework)).length;
      const linkedRiskIds = new Set(
        input.filteredEngineRisks
          .filter((risk) => risk.frameworks.some((mapping) => mapping.framework === framework))
          .map((risk) => risk.id),
      );
      const evidenceAvailable = input.evidence.filter(
        (item) =>
          (item.controlId &&
            input.controls.some((control) => control.id === item.controlId && control.frameworks?.includes(framework))) ||
          (item.riskId && linkedRiskIds.has(item.riskId)),
      ).length;
      const appetiteBreaches = input.filteredEngineRisks.filter(
        (risk) =>
          risk.frameworks.some((mapping) => mapping.framework === framework) &&
          evaluateRiskAppetiteStatus(risk, { frameworks: [framework] }).appetiteStatus === 'Outside',
      ).length;
      const scoreKey = Object.keys(input.frameworkScores).find(
        (key) => getFrameworkDisplayName(key, input.frameworkOptions) === framework,
      );
      const coverage = scoreKey ? input.frameworkScores[scoreKey] : 0;
      return {
        framework,
        coverage,
        controlsMapped,
        evidenceAvailable,
        risksLinked: linkedRiskIds.size,
        appetiteBreaches,
        posture: (coverage >= 75 ? 'success' : coverage >= 55 ? 'warning' : 'critical') as Tone,
      };
    })
    .filter((row) => row.coverage > 0 || row.controlsMapped > 0 || row.risksLinked > 0)
    .sort((left, right) => right.coverage - left.coverage);
}

export function buildChangeSignals(input: {
  enterprisePosture: EnterpriseRiskPosture;
  previousSnapshot: Snapshot | null;
  complianceCoverage: number;
}): ChangeSignal[] {
  const previous = input.previousSnapshot;
  return [
    {
      label: 'New risks outside appetite',
      delta: input.enterprisePosture.exceptions.risksOutsideAppetite - (previous?.risksOutsideAppetite || 0),
      action: 'View risks',
      tone:
        input.enterprisePosture.exceptions.risksOutsideAppetite > (previous?.risksOutsideAppetite || 0)
          ? 'critical'
          : 'success',
    },
    {
      label: 'Controls moved to ineffective',
      delta: input.enterprisePosture.exceptions.failedControls - (previous?.failedControls || 0),
      action: 'Review controls',
      tone:
        input.enterprisePosture.exceptions.failedControls > (previous?.failedControls || 0)
          ? 'warning'
          : 'success',
    },
    {
      label: 'Evidence expired',
      delta: input.enterprisePosture.exceptions.expiringEvidence - (previous?.expiringEvidence || 0),
      action: 'Request evidence',
      tone:
        input.enterprisePosture.exceptions.expiringEvidence > (previous?.expiringEvidence || 0)
          ? 'warning'
          : 'success',
    },
    {
      label: 'Vendor assessment overdue',
      delta: input.enterprisePosture.exceptions.highRiskVendors - (previous?.highRiskVendors || 0),
      action: 'Reassess vendor',
      tone:
        input.enterprisePosture.exceptions.highRiskVendors > (previous?.highRiskVendors || 0)
          ? 'warning'
          : 'success',
    },
    {
      label: 'Framework coverage changed',
      delta: input.complianceCoverage - (previous?.coverage || 0),
      action: 'Review framework posture',
      tone: input.complianceCoverage < (previous?.coverage || 0) ? 'warning' : 'success',
    },
  ];
}

export function buildDashboardMetrics(input: MetricsInput): DashboardMetrics {
  const complianceCoverage = clamp(
    avg(Object.values(input.enterprisePosture.frameworkScores).filter((value) => value > 0)),
  );
  const criticalIssueCount = input.issues.filter(
    (issue) => issue.priority === 'Critical' && issue.status !== 'Resolved',
  ).length;
  const remediationProgress = clamp(
    input.risks.length
      ? (input.risks.filter((risk) => ['treated', 'accepted', 'closed'].includes(risk.status)).length /
          input.risks.length) *
          100
      : 0,
  );
  const inherentAverage = avg(
    input.filteredEngineRisks.map((risk) =>
      normalizeRiskScore(scoreFromLikelihoodImpact(risk.inherent.likelihood, risk.inherent.impact)),
    ),
  );
  const residualAverage = avg(
    input.filteredEngineRisks.map((risk) =>
      normalizeRiskScore(scoreFromLikelihoodImpact(risk.residual.likelihood, risk.residual.impact)),
    ),
  );
  const targetAverage = avg(
    input.filteredEngineRisks.map((risk) =>
      normalizeRiskScore(
        scoreFromLikelihoodImpact(
          (risk.target || risk.residual).likelihood,
          (risk.target || risk.residual).impact,
        ),
      ),
    ),
  );
  const appetiteThresholdAverage = avg(APPETITE_CATEGORIES.map((item) => item.threshold));
  const vendorExposure = getVendorExposure(input.enterprisePosture.exceptions.highRiskVendors);

  const decisions: DashboardDecision[] = [
    {
      label: 'Accept risk',
      count: input.risks.filter((risk) => risk.status === 'accepted').length,
      reason: 'Residual risk is within approved appetite for designated domains.',
      owner: 'Risk Committee',
      nextAction: 'Review acceptance record',
      tone: 'success',
    },
    {
      label: 'Treat risk',
      count: input.enterprisePosture.exceptions.risksOutsideAppetite,
      reason: 'Residual exposure is above appetite and treatment planning is required.',
      owner: 'Control Owners',
      nextAction: 'Open treatment plan',
      tone: input.enterprisePosture.exceptions.risksOutsideAppetite > 0 ? 'critical' : 'success',
    },
    {
      label: 'Escalate risk',
      count: input.issues.filter((issue) => issue.priority === 'Critical').length,
      reason: 'Critical issues are affecting posture or blocking readiness.',
      owner: 'Executive Sponsor',
      nextAction: 'Escalate issue',
      tone: criticalIssueCount > 0 ? 'critical' : 'success',
    },
    {
      label: 'Request evidence',
      count: input.enterprisePosture.exceptions.expiringEvidence,
      reason: 'Expired or missing evidence is weakening assurance confidence.',
      owner: 'Assurance Lead',
      nextAction: 'Request evidence',
      tone: input.enterprisePosture.exceptions.expiringEvidence > 0 ? 'warning' : 'success',
    },
    {
      label: 'Reassess vendor',
      count: input.enterprisePosture.exceptions.highRiskVendors,
      reason: 'Vendor assessments are stale or high-risk vendors need refreshed review.',
      owner: 'TPRM Lead',
      nextAction: 'Reassess vendor',
      tone: input.enterprisePosture.exceptions.highRiskVendors > 0 ? 'warning' : 'success',
    },
    {
      label: 'Review appetite threshold',
      count: buildAppetiteRows(input.filteredEngineRisks, input.selectedFrameworks).filter((row) => row.status !== 'Within Appetite').length,
      reason: 'Multiple domains are breaching thresholds and may require executive review.',
      owner: 'Risk Committee',
      nextAction: 'Review appetite threshold',
      tone: buildAppetiteRows(input.filteredEngineRisks, input.selectedFrameworks).some((row) => row.status === 'Exceeded') ? 'critical' : 'warning',
    },
  ];

  const priorityRisks: PriorityRiskRow[] = input.risks
    .filter((risk) => input.filteredEngineRisks.some((item) => item.id === risk.id))
    .map((risk) => {
      const engineRisk = input.filteredEngineRisks.find((item) => item.id === risk.id);
      const evaluation = engineRisk
        ? evaluateRiskAppetiteStatus(engineRisk, { frameworks: input.selectedFrameworks })
        : null;
      return {
        id: risk.id,
        title: risk.title,
        category: RISK_CATEGORY_LABELS[risk.category] || titleCase(risk.category),
        status: RISK_STATUS_LABELS[risk.status] || titleCase(risk.status),
        severity: risk.severity,
        residual: `${risk.residualLikelihood} x ${risk.residualImpact}`,
        appetiteStatus: evaluation?.appetiteStatus || 'Within',
        residualScore: evaluation?.residualScore || 0,
      };
    })
    .sort((left, right) => right.residualScore - left.residualScore)
    .slice(0, 8);

  return {
    complianceCoverage,
    criticalIssueCount,
    remediationProgress,
    vendorExposure,
    inherentAverage,
    residualAverage,
    targetAverage,
    appetiteThresholdAverage,
    kpis: [
      {
        title: 'Risk Posture',
        metric: input.enterprisePosture.enterpriseScore,
        trend: `${input.enterprisePosture.trend >= 0 ? '+' : ''}${input.enterprisePosture.trend}`,
        status: getRiskStatusTone(input.enterprisePosture.enterpriseScore),
        driver: 'Composite score across residual exposure, controls, evidence, and coverage.',
        action: 'View risks',
        path: 'risks',
      },
      {
        title: 'Appetite Status',
        metric: input.enterprisePosture.appetiteStatus,
        trend: `${input.enterprisePosture.exceptions.risksOutsideAppetite} breach`,
        status: input.enterprisePosture.appetiteStatus === 'Outside' ? 'critical' : 'success',
        driver: 'Residual exposure compared to approved thresholds.',
        action: 'Open matrix',
        path: 'risks',
      },
      {
        title: 'Outside Appetite',
        metric: input.enterprisePosture.exceptions.risksOutsideAppetite,
        trend: `${criticalIssueCount} critical`,
        status: input.enterprisePosture.exceptions.risksOutsideAppetite > 0 ? 'critical' : 'success',
        driver: 'Breach count requiring treatment or escalation.',
        action: 'Treatment plan',
        path: 'review-tasks',
      },
      {
        title: 'Coverage',
        metric: `${complianceCoverage}%`,
        trend: `${input.selectedFrameworks.length} in scope`,
        status: getRiskStatusTone(100 - complianceCoverage),
        driver: 'Framework control coverage and mapped assurance.',
        action: 'Review controls',
        path: 'controls',
      },
      {
        title: 'Critical Issues',
        metric: criticalIssueCount,
        trend: `${input.enterprisePosture.exceptions.failedControls} failed`,
        status: criticalIssueCount > 0 ? 'critical' : 'success',
        driver: 'Critical exceptions and ineffective controls.',
        action: 'Escalate',
        path: 'issues',
      },
      {
        title: 'Remediation',
        metric: `${remediationProgress}%`,
        trend: `${vendorExposure} vendor`,
        status: getRiskStatusTone(100 - remediationProgress),
        driver: 'Treatment plan progress and overdue action pressure.',
        action: 'Open workbench',
        path: 'review-tasks',
      },
    ],
    decisions,
    priorityRisks,
  };
}
