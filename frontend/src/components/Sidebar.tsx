import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { theme } from '../theme';
import {
  AccessIcon,
  ActivityIcon,
  AssetIcon,
  AuditIcon,
  ControlIcon,
  DashboardIcon,
  EvidenceIcon,
  IssueIcon,
  PlusIcon,
  PolicyIcon,
  ReportsIcon,
  ReviewIcon,
  RiskIcon,
  TrainingIcon,
  UsersIcon,
  VendorIcon,
} from './icons';

interface NavItem {
  label: string;
  key: string;
  icon: ReactNode;
}

interface NavSection {
  title: string;
  railIcon: ReactNode;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    railIcon: <DashboardIcon size={18} />,
    items: [
      { label: 'Dashboard', key: 'dashboard', icon: <DashboardIcon size={18} /> },
      { label: 'Executive Overview', key: 'executive-overview', icon: <ReportsIcon size={18} /> },
      { label: 'Reports & Analytics', key: 'reports', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    title: 'Frameworks',
    railIcon: <ControlIcon size={18} />,
    items: [{ label: 'Control Library', key: 'controls', icon: <ControlIcon size={18} /> }],
  },
  {
    title: 'Inventory',
    railIcon: <AssetIcon size={18} />,
    items: [
      { label: 'Assets', key: 'assets', icon: <AssetIcon size={18} /> },
      { label: 'Vendors', key: 'vendors', icon: <VendorIcon size={18} /> },
    ],
  },
  {
    title: 'Third-Party Risk',
    railIcon: <VendorIcon size={18} />,
    items: [{ label: 'TPRM Dashboard', key: 'tprm-dashboard', icon: <VendorIcon size={18} /> }],
  },
  {
    title: 'Governance',
    railIcon: <PolicyIcon size={18} />,
    items: [
      { label: 'Policies & Documents', key: 'governance-documents', icon: <PolicyIcon size={18} /> },
      { label: 'Review Tasks', key: 'review-tasks', icon: <ReviewIcon size={18} /> },
    ],
  },
  {
    title: 'Risk Management',
    railIcon: <RiskIcon size={18} />,
    items: [
      { label: 'Risks', key: 'risks', icon: <RiskIcon size={18} /> },
      { label: 'Controls', key: 'controls', icon: <ControlIcon size={18} /> },
    ],
  },
  {
    title: 'Operations',
    railIcon: <IssueIcon size={18} />,
    items: [{ label: 'Issues', key: 'issues', icon: <IssueIcon size={18} /> }],
  },
  {
    title: 'Evidence',
    railIcon: <EvidenceIcon size={18} />,
    items: [
      { label: 'Evidence', key: 'evidence', icon: <EvidenceIcon size={18} /> },
      { label: 'Evidence Operations', key: 'compliance-tracker', icon: <EvidenceIcon size={18} /> },
      { label: 'Data Protection', key: 'data-protection', icon: <PolicyIcon size={18} /> },
    ],
  },
  {
    title: 'Readiness',
    railIcon: <AuditIcon size={18} />,
    items: [
      { label: 'Audit Readiness', key: 'audit-readiness', icon: <AuditIcon size={18} /> },
      { label: 'Training & Awareness', key: 'training', icon: <TrainingIcon size={18} /> },
      { label: 'Training Engagements', key: 'training-engagements', icon: <TrainingIcon size={18} /> },
      { label: 'Training KPIs', key: 'training-kpis', icon: <ReportsIcon size={18} /> },
    ],
  },
  {
    title: 'Reviews',
    railIcon: <ReviewIcon size={18} />,
    items: [
      { label: 'Application Review Register', key: 'app-review', icon: <ReviewIcon size={18} /> },
      { label: 'Access Review Register', key: 'access-review', icon: <AccessIcon size={18} /> },
    ],
  },
  {
    title: 'Team',
    railIcon: <UsersIcon size={18} />,
    items: [
      { label: 'Organization Setup', key: 'workspace-new', icon: <PlusIcon size={18} /> },
      { label: 'Team Access', key: 'workspace-members', icon: <UsersIcon size={18} /> },
      { label: 'Activity Log', key: 'activity-log', icon: <ActivityIcon size={18} /> },
    ],
  },
];

interface SidebarProps {
  activeKey: string;
  onSelect: (key: string) => void;
  isOpen?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export function Sidebar({ activeKey, onSelect, isOpen = true, isMobile = false, onClose, onOpen }: SidebarProps) {
  const activeSectionIndex = useMemo(() => {
    const index = navSections.findIndex((section) => section.items.some((item) => item.key === activeKey));
    return index >= 0 ? index : 0;
  }, [activeKey]);

  const [selectedSectionIndex, setSelectedSectionIndex] = useState(activeSectionIndex);

  useEffect(() => {
    setSelectedSectionIndex(activeSectionIndex);
  }, [activeSectionIndex]);

  const selectedSection = navSections[selectedSectionIndex] || navSections[0];
  const railWidth = 72;
  const panelWidth = isMobile ? 'min(264px, calc(100vw - 112px))' : '248px';
  const desktopPanelOpen = isMobile ? true : isOpen;

  return (
    <>
      {isMobile && isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: '64px 0 0 0',
            backgroundColor: 'rgba(15, 23, 42, 0.38)',
            backdropFilter: 'blur(3px)',
            zIndex: 20,
          }}
        />
      )}

      <aside
        style={{
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? '64px' : 'auto',
          left: 0,
          bottom: 0,
          zIndex: isMobile ? 30 : 'auto',
          display: 'flex',
          height: isMobile ? 'calc(100vh - 64px)' : '100%',
          transform: isMobile ? (isOpen ? 'translateX(0)' : 'translateX(calc(-100% - 16px))') : 'none',
          transition: 'transform 0.24s ease',
          pointerEvents: isMobile && !isOpen ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            width: railWidth,
            minWidth: railWidth,
            backgroundColor: theme.colors.surface,
            borderRight: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: `${theme.spacing[4]} ${theme.spacing[2]}`,
            gap: theme.spacing[2],
            boxShadow: theme.shadows.sm,
          }}
        >
          {navSections.map((section, index) => {
            const isActiveSection = index === selectedSectionIndex;
            return (
              <button
                key={section.title}
                type="button"
                title={section.title}
                onClick={() => {
                  setSelectedSectionIndex(index);

                  if (isMobile) {
                    onOpen?.();
                    return;
                  }

                  if (isActiveSection && isOpen) {
                    onClose?.();
                    return;
                  }

                  onOpen?.();
                }}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: theme.borderRadius.lg,
                  border: 'none',
                  background: isActiveSection ? '#1E293B' : 'transparent',
                  color: isActiveSection ? theme.colors.text.inverse : theme.colors.text.muted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: isActiveSection ? theme.shadows.md : 'none',
                }}
              >
                {section.railIcon}
              </button>
            );
          })}
        </div>

        <nav
          style={{
            width: desktopPanelOpen ? panelWidth : '0',
            minWidth: desktopPanelOpen ? panelWidth : '0',
            backgroundColor: theme.colors.sidebar.background,
            borderRight: `1px solid ${theme.colors.sidebar.border}`,
            padding: desktopPanelOpen ? theme.spacing[4] : '0',
            overflowY: 'auto',
            boxShadow: isMobile || isOpen ? theme.shadows.lg : 'none',
            transition: 'width 0.22s ease, min-width 0.22s ease, padding 0.22s ease',
            overflowX: 'hidden',
          }}
        >
          {desktopPanelOpen && (
            <>
              <div
                style={{
                  fontSize: theme.typography.sizes.xs,
                  fontWeight: theme.typography.weights.semibold,
                  color: theme.colors.text.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: theme.spacing[4],
                }}
              >
                {selectedSection.title}
              </div>

              <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                {selectedSection.items.map((item) => {
                  const isActive = activeKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelect(item.key)}
                      style={{
                        padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
                        cursor: 'pointer',
                        color: isActive ? theme.colors.text.inverse : theme.colors.text.main,
                        background: isActive ? '#1E293B' : theme.colors.surface,
                        borderRadius: theme.borderRadius.lg,
                        fontWeight: isActive ? theme.typography.weights.semibold : theme.typography.weights.medium,
                        fontSize: theme.typography.sizes.sm,
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing[3],
                        border: `1px solid ${isActive ? '#1E293B' : theme.colors.border}`,
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ opacity: isActive ? 1 : 0.72, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                      <span>{item.label}</span>
                      {isActive && (
                        <span
                          style={{
                            marginLeft: 'auto',
                            width: 8,
                            height: 8,
                            borderRadius: theme.borderRadius.full,
                            backgroundColor: '#34D399',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
