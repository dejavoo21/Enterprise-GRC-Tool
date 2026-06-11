import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Sidebar, TopBar } from '../components';
import { useAuth } from '../context/AuthContext';
import { useShell } from '../context/ShellContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { fetchActivityLedger } from '../lib/api';
import {
  getWorkspaceDefinitionForKey,
  personalizedHomeItems,
  shellNotifications,
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
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1180 : false,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1180 : false,
  );
  const [recentActivity, setRecentActivity] = useState<ActivityLedgerEntry[]>([]);

  const subtitle = 'Enterprise governance operating system for risk, compliance, resilience, and board oversight';
  const activeWorkspace = useMemo(() => getWorkspaceDefinitionForKey(activeKey), [activeKey]);

  const filteredSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return shellSearchIndex.slice(0, 8);
    return shellSearchIndex.filter((item) => item.keywords.includes(query)).slice(0, 10);
  }, [searchQuery]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1180;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchActivityLedger({ limit: 6 })
      .then((result) => {
        if (mounted) setRecentActivity(result.entries || []);
      })
      .catch(() => {
        if (mounted) setRecentActivity([]);
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

  const greeting = user?.fullName?.split(' ')[0] || currentWorkspace.name || 'Team';
  const unreadNotifications = shellNotifications.filter((item) => item.unread);

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
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 72px)', overflow: 'hidden' }}>
        <Sidebar
          activeKey={activeKey}
          onSelect={handleNavigate}
          isOpen={sidebarOpen}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
          onOpen={() => setSidebarOpen(true)}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 320px' }}>
          <main
            style={{
              minWidth: 0,
              overflowY: 'auto',
              padding: isMobile ? theme.spacing[4] : theme.spacing[5],
            }}
          >
            <div
              style={{
                maxWidth: 1440,
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
                    <Badge variant="primary" size="sm">{currentWorkspace.name || 'Workspace'}</Badge>
                    <Badge variant="default" size="sm">{unreadNotifications.length} priority alerts</Badge>
                    <Badge variant="success" size="sm">{recentActivity.length} recent events</Badge>
                  </div>
                </div>
              </Card>

              {children}
            </div>
          </main>

          {!isMobile ? (
            <aside
              style={{
                borderLeft: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                padding: theme.spacing[4],
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'grid', gap: theme.spacing[4], position: 'sticky', top: theme.spacing[4] }}>
                <Card style={{ padding: theme.spacing[4] }}>
                  <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.bold, color: theme.colors.text.main }}>
                    Personalized Home
                  </div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                    My work, approvals, certifications, and review pressure across the platform.
                  </div>
                  <div style={{ marginTop: theme.spacing[3], display: 'grid', gap: theme.spacing[2] }}>
                    {personalizedHomeItems.slice(0, 5).map((item) => (
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
                          <Badge variant={item.tone} size="sm">{item.tone}</Badge>
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, lineHeight: 1.5 }}>
                          {item.detail}
                        </div>
                      </button>
                    ))}
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
                          {entry.actorName} • {entry.targetName || entry.targetType}
                        </div>
                        <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>
                          {formatTimestamp(entry.timestamp)}
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                        No recent activity available.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
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
        subtitle="Approvals, audit requests, vendor reviews, training reminders, and regulatory changes."
        open={activePanel === 'notifications'}
        onClose={closePanel}
      >
        <div style={{ display: 'grid', gap: theme.spacing[3] }}>
          {shellNotifications.map((item) => (
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
                <Badge variant={item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'default'} size="sm">
                  {item.priority}
                </Badge>
              </div>
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>{item.detail}</div>
            </button>
          ))}
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
