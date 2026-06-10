import {
  EnterpriseRoleKey,
  PermissionAction,
  PermissionModule,
  RoleStatus,
  StepUpPurpose,
} from '../types/accessGovernance.js';
import { WorkspaceRole } from '../types/models.js';

export const GOVERNANCE_PERMISSION_MODULES: PermissionModule[] = [
  'Dashboard',
  'AI',
  'Risks',
  'Controls',
  'Evidence',
  'Audits',
  'Resilience',
  'Regulatory',
  'Vendors',
  'Policies',
  'Training',
  'Reports',
  'Users',
  'Settings',
];

export const GOVERNANCE_PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'approve',
  'delete',
  'export',
  'assign',
  'configure',
];

export const STEP_UP_ACTIONS: StepUpPurpose[] = [
  'assign_admin_role',
  'change_permissions',
  'approve_access_request',
  'revoke_access',
  'disable_mfa',
  'export_access_review',
];

export const ROLE_LABELS: Record<EnterpriseRoleKey, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  grc_manager: 'GRC Manager',
  risk_owner: 'Risk Owner',
  control_owner: 'Control Owner',
  auditor: 'Auditor',
  evidence_contributor: 'Evidence Contributor',
  vendor_manager: 'Vendor Manager',
  read_only_executive: 'Read-only Executive',
};

export const DEFAULT_ROLE_DESCRIPTIONS: Record<EnterpriseRoleKey, string> = {
  super_admin: 'Global platform administration, emergency access, and tenant oversight.',
  tenant_admin: 'Tenant configuration, user administration, and governance operations.',
  grc_manager: 'Cross-module GRC operation, approvals, and workflow coordination.',
  risk_owner: 'Risk intake, treatment tracking, and risk acceptance coordination.',
  control_owner: 'Control execution, evidence collection, and policy coordination.',
  auditor: 'Independent audit visibility, evidence review, and reporting access.',
  evidence_contributor: 'Operational evidence uploads and remediation support.',
  vendor_manager: 'Third-party onboarding, vendor assessments, and contract tracking.',
  read_only_executive: 'Board and executive read-only visibility across dashboards and reports.',
};

export type PermissionSet = Record<PermissionAction, boolean>;
export type RolePermissionMatrix = Record<PermissionModule, PermissionSet>;

function emptyPermissionSet(): PermissionSet {
  return {
    view: false,
    create: false,
    edit: false,
    approve: false,
    delete: false,
    export: false,
    assign: false,
    configure: false,
  };
}

function buildRoleMatrix(
  overrides: Partial<Record<PermissionModule, Partial<PermissionSet>>>,
): RolePermissionMatrix {
  const matrix = {} as RolePermissionMatrix;

  GOVERNANCE_PERMISSION_MODULES.forEach((moduleName) => {
    matrix[moduleName] = {
      ...emptyPermissionSet(),
      ...(overrides[moduleName] || {}),
    };
  });

  return matrix;
}

function viewExportOnAll(): Partial<Record<PermissionModule, Partial<PermissionSet>>> {
  return Object.fromEntries(
    GOVERNANCE_PERMISSION_MODULES.map((moduleName) => [moduleName, { view: true, export: true }]),
  ) as Partial<Record<PermissionModule, Partial<PermissionSet>>>;
}

export function defaultPermissionMatrix(): Record<EnterpriseRoleKey, RolePermissionMatrix> {
  return {
    super_admin: buildRoleMatrix(
      Object.fromEntries(
        GOVERNANCE_PERMISSION_MODULES.map((moduleName) => [
          moduleName,
          {
            view: true,
            create: true,
            edit: true,
            approve: true,
            delete: true,
            export: true,
            assign: true,
            configure: true,
          },
        ]),
      ) as Partial<Record<PermissionModule, Partial<PermissionSet>>>,
    ),
    tenant_admin: buildRoleMatrix({
      ...viewExportOnAll(),
      Dashboard: { view: true, export: true, configure: true },
      AI: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Risks: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Controls: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Evidence: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Audits: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Resilience: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Regulatory: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Vendors: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Policies: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Training: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Reports: { view: true, create: true, edit: true, approve: true, export: true },
      Users: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Settings: { view: true, edit: true, export: true, configure: true },
    }),
    grc_manager: buildRoleMatrix({
      ...viewExportOnAll(),
      Risks: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      AI: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Controls: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Evidence: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Audits: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Resilience: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Regulatory: { view: true, create: true, edit: true, approve: true, export: true, assign: true, configure: true },
      Vendors: { view: true, create: true, edit: true, export: true, assign: true },
      Policies: { view: true, create: true, edit: true, approve: true, export: true },
      Training: { view: true, create: true, edit: true, export: true, assign: true },
      Reports: { view: true, export: true, create: true },
      Users: { view: true, assign: true, export: true },
      Settings: { view: true, export: true },
    }),
    risk_owner: buildRoleMatrix({
      Dashboard: { view: true, export: true },
      AI: { view: true, create: true, edit: true, approve: false, export: true, assign: true },
      Risks: { view: true, create: true, edit: true, approve: false, export: true, assign: true },
      Controls: { view: true, export: true },
      Evidence: { view: true, create: true, export: true },
      Audits: { view: true, export: true },
      Resilience: { view: true, create: true, edit: true, export: true },
      Regulatory: { view: true, export: true },
      Reports: { view: true, export: true },
    }),
    control_owner: buildRoleMatrix({
      Dashboard: { view: true, export: true },
      AI: { view: true, edit: true, approve: true, export: true },
      Controls: { view: true, create: true, edit: true, export: true, assign: true },
      Evidence: { view: true, create: true, edit: true, export: true },
      Policies: { view: true, edit: true, export: true },
      Training: { view: true, export: true },
      Reports: { view: true, export: true },
      Audits: { view: true, approve: true, export: true },
      Resilience: { view: true, edit: true, approve: true, export: true },
      Regulatory: { view: true, edit: true, approve: true, export: true },
    }),
    auditor: buildRoleMatrix({
      ...viewExportOnAll(),
      AI: { view: true, export: true, approve: true },
      Audits: { view: true, export: true, approve: true },
      Evidence: { view: true, export: true, approve: true },
      Resilience: { view: true, export: true },
    }),
    evidence_contributor: buildRoleMatrix({
      Dashboard: { view: true },
      AI: { view: true },
      Evidence: { view: true, create: true, edit: true },
      Controls: { view: true },
      Policies: { view: true },
      Training: { view: true },
      Resilience: { view: true },
      Regulatory: { view: true },
    }),
    vendor_manager: buildRoleMatrix({
      Dashboard: { view: true, export: true },
      AI: { view: true, create: true, edit: true, approve: true, export: true, assign: true },
      Vendors: { view: true, create: true, edit: true, export: true, assign: true },
      Audits: { view: true, approve: true, export: true },
      Reports: { view: true, export: true },
      Evidence: { view: true, create: true },
      Resilience: { view: true, create: true, edit: true, export: true, assign: true },
      Regulatory: { view: true, create: true, edit: true, export: true, assign: true },
    }),
    read_only_executive: buildRoleMatrix({
      Dashboard: { view: true, export: true },
      AI: { view: true, export: true },
      Risks: { view: true, export: true },
      Controls: { view: true, export: true },
      Evidence: { view: true, export: true },
      Audits: { view: true, export: true },
      Vendors: { view: true, export: true },
      Policies: { view: true, export: true },
      Training: { view: true, export: true },
      Reports: { view: true, export: true },
      Resilience: { view: true, export: true },
      Regulatory: { view: true, export: true },
      Users: { view: true, export: true },
      Settings: { view: true },
    }),
  };
}

export function getDefaultRoles() {
  return (Object.keys(ROLE_LABELS) as EnterpriseRoleKey[]).map((id) => ({
    id,
    name: ROLE_LABELS[id],
    description: DEFAULT_ROLE_DESCRIPTIONS[id],
    status: 'active' as RoleStatus,
    isDefault: true,
    inheritedFrom: null,
  }));
}

export function mapLegacyWorkspaceRoleToEnterpriseRole(role: WorkspaceRole): EnterpriseRoleKey {
  switch (role) {
    case 'owner':
      return 'super_admin';
    case 'admin':
      return 'tenant_admin';
    case 'grc':
      return 'grc_manager';
    case 'auditor':
      return 'auditor';
    case 'viewer':
    default:
      return 'read_only_executive';
  }
}

export function mapEnterpriseRoleToLegacyWorkspaceRole(role: EnterpriseRoleKey): WorkspaceRole {
  switch (role) {
    case 'super_admin':
      return 'owner';
    case 'tenant_admin':
      return 'admin';
    case 'grc_manager':
    case 'risk_owner':
    case 'control_owner':
    case 'evidence_contributor':
    case 'vendor_manager':
      return 'grc';
    case 'auditor':
      return 'auditor';
    case 'read_only_executive':
    default:
      return 'viewer';
  }
}

export function getDefaultSodRules() {
  return [
    {
      id: 'risk-create-approve',
      title: 'Risk Author and Approver Conflict',
      description: 'A user should not both create and approve the same risk.',
      severity: 'medium' as const,
      rules: [
        { module: 'Risks' as PermissionModule, action: 'create' as PermissionAction },
        { module: 'Risks' as PermissionModule, action: 'approve' as PermissionAction },
      ],
    },
    {
      id: 'evidence-upload-approve',
      title: 'Evidence Upload and Approval Conflict',
      description: 'A user should not both upload and approve evidence.',
      severity: 'medium' as const,
      rules: [
        { module: 'Evidence' as PermissionModule, action: 'create' as PermissionAction },
        { module: 'Evidence' as PermissionModule, action: 'approve' as PermissionAction },
      ],
    },
    {
      id: 'vendor-create-approve',
      title: 'Vendor Assessment and Approval Conflict',
      description: 'A user should not both create vendor assessments and approve vendor risk.',
      severity: 'medium' as const,
      rules: [
        { module: 'Vendors' as PermissionModule, action: 'create' as PermissionAction },
        { module: 'Vendors' as PermissionModule, action: 'approve' as PermissionAction },
      ],
    },
    {
      id: 'controls-configure-audit-approve',
      title: 'Control Configuration and Audit Evidence Approval Conflict',
      description: 'A user should not configure controls and approve audit evidence.',
      severity: 'high' as const,
      rules: [
        { module: 'Controls' as PermissionModule, action: 'configure' as PermissionAction },
        { module: 'Audits' as PermissionModule, action: 'approve' as PermissionAction },
      ],
    },
  ];
}
