import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import {
  AuditIcon,
  EvidenceIcon,
  IssueIcon,
  PolicyIcon,
  ReportsIcon,
  ReviewIcon,
  RiskIcon,
} from './icons';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/api';
import { theme } from '../theme';
import { canAccessWorkspace, getWorkspaceDefinitionForKey, workspaceCapabilityStrip, workspaceDefinitions } from '../lib/platformShell';

interface SidebarProps {
  activeKey: string;
  onSelect: (key: string) => void;
  isOpen?: boolean;
  isMobile?: boolean;
  showWorkspacePanelOnDesktop?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export function Sidebar({
  activeKey,
  onSelect,
  isOpen = true,
  isMobile = false,
  showWorkspacePanelOnDesktop = true,
  onClose,
  onOpen,
}: SidebarProps) {
  const { role } = useAuth();
  const activeWorkspace = useMemo(() => getWorkspaceDefinitionForKey(activeKey), [activeKey]);
  const selectedWorkspace = activeWorkspace;
  const [quickActionsOpen, setQuickActionsOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(true);
  const [shortcutCounts, setShortcutCounts] = useState({
    myTasks: 0,
    myApprovals: 0,
    myReviews: 0,
    myAudits: 0,
  });

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/review-tasks'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/admin/access-requests'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/admin/access-reviews'),
      apiCall<{ data: Array<{ framework: string; readinessPercent: number; openItems: number }> }>('/api/v1/audit-readiness/summary'),
    ]).then((results) => {
      if (!mounted) return;
      const reviewTasks = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
      const accessRequests = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];
      const accessReviews = results[2].status === 'fulfilled' ? results[2].value.data || [] : [];
      const auditSummary = results[3].status === 'fulfilled' ? results[3].value.data || [] : [];

      setShortcutCounts({
        myTasks: reviewTasks.filter((item) => (item.status || '').toLowerCase() !== 'completed').length,
        myApprovals: accessRequests.filter((item) => ['pending', 'request_info'].includes((item.status || '').toLowerCase())).length,
        myReviews: accessReviews.filter((item) => !['completed', 'closed'].includes((item.status || '').toLowerCase())).length,
        myAudits: auditSummary.reduce((total, item) => total + Number(item.openItems || 0), 0),
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const railWidth = 64;
  const panelWidth = isMobile ? 'min(288px, calc(100vw - 88px))' : '160px';
  const panelOpen = isMobile ? isOpen : showWorkspacePanelOnDesktop;
  const executiveQuickActions = [
    { key: 'risks', label: 'Create Risk', icon: <RiskIcon size={15} /> },
    { key: 'audit-readiness', label: 'Create Audit', icon: <AuditIcon size={15} /> },
    { key: 'evidence', label: 'Upload Evidence', icon: <EvidenceIcon size={15} /> },
    { key: 'governance-documents', label: 'Create Policy', icon: <PolicyIcon size={15} /> },
    { key: 'risk-matrix', label: 'Create Assessment', icon: <ReviewIcon size={15} /> },
    { key: 'issues', label: 'Create Incident', icon: <IssueIcon size={15} /> },
    { key: 'reports', label: 'Generate Report', icon: <ReportsIcon size={15} /> },
  ];
  const executiveShortcuts = [
    { key: 'review-tasks', label: 'My Tasks', count: shortcutCounts.myTasks },
    { key: 'workspace-members', label: 'My Approvals', count: shortcutCounts.myApprovals },
    { key: 'admin-access-reviews', label: 'My Reviews', count: shortcutCounts.myReviews },
    { key: 'audit-readiness', label: 'My Audits', count: shortcutCounts.myAudits },
  ];

  return (
    <>
      {isMobile && isOpen ? (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: '72px 0 0 0',
            backgroundColor: theme.colors.overlay,
            backdropFilter: 'blur(3px)',
            zIndex: 24,
          }}
        />
      ) : null}

      <aside
        aria-label="Workspace navigation"
        style={{
          position: isMobile ? 'fixed' : 'sticky',
          top: isMobile ? 72 : 0,
          left: 0,
          height: isMobile ? 'calc(100vh - 72px)' : 'calc(100vh - 72px)',
          zIndex: isMobile ? 30 : 20,
          display: 'flex',
          transform: isMobile ? (isOpen ? 'translateX(0)' : 'translateX(calc(-100% - 16px))') : 'none',
          transition: 'transform 0.24s ease',
          pointerEvents: isMobile && !isOpen ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            width: railWidth,
            minWidth: railWidth,
            padding: `${theme.spacing[2]} 10px`,
            background: theme.colors.sidebar.background,
            borderRight: `1px solid ${theme.colors.sidebar.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing[1],
            backdropFilter: 'blur(18px)',
          }}
        >
          {workspaceDefinitions.map((workspace) => {
            const isActiveWorkspace = workspace.id === selectedWorkspace.id;
            const hasAccess = canAccessWorkspace(workspace.id, role);
            return (
              <button
                key={workspace.id}
                type="button"
                title={workspace.title}
                disabled={!hasAccess}
                onClick={() => {
                  const defaultRoute = workspace.routeKey || workspace.items[0]?.key;
                  if (defaultRoute) {
                    onSelect(defaultRoute);
                  }
                  onOpen?.();
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.borderRadius.lg,
                  border: `1px solid ${isActiveWorkspace ? workspace.accent : theme.colors.border}`,
                  background: isActiveWorkspace ? theme.colors.primaryLight : theme.colors.surface,
                  color: isActiveWorkspace ? workspace.accent : theme.colors.text.muted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: hasAccess ? 'pointer' : 'not-allowed',
                  boxShadow: isActiveWorkspace ? theme.shadows.card : 'none',
                  opacity: hasAccess ? 1 : 0.4,
                }}
              >
                {workspace.railIcon}
              </button>
            );
          })}
        </div>

        <nav
          style={{
            width: panelOpen ? panelWidth : 0,
            minWidth: panelOpen ? panelWidth : 0,
            overflow: 'hidden',
            background: theme.colors.sidebar.background,
            borderRight: `1px solid ${theme.colors.sidebar.border}`,
            position: 'sticky',
            top: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: panelOpen ? '10px' : 0,
              display: 'grid',
              alignContent: 'start',
              gap: 10,
            }}
          >
            <div
              style={{
                padding: `4px 4px 8px`,
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Workspace
              </div>
              <div style={{ marginTop: 4, fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                {selectedWorkspace.title}
              </div>
            </div>

            {selectedWorkspace.id === 'executive' ? null : (
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                {workspaceCapabilityStrip.map((capability) => (
                  <span
                    key={capability}
                    style={{
                      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                      borderRadius: theme.borderRadius.full,
                      background: theme.colors.surfaceHover,
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.sizes.xs,
                      fontWeight: theme.typography.weights.medium,
                    }}
                  >
                    {capability}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gap: 2 }}>
              {selectedWorkspace.items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelect(item.key);
                      if (isMobile) onClose?.();
                    }}
                    style={{
                      width: '100%',
                      padding: `8px 10px`,
                      borderRadius: theme.borderRadius.lg,
                      border: `1px solid ${isActive ? selectedWorkspace.accent : 'transparent'}`,
                      background: isActive ? theme.colors.primaryLight : 'transparent',
                      color: theme.colors.text.main,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      minHeight: 36,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <span style={{ color: isActive ? selectedWorkspace.accent : theme.colors.text.secondary, display: 'inline-flex' }}>{item.icon}</span>
                      <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: isActive ? theme.typography.weights.semibold : theme.typography.weights.medium }}>{item.label}</span>
                      {isActive ? (
                        <span
                          style={{
                            marginLeft: 'auto',
                            width: 6,
                            height: 6,
                            borderRadius: theme.borderRadius.full,
                            background: selectedWorkspace.accent,
                          }}
                        />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedWorkspace.id === 'executive' ? (
              <>
                <div style={{ paddingTop: theme.spacing[1], borderTop: `1px solid ${theme.colors.border}` }}>
                  <button
                    type="button"
                    onClick={() => setQuickActionsOpen((current) => !current)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing[2],
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      marginBottom: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Quick Actions
                    </span>
                    <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{quickActionsOpen ? '−' : '+'}</span>
                  </button>
                  {quickActionsOpen ? (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {executiveQuickActions.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            onSelect(item.key);
                            if (isMobile) onClose?.();
                          }}
                          style={{
                            width: '100%',
                            padding: `7px 10px`,
                            borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.surface,
                            textAlign: 'left',
                            color: theme.colors.text.main,
                            fontSize: theme.typography.sizes.xs,
                            cursor: 'pointer',
                            minHeight: 30,
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing[2] }}>
                            <span style={{ color: theme.colors.primary, display: 'inline-flex' }}>{item.icon}</span>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div style={{ paddingTop: theme.spacing[1], borderTop: `1px solid ${theme.colors.border}` }}>
                  <button
                    type="button"
                    onClick={() => setShortcutsOpen((current) => !current)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing[2],
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      marginBottom: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Shortcuts
                    </span>
                    <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{shortcutsOpen ? '−' : '+'}</span>
                  </button>
                  {shortcutsOpen ? (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {executiveShortcuts.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            onSelect(item.key);
                            if (isMobile) onClose?.();
                          }}
                          style={{
                            width: '100%',
                            padding: `7px 10px`,
                            borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.border}`,
                            background: theme.colors.surface,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: theme.spacing[2],
                            color: theme.colors.text.main,
                            fontSize: theme.typography.sizes.xs,
                            cursor: 'pointer',
                            minHeight: 30,
                          }}
                        >
                          <span>{item.label}</span>
                          <Badge variant="primary" size="sm">{item.count}</Badge>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </nav>
      </aside>
    </>
  );
}
