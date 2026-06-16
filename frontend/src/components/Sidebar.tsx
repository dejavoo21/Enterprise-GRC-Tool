import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
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

  const railWidth = 84;
  const panelWidth = isMobile ? 'min(320px, calc(100vw - 108px))' : '280px';
  const panelOpen = isMobile ? isOpen : showWorkspacePanelOnDesktop;
  const executiveQuickActions = [
    { key: 'risks', label: 'Create Risk' },
    { key: 'audit-readiness', label: 'Create Audit' },
    { key: 'evidence', label: 'Upload Evidence' },
    { key: 'governance-documents', label: 'Create Policy' },
    { key: 'risk-matrix', label: 'Create Assessment' },
    { key: 'tprm-dashboard', label: 'Create Vendor Review' },
    { key: 'issues', label: 'Create Incident' },
    { key: 'reports', label: 'Generate Report' },
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
            padding: `${theme.spacing[4]} ${theme.spacing[2]}`,
            background: theme.colors.sidebar.background,
            borderRight: `1px solid ${theme.colors.sidebar.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing[2],
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
                  width: 52,
                  height: 52,
                  borderRadius: theme.borderRadius.xl,
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
            boxShadow: theme.shadows.md,
          }}
        >
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: panelOpen ? theme.spacing[4] : 0,
              display: 'grid',
              alignContent: 'start',
              gap: theme.spacing[4],
            }}
          >
            <div
              style={{
                borderRadius: theme.borderRadius['2xl'],
                padding: theme.spacing[4],
                background: theme.colors.gradients.heroSubtle,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Workspace
              </div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                {selectedWorkspace.title}
              </div>
              <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                {selectedWorkspace.subtitle}
              </div>
            </div>

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

            <div style={{ display: 'grid', gap: theme.spacing[2] }}>
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
                      padding: theme.spacing[3],
                      borderRadius: theme.borderRadius.xl,
                      border: `1px solid ${isActive ? selectedWorkspace.accent : theme.colors.border}`,
                      background: isActive ? theme.colors.primaryLight : theme.colors.surface,
                      color: theme.colors.text.main,
                      textAlign: 'left',
                      display: 'grid',
                      gap: theme.spacing[1],
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                      <span style={{ color: isActive ? selectedWorkspace.accent : theme.colors.text.secondary, display: 'inline-flex' }}>{item.icon}</span>
                      <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{item.label}</span>
                      {isActive ? (
                        <span
                          style={{
                            marginLeft: 'auto',
                            width: 8,
                            height: 8,
                            borderRadius: theme.borderRadius.full,
                            background: selectedWorkspace.accent,
                          }}
                        />
                      ) : null}
                    </div>
                    <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, lineHeight: 1.5 }}>
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedWorkspace.id === 'executive' ? (
              <>
                <div style={{ paddingTop: theme.spacing[1], borderTop: `1px solid ${theme.colors.border}` }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: theme.spacing[2] }}>
                    Quick Actions
                  </div>
                  <div style={{ display: 'grid', gap: theme.spacing[1] }}>
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
                          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                          borderRadius: theme.borderRadius.lg,
                          border: `1px solid ${theme.colors.border}`,
                          background: theme.colors.surface,
                          textAlign: 'left',
                          color: theme.colors.text.main,
                          fontSize: theme.typography.sizes.sm,
                          cursor: 'pointer',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ paddingTop: theme.spacing[1], borderTop: `1px solid ${theme.colors.border}` }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: theme.spacing[2] }}>
                    Shortcuts
                  </div>
                  <div style={{ display: 'grid', gap: theme.spacing[1] }}>
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
                          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                          borderRadius: theme.borderRadius.lg,
                          border: `1px solid ${theme.colors.border}`,
                          background: theme.colors.surface,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: theme.spacing[2],
                          color: theme.colors.text.main,
                          fontSize: theme.typography.sizes.sm,
                          cursor: 'pointer',
                        }}
                      >
                        <span>{item.label}</span>
                        <Badge variant="primary" size="sm">{item.count}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </nav>
      </aside>
    </>
  );
}
