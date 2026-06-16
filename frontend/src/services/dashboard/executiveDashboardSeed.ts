import type { ActivityLedgerEntry } from '@/types/activityLedger';
import type { ControlWithFrameworks } from '@/types/control';
import type { EvidenceItem } from '@/types/evidence';
import type { Risk } from '@/types/risk';
import type { VendorRiskAssessment } from '@/types/tprm';
import type { DashboardIssue, DashboardVendor } from '@/services/grcEngine/dashboardRiskAdapter';

type ReviewTaskRecord = { id: string; status?: string };
type GovernanceDocumentRecord = { id: string };
type Tone = 'success' | 'warning' | 'critical';

export interface ExecutiveSeedTrainingSummary {
  overallCompletionRate: number;
  overdueAssignments: number;
  activeCampaigns: number;
}

export interface ExecutiveSeedAuditSummaryItem {
  framework: string;
  readinessPercent: number;
  openItems: number;
}

export interface ExecutiveFrameworkCoverageSeed {
  framework: string;
  coverage: number;
  controlsMapped: number;
  complianceScore: number;
  tone: Tone;
}

export interface ExecutiveReportingSeed {
  boardReadiness: number;
  committeeReadiness: number;
  executiveReportingStatus: string;
  boardPackStatus: string;
}

export interface ExecutiveForecastSeed {
  predictedRiskExposure: number;
  complianceForecast: number;
  auditReadinessForecast: number;
}

export interface ExecutiveResilienceSeed {
  resilienceScore: number;
  criticalServices: number;
  exercisesTracked: number;
}

export interface ExecutiveAiSeed {
  aiGovernanceScore: number;
  aiSystems: number;
  highRiskAi: number;
}

export interface ExecutiveSeedState {
  controls: ControlWithFrameworks[];
  risks: Risk[];
  vendors: DashboardVendor[];
  vendorAssessments: VendorRiskAssessment[];
  evidence: EvidenceItem[];
  governanceDocuments: GovernanceDocumentRecord[];
  reviewTasks: ReviewTaskRecord[];
  issues: DashboardIssue[];
  trainingSummary: ExecutiveSeedTrainingSummary;
  auditSummary: ExecutiveSeedAuditSummaryItem[];
  frameworkCoverage: ExecutiveFrameworkCoverageSeed[];
  reporting: ExecutiveReportingSeed;
  forecasts: ExecutiveForecastSeed;
  resilience: ExecutiveResilienceSeed;
  ai: ExecutiveAiSeed;
  activityEntries: ActivityLedgerEntry[];
}

export const EXECUTIVE_FRAMEWORK_SEQUENCE = [
  'ISO 27001',
  'SOC 2',
  'NIST CSF',
  'ISO 27701',
  'ISO 22301',
  'DORA',
  'GDPR',
  'PCI DSS',
] as const;

const FRAMEWORK_SEED_ROWS: ExecutiveFrameworkCoverageSeed[] = [
  { framework: 'ISO 27001', coverage: 85, controlsMapped: 34, complianceScore: 87, tone: 'success' },
  { framework: 'SOC 2', coverage: 78, controlsMapped: 28, complianceScore: 79, tone: 'success' },
  { framework: 'NIST CSF', coverage: 82, controlsMapped: 31, complianceScore: 84, tone: 'success' },
  { framework: 'ISO 27701', coverage: 74, controlsMapped: 18, complianceScore: 73, tone: 'warning' },
  { framework: 'ISO 22301', coverage: 81, controlsMapped: 16, complianceScore: 80, tone: 'success' },
  { framework: 'DORA', coverage: 76, controlsMapped: 20, complianceScore: 74, tone: 'warning' },
  { framework: 'GDPR', coverage: 79, controlsMapped: 22, complianceScore: 81, tone: 'success' },
  { framework: 'PCI DSS', coverage: 83, controlsMapped: 24, complianceScore: 84, tone: 'success' },
];

const RISK_CATEGORY_PLAN = [
  { key: 'information_security' as const, label: 'Information Security', count: 28, owner: 'Security Operations' },
  { key: 'operational' as const, label: 'Operational', count: 22, owner: 'Operations Resilience' },
  { key: 'compliance' as const, label: 'Compliance', count: 15, owner: 'Compliance Office' },
  { key: 'financial' as const, label: 'Strategic', count: 10, owner: 'Executive Leadership' },
  { key: 'strategic' as const, label: 'Strategic', count: 10, owner: 'Executive Leadership' },
] as const;

function isoDate(monthOffset: number, day = 12, hour = 9) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthOffset, day);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

function toneFromScore(score: number): Tone {
  if (score >= 80) return 'success';
  if (score >= 65) return 'warning';
  return 'critical';
}

function makeRiskId(workspaceId: string, index: number) {
  return `demo-risk-${workspaceId}-${index + 1}`;
}

function buildSeedRisks(workspaceId: string): Risk[] {
  const severities: Risk['severity'][] = ['critical', 'high', 'high', 'medium', 'medium', 'low'];
  const patterns = [
    { residualLikelihood: 5, residualImpact: 4 },
    { residualLikelihood: 4, residualImpact: 5 },
    { residualLikelihood: 4, residualImpact: 4 },
    { residualLikelihood: 3, residualImpact: 4 },
    { residualLikelihood: 3, residualImpact: 3 },
    { residualLikelihood: 2, residualImpact: 3 },
  ];

  const risks: Risk[] = [];
  let index = 0;

  RISK_CATEGORY_PLAN.forEach((plan) => {
    for (let i = 0; i < plan.count; i += 1) {
      const pattern = patterns[(index + i) % patterns.length];
      const severity = severities[(index + i) % severities.length];
      const monthOffset = (index + i) % 12;
      const inherentLikelihood = Math.min(5, pattern.residualLikelihood + 1);
      const inherentImpact = Math.min(5, pattern.residualImpact + ((index + i) % 2 === 0 ? 1 : 0));
      const titleSuffix = ((index + i) % 6) + 1;
      risks.push({
        id: makeRiskId(workspaceId, index + i),
        workspaceId,
        title: `${plan.label} Risk ${titleSuffix}`,
        description: `${plan.label} exposure requiring executive monitoring and monthly treatment follow-through.`,
        owner: plan.owner,
        category: plan.key === 'financial' ? 'strategic' : plan.key,
        status: severity === 'low' ? 'treated' : severity === 'medium' ? 'assessed' : 'identified',
        inherentLikelihood,
        inherentImpact,
        residualLikelihood: pattern.residualLikelihood,
        residualImpact: pattern.residualImpact,
        inherentRiskScore: inherentLikelihood * inherentImpact,
        residualRiskScore: pattern.residualLikelihood * pattern.residualImpact,
        severity,
        dueDate: isoDate(-1 * monthOffset + 1, 26),
        treatmentPlan: `Reduce ${plan.label.toLowerCase()} concentration and improve control execution.`,
        controlIds: [],
        createdAt: isoDate(monthOffset, 5 + ((index + i) % 20)),
        updatedAt: isoDate(monthOffset, 10 + ((index + i) % 18), 11),
      });
    }
    index += plan.count;
  });

  return risks;
}

function buildSeedControls(workspaceId: string): ControlWithFrameworks[] {
  const controls: ControlWithFrameworks[] = [];
  FRAMEWORK_SEED_ROWS.forEach((frameworkRow, frameworkIndex) => {
    for (let i = 0; i < frameworkRow.controlsMapped; i += 1) {
      const status =
        i < Math.round(frameworkRow.controlsMapped * (frameworkRow.coverage / 100))
          ? 'implemented'
          : i < Math.round(frameworkRow.controlsMapped * 0.9)
            ? 'in_progress'
            : 'not_implemented';
      controls.push({
        id: `demo-control-${workspaceId}-${frameworkIndex + 1}-${i + 1}`,
        workspaceId,
        title: `${frameworkRow.framework} Control ${i + 1}`,
        description: `${frameworkRow.framework} mapped safeguard for executive assurance and framework reporting.`,
        owner: frameworkIndex % 2 === 0 ? 'GRC Manager' : 'Control Owner',
        status,
        domain: frameworkIndex % 2 === 0 ? 'Security Governance' : 'Operational Assurance',
        primaryFramework: frameworkRow.framework,
        createdAt: isoDate((frameworkIndex + i) % 12, 3 + (i % 20)),
        updatedAt: isoDate((frameworkIndex + i) % 12, 14 + (i % 10)),
        frameworks: [frameworkRow.framework],
      });
    }
  });
  return controls;
}

function buildSeedEvidence(workspaceId: string, controls: ControlWithFrameworks[], risks: Risk[]): EvidenceItem[] {
  return Array.from({ length: 96 }, (_, index) => {
    const control = controls[index % controls.length];
    const risk = risks[index % risks.length];
    return {
      id: `demo-evidence-${workspaceId}-${index + 1}`,
      workspaceId,
      name: `Evidence Artifact ${index + 1}`,
      description: 'Seeded executive evidence artifact for overview assurance coverage.',
      type: (['policy', 'configuration', 'log', 'report'] as const)[index % 4],
      controlId: control.id,
      riskId: index % 3 === 0 ? risk.id : undefined,
      collectedBy: index % 2 === 0 ? 'Evidence Office' : 'Security Operations',
      collectedAt: isoDate(index % 12, 2 + (index % 22)),
      lastReviewedAt: isoDate(index % 6, 8 + (index % 18)),
    };
  });
}

function buildSeedVendors(workspaceId: string): DashboardVendor[] {
  const tiers: Array<NonNullable<DashboardVendor['riskTier']>> = [
    'critical',
    'high',
    'high',
    'medium',
    'medium',
    'low',
  ];

  return Array.from({ length: 18 }, (_, index) => ({
    id: `demo-vendor-${workspaceId}-${index + 1}`,
    vendorName: `Vendor ${index + 1}`,
    riskTier: tiers[index % tiers.length],
    riskScore: 84 - index * 2,
  }));
}

function buildSeedVendorAssessments(workspaceId: string, vendors: DashboardVendor[]): VendorRiskAssessment[] {
  return vendors.map((vendor, index) => ({
    id: `demo-vra-${workspaceId}-${index + 1}`,
    workspaceId,
    vendorId: vendor.id,
    assessmentType: index % 2 === 0 ? 'periodic' : 'triggered',
    status: index % 5 === 0 ? 'expired' : index % 3 === 0 ? 'pending_review' : 'completed',
    riskTier: vendor.riskTier,
    inherentRiskScore: 78 - index,
    residualRiskScore: 63 - Math.min(index, 18),
    dueDate: isoDate((index + 1) % 6, 20),
    completedDate: index % 5 === 0 ? undefined : isoDate((index + 2) % 6, 15),
    nextReviewDate: isoDate(-((index % 6) + 1), 18),
    findings: [
      {
        id: `demo-vra-finding-${workspaceId}-${index + 1}`,
        title: 'Control assurance gap',
        severity: vendor.riskTier === 'critical' ? 'critical' : vendor.riskTier === 'high' ? 'high' : 'medium',
        status: index % 4 === 0 ? 'open' : 'remediated',
      },
    ],
    notes: 'Seeded vendor review posture for executive exposure tracking.',
    createdAt: isoDate(index % 12, 7),
    updatedAt: isoDate(index % 12, 13),
    vendorName: vendor.vendorName,
    assessorName: 'Third-Party Risk Office',
    reviewerName: 'Risk Committee',
  }));
}

function buildSeedIssues(workspaceId: string): DashboardIssue[] {
  const priorities: DashboardIssue['priority'][] = ['Critical', 'High', 'High', 'Medium', 'Medium', 'Low'];
  const statuses: DashboardIssue['status'][] = ['Open', 'In Progress', 'Pending', 'Open', 'Resolved', 'Open'];
  const domains = ['Infrastructure', 'Access', 'Third-Party', 'Monitoring', 'Privacy', 'Audit'];

  return Array.from({ length: 18 }, (_, index) => ({
    id: `demo-issue-${workspaceId}-${index + 1}`,
    title: `Executive issue ${index + 1}`,
    owner: index % 2 === 0 ? 'Platform Operations' : 'Governance Office',
    status: statuses[index % statuses.length],
    priority: priorities[index % priorities.length],
    dueDate: isoDate((index + 1) % 4, 24),
    domain: domains[index % domains.length],
  }));
}

function buildSeedReviewTasks(workspaceId: string): ReviewTaskRecord[] {
  const statuses = ['open', 'open', 'in_progress', 'overdue', 'completed', 'pending'];
  return Array.from({ length: 12 }, (_, index) => ({
    id: `demo-review-task-${workspaceId}-${index + 1}`,
    status: statuses[index % statuses.length],
  }));
}

function buildSeedGovernanceDocuments(workspaceId: string): GovernanceDocumentRecord[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `demo-policy-${workspaceId}-${index + 1}`,
  }));
}

function buildSeedAuditSummary(): ExecutiveSeedAuditSummaryItem[] {
  return FRAMEWORK_SEED_ROWS.map((row, index) => ({
    framework: row.framework,
    readinessPercent: row.complianceScore,
    openItems: [2, 3, 1, 4, 2, 3, 2, 1][index] || 0,
  }));
}

function buildSeedActivity(workspaceId: string, organizationName: string): ActivityLedgerEntry[] {
  const actor = organizationName || 'Security Office';
  const specs: Array<Pick<ActivityLedgerEntry, 'action' | 'category' | 'targetType' | 'targetName' | 'outcome' | 'severity' | 'notes'>> = [
    { action: 'risk.created', category: 'risk', targetType: 'risk', targetName: 'RISK-1024', outcome: 'success', severity: 'medium', notes: 'Board exposure register updated after reassessment.' },
    { action: 'risk.updated', category: 'risk', targetType: 'risk', targetName: 'RISK-1024', outcome: 'success', severity: 'medium', notes: 'Residual score and treatment milestones were refreshed.' },
    { action: 'control.tested', category: 'control', targetType: 'control', targetName: 'CTRL-203', outcome: 'success', severity: 'info', notes: 'Quarterly control test passed with minor observations.' },
    { action: 'evidence.uploaded', category: 'evidence', targetType: 'evidence', targetName: 'EVID-889', outcome: 'success', severity: 'info', notes: 'Audit evidence uploaded and linked to mapped control set.' },
    { action: 'audit.created', category: 'audit', targetType: 'audit', targetName: 'AUD-556', outcome: 'success', severity: 'medium', notes: 'Readiness workpaper bundle opened for committee review.' },
    { action: 'policy.approved', category: 'policy', targetType: 'policy', targetName: 'POL-220', outcome: 'success', severity: 'low', notes: 'Revised security policy approved with board attestation.' },
    { action: 'vendor.reviewed', category: 'vendor', targetType: 'vendor', targetName: 'VEND-334', outcome: 'success', severity: 'medium', notes: 'Periodic review completed with elevated subcontractor watchpoints.' },
    { action: 'training.assigned', category: 'training', targetType: 'campaign', targetName: 'TRN-441', outcome: 'pending', severity: 'low', notes: 'Leadership phishing drill assigned for the next awareness cycle.' },
    { action: 'user.access_approved', category: 'user', targetType: 'access-request', targetName: 'ACC-904', outcome: 'success', severity: 'low', notes: 'MFA-enforced executive access request approved.' },
  ];

  return specs.map((spec, index) => ({
    id: `demo-activity-${workspaceId}-${index + 1}`,
    workspaceId,
    actorUserId: null,
    actorName: actor,
    actorRole: 'Executive Office',
    action: spec.action,
    category: spec.category,
    targetType: spec.targetType,
    targetId: `seed-${index + 1}`,
    targetName: spec.targetName,
    previousValue: null,
    newValue: null,
    outcome: spec.outcome,
    severity: spec.severity,
    ipAddress: null,
    userAgent: null,
    device: 'Enterprise Web',
    location: null,
    correlationId: null,
    source: 'system',
    timestamp: isoDate(0, 16 - index, 9 + (index % 5)),
    notes: spec.notes,
    frameworkCode: null,
  }));
}

export function buildExecutiveDashboardSeed(
  workspaceId: string,
  organizationName: string,
): ExecutiveSeedState {
  const risks = buildSeedRisks(workspaceId);
  const controls = buildSeedControls(workspaceId);
  const evidence = buildSeedEvidence(workspaceId, controls, risks);
  const vendors = buildSeedVendors(workspaceId);
  const vendorAssessments = buildSeedVendorAssessments(workspaceId, vendors);
  const issues = buildSeedIssues(workspaceId);

  return {
    controls,
    risks,
    vendors,
    vendorAssessments,
    evidence,
    governanceDocuments: buildSeedGovernanceDocuments(workspaceId),
    reviewTasks: buildSeedReviewTasks(workspaceId),
    issues,
    trainingSummary: {
      overallCompletionRate: 78,
      overdueAssignments: 12,
      activeCampaigns: 6,
    },
    auditSummary: buildSeedAuditSummary(),
    frameworkCoverage: FRAMEWORK_SEED_ROWS,
    reporting: {
      boardReadiness: 88,
      committeeReadiness: 84,
      executiveReportingStatus: 'On track',
      boardPackStatus: 'Draft ready',
    },
    forecasts: {
      predictedRiskExposure: 76,
      complianceForecast: 83,
      auditReadinessForecast: 86,
    },
    resilience: {
      resilienceScore: 81,
      criticalServices: 7,
      exercisesTracked: 4,
    },
    ai: {
      aiGovernanceScore: 74,
      aiSystems: 3,
      highRiskAi: 2,
    },
    activityEntries: buildSeedActivity(workspaceId, organizationName),
  };
}

export function mergeWithExecutiveSeed<T>(live: T[], seeded: T[], minimumCount: number): T[] {
  if (live.length >= minimumCount) return live;
  return [...live, ...seeded.slice(0, Math.max(0, minimumCount - live.length))];
}

export function fallbackScalar(liveValue: number | undefined, seededValue: number) {
  return typeof liveValue === 'number' && liveValue > 0 ? liveValue : seededValue;
}

export function fallbackText(liveValue: string | undefined | null, seededValue: string) {
  return liveValue && liveValue.trim() ? liveValue : seededValue;
}

export function toneFromCoverage(score: number): Tone {
  return toneFromScore(score);
}
