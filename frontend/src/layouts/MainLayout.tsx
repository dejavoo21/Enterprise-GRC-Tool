import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Sidebar, TopBar } from '../components';
import { useAuth } from '../context/AuthContext';
import { useShell } from '../context/ShellContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiCall, fetchActivityLedger } from '../lib/api';
import { getWorkspaceOrganizationName } from '../lib/workspaceDisplay';
import {
  getWorkspaceDefinitionForKey,
  shellQuickActions,
  shellSearchIndex,
} from '../lib/platformShell';
import { theme } from '../theme';
import type { ActivityLedgerEntry } from '../types/activityLedger';

interface MainLayoutProps {
  children: React.ReactNode;
  activeKey: string;
  onNavigate: (key: string) => void;
}

interface LiveNotificationItem {
  id: string;
  title: string;
  detail: string;
  routeKey: string;
  priority: 'low' | 'medium' | 'high';
  unread?: boolean;
}

interface LiveFocusItem {
  id: string;
  label: string;
  detail: string;
  routeKey: string;
  tone: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

interface RightRailState {
  focusItems: LiveFocusItem[];
  notifications: LiveNotificationItem[];
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toneForOutcome(outcome: ActivityLedgerEntry['outcome']) {
  switch (outcome) {
    case 'failed':
    case 'blocked':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'success';
  }
}

function compactCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function riskCountFromRows(rows: Array<{ severity?: string | null; residualScore?: number | null }>) {
  return rows.filter((item) => {
    const severity = (item.severity || '').toLowerCase();
    if (severity === 'critical' || severity === 'high') return true;
    return Number(item.residualScore || 0) >= 70;
  }).length;
}

function priorityBadgeVariant(priority: LiveNotificationItem['priority']) {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'default';
}

function Drawer({
  title,
  subtitle,
  open,
  onClose,
  children,
  width = 360,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <>
      {open ? (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: theme.colors.overlay,
            zIndex: 50,
          }}
        />
      ) : null}
      <aside
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width,
          maxWidth: '100vw',
          transform: open ? 'translateX(0)' : 'translateX(110%)',
          transition: 'transform 0.24s ease',
          background: theme.colors.surface,
          borderLeft: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.xl,
          zIndex: 60,
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
        }}
      >
        <div style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing[3] }}>
            <div>
              <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>{title}</div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{subtitle}</div>
            </div>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: theme.spacing[4] }}>{children}</div>
      </aside>
    </>
  );
}

export function MainLayout({ children, activeKey, onNavigate }: MainLayoutProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const {
    activePanel,
    closePanel,
    searchQuery,
    setSearchQuery,
    registerSearch,
  } = useShell();
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 960 : false,
  );
  const [recentActivity, setRecentActivity] = useState<ActivityLedgerEntry[]>([]);
  const [rightRail, setRightRail] = useState<RightRailState>({ focusItems: [], notifications: [] });

  const subtitle = 'Enterprise governance operating system for risk, compliance, resilience, and board oversight';
  const activeWorkspace = useMemo(() => getWorkspaceDefinitionForKey(activeKey), [activeKey]);
  const isMobile = viewportWidth < 960;
  const showRightRailDesktop = viewportWidth >= 1280;
  const showCompactExecutiveSidebar = activeKey === 'dashboard' && !isMobile;

  const filteredSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return shellSearchIndex.slice(0, 8);
    return shellSearchIndex.filter((item) => item.keywords.includes(query)).slice(0, 10);
  }, [searchQuery]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setSidebarOpen(window.innerWidth >= 960);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      fetchActivityLedger({ limit: 6 }),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/review-tasks'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/admin/access-reviews'),
      apiCall<{ data: Array<{ framework: string; readinessPercent: number; openItems: number }> }>('/api/v1/audit-readiness/summary'),
      apiCall<{ data: Array<{ id: string; severity?: string | null; residualScore?: number | null }> }>('/api/v1/risks'),
      apiCall<{ data: Array<{ id: string; status?: string | null }> }>('/api/v1/admin/access-requests'),
    ])
      .then((results) => {
        if (!mounted) return;

        const activityEntries = results[0].status === 'fulfilled' ? results[0].value.entries || [] : [];
        const reviewTasks = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];
        const accessReviews = results[2].status === 'fulfilled' ? results[2].value.data || [] : [];
        const auditSummary = results[3].status === 'fulfilled' ? results[3].value.data || [] : [];
        const risks = results[4].status === 'fulfilled' ? results[4].value.data || [] : [];
        const accessRequests = results[5].status === 'fulfilled' ? results[5].value.data || [] : [];

        setRecentActivity(activityEntries);

        const openTasks = reviewTasks.filter((item) => (item.status || '').toLowerCase() !== 'completed').length;
        const overdueTasks = reviewTasks.filter((item) => (item.status || '').toLowerCase() === 'overdue').length;
        const pendingApprovals = accessRequests.filter((item) => ['pending', 'request_info'].includes((item.status || '').toLowerCase())).length;
        const activeReviews = accessReviews.filter((item) => !['completed', 'closed'].includes((item.status || '').toLowerCase())).length;
        const auditBlockers = auditSummary.reduce((total, item) => total + Number(item.openItems || 0), 0);
        const priorityRisks = riskCountFromRows(risks);

        const focusItems: LiveFocusItem[] = [
          {
            id: 'my-tasks',
            label: 'My Tasks',
            detail: openTasks > 0 ? `${compactCountLabel(openTasks, 'open task')} across governance workflows.` : 'No open workflow tasks in this workspace.',
            routeKey: 'review-tasks',
            tone: overdueTasks > 0 ? 'warning' : openTasks > 0 ? 'primary' : 'success',
          },
          {
            id: 'my-approvals',
            label: 'My Approvals',
            detail: pendingApprovals > 0 ? `${compactCountLabel(pendingApprovals, 'approval')} waiting for access review.` : 'No pending access approvals.',
            routeKey: 'workspace-members',
            tone: pendingApprovals > 0 ? 'danger' : 'success',
          },
          {
            id: 'my-reviews',
            label: 'My Reviews',
            detail: activeReviews > 0 ? `${compactCountLabel(activeReviews, 'active review')} still in certification.` : 'No active access reviews.',
            routeKey: 'admin-access-reviews',
            tone: activeReviews > 0 ? 'primary' : 'success',
          },
          {
            id: 'my-audits',
            label: 'My Audits',
            detail: auditBlockers > 0 ? `${compactCountLabel(auditBlockers, 'open blocker item')} across audit readiness.` : 'Audit readiness has no open blocker items.',
            routeKey: 'audit-readiness',
            tone: auditBlockers > 0 ? 'warning' : 'success',
          },
          {
            id: 'my-risks',
            label: 'My Risks',
            detail: priorityRisks > 0 ? `${compactCountLabel(priorityRisks, 'priority risk')} still need response.` : 'No high-priority risks above threshold.',
            routeKey: 'risks',
            tone: priorityRisks > 0 ? 'danger' : 'success',
          },
        ];

        const notifications: LiveNotificationItem[] = [
          ...(pendingApprovals > 0 ? [{
            id: 'notif-approvals',
            title: 'Approval required',
            detail: `${compactCountLabel(pendingApprovals, 'access request')} waiting for review before activation.`,
            routeKey: 'workspace-members',
            priority: 'high' as const,
            unread: true,
          }] : []),
          ...(auditBlockers > 0 ? [{
            id: 'notif-audits',
            title: 'Audit blockers open',
            detail: `${compactCountLabel(auditBlockers, 'audit blocker item')} needs attention across readiness.`,
            routeKey: 'audit-readiness',
            priority: auditBlockers > 3 ? 'high' as const : 'medium' as const,
            unread: true,
          }] : []),
          ...(priorityRisks > 0 ? [{
            id: 'notif-risks',
            title: 'Priority risks elevated',
            detail: `${compactCountLabel(priorityRisks, 'priority risk')} remains above target posture.`,
            routeKey: 'risks',
            priority: priorityRisks > 2 ? 'high' as const : 'medium' as const,
            unread: true,
          }] : []),
          ...(openTasks > 0 ? [{
            id: 'notif-tasks',
            title: 'Workflow tasks active',
            detail: `${compactCountLabel(openTasks, 'open task')} currently assigned in this workspace.`,
            routeKey: 'review-tasks',
            priority: overdueTasks > 0 ? 'medium' as const : 'low' as const,
          }] : []),
          ...(activityEntries.length === 0 ? [{
            id: 'notif-activity',
            title: 'Activity ledger is quiet',
            detail: 'No recent enterprise activity has been recorded for this workspace yet.',
            routeKey: 'activity-ledger',
            priority: 'low' as const,
          }] : []),
        ];

        setRightRail({ focusItems, notifications });
      })
      .catch(() => {
        if (!mounted) return;
        setRecentActivity([]);
        setRightRail({ focusItems: [], notifications: [] });
      });

    return () => {
      mounted = false;
    };
  }, [currentWorkspace.id]);

  const handleToggleSidebar = () => {
    setSidebarOpen((current) => !current);
  };

  const handleNavigate = (key: string) => {
    onNavigate(key);
    if (searchQuery.trim()) registerSearch(searchQuery.trim());
    closePanel();
    if (isMobile) setSidebarOpen(false);
  };

  const workspaceLabel = getWorkspaceOrganizationName(currentWorkspace);
  const greeting = user?.fullName?.split(' ')[0] || workspaceLabel || 'Team';
  const unreadNotifications = rightRail.notifications.filter((item) => item.unread);

  const rightRailContent = (
    <div style={{ display: 'grid', gap: theme.spacing[4], position: showRightRailDesktop ? 'sticky' : 'static', top: theme.spacing[4] }}>
      <Card style={{ padding: theme.spacing[4] }}>
        <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
          Personalized Home
        </div>
        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
          Live actions, approvals, reviews, and posture signals for {workspaceLabel || 'the active workspace'}.
        </div>
        <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
          {rightRail.focusItems.length > 0 ? rightRail.focusItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.routeKey)}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                background: theme.colors.surfaceHover,
                padding: theme.spacing[3],
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.label}</span>
                <Badge variant={item.tone} size="sm">{item.tone === 'success' ? 'clear' : item.tone}</Badge>
              </div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, lineHeight: 1.5 }}>
                {item.detail}
              </div>
            </button>
          )) : (
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              No personal workload signals are available for this workspace yet.
            </div>
          )}
        </div>
      </Card>

      <Card style={{ padding: theme.spacing[4] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
              Recent Activity
            </div>
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              Significant events from the enterprise activity ledger.
            </div>
          </div>
          <Button variant="ghost" onClick={() => handleNavigate('activity-ledger')}>Open</Button>
        </div>
        <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
          {recentActivity.length > 0 ? recentActivity.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                padding: theme.spacing[3],
                background: theme.colors.surfaceHover,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                  {entry.action.replace(/_/g, ' ')}
                </span>
                <Badge variant={toneForOutcome(entry.outcome)} size="sm">{entry.outcome}</Badge>
              </div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                {entry.actorName} | {entry.targetName || entry.targetType}
              </div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                {formatTimestamp(entry.timestamp)}
              </div>
            </div>
          )) : (
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              No recent activity available for this workspace yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.background,
        color: theme.colors.text.main,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <TopBar
        appName="Enterprise GRC Tool"
        subtitle={subtitle}
        onToggleSidebar={handleToggleSidebar}
        onNavigate={handleNavigate}
        compact={isMobile}
        notificationCount={unreadNotifications.length}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 72px)', overflow: 'hidden' }}>
        <Sidebar
          activeKey={activeKey}
          onSelect={handleNavigate}
          isOpen={sidebarOpen}
          isMobile={isMobile}
          showWorkspacePanelOnDesktop={!showCompactExecutiveSidebar}
          onClose={() => setSidebarOpen(false)}
          onOpen={() => setSidebarOpen(true)}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: showRightRailDesktop ? 'minmax(0, 1fr) 284px' : 'minmax(0, 1fr)' }}>
          <main
            style={{
              minWidth: 0,
              overflowY: 'auto',
              padding: isMobile ? theme.spacing[4] : theme.spacing[5],
            }}
          >
            <div
              style={{
                maxWidth: 1480,
                margin: '0 auto',
                display: 'grid',
                gap: theme.spacing[4],
              }}
            >
              <Card
                style={{
                  padding: theme.spacing[4],
                  background: theme.colors.gradients.card,
                  borderRadius: theme.borderRadius['2xl'],
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[3], alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: theme.spacing[1], minWidth: 0 }}>
                    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {activeWorkspace.title}
                    </div>
                    <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                      {greeting}, your enterprise workbench is ready.
                    </div>
                    <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, maxWidth: 780 }}>
                      {activeWorkspace.subtitle} Use search, quick actions, and the activity rail to move between operating workflows without leaving the workspace context.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Badge variant="primary" size="sm">{workspaceLabel}</Badge>
                    <Badge variant="default" size="sm">{unreadNotifications.length} priority alerts</Badge>
                    <Badge variant="success" size="sm">{recentActivity.length} recent events</Badge>
                  </div>
                </div>
              </Card>

              {children}

              {!showRightRailDesktop ? rightRailContent : null}
            </div>
          </main>

          {showRightRailDesktop ? (
            <aside
              style={{
                borderLeft: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                padding: theme.spacing[4],
                overflowY: 'auto',
              }}
            >
              {rightRailContent}
            </aside>
          ) : null}
        </div>
      </div>

      <Drawer
        title="Enterprise Search"
        subtitle="Search risks, controls, evidence, vendors, assets, audits, users, and reports."
        open={activePanel === 'search'}
        onClose={closePanel}
        width={420}
      >
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search across workspaces"
            autoFocus
            style={{
              width: '100%',
              padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.xl,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.surfaceHover,
              color: theme.colors.text.main,
            }}
          />
          {filteredSearchResults.map((result) => (
            <button
              key={`${result.workspaceId}-${result.key}`}
              type="button"
              onClick={() => handleNavigate(result.key)}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                background: theme.colors.surface,
                padding: theme.spacing[3],
                textAlign: 'left',
                display: 'grid',
                gap: theme.spacing[1],
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{result.label}</span>
                <Badge variant="default" size="sm">{result.workspaceTitle}</Badge>
              </div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{result.description}</div>
            </button>
          ))}
        </div>
      </Drawer>

      <Drawer
        title="Notifications"
        subtitle="Live approvals, task pressure, audit blockers, and workspace posture signals."
        open={activePanel === 'notifications'}
        onClose={closePanel}
      >
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          {rightRail.notifications.length > 0 ? rightRail.notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.routeKey)}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                background: item.unread ? theme.colors.primaryLight : theme.colors.surface,
                padding: theme.spacing[3],
                textAlign: 'left',
                display: 'grid',
                gap: theme.spacing[1],
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{item.title}</span>
                <Badge variant={priorityBadgeVariant(item.priority)} size="sm">
                  {item.priority}
                </Badge>
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.detail}</div>
            </button>
          )) : (
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              No live notifications are available for this workspace yet.
            </div>
          )}
        </div>
      </Drawer>

      <Drawer
        title="Quick Actions"
        subtitle="Launch frequent workflows without hunting across modules."
        open={activePanel === 'quickActions'}
        onClose={closePanel}
      >
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          {shellQuickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleNavigate(action.routeKey)}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                background: theme.colors.surface,
                padding: theme.spacing[3],
                textAlign: 'left',
                display: 'grid',
                gap: theme.spacing[1],
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{action.label}</span>
                <Badge variant="primary" size="sm">{action.group}</Badge>
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{action.description}</div>
            </button>
          ))}
        </div>
      </Drawer>

      <Drawer
        title="Activity Hub"
        subtitle="Unified platform activity across access, audit, reporting, and operational changes."
        open={activePanel === 'activity'}
        onClose={closePanel}
      >
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          {recentActivity.length > 0 ? recentActivity.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.xl,
                background: theme.colors.surface,
                padding: theme.spacing[3],
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing[2], alignItems: 'center' }}>
                <span style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold }}>{entry.action.replace(/_/g, ' ')}</span>
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                  <Badge variant="default" size="sm">{entry.category}</Badge>
                  <Badge variant={toneForOutcome(entry.outcome)} size="sm">{entry.outcome}</Badge>
                </div>
              </div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                {entry.actorName} changed {entry.targetName || entry.targetType}
              </div>
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                {formatTimestamp(entry.timestamp)}
              </div>
              {entry.notes ? (
                <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                  {entry.notes}
                </div>
              ) : null}
            </div>
          )) : (
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              No recent activity entries are available.
            </div>
          )}
          <Button variant="primary" onClick={() => handleNavigate('activity-ledger')}>Open Full Activity Ledger</Button>
        </div>
      </Drawer>
    </div>
  );
}
