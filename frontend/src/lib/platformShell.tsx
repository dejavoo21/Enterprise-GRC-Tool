import type { ReactNode } from 'react';
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

export interface WorkspaceNavItem {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
}

export interface WorkspaceDefinition {
  id:
    | 'executive'
    | 'governance'
    | 'risk'
    | 'compliance'
    | 'audit'
    | 'third-party'
    | 'asset'
    | 'resilience'
    | 'ai-governance'
    | 'esg'
    | 'administration';
  title: string;
  subtitle: string;
  railIcon: ReactNode;
  accent: string;
  items: WorkspaceNavItem[];
}

export interface QuickActionDefinition {
  id: string;
  label: string;
  description: string;
  routeKey: string;
  group: string;
}

export interface ShellNotification {
  id: string;
  title: string;
  detail: string;
  routeKey: string;
  priority: 'low' | 'medium' | 'high';
  unread?: boolean;
}

export interface PersonalizedItem {
  id: string;
  label: string;
  detail: string;
  routeKey: string;
  tone: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

export const workspaceDefinitions: WorkspaceDefinition[] = [
  {
    id: 'executive',
    title: 'Executive Center',
    subtitle: 'Board intelligence, posture, trends, and reporting.',
    railIcon: <DashboardIcon size={18} />,
    accent: 'var(--color-primary)',
    items: [
      { key: 'dashboard', label: 'Executive Command', description: 'Tiered enterprise dashboard.', icon: <DashboardIcon size={18} /> },
      { key: 'executive-overview', label: 'Board Intelligence', description: 'Executive center and board signals.', icon: <ReportsIcon size={18} /> },
      { key: 'enterprise-operating-system', label: 'Enterprise OS', description: 'Unified entity graph, actions, approvals, workflows, and executive 360 views.', icon: <ActivityIcon size={18} /> },
      { key: 'reports', label: 'Board Reporting Center', description: 'Generate board, audit, and executive packs.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'governance',
    title: 'Governance Workspace',
    subtitle: 'Policy lifecycle, approvals, obligations, and governance reporting.',
    railIcon: <PolicyIcon size={18} />,
    accent: 'var(--color-info)',
    items: [
      { key: 'governance-documents', label: 'Policies & Standards', description: 'Documents, standards, and procedures.', icon: <PolicyIcon size={18} /> },
      { key: 'review-tasks', label: 'Approvals & Reviews', description: 'Policy reviews and governance tasks.', icon: <ReviewIcon size={18} /> },
      { key: 'regulatory-change', label: 'Regulatory Obligations', description: 'Change monitoring and obligation tracking.', icon: <ActivityIcon size={18} /> },
    ],
  },
  {
    id: 'risk',
    title: 'Risk Workspace',
    subtitle: 'Risk register, assessments, treatment, analytics, and KRIs.',
    railIcon: <RiskIcon size={18} />,
    accent: 'var(--color-warning)',
    items: [
      { key: 'risks', label: 'Risk Register', description: 'Enterprise risk posture and analytics.', icon: <RiskIcon size={18} /> },
      { key: 'risk-matrix', label: 'Risk Assessments', description: 'Heatmaps and scoring views.', icon: <ReviewIcon size={18} /> },
      { key: 'issues', label: 'Risk Operations', description: 'Issues, remediation, and actions.', icon: <IssueIcon size={18} /> },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance Workspace',
    subtitle: 'Frameworks, controls, evidence, and coverage.',
    railIcon: <ControlIcon size={18} />,
    accent: 'var(--color-success)',
    items: [
      { key: 'controls', label: 'Controls', description: 'Control library and control performance.', icon: <ControlIcon size={18} /> },
      { key: 'evidence', label: 'Evidence', description: 'Evidence inventory and requests.', icon: <EvidenceIcon size={18} /> },
      { key: 'compliance-tracker', label: 'Coverage & Operations', description: 'Gap analysis and evidence operations.', icon: <ReportsIcon size={18} /> },
      { key: 'data-protection', label: 'Compliance Reports', description: 'Data protection and reporting views.', icon: <PolicyIcon size={18} /> },
      { key: 'privacy-data-governance', label: 'Privacy Governance', description: 'Data inventory, DPIAs, DSARs, breaches, and privacy reporting.', icon: <PolicyIcon size={18} /> },
    ],
  },
  {
    id: 'audit',
    title: 'Audit Workspace',
    subtitle: 'Audit readiness, engagements, findings, and remediation.',
    railIcon: <AuditIcon size={18} />,
    accent: 'var(--color-danger)',
    items: [
      { key: 'audit-readiness', label: 'Audit Command Center', description: 'Readiness, requests, and evidence posture.', icon: <AuditIcon size={18} /> },
      { key: 'app-review', label: 'Application Reviews', description: 'Application review register.', icon: <ReviewIcon size={18} /> },
      { key: 'access-review', label: 'Access Reviews', description: 'Access certification and review register.', icon: <AccessIcon size={18} /> },
    ],
  },
  {
    id: 'third-party',
    title: 'Third Party Workspace',
    subtitle: 'Vendors, assessments, reviews, contracts, and monitoring.',
    railIcon: <VendorIcon size={18} />,
    accent: 'var(--color-primary-strong)',
    items: [
      { key: 'vendors', label: 'Vendors', description: 'Vendor register and lifecycle.', icon: <VendorIcon size={18} /> },
      { key: 'tprm-dashboard', label: 'Assessments & Monitoring', description: 'Third-party posture and reviews.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'asset',
    title: 'Asset Workspace',
    subtitle: 'Asset tracking, QR workflows, and operational inventory.',
    railIcon: <AssetIcon size={18} />,
    accent: 'var(--color-accent)',
    items: [{ key: 'assets', label: 'Assets', description: 'Asset operations and lifecycle.', icon: <AssetIcon size={18} /> }],
  },
  {
    id: 'resilience',
    title: 'Resilience Workspace',
    subtitle: 'Continuity, recovery, training, and operating readiness.',
    railIcon: <TrainingIcon size={18} />,
    accent: 'var(--color-success-strong)',
    items: [
      { key: 'business-continuity', label: 'Business Continuity', description: 'Continuity, exercises, and dependencies.', icon: <AuditIcon size={18} /> },
      { key: 'training', label: 'Training & Awareness', description: 'Campaigns and completion posture.', icon: <TrainingIcon size={18} /> },
      { key: 'training-engagements', label: 'Training Engagements', description: 'Engagements and assignments.', icon: <TrainingIcon size={18} /> },
      { key: 'training-kpis', label: 'Training Reports', description: 'KPIs and board-facing metrics.', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    id: 'esg',
    title: 'ESG Workspace',
    subtitle: 'Sustainability, carbon, supplier ESG, reporting, and board readiness.',
    railIcon: <ReportsIcon size={18} />,
    accent: 'var(--color-info-strong)',
    items: [{ key: 'esg-management', label: 'ESG Management', description: 'Environmental, social, governance, and carbon command center.', icon: <ReportsIcon size={18} /> }],
  },
  {
    id: 'ai-governance',
    title: 'AI Governance Workspace',
    subtitle: 'AI inventory, controls, incidents, and compliance readiness.',
    railIcon: <ActivityIcon size={18} />,
    accent: 'var(--color-danger-strong)',
    items: [{ key: 'ai-governance', label: 'AI Governance', description: 'Inventory, controls, and incidents.', icon: <PolicyIcon size={18} /> }],
  },
  {
    id: 'administration',
    title: 'Administration Workspace',
    subtitle: 'Users, roles, permissions, access governance, and tenant settings.',
    railIcon: <UsersIcon size={18} />,
    accent: 'var(--color-text-main)',
    items: [
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

export const activeKeyToWorkspaceId = workspaceDefinitions.reduce<Record<string, WorkspaceDefinition['id']>>((acc, workspace) => {
  workspace.items.forEach((item) => {
    acc[item.key] = workspace.id;
  });
  return acc;
}, {});

export function getWorkspaceDefinitionForKey(activeKey: string) {
  const workspaceId = activeKeyToWorkspaceId[activeKey] || 'executive';
  return workspaceDefinitions.find((workspace) => workspace.id === workspaceId) || workspaceDefinitions[0];
}

export const shellQuickActions: QuickActionDefinition[] = [
  { id: 'create-risk', label: 'Create Risk', description: 'Open the risk workspace and add a new risk.', routeKey: 'risks', group: 'Risk' },
  { id: 'create-audit', label: 'Create Audit', description: 'Jump into the audit command center.', routeKey: 'audit-readiness', group: 'Audit' },
  { id: 'vendor-review', label: 'Create Vendor Review', description: 'Start a vendor assessment workflow.', routeKey: 'tprm-dashboard', group: 'Third Party' },
  { id: 'upload-evidence', label: 'Upload Evidence', description: 'Go to evidence operations and upload artifacts.', routeKey: 'evidence', group: 'Compliance' },
  { id: 'create-policy', label: 'Create Policy', description: 'Launch governance document workflows.', routeKey: 'governance-documents', group: 'Governance' },
  { id: 'create-assessment', label: 'Create Assessment', description: 'Open risk assessments and matrix tooling.', routeKey: 'risk-matrix', group: 'Risk' },
  { id: 'create-incident', label: 'Create Incident', description: 'Move to issue operations and remediation.', routeKey: 'issues', group: 'Operations' },
  { id: 'assign-task', label: 'Assign Task', description: 'Open review tasks and assign work.', routeKey: 'review-tasks', group: 'Governance' },
  { id: 'generate-report', label: 'Generate Report', description: 'Open the board reporting center.', routeKey: 'reports', group: 'Executive' },
  { id: 'privacy-review', label: 'Open Privacy Program', description: 'Review privacy inventory, DSARs, and DPIAs.', routeKey: 'privacy-data-governance', group: 'Compliance' },
];

export const shellNotifications: ShellNotification[] = [
  { id: 'notif-1', title: 'Approval required', detail: '3 access requests are waiting for review before workspace activation.', routeKey: 'workspace-members', priority: 'high', unread: true },
  { id: 'notif-2', title: 'Audit evidence due', detail: 'ISO 27001 readiness has 6 evidence items approaching their deadline.', routeKey: 'audit-readiness', priority: 'high', unread: true },
  { id: 'notif-3', title: 'Vendor review overdue', detail: 'Two high-risk vendors require refreshed assessments this week.', routeKey: 'tprm-dashboard', priority: 'medium', unread: true },
  { id: 'notif-4', title: 'Policy review window', detail: 'Policy approvals for the governance workspace are due in 4 days.', routeKey: 'governance-documents', priority: 'medium' },
  { id: 'notif-5', title: 'Training reminder', detail: 'Security awareness completion fell below the target threshold.', routeKey: 'training', priority: 'low' },
];

export const personalizedHomeItems: PersonalizedItem[] = [
  { id: 'my-tasks', label: 'My Tasks', detail: '8 open workflow items across governance and evidence.', routeKey: 'review-tasks', tone: 'warning' },
  { id: 'my-approvals', label: 'My Approvals', detail: '3 approvals need step-up verification.', routeKey: 'workspace-members', tone: 'danger' },
  { id: 'my-reviews', label: 'My Reviews', detail: '2 access review certifications are due this week.', routeKey: 'admin-access-reviews', tone: 'primary' },
  { id: 'my-audits', label: 'My Audits', detail: 'Audit readiness has 4 open blocker items.', routeKey: 'audit-readiness', tone: 'warning' },
  { id: 'my-risks', label: 'My Risks', detail: '5 priority risks moved above appetite.', routeKey: 'risks', tone: 'danger' },
  { id: 'my-controls', label: 'My Controls', detail: '12 controls need evidence refresh in the next 30 days.', routeKey: 'controls', tone: 'default' },
  { id: 'my-vendors', label: 'My Vendors', detail: '1 strategic vendor is pending risk committee review.', routeKey: 'vendors', tone: 'primary' },
  { id: 'my-notifications', label: 'My Notifications', detail: 'Unread alerts across approvals, audits, and reporting.', routeKey: 'activity-ledger', tone: 'success' },
];

export const workspaceCapabilityStrip = ['Overview', 'Operations', 'Analytics', 'Reports', 'Settings'];

export const shellSearchIndex = workspaceDefinitions.flatMap((workspace) =>
  workspace.items.map((item) => ({
    ...item,
    workspaceId: workspace.id,
    workspaceTitle: workspace.title,
    keywords: `${workspace.title} ${item.label} ${item.description}`.toLowerCase(),
  })),
);
