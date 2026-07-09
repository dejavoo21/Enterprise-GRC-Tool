import { useEffect, useMemo, useState } from 'react';
import {
  AuditIcon,
  AccessIcon,
  EvidenceIcon,
  IssueIcon,
  PolicyIcon,
  ReportsIcon,
  ReviewIcon,
  RiskIcon,
  TaskIcon,
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

type WorkspaceHealthItem = {
  id: string;
  label: string;
  count: number;
  routeKey: string;
  tone: 'default' | 'primary' | 'success' | 'warning' | 'danger';
};

type SidebarTrainingSummary = {
  overdueAssignments?: number;
};

function riskCountFromRows(rows: Array<{ severity?: string | null; residualRiskScore?: number | null }>) {
  return rows.filter((item) => {
    const severity = (item.severity || '').toLowerCase();
    if (severity === 'critical' || severity === 'high') return true;
    return Number(item.residualRiskScore || 0) >= 12;
  }).length;
}

function openRiskCount(rows: Array<{ status?: string | null }>) {
  return rows.filter((item) => (item.status || '').toLowerCase() !== 'closed').length;
}

function openIssueCount(rows: Array<{ status?: string | null }>) {
  return rows.filter((item) => !['resolved', 'closed'].includes((item.status || '').toLowerCase())).length;
}

function highRiskVendorCount(rows: Array<{ riskTier?: string | null; status?: string | null }>) {
  return rows.filter((item) => {
    const tier = (item.riskTier || '').toLowerCase();
    const status = (item.status || '').toLowerCase();
    return (tier === 'high' || tier === 'critical') && status !== 'expired';
  }).length;
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
  const [workspaceHealth, setWorkspaceHealth] = useState<WorkspaceHealthItem[]>([]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/review-tasks'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/admin/access-requests'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/admin/access-reviews'),
      apiCall<{ data: Array<{ framework: string; readinessPercent: number; openItems: number }> }>('/api/v1/audit-readiness/summary'),
      apiCall<{ data: Array<{ id: string; status?: string | null; severity?: string | null; residualRiskScore?: number | null }> }>('/api/v1/risks'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/issues'),
      apiCall<{ data: SidebarTrainingSummary }>('/api/v1/training/dashboard'),
      apiCall<{ data: Array<{ id: string; riskTier?: string | null; status?: string | null }> }>('/api/v1/tprm/assessments'),
    ]).then((results) => {
      if (!mounted) return;
      const reviewTasks = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
      const accessRequests = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];
      const accessReviews = results[2].status === 'fulfilled' ? results[2].value.data || [] : [];
      const auditSummary = results[3].status === 'fulfilled' ? results[3].value.data || [] : [];
      const risks = results[4].status === 'fulfilled' ? results[4].value.data || [] : [];
      const issues = results[5].status === 'fulfilled' ? results[5].value.data || [] : [];
      const trainingSummary = results[6].status === 'fulfilled' ? results[6].value.data || {} : {};
      const vendorAssessments = results[7].status === 'fulfilled' ? results[7].value.data || [] : [];

      const overdueActions = reviewTasks.filter((item) => (item.status || '').toLowerCase() === 'overdue').length;
      const auditBlockers = auditSummary.reduce((total, item) => total + Number(item.openItems || 0), 0);
      const openRisks = openRiskCount(risks);
      const outsideAppetite = riskCountFromRows(risks);
      const openIssues = openIssueCount(issues);
      const highRiskVendors = highRiskVendorCount(vendorAssessments);
      const overdueTraining = Number(trainingSummary.overdueAssignments || 0);

      setShortcutCounts({
        myTasks: reviewTasks.filter((item) => (item.status || '').toLowerCase() !== 'completed').length,
        myApprovals: accessRequests.filter((item) => ['pending', 'request_info'].includes((item.status || '').toLowerCase())).length,
        myReviews: accessReviews.filter((item) => !['completed', 'closed'].includes((item.status || '').toLowerCase())).length,
        myAudits: auditBlockers,
      });

      setWorkspaceHealth([
        { id: 'health-open-risks', label: 'Open risks', count: openRisks, routeKey: 'risks', tone: openRisks > 0 ? 'primary' : 'success' },
        { id: 'health-appetite', label: 'Outside appetite', count: outsideAppetite, routeKey: 'risks', tone: outsideAppetite > 0 ? 'danger' : 'success' },
        { id: 'health-actions', label: 'Overdue actions', count: overdueActions, routeKey: 'review-tasks', tone: overdueActions > 0 ? 'warning' : 'success' },
        { id: 'health-audits', label: 'Audit blockers', count: auditBlockers, routeKey: 'audit-readiness', tone: auditBlockers > 0 ? 'warning' : 'success' },
        { id: 'health-issues', label: 'Open issues', count: openIssues, routeKey: 'issues', tone: openIssues > 0 ? 'warning' : 'success' },
        { id: 'health-vendors', label: 'High-risk vendors', count: highRiskVendors, routeKey: 'tprm-dashboard', tone: highRiskVendors > 0 ? 'danger' : 'success' },
        { id: 'health-training', label: 'Overdue training', count: overdueTraining, routeKey: 'training', tone: overdueTraining > 0 ? 'warning' : 'success' },
      ]);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const railWidth = 76;
  const panelWidth = isMobile ? 'min(392px, calc(100vw - 92px))' : '348px';
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
    { key: 'review-tasks', label: 'My Tasks', count: shortcutCounts.myTasks, icon: <TaskIcon size={17} />, badgeStyle: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary } },
    { key: 'workspace-members', label: 'My Approvals', count: shortcutCounts.myApprovals, icon: <AccessIcon size={17} />, badgeStyle: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary } },
    { key: 'admin-access-reviews', label: 'My Reviews', count: shortcutCounts.myReviews, icon: <ReviewIcon size={17} />, badgeStyle: { backgroundColor: '#F3E8FF', color: '#7C3AED' } },
    { key: 'audit-readiness', label: 'My Audits', count: shortcutCounts.myAudits, icon: <AuditIcon size={17} />, badgeStyle: { backgroundColor: theme.colors.semantic.successLight, color: theme.colors.semantic.success } },
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
            padding: `${theme.spacing[2]} 12px`,
            background: theme.colors.sidebar.background,
            borderRight: `1px solid ${theme.colors.sidebar.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
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
                  width: 50,
                  height: 50,
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
                <span style={{ transform: 'scale(1.15)', display: 'inline-flex' }}>{workspace.railIcon}</span>
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
                      <span
                        style={{
                          fontSize: theme.typography.sizes.sm,
                          fontWeight: isActive ? theme.typography.weights.semibold : theme.typography.weights.medium,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </span>
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
                            padding: `5px 8px`,
                            borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.borderLight}`,
                            background: 'transparent',
                            textAlign: 'left',
                            color: theme.colors.text.main,
                            fontSize: theme.typography.sizes.xs,
                            cursor: 'pointer',
                            minHeight: 22,
                            transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background = theme.colors.surfaceHover;
                            event.currentTarget.style.borderColor = theme.colors.border;
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = 'transparent';
                            event.currentTarget.style.borderColor = theme.colors.borderLight;
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: theme.colors.text.secondary, display: 'inline-flex', transform: 'scale(0.92)' }}>{item.icon}</span>
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
                            padding: `6px 8px`,
                            borderRadius: theme.borderRadius.lg,
                            border: `1px solid ${theme.colors.borderLight}`,
                            background: 'transparent',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: theme.spacing[2],
                            color: theme.colors.text.main,
                            fontSize: '13px',
                            cursor: 'pointer',
                            minHeight: 38,
                            transition: 'background-color 120ms ease, border-color 120ms ease',
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background = theme.colors.surfaceHover;
                            event.currentTarget.style.borderColor = theme.colors.border;
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = 'transparent';
                            event.currentTarget.style.borderColor = theme.colors.borderLight;
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span style={{ color: theme.colors.text.secondary, display: 'inline-flex', flex: '0 0 auto' }}>{item.icon}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                          </span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              minWidth: 20,
                              height: 20,
                              padding: '0 6px',
                              borderRadius: theme.borderRadius.full,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 600,
                              lineHeight: 1,
                              ...item.badgeStyle,
                            }}
                          >
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div style={{ paddingTop: theme.spacing[1], borderTop: `1px solid ${theme.colors.border}` }}>
                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Workspace Health
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                    {workspaceHealth.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelect(item.routeKey);
                          if (isMobile) onClose?.();
                        }}
                        style={{
                          border: `1px solid ${theme.colors.borderLight}`,
                          borderRadius: theme.borderRadius.lg,
                          background: theme.colors.surfaceHover,
                          padding: '8px 8px 7px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: '10px', color: theme.colors.text.muted, lineHeight: 1.1 }}>{item.label}</span>
                        <span
                          style={{
                            fontSize: '18px',
                            fontWeight: theme.typography.weights.bold,
                            lineHeight: 1,
                            color:
                              item.tone === 'danger'
                                ? theme.colors.semantic.danger
                                : item.tone === 'warning'
                                  ? theme.colors.semantic.warning
                                  : item.tone === 'primary'
                                    ? theme.colors.primary
                                    : theme.colors.semantic.success,
                          }}
                        >
                          {item.count}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {workspaceHealth
                      .filter((item) => item.count > 0)
                      .slice(0, 5)
                      .map((item) => (
                        <button
                          key={`${item.id}-chip`}
                          type="button"
                          onClick={() => {
                            onSelect(item.routeKey);
                            if (isMobile) onClose?.();
                          }}
                          style={{
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: 999,
                            background: theme.colors.surface,
                            padding: '4px 8px',
                            fontSize: '10px',
                            color: theme.colors.text.secondary,
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
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
