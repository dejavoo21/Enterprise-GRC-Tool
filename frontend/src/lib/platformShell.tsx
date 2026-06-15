import type { ReactNode } from 'react';
import type { WorkspaceRole } from '../types/auth';
import {
  AccessIcon,
  ActivityIcon,
  AssetIcon,
  AuditIcon,
  ControlIcon,
  DashboardIcon,
  EvidenceIcon,
  IssueIcon,
  PolicyIcon,
  ReportsIcon,
  ReviewIcon,
  RiskIcon,
  TrainingIcon,
  UsersIcon,
  VendorIcon,
} from '../components/icons';

export type WorkspaceId =
  | 'executive'
  | 'risk'
  | 'compliance'
  | 'controls'
  | 'evidence'
  | 'audit'
  | 'asset'
  | 'vendor'
  | 'privacy'
  | 'ai-governance'
  | 'esg'
  | 'administration';

export interface WorkspaceNavItem {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
}

export interface WorkspaceDefinition {
  id: WorkspaceId;
  title: string;
  subtitle: string;
  routeKey: string;
  routePath: string;
  railIcon: ReactNode;
  accent: string;
  allowedRoles: WorkspaceRole[];
  items: WorkspaceNavItem[];
}

export interface QuickActionDefinition {
  id: string;
  label: string;
  description: string;
  routeKey: string;
  group: string;
}

export const workspaceDefinitions: WorkspaceDefinition[] = [
  {
    id: 'executive',
    title: 'Executive Center',
    subtitle: 'Board intelligence, posture, trends, and reporting.',
    routeKey: 'executive-workspace',
    routePath: '/workspaces/executive',
    railIcon: <DashboardIcon size={18} />,
    accent: 'var(--color-primary)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'executive-workspace', label: 'Executive Workspace', description: 'Executive landing and command workspace.', icon: <DashboardIcon size={18} /> },
      { key: 'dashboard', label: 'Executive Command', description: 'Balanced enterprise command dashboard.', icon: <DashboardIcon size={18} /> },
      { key: 'executive-overview', label: 'Board Intelligence', description: 'Executive center and board signals.', icon: <ReportsIcon size={18} /> },
      { key: 'enterprise-operating-system', label: 'Enterprise OS', description: 'Unified entity graph, actions, approvals, workflows, and executive 360 views.', icon: <ActivityIcon size={18} /> },
      { key: 'reports', label: 'Board Reporting Center', description: 'Generate board, audit, and executive packs.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'risk',
    title: 'Risk Workspace',
    subtitle: 'Risk register, assessments, treatment, analytics, and issue operations.',
    routeKey: 'risk-workspace',
    routePath: '/workspaces/risk',
    railIcon: <RiskIcon size={18} />,
    accent: 'var(--color-warning)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'risk-workspace', label: 'Risk Workspace', description: 'Risk landing workspace.', icon: <RiskIcon size={18} /> },
      { key: 'risks', label: 'Risk Register', description: 'Enterprise risk posture and analytics.', icon: <RiskIcon size={18} /> },
      { key: 'risk-matrix', label: 'Risk Assessments', description: 'Heatmaps and scoring views.', icon: <ReviewIcon size={18} /> },
      { key: 'issues', label: 'Risk Operations', description: 'Issues, remediation, and actions.', icon: <IssueIcon size={18} /> },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance Workspace',
    subtitle: 'Coverage, obligations, and compliance coordination.',
    routeKey: 'compliance-workspace',
    routePath: '/workspaces/compliance',
    railIcon: <ReportsIcon size={18} />,
    accent: 'var(--color-info)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'compliance-workspace', label: 'Compliance Workspace', description: 'Compliance landing and program coordination.', icon: <ReportsIcon size={18} /> },
      { key: 'compliance-tracker', label: 'Coverage & Operations', description: 'Gap analysis and evidence operations.', icon: <ReportsIcon size={18} /> },
      { key: 'regulatory-change', label: 'Regulatory Obligations', description: 'Change monitoring and obligation tracking.', icon: <ActivityIcon size={18} /> },
      { key: 'data-protection', label: 'Compliance Reports', description: 'Data protection and reporting views.', icon: <PolicyIcon size={18} /> },
    ],
  },
  {
    id: 'controls',
    title: 'Controls Workspace',
    subtitle: 'Control library, performance, and mapped control posture.',
    routeKey: 'controls-workspace',
    routePath: '/workspaces/controls',
    railIcon: <ControlIcon size={18} />,
    accent: 'var(--color-success)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'controls-workspace', label: 'Controls Workspace', description: 'Control landing workspace.', icon: <ControlIcon size={18} /> },
      { key: 'controls', label: 'Controls', description: 'Control library and control performance.', icon: <ControlIcon size={18} /> },
      { key: 'compliance-tracker', label: 'Coverage Operations', description: 'Mapped control coverage and gap operations.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'evidence',
    title: 'Evidence Workspace',
    subtitle: 'Evidence inventory, requests, freshness, and assurance support.',
    routeKey: 'evidence-workspace',
    routePath: '/workspaces/evidence',
    railIcon: <EvidenceIcon size={18} />,
    accent: 'var(--color-primary-strong)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'evidence-workspace', label: 'Evidence Workspace', description: 'Evidence landing workspace.', icon: <EvidenceIcon size={18} /> },
      { key: 'evidence', label: 'Evidence', description: 'Evidence inventory and requests.', icon: <EvidenceIcon size={18} /> },
      { key: 'audit-readiness', label: 'Audit Support', description: 'Prepare evidence for audit readiness.', icon: <AuditIcon size={18} /> },
    ],
  },
  {
    id: 'audit',
    title: 'Audit Workspace',
    subtitle: 'Audit readiness, review registers, findings, and remediation.',
    routeKey: 'audit-workspace',
    routePath: '/workspaces/audit',
    railIcon: <AuditIcon size={18} />,
    accent: 'var(--color-danger)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'audit-workspace', label: 'Audit Workspace', description: 'Audit landing workspace.', icon: <AuditIcon size={18} /> },
      { key: 'audit-readiness', label: 'Audit Command Center', description: 'Readiness, requests, and evidence posture.', icon: <AuditIcon size={18} /> },
      { key: 'app-review', label: 'Application Reviews', description: 'Application review register.', icon: <ReviewIcon size={18} /> },
      { key: 'access-review', label: 'Access Reviews', description: 'Access certification and review register.', icon: <AccessIcon size={18} /> },
    ],
  },
  {
    id: 'asset',
    title: 'Asset Workspace',
    subtitle: 'Asset tracking, QR workflows, and operational inventory.',
    routeKey: 'asset-workspace',
    routePath: '/workspaces/assets',
    railIcon: <AssetIcon size={18} />,
    accent: 'var(--color-accent)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'asset-workspace', label: 'Asset Workspace', description: 'Asset landing workspace.', icon: <AssetIcon size={18} /> },
      { key: 'assets', label: 'Assets', description: 'Asset operations and lifecycle.', icon: <AssetIcon size={18} /> },
    ],
  },
  {
    id: 'vendor',
    title: 'Vendor Workspace',
    subtitle: 'Vendors, assessments, reviews, and third-party monitoring.',
    routeKey: 'vendor-workspace',
    routePath: '/workspaces/vendors',
    railIcon: <VendorIcon size={18} />,
    accent: 'var(--color-warning-strong)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'vendor-workspace', label: 'Vendor Workspace', description: 'Vendor landing workspace.', icon: <VendorIcon size={18} /> },
      { key: 'vendors', label: 'Vendors', description: 'Vendor register and lifecycle.', icon: <VendorIcon size={18} /> },
      { key: 'tprm-dashboard', label: 'Assessments & Monitoring', description: 'Third-party posture and reviews.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Workspace',
    subtitle: 'Privacy governance, DSARs, DPIAs, and data protection reporting.',
    routeKey: 'privacy-workspace',
    routePath: '/workspaces/privacy',
    railIcon: <PolicyIcon size={18} />,
    accent: 'var(--color-info-strong)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'privacy-workspace', label: 'Privacy Workspace', description: 'Privacy landing workspace.', icon: <PolicyIcon size={18} /> },
      { key: 'privacy-data-governance', label: 'Privacy Governance', description: 'Data inventory, DPIAs, DSARs, breaches, and privacy reporting.', icon: <PolicyIcon size={18} /> },
      { key: 'data-protection', label: 'Data Protection', description: 'Compliance reporting and privacy posture views.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'ai-governance',
    title: 'AI Governance Workspace',
    subtitle: 'AI inventory, controls, incidents, and compliance readiness.',
    routeKey: 'ai-governance-workspace',
    routePath: '/workspaces/ai-governance',
    railIcon: <ActivityIcon size={18} />,
    accent: 'var(--color-danger-strong)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'ai-governance-workspace', label: 'AI Governance Workspace', description: 'AI governance landing workspace.', icon: <ActivityIcon size={18} /> },
      { key: 'ai-governance', label: 'AI Governance', description: 'Inventory, controls, and incidents.', icon: <PolicyIcon size={18} /> },
    ],
  },
  {
    id: 'esg',
    title: 'ESG Workspace',
    subtitle: 'Sustainability, carbon, supplier ESG, reporting, and board readiness.',
    routeKey: 'esg-workspace',
    routePath: '/workspaces/esg',
    railIcon: <TrainingIcon size={18} />,
    accent: 'var(--color-success-strong)',
    allowedRoles: ['owner', 'admin', 'grc', 'auditor', 'viewer'],
    items: [
      { key: 'esg-workspace', label: 'ESG Workspace', description: 'ESG landing workspace.', icon: <TrainingIcon size={18} /> },
      { key: 'esg-management', label: 'ESG Management', description: 'Environmental, social, governance, and carbon command center.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'administration',
    title: 'Administration Workspace',
    subtitle: 'Users, roles, permissions, security, and workspace administration.',
    routeKey: 'administration-workspace',
    routePath: '/workspaces/administration',
    railIcon: <UsersIcon size={18} />,
    accent: 'var(--color-text-main)',
    allowedRoles: ['owner', 'admin'],
    items: [
      { key: 'administration-workspace', label: 'Administration Workspace', description: 'Administrative landing workspace.', icon: <UsersIcon size={18} /> },
      { key: 'workspace-new', label: 'Organization Setup', description: 'Workspace setup and tenant onboarding.', icon: <UsersIcon size={18} /> },
      { key: 'workspace-management', label: 'Workspace Management', description: 'Create, switch, archive, and configure workspaces.', icon: <UsersIcon size={18} /> },
      { key: 'workspace-members', label: 'Team Access', description: 'User access governance and reviews.', icon: <UsersIcon size={18} /> },
      { key: 'activity-ledger', label: 'Activity Ledger', description: 'Enterprise audit and activity hub.', icon: <ActivityIcon size={18} /> },
      { key: 'admin-users', label: 'Users', description: 'User directory and access state.', icon: <UsersIcon size={18} /> },
      { key: 'admin-roles', label: 'Roles', description: 'Role catalog and inheritance.', icon: <AccessIcon size={18} /> },
      { key: 'admin-permissions', label: 'Permissions', description: 'Permission matrix and SoD controls.', icon: <ControlIcon size={18} /> },
      { key: 'admin-authentication', label: 'Authentication', description: 'MFA, passkeys, and step-up flows.', icon: <AccessIcon size={18} /> },
      { key: 'admin-access-reviews', label: 'Access Reviews', description: 'Certification campaigns and evidence.', icon: <ReviewIcon size={18} /> },
      { key: 'admin-login-activity', label: 'Login Activity', description: 'Authentication monitoring.', icon: <ActivityIcon size={18} /> },
      { key: 'admin-security-settings', label: 'Security Settings', description: 'Sessions, MFA, and passkeys.', icon: <AccessIcon size={18} /> },
    ],
  },
];

export function getWorkspaceDefinitionById(workspaceId: WorkspaceId) {
  return workspaceDefinitions.find((workspace) => workspace.id === workspaceId);
}

export function canAccessWorkspace(workspaceId: WorkspaceId, role: WorkspaceRole | null) {
  if (!role) return false;
  const workspace = getWorkspaceDefinitionById(workspaceId);
  return Boolean(workspace && workspace.allowedRoles.includes(role));
}

export const activeKeyToWorkspaceId = workspaceDefinitions.reduce<Record<string, WorkspaceId>>((acc, workspace) => {
  acc[workspace.routeKey] = workspace.id;
  workspace.items.forEach((item) => {
    acc[item.key] = workspace.id;
  });
  return acc;
}, {});

export function getWorkspaceDefinitionForKey(activeKey: string) {
  const workspaceId = activeKeyToWorkspaceId[activeKey] || 'executive';
  return getWorkspaceDefinitionById(workspaceId) || workspaceDefinitions[0];
}

export const shellQuickActions: QuickActionDefinition[] = [
  { id: 'open-executive', label: 'Executive Workspace', description: 'Open the executive landing workspace.', routeKey: 'executive-workspace', group: 'Executive' },
  { id: 'open-risk', label: 'Risk Workspace', description: 'Open the risk landing workspace.', routeKey: 'risk-workspace', group: 'Risk' },
  { id: 'open-controls', label: 'Controls Workspace', description: 'Open the controls landing workspace.', routeKey: 'controls-workspace', group: 'Controls' },
  { id: 'open-evidence', label: 'Evidence Workspace', description: 'Open the evidence landing workspace.', routeKey: 'evidence-workspace', group: 'Evidence' },
  { id: 'open-audit', label: 'Audit Workspace', description: 'Open the audit landing workspace.', routeKey: 'audit-workspace', group: 'Audit' },
  { id: 'open-vendors', label: 'Vendor Workspace', description: 'Open the vendor landing workspace.', routeKey: 'vendor-workspace', group: 'Vendor' },
  { id: 'open-privacy', label: 'Privacy Workspace', description: 'Open the privacy landing workspace.', routeKey: 'privacy-workspace', group: 'Privacy' },
  { id: 'open-admin', label: 'Administration Workspace', description: 'Open the administration landing workspace.', routeKey: 'administration-workspace', group: 'Administration' },
];

export const workspaceCapabilityStrip = ['Workspace', 'Operations', 'Analytics', 'Reporting', 'Security'];

export const shellSearchIndex = workspaceDefinitions.flatMap((workspace) =>
  workspace.items.map((item) => ({
    ...item,
    workspaceId: workspace.id,
    workspaceTitle: workspace.title,
    keywords: `${workspace.title} ${item.label} ${item.description}`.toLowerCase(),
  })),
);

export const workspaceNavigationAudit = workspaceDefinitions.map((workspace) => ({
  workspace: workspace.title,
  route: workspace.routePath,
  routeKey: workspace.routeKey,
  component:
    workspace.id === 'executive'
      ? 'ExecutiveWorkspace'
      : workspace.id === 'risk'
        ? 'RiskWorkspace'
        : workspace.id === 'compliance'
          ? 'ComplianceWorkspace'
          : workspace.id === 'controls'
            ? 'ControlsWorkspace'
            : workspace.id === 'evidence'
              ? 'EvidenceWorkspace'
              : workspace.id === 'audit'
                ? 'AuditWorkspace'
                : workspace.id === 'asset'
                  ? 'AssetWorkspace'
                  : workspace.id === 'vendor'
                    ? 'VendorWorkspace'
                    : workspace.id === 'privacy'
                      ? 'PrivacyWorkspace'
                      : workspace.id === 'ai-governance'
                        ? 'AIGovernanceWorkspace'
                        : workspace.id === 'esg'
                          ? 'ESGWorkspace'
                          : 'AdministrationWorkspace',
  status: 'configured',
}));
