import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyStatePanel,
  PageHeader,
  PageSectionCard,
  SummaryMetricStrip,
  ToolbarButtonRow,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { canAccessWorkspace, getWorkspaceDefinitionById, type WorkspaceId } from '../lib/platformShell';
import { theme } from '../theme';

interface WorkspacePageProps {
  onNavigate?: (key: string) => void;
}

type MetricTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type WorkspacePageConfig = {
  title: string;
  description: string;
  breadcrumb: string;
  primaryAction: { label: string; routeKey: string };
  secondaryActions: Array<{ label: string; routeKey: string }>;
  metrics: Array<{ label: string; value: string | number; detail: string; tone: MetricTone }>;
  panels: Array<{
    title: string;
    subtitle: string;
    badge?: string;
    items: string[];
    cta?: { label: string; routeKey: string };
  }>;
};

const workspacePageConfigs: Record<WorkspaceId, WorkspacePageConfig> = {
  executive: {
    title: 'Executive Workspace',
    description: 'Board posture, workspace signals, reporting, and enterprise operating views.',
    breadcrumb: 'Workspaces / Executive Center',
    primaryAction: { label: 'Open Executive Dashboard', routeKey: 'dashboard' },
    secondaryActions: [
      { label: 'Board Intelligence', routeKey: 'executive-overview' },
      { label: 'Strategic Risks', routeKey: 'risks' },
      { label: 'Reports', routeKey: 'reports' },
    ],
    metrics: [
      { label: 'Navigation Views', value: 9, detail: 'Overview, dashboard, board intelligence, risk, regulatory, ESG, AI, reports, and settings.', tone: 'primary' },
      { label: 'Signals', value: 'Live', detail: 'Recent activity and posture insights are available.', tone: 'success' },
      { label: 'Board Reporting', value: 'Ready', detail: 'Export current board and executive reporting.', tone: 'default' },
    ],
    panels: [
      {
        title: 'Executive Operating Views',
        subtitle: 'Move between the dashboard, board intelligence, and strategic oversight workflows.',
        items: ['Executive Dashboard command center', 'Board intelligence and oversight view', 'Strategic risks and regulatory exposure'],
        cta: { label: 'Open Strategic Risks', routeKey: 'risks' },
      },
      {
        title: 'Reporting Actions',
        subtitle: 'Generate and distribute board-ready reporting from the active workspace.',
        badge: 'Reporting',
        items: ['Export board snapshot', 'Review board pack templates', 'Open reporting center'],
        cta: { label: 'Open Reports', routeKey: 'reports' },
      },
    ],
  },
  risk: {
    title: 'Risk Workspace',
    description: 'Risk register, assessments, treatment planning, and issue remediation.',
    breadcrumb: 'Workspaces / Risk Workspace',
    primaryAction: { label: 'Open Risk Register', routeKey: 'risks' },
    secondaryActions: [
      { label: 'Risk Assessments', routeKey: 'risk-matrix' },
      { label: 'Risk Operations', routeKey: 'issues' },
    ],
    metrics: [
      { label: 'Core Views', value: 3, detail: 'Register, assessments, and operations.', tone: 'primary' },
      { label: 'Treatment Flow', value: 'Active', detail: 'Remediation and issue handling are linked.', tone: 'warning' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Risk workflows can be launched directly.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Risk Operations',
        subtitle: 'Use the register, matrix, and issue workflows together.',
        items: ['Review enterprise risk register', 'Run heatmap and scoring assessments', 'Track remediation through issues and actions'],
        cta: { label: 'Open Risk Assessments', routeKey: 'risk-matrix' },
      },
      {
        title: 'Next Actions',
        subtitle: 'Suggested starting points for risk analysis and treatment.',
        badge: 'Workflow',
        items: ['Create a new risk entry', 'Assess inherent and residual exposure', 'Escalate blocked or overdue treatment items'],
        cta: { label: 'Open Risk Operations', routeKey: 'issues' },
      },
    ],
  },
  compliance: {
    title: 'Compliance Workspace',
    description: 'Coverage monitoring, obligation tracking, and compliance program coordination.',
    breadcrumb: 'Workspaces / Compliance Workspace',
    primaryAction: { label: 'Open Coverage Operations', routeKey: 'compliance-tracker' },
    secondaryActions: [
      { label: 'Regulatory Change', routeKey: 'regulatory-change' },
      { label: 'Compliance Reports', routeKey: 'data-protection' },
    ],
    metrics: [
      { label: 'Programs', value: 3, detail: 'Coverage operations, obligations, and reports.', tone: 'primary' },
      { label: 'Obligations', value: 'Tracked', detail: 'Regulatory and coverage changes are centralized.', tone: 'warning' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Compliance workflows are active.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Coverage Command',
        subtitle: 'Keep framework coverage, obligations, and evidence operations aligned.',
        items: ['Review compliance coverage operations', 'Track regulatory change and obligations', 'Open compliance reporting views'],
        cta: { label: 'Open Regulatory Change', routeKey: 'regulatory-change' },
      },
      {
        title: 'Program Actions',
        subtitle: 'Use this workspace as the top-level compliance coordination view.',
        badge: 'Coordination',
        items: ['Inspect open compliance gaps', 'Review obligation pressure', 'Launch report and evidence follow-up'],
        cta: { label: 'Open Compliance Reports', routeKey: 'data-protection' },
      },
    ],
  },
  controls: {
    title: 'Controls Workspace',
    description: 'Control library, implementation posture, and control governance.',
    breadcrumb: 'Workspaces / Controls Workspace',
    primaryAction: { label: 'Open Controls', routeKey: 'controls' },
    secondaryActions: [
      { label: 'Coverage Operations', routeKey: 'compliance-tracker' },
      { label: 'Audit Readiness', routeKey: 'audit-readiness' },
    ],
    metrics: [
      { label: 'Control Views', value: 2, detail: 'Controls and coverage operations.', tone: 'primary' },
      { label: 'Audit Linkage', value: 'Mapped', detail: 'Control posture feeds readiness and assurance.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Control operations are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Control Management',
        subtitle: 'Manage implementation posture and mapped framework coverage.',
        items: ['Review control library', 'Inspect implementation posture', 'Open gap and coverage analysis'],
        cta: { label: 'Open Coverage Operations', routeKey: 'compliance-tracker' },
      },
      {
        title: 'Assurance Coordination',
        subtitle: 'Controls should flow directly into audit and evidence activity.',
        badge: 'Assurance',
        items: ['Identify failed or ineffective controls', 'Coordinate evidence follow-up', 'Prepare controls for audits'],
        cta: { label: 'Open Audit Readiness', routeKey: 'audit-readiness' },
      },
    ],
  },
  evidence: {
    title: 'Evidence Workspace',
    description: 'Evidence inventory, requests, freshness, and assurance follow-up.',
    breadcrumb: 'Workspaces / Evidence Workspace',
    primaryAction: { label: 'Open Evidence', routeKey: 'evidence' },
    secondaryActions: [
      { label: 'Coverage Operations', routeKey: 'compliance-tracker' },
      { label: 'Audit Readiness', routeKey: 'audit-readiness' },
    ],
    metrics: [
      { label: 'Evidence Views', value: 3, detail: 'Inventory, coverage, and audit support.', tone: 'primary' },
      { label: 'Freshness', value: 'Monitored', detail: 'Evidence aging and follow-up are centralized.', tone: 'warning' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Evidence workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Evidence Operations',
        subtitle: 'Track inventory, requests, and stale or missing artifacts.',
        items: ['Open evidence register', 'Request or upload missing artifacts', 'Review evidence aging and freshness'],
        cta: { label: 'Open Coverage Operations', routeKey: 'compliance-tracker' },
      },
      {
        title: 'Audit Support',
        subtitle: 'Evidence should be audit-ready and easy to retrieve.',
        badge: 'Audit',
        items: ['Prepare evidence packages', 'Track upcoming review dates', 'Coordinate requests with audit readiness'],
        cta: { label: 'Open Audit Readiness', routeKey: 'audit-readiness' },
      },
    ],
  },
  audit: {
    title: 'Audit Workspace',
    description: 'Audit command center, application reviews, access reviews, and remediation.',
    breadcrumb: 'Workspaces / Audit Workspace',
    primaryAction: { label: 'Open Audit Command Center', routeKey: 'audit-readiness' },
    secondaryActions: [
      { label: 'Application Reviews', routeKey: 'app-review' },
      { label: 'Access Reviews', routeKey: 'access-review' },
    ],
    metrics: [
      { label: 'Audit Views', value: 3, detail: 'Command center plus review registers.', tone: 'primary' },
      { label: 'Review Paths', value: 'Linked', detail: 'Application and access reviews are in scope.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Audit workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Audit Command',
        subtitle: 'Readiness, requests, and review work are grouped in one shell.',
        items: ['Inspect audit blockers and readiness', 'Open application review register', 'Open access review register'],
        cta: { label: 'Open Access Reviews', routeKey: 'access-review' },
      },
      {
        title: 'Audit Actions',
        subtitle: 'Use this workspace when preparing for or running assurance activity.',
        badge: 'Readiness',
        items: ['Coordinate evidence collection', 'Review open audit requests', 'Track findings and response work'],
        cta: { label: 'Open Application Reviews', routeKey: 'app-review' },
      },
    ],
  },
  training: {
    title: 'Training & Awareness Workspace',
    description: 'Campaigns, assignments, training records, phishing simulations, and measurable awareness outcomes.',
    breadcrumb: 'Workspaces / Training & Awareness',
    primaryAction: { label: 'Open Campaigns', routeKey: 'training' },
    secondaryActions: [
      { label: 'Assignments', routeKey: 'training-assignments' },
      { label: 'Phishing Simulations', routeKey: 'training-phishing' },
      { label: 'Metrics', routeKey: 'training-kpis' },
    ],
    metrics: [
      { label: 'Workspace Views', value: 6, detail: 'Overview, campaigns, assignments, records, phishing, and metrics.', tone: 'primary' },
      { label: 'Awareness Ops', value: 'Active', detail: 'Completion, campaigns, and phishing outcomes are tracked.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Training workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Campaign Operations',
        subtitle: 'Coordinate awareness campaigns, learning modules, and employee completion flow.',
        items: ['Open active campaigns', 'Manage assignments and mandatory training', 'Track training records and module completion'],
        cta: { label: 'Open Assignments', routeKey: 'training-assignments' },
      },
      {
        title: 'Simulation & Metrics',
        subtitle: 'Use phishing outcomes and training KPIs to measure awareness effectiveness.',
        badge: 'Metrics',
        items: ['Review phishing simulation results', 'Inspect click-rate performance', 'Open KPI and completion analytics'],
        cta: { label: 'Open Training Metrics', routeKey: 'training-kpis' },
      },
    ],
  },
  'continuous-assurance': {
    title: 'Continuous Assurance Workspace',
    description: 'Continuous controls monitoring, automated evidence, exceptions, drift detection, connectors, analytics, and assurance reporting.',
    breadcrumb: 'Workspaces / Continuous Assurance Workspace',
    primaryAction: { label: 'Open Assurance Overview', routeKey: 'continuous-assurance-overview' },
    secondaryActions: [
      { label: 'Control Monitors', routeKey: 'ccm-monitors' },
      { label: 'Automated Tests', routeKey: 'ccm-tests' },
      { label: 'Connectors', routeKey: 'ccm-connectors' },
    ],
    metrics: [
      { label: 'Assurance Views', value: 10, detail: 'Overview, monitors, tests, evidence, drift, exceptions, connectors, analytics, reports, and settings.', tone: 'primary' },
      { label: 'Automation', value: 'Active', detail: 'Evidence and control monitoring workflows are automated.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Continuous assurance workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Operational Assurance',
        subtitle: 'Run control monitors, automated tests, drift workflows, and exception handling from one workspace.',
        items: ['Open the assurance overview', 'Operate control monitors and test schedules', 'Review failed tests, drift, and exceptions'],
        cta: { label: 'Open Control Monitors', routeKey: 'ccm-monitors' },
      },
      {
        title: 'Automation Layer',
        subtitle: 'Connect cloud, identity, and ticketing sources into evidence collection and assurance analytics.',
        badge: 'Automation',
        items: ['Manage evidence collection jobs', 'Test and sync connectors', 'Generate executive assurance reports'],
        cta: { label: 'Open Connectors', routeKey: 'ccm-connectors' },
      },
    ],
  },
  asset: {
    title: 'Asset Workspace',
    description: 'Asset operations, inventory management, QR workflows, and lifecycle tracking.',
    breadcrumb: 'Workspaces / Asset Workspace',
    primaryAction: { label: 'Open Assets', routeKey: 'assets' },
    secondaryActions: [
      { label: 'Open Risk Register', routeKey: 'risks' },
      { label: 'Open Evidence', routeKey: 'evidence' },
    ],
    metrics: [
      { label: 'Asset Views', value: 1, detail: 'Asset operations and lifecycle tracking.', tone: 'primary' },
      { label: 'Field Flow', value: 'Enabled', detail: 'Assets link to risk and evidence workflows.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Asset tracking is available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Asset Operations',
        subtitle: 'Manage asset records, QR activities, and lifecycle events.',
        items: ['Open the asset register', 'Track creation and assignment', 'Coordinate evidence and operational reviews'],
      },
      {
        title: 'Connected Workflows',
        subtitle: 'Assets should feed evidence and risk management where needed.',
        badge: 'Connected',
        items: ['Link critical assets to risks', 'Support inventory evidence', 'Prepare assets for audit verification'],
        cta: { label: 'Open Risks', routeKey: 'risks' },
      },
    ],
  },
  vendor: {
    title: 'Vendor Workspace',
    description: 'Vendor register, third-party assessments, and monitoring workflows.',
    breadcrumb: 'Workspaces / Vendor Workspace',
    primaryAction: { label: 'Open Vendors', routeKey: 'vendors' },
    secondaryActions: [
      { label: 'Assessments & Monitoring', routeKey: 'tprm-dashboard' },
      { label: 'Open Risks', routeKey: 'risks' },
    ],
    metrics: [
      { label: 'Vendor Views', value: 2, detail: 'Register and TPRM dashboard.', tone: 'primary' },
      { label: 'Monitoring', value: 'Live', detail: 'Third-party posture is actively monitored.', tone: 'warning' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Vendor workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Third-Party Operations',
        subtitle: 'Manage the vendor register and linked assessment workflows.',
        items: ['Review vendor register', 'Open assessment and monitoring dashboard', 'Track high-risk third parties'],
        cta: { label: 'Open TPRM Dashboard', routeKey: 'tprm-dashboard' },
      },
      {
        title: 'Risk Coordination',
        subtitle: 'Vendor posture should connect directly into enterprise risk tracking.',
        badge: 'Risk Link',
        items: ['Escalate high-risk vendors', 'Coordinate reassessments', 'Connect vendor findings to risk treatment'],
        cta: { label: 'Open Risk Register', routeKey: 'risks' },
      },
    ],
  },
  privacy: {
    title: 'Privacy Workspace',
    description: 'Privacy program management, DSARs, DPIAs, data protection, and governance.',
    breadcrumb: 'Workspaces / Privacy Workspace',
    primaryAction: { label: 'Open Privacy Governance', routeKey: 'privacy-data-governance' },
    secondaryActions: [
      { label: 'Compliance Reports', routeKey: 'data-protection' },
      { label: 'Regulatory Change', routeKey: 'regulatory-change' },
    ],
    metrics: [
      { label: 'Privacy Views', value: 3, detail: 'Privacy governance, reports, and obligations.', tone: 'primary' },
      { label: 'Program Status', value: 'Managed', detail: 'Privacy inventory and reviews are centralized.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Privacy workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Privacy Operations',
        subtitle: 'Manage privacy inventory, breaches, DSARs, and DPIAs.',
        items: ['Open privacy governance platform', 'Review data protection reports', 'Track obligation changes and privacy exposure'],
        cta: { label: 'Open Data Protection', routeKey: 'data-protection' },
      },
      {
        title: 'Compliance Coordination',
        subtitle: 'Connect privacy workflows to broader compliance management.',
        badge: 'Coordination',
        items: ['Review retention and breach posture', 'Track privacy-related obligations', 'Prepare privacy reporting for leadership'],
        cta: { label: 'Open Regulatory Change', routeKey: 'regulatory-change' },
      },
    ],
  },
  'ai-governance': {
    title: 'AI Governance Workspace',
    description: 'AI inventory, model risk, incidents, controls, and regulatory readiness.',
    breadcrumb: 'Workspaces / AI Governance Workspace',
    primaryAction: { label: 'Open AI Governance', routeKey: 'ai-governance' },
    secondaryActions: [
      { label: 'Open Risks', routeKey: 'risks' },
      { label: 'Open Reporting', routeKey: 'reports' },
    ],
    metrics: [
      { label: 'AI Views', value: 1, detail: 'Inventory, controls, and incident oversight.', tone: 'primary' },
      { label: 'Regulatory Readiness', value: 'Tracked', detail: 'AI obligations and model controls are in scope.', tone: 'warning' },
      { label: 'Workspace Status', value: 'Ready', detail: 'AI governance workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Model Governance',
        subtitle: 'Track AI systems, controls, incidents, and assurance actions.',
        items: ['Open AI governance platform', 'Review high-risk models and incidents', 'Connect AI risks and reporting'],
        cta: { label: 'Open Risks', routeKey: 'risks' },
      },
      {
        title: 'Executive Readiness',
        subtitle: 'Use this workspace for AI oversight and board reporting.',
        badge: 'Board',
        items: ['Prepare AI oversight reporting', 'Review control maturity', 'Inspect AI-specific regulatory readiness'],
        cta: { label: 'Open Reporting Center', routeKey: 'reports' },
      },
    ],
  },
  esg: {
    title: 'ESG Workspace',
    description: 'Sustainability operations, carbon metrics, supplier ESG, and board readiness.',
    breadcrumb: 'Workspaces / ESG Workspace',
    primaryAction: { label: 'Open ESG Management', routeKey: 'esg-management' },
    secondaryActions: [
      { label: 'Open Reporting', routeKey: 'reports' },
      { label: 'Open Vendors', routeKey: 'vendors' },
    ],
    metrics: [
      { label: 'ESG Views', value: 1, detail: 'Sustainability and board readiness hub.', tone: 'primary' },
      { label: 'Board Readiness', value: 'Active', detail: 'ESG reporting and exposure are in scope.', tone: 'success' },
      { label: 'Workspace Status', value: 'Ready', detail: 'ESG workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Sustainability Command',
        subtitle: 'Manage carbon, ESG metrics, supplier ESG, and leadership reporting.',
        items: ['Open ESG management platform', 'Review supplier ESG linkage', 'Prepare board-facing ESG reporting'],
        cta: { label: 'Open Reporting Center', routeKey: 'reports' },
      },
      {
        title: 'Linked Workflows',
        subtitle: 'ESG outcomes should connect into vendor and executive oversight.',
        badge: 'Linked',
        items: ['Review supplier ESG posture', 'Escalate material findings', 'Coordinate updates for executive review'],
        cta: { label: 'Open Vendors', routeKey: 'vendors' },
      },
    ],
  },
  administration: {
    title: 'Administration Workspace',
    description: 'Organization setup, workspaces, access governance, users, roles, permissions, authentication, and security.',
    breadcrumb: 'Workspaces / Administration Workspace',
    primaryAction: { label: 'Open Team Access', routeKey: 'workspace-members' },
    secondaryActions: [
      { label: 'Workspace Management', routeKey: 'workspace-management' },
      { label: 'Security Settings', routeKey: 'admin-security-settings' },
      { label: 'Permission Matrix', routeKey: 'admin-permissions' },
    ],
    metrics: [
      { label: 'Admin Views', value: 8, detail: 'Workspace, access, roles, permissions, and security.', tone: 'primary' },
      { label: 'Privileged Scope', value: 'Restricted', detail: 'Only admin roles should access this workspace.', tone: 'danger' },
      { label: 'Workspace Status', value: 'Ready', detail: 'Administrative workflows are available.', tone: 'success' },
    ],
    panels: [
      {
        title: 'Access Governance',
        subtitle: 'Manage users, roles, permissions, reviews, and security posture.',
        items: ['Open team access', 'Open role management', 'Open permission matrix'],
        cta: { label: 'Open Role Management', routeKey: 'admin-roles' },
      },
      {
        title: 'Workspace Administration',
        subtitle: 'Manage tenant setup, workspaces, authentication, and audit visibility.',
        badge: 'Privileged',
        items: ['Open organization setup', 'Open workspace management', 'Open activity ledger and security settings'],
        cta: { label: 'Open Workspace Management', routeKey: 'workspace-management' },
      },
    ],
  },
};

function WorkspaceErrorView({
  title = 'Unable to load workspace',
  detail,
  onRetry,
}: {
  title?: string;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <EmptyStatePanel
      eyebrow="Workspace Error"
      title={title}
      description={detail}
      actions={<Button variant="primary" onClick={onRetry}>Retry</Button>}
    />
  );
}

function WorkspaceLandingPage({
  workspaceId,
  onNavigate,
}: WorkspacePageProps & { workspaceId: WorkspaceId }) {
  const { role } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const workspaceDefinition = useMemo(() => getWorkspaceDefinitionById(workspaceId), [workspaceId]);
  const config = workspacePageConfigs[workspaceId];

  useEffect(() => {
    console.info('Workspace loaded:', workspaceId);
  }, [workspaceId]);

  const handleNavigate = (key: string) => {
    try {
      setError(null);
      onNavigate?.(key);
    } catch (navigationError) {
      setError(navigationError instanceof Error ? navigationError.message : 'Unknown navigation error');
    }
  };

  if (!workspaceDefinition || !config) {
    return <WorkspaceErrorView detail={`Missing workspace configuration for "${workspaceId}".`} onRetry={() => window.location.reload()} />;
  }

  if (!canAccessWorkspace(workspaceId, role)) {
    return (
      <WorkspaceErrorView
        detail={`Permission denied for role "${role || 'unknown'}" while loading ${config.title}.`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: theme.spacing[4] }}>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumb={config.breadcrumb}
        action={<Badge variant="primary" size="sm">{workspaceDefinition.title}</Badge>}
      />

      {error ? <WorkspaceErrorView detail={error} onRetry={() => window.location.reload()} /> : null}

      <SummaryMetricStrip metrics={config.metrics} />

      <PageSectionCard
        title="Workspace Actions"
        subtitle="Primary and related navigation for this workspace."
        action={
          <ToolbarButtonRow
            primaryLabel={config.primaryAction.label}
            onPrimary={() => handleNavigate(config.primaryAction.routeKey)}
            secondaryActions={config.secondaryActions.map((action) => ({
              label: action.label,
              onClick: () => handleNavigate(action.routeKey),
            }))}
          />
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.spacing[3] }}>
          {workspaceDefinition.items.map((item) => (
            <Card key={item.key} style={{ padding: theme.spacing[4], border: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], color: theme.colors.primary }}>
                {item.icon}
                <strong style={{ color: theme.colors.text.main }}>{item.label}</strong>
              </div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                {item.description}
              </div>
              <div style={{ marginTop: theme.spacing[3] }}>
                <Button variant="secondary" onClick={() => handleNavigate(item.key)}>Open</Button>
              </div>
            </Card>
          ))}
        </div>
      </PageSectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: theme.spacing[3] }}>
        {config.panels.map((panel) => (
          <PageSectionCard
            key={panel.title}
            title={panel.title}
            subtitle={panel.subtitle}
            action={panel.badge ? <Badge variant="default" size="sm">{panel.badge}</Badge> : null}
          >
            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
              {panel.items.map((item) => (
                <div key={item} style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                  {item}
                </div>
              ))}
              {panel.cta ? (
                <div style={{ marginTop: theme.spacing[2] }}>
                  <Button variant="secondary" onClick={() => handleNavigate(panel.cta!.routeKey)}>
                    {panel.cta.label}
                  </Button>
                </div>
              ) : null}
            </div>
          </PageSectionCard>
        ))}
      </div>
    </div>
  );
}

export function ExecutiveWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="executive" {...props} />;
}

export function RiskWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="risk" {...props} />;
}

export function ComplianceWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="compliance" {...props} />;
}

export function ControlsWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="controls" {...props} />;
}

export function EvidenceWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="evidence" {...props} />;
}

export function AuditWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="audit" {...props} />;
}

export function TrainingWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="training" {...props} />;
}

export function ContinuousAssuranceWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="continuous-assurance" {...props} />;
}

export function AssetWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="asset" {...props} />;
}

export function VendorWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="vendor" {...props} />;
}

export function PrivacyWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="privacy" {...props} />;
}

export function AIGovernanceWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="ai-governance" {...props} />;
}

export function ESGWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="esg" {...props} />;
}

export function AdministrationWorkspace(props: WorkspacePageProps) {
  return <WorkspaceLandingPage workspaceId="administration" {...props} />;
}
