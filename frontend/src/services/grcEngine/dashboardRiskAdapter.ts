import type { ControlWithFrameworks } from '@/types/control';
import type { EvidenceItem } from '@/types/evidence';
import type { Risk as AppRisk } from '@/types/risk';
import type { VendorRiskAssessment } from '@/types/tprm';
import type {
  Control,
  Evidence,
  FrameworkMapping,
  Issue,
  Risk,
  Vendor,
} from '@/services/grcEngine/riskEngine';

export type DashboardIssue = {
  id: string;
  title: string;
  owner: string;
  status: 'Open' | 'In Progress' | 'Pending' | 'Resolved';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  dueDate: string;
  domain: string;
};

export type DashboardVendor = {
  id: string;
  vendorName?: string;
  name?: string;
  riskTier?: 'critical' | 'high' | 'medium' | 'low';
  riskScore?: number;
};

export const DASHBOARD_ISSUE_FALLBACK: DashboardIssue[] = [
  { id: 'ISS-001', title: 'Expired SSL certificates on production servers', owner: 'Platform Operations', status: 'Open', priority: 'Critical', dueDate: '2026-03-10', domain: 'Infrastructure' },
  { id: 'ISS-002', title: 'Missing access reviews for privileged accounts', owner: 'Identity Team', status: 'In Progress', priority: 'High', dueDate: '2026-03-15', domain: 'Access' },
  { id: 'ISS-003', title: 'Firewall rule set contains stale exceptions', owner: 'Network Engineering', status: 'Open', priority: 'High', dueDate: '2026-03-20', domain: 'Infrastructure' },
  { id: 'ISS-004', title: 'Incomplete supplier diligence responses', owner: 'Vendor Oversight', status: 'Pending', priority: 'Medium', dueDate: '2026-03-25', domain: 'Third-Party' },
  { id: 'ISS-005', title: 'Audit log retention control not fully configured', owner: 'IT Operations', status: 'In Progress', priority: 'Medium', dueDate: '2026-03-30', domain: 'Monitoring' },
  { id: 'ISS-006', title: 'Data classification labels are missing for shared records', owner: 'Data Governance', status: 'Open', priority: 'Medium', dueDate: '2026-04-05', domain: 'Privacy' },
];

type AdapterInput = {
  risks: AppRisk[];
  controls: ControlWithFrameworks[];
  evidence: EvidenceItem[];
  issues: DashboardIssue[];
  vendors: DashboardVendor[];
  vendorAssessments: VendorRiskAssessment[];
};

function controlEffectivenessFromStatus(status: ControlWithFrameworks['status']): number {
  if (status === 'implemented') return 85;
  if (status === 'in_progress') return 55;
  return 20;
}

function mapIssueSeverity(priority: DashboardIssue['priority']): Issue['severity'] {
  return priority.toLowerCase() as Issue['severity'];
}

function mapIssueStatus(status: DashboardIssue['status']): Issue['status'] {
  if (status === 'Resolved') return 'closed';
  if (status === 'In Progress') return 'in_progress';
  if (status === 'Pending') return 'blocked';
  return 'open';
}

function mapIssueType(issue: DashboardIssue): Issue['type'] {
  const domain = issue.domain.toLowerCase();
  if (domain.includes('audit')) return 'audit';
  if (domain.includes('vendor') || domain.includes('third')) return 'vendor';
  if (domain.includes('policy')) return 'policy';
  return 'risk';
}

function domainMatchesRisk(issue: DashboardIssue, risk: AppRisk): boolean {
  const domain = issue.domain.toLowerCase();
  if (risk.category === 'privacy') return domain.includes('privacy') || domain.includes('data');
  if (risk.category === 'vendor') return domain.includes('vendor') || domain.includes('third');
  if (risk.category === 'compliance') return domain.includes('audit') || domain.includes('monitor') || domain.includes('access');
  if (risk.category === 'operational') return domain.includes('infrastructure') || domain.includes('monitor') || domain.includes('resilience');
  if (risk.category === 'information_security') return ['security', 'access', 'infrastructure', 'monitoring'].some((token) => domain.includes(token));
  return false;
}

function mapEvidenceStatus(evidence: EvidenceItem): Evidence['status'] {
  const referenceDate = evidence.lastReviewedAt || evidence.collectedAt;
  const ageDays = (Date.now() - new Date(referenceDate).getTime()) / 86400000;
  if (ageDays > 120) return 'expired';
  return 'valid';
}

function buildFrameworkMappings(controls: ControlWithFrameworks[]): FrameworkMapping[] {
  return controls.flatMap((control) =>
    (control.frameworks || []).map((framework) => ({
      framework,
      controlId: control.id,
    })),
  );
}

function buildVendorMap(
  vendors: DashboardVendor[],
  assessments: VendorRiskAssessment[],
): Map<string, Vendor> {
  const latestAssessmentByVendor = new Map<string, VendorRiskAssessment>();

  assessments.forEach((assessment) => {
    const current = latestAssessmentByVendor.get(assessment.vendorId);
    if (!current || new Date(current.updatedAt).getTime() < new Date(assessment.updatedAt).getTime()) {
      latestAssessmentByVendor.set(assessment.vendorId, assessment);
    }
  });

  return new Map(
    vendors.map((vendor) => {
      const assessment = latestAssessmentByVendor.get(vendor.id);
      return [
        vendor.id,
        {
          id: vendor.id,
          name: vendor.vendorName || vendor.name,
          tier: assessment?.riskTier || vendor.riskTier,
          riskScore: assessment?.residualRiskScore ?? vendor.riskScore,
          lastAssessmentDate: assessment?.completedDate
            ? new Date(assessment.completedDate)
            : assessment?.updatedAt
              ? new Date(assessment.updatedAt)
              : undefined,
        } satisfies Vendor,
      ];
    }),
  );
}

export function adaptDashboardDataToRisks({
  risks,
  controls,
  evidence,
  issues,
  vendors,
  vendorAssessments,
}: AdapterInput): Risk[] {
  const controlsById = new Map(controls.map((control) => [control.id, control]));
  const vendorMap = buildVendorMap(vendors, vendorAssessments);

  return risks.map((risk) => {
    const linkedControls = (risk.controlIds || [])
      .map((controlId) => controlsById.get(controlId))
      .filter((control): control is ControlWithFrameworks => Boolean(control));

    const mappedControls: Control[] = linkedControls.map((control) => ({
      id: control.id,
      status:
        control.status === 'not_applicable'
          ? 'not_implemented'
          : control.status,
      effectiveness: controlEffectivenessFromStatus(control.status),
    }));

    const mappedEvidence = evidence
      .filter(
        (item) =>
          item.riskId === risk.id ||
          (item.controlId ? linkedControls.some((control) => control.id === item.controlId) : false),
      )
      .map(
        (item): Evidence => ({
          id: item.id,
          status: mapEvidenceStatus(item),
          lastUpdated: new Date(item.lastReviewedAt || item.collectedAt),
        }),
      );

    const evidencePayload =
      mappedEvidence.length > 0
        ? mappedEvidence
        : [
            {
              id: `${risk.id}-missing-evidence`,
              status: 'missing',
              lastUpdated: new Date(),
            } satisfies Evidence,
          ];

    const mappedIssues = issues
      .filter((issue) => domainMatchesRisk(issue, risk))
      .map(
        (issue): Issue => ({
          id: issue.id,
          status: mapIssueStatus(issue.status),
          severity: mapIssueSeverity(issue.priority),
          type: mapIssueType(issue),
        }),
      );

    const relatedVendors =
      risk.category === 'vendor' || risk.category === 'compliance'
        ? [...vendorMap.values()]
        : [];

    return {
      id: risk.id,
      category: risk.category,
      inherent: {
        likelihood: risk.inherentLikelihood,
        impact: risk.inherentImpact,
      },
      residual: {
        likelihood: risk.residualLikelihood,
        impact: risk.residualImpact,
      },
      target: {
        likelihood: Math.max(1, risk.residualLikelihood - 1),
        impact: Math.max(1, risk.residualImpact - 1),
      },
      controls: mappedControls,
      evidence: evidencePayload,
      issues: mappedIssues,
      vendors: relatedVendors,
      frameworks: buildFrameworkMappings(linkedControls),
      metadata: {
        title: risk.title,
        status: risk.status,
        severity: risk.severity,
      },
    };
  });
}
