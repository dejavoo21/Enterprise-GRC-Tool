import type { ReactNode } from 'react';
import { theme } from '../theme';
import {
  DashboardIcon,
  ReportsIcon,
  FrameworkIcon,
  ControlIcon,
  AssetIcon,
  VendorIcon,
  AppIcon,
  PolicyIcon,
  RiskIcon,
  TreatmentIcon,
  MatrixIcon,
  IssueIcon,
  IncidentIcon,
  TaskIcon,
  EvidenceIcon,
  StatementIcon,
  TraceIcon,
  ReviewIcon,
  AccessIcon,
  SettingsIcon,
  AuditIcon,
  TrainingIcon,
  ActivityIcon,
  UsersIcon,
  PlusIcon,
} from './icons';

interface NavItem {
  label: string;
  key: string;
  icon: ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', key: 'dashboard', icon: <DashboardIcon size={18} /> },
      { label: 'Executive Overview', key: 'executive-overview', icon: <ReportsIcon size={18} /> },
      { label: 'Reports & Analytics', key: 'reports', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    title: 'FRAMEWORKS',
    items: [
      { label: 'Framework Library', key: 'frameworks', icon: <FrameworkIcon size={18} /> },
      { label: 'Control Library', key: 'control-library', icon: <ControlIcon size={18} /> },
    ],
  },
  {
    title: 'INVENTORY',
    items: [
      { label: 'Assets', key: 'assets', icon: <AssetIcon size={18} /> },
      { label: 'Vendors', key: 'vendors', icon: <VendorIcon size={18} /> },
      { label: 'Applications', key: 'applications', icon: <AppIcon size={18} /> },
    ],
  },
  {
    title: 'THIRD PARTY RISK',
    items: [
      { label: 'TPRM Dashboard', key: 'tprm-dashboard', icon: <VendorIcon size={18} /> },
      { label: 'Assessments', key: 'tprm-assessments', icon: <AuditIcon size={18} /> },
      { label: 'Questionnaires', key: 'tprm-questionnaires', icon: <PolicyIcon size={18} /> },
      { label: 'Contracts', key: 'tprm-contracts', icon: <StatementIcon size={18} /> },
      { label: 'Incidents', key: 'tprm-incidents', icon: <IncidentIcon size={18} /> },
    ],
  },
  {
    title: 'GOVERNANCE',
    items: [
      { label: 'Policies & Documents', key: 'governance-documents', icon: <PolicyIcon size={18} /> },
      { label: 'Review Tasks', key: 'review-tasks', icon: <ReviewIcon size={18} /> },
    ],
  },
  {
    title: 'RISK MANAGEMENT',
    items: [
      { label: 'Risks', key: 'risks', icon: <RiskIcon size={18} /> },
      { label: 'Controls', key: 'controls', icon: <ControlIcon size={18} /> },
      { label: 'Treatments', key: 'treatments', icon: <TreatmentIcon size={18} /> },
      { label: 'Risk Matrix', key: 'risk-matrix', icon: <MatrixIcon size={18} /> },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Issues', key: 'issues', icon: <IssueIcon size={18} /> },
      { label: 'Incidents', key: 'incidents', icon: <IncidentIcon size={18} /> },
      { label: 'Tasks', key: 'tasks', icon: <TaskIcon size={18} /> },
    ],
  },
  {
    title: 'COMPLIANCE & EVIDENCE',
    items: [
      { label: 'Evidence', key: 'evidence', icon: <EvidenceIcon size={18} /> },
      { label: 'Compliance Evidence Tracker', key: 'compliance-tracker', icon: <EvidenceIcon size={18} /> },
      { label: 'Data Protection', key: 'data-protection', icon: <PolicyIcon size={18} /> },
      { label: 'Statement of Applicability', key: 'soa', icon: <StatementIcon size={18} /> },
      { label: 'Traceability', key: 'traceability', icon: <TraceIcon size={18} /> },
    ],
  },
  {
    title: 'READINESS & PEOPLE',
    items: [
      { label: 'Audit Readiness', key: 'audit-readiness', icon: <AuditIcon size={18} /> },
      { label: 'Training & Awareness', key: 'training', icon: <TrainingIcon size={18} /> },
      { label: 'Training Engagements', key: 'training-engagements', icon: <TrainingIcon size={18} /> },
      { label: 'Training KPIs', key: 'training-kpis', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    title: 'KNOWLEDGE LIBRARY',
    items: [
      { label: 'Awareness Library', key: 'awareness-library', icon: <PolicyIcon size={18} /> },
    ],
  },
  {
    title: 'REVIEWS',
    items: [
      { label: 'Application Review Register', key: 'app-review', icon: <ReviewIcon size={18} /> },
      { label: 'Access Review Register', key: 'access-review', icon: <AccessIcon size={18} /> },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { label: 'New Workspace', key: 'workspace-new', icon: <PlusIcon size={18} /> },
      { label: 'Workspace Members', key: 'workspace-members', icon: <UsersIcon size={18} /> },
      { label: 'Activity Log', key: 'activity-log', icon: <ActivityIcon size={18} /> },
      { label: 'Settings', key: 'settings', icon: <SettingsIcon size={18} /> },
    ],
  },
];

interface SidebarProps {
  activeKey: string;
  onSelect: (key: string) => void;
  isOpen?: boolean;
}

export function Sidebar({ activeKey, onSelect, isOpen = true }: SidebarProps) {
  return (
    <nav
      style={{
        width: isOpen ? '260px' : '0',
        minWidth: isOpen ? '260px' : '0',
        backgroundColor: theme.colors.sidebar.background,
        borderRight: `1px solid ${theme.colors.sidebar.border}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      <div style={{ padding: theme.spacing[4], flex: 1 }}>
        {navSections.map((section, sectionIndex) => (
          <div key={section.title} style={{ marginBottom: theme.spacing[4] }}>
            <div
              style={{
                fontSize: theme.typography.sizes.xs,
                fontWeight: theme.typography.weights.semibold,
                color: theme.colors.text.muted,
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                letterSpacing: '0.05em',
                marginTop: sectionIndex === 0 ? 0 : theme.spacing[2],
              }}
            >
              {section.title}
            </div>

            {section.items.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(item.key);
                  }}
                  style={{
                    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                    cursor: 'pointer',
                    color: isActive ? theme.colors.primary : theme.colors.text.secondary,
                    backgroundColor: isActive ? theme.colors.sidebar.itemActive : 'transparent',
                    borderRadius: theme.borderRadius.lg,
                    fontWeight: isActive ? theme.typography.weights.medium : theme.typography.weights.regular,
                    fontSize: theme.typography.sizes.sm,
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing[3],
                    transition: 'all 0.15s ease',
                    marginBottom: theme.spacing[1],
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = theme.colors.sidebar.itemHover;
                      e.currentTarget.style.color = theme.colors.text.main;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.text.secondary;
                    }
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
