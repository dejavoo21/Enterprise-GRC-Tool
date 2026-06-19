import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SHELL_THEME_OPTIONS, useShell } from '../context/ShellContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getWorkspaceOrganizationName, getWorkspaceSelectorLabel } from '../lib/workspaceDisplay';
import { theme } from '../theme';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  ActivityIcon,
  ChevronDownIcon,
  SearchIcon,
  SettingsIcon,
} from './icons';

interface TopBarProps {
  appName: string;
  subtitle?: string;
  onToggleSidebar?: () => void;
  onNavigate: (key: string) => void;
  compact?: boolean;
  notificationCount?: number;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  grc: 'GRC Analyst',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

function CircleButton({
  label,
  onClick,
  children,
  active = false,
  count,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
        backgroundColor: active ? theme.colors.primaryLight : theme.colors.surface,
        color: active ? theme.colors.primary : theme.colors.text.secondary,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {children}
      {typeof count === 'number' && count > 0 ? (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.semantic.danger,
            color: theme.colors.text.inverse,
            fontSize: theme.typography.sizes.xs,
            fontWeight: theme.typography.weights.bold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function TopBar({
  appName,
  subtitle,
  onToggleSidebar,
  onNavigate,
  compact = false,
  notificationCount = 0,
}: TopBarProps) {
  const logoSrc = '/laflo-logo.png';
  const { user, role, logout } = useAuth();
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace();
  const { activePanel, openPanel, togglePanel, setThemeMode, themeMode, searchQuery, setSearchQuery } = useShell();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const unreadCount = useMemo(() => notificationCount, [notificationCount]);

  const userInitials = user?.fullName
    ? user.fullName.split(' ').map((name) => name[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const displayName = user?.fullName || user?.email || 'User';
  const roleLabel = role ? ROLE_LABELS[role] || role : 'User';
  const workspaceLabel = getWorkspaceOrganizationName(currentWorkspace);
  const themeLabel = SHELL_THEME_OPTIONS.find((option) => option.value === themeMode)?.label || 'Auto';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        padding: `10px ${theme.spacing[3]}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '0 0 auto' }}>
          {onToggleSidebar ? (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle navigation"
              style={{
                width: 36,
                height: 36,
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                color: theme.colors.text.secondary,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[3],
              cursor: 'pointer',
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 122,
                minWidth: 122,
                height: 34,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <img src={logoSrc} alt="Laflo logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ minWidth: 0, display: 'grid', gap: 1, width: 316 }}>
              <strong style={{ fontSize: theme.typography.sizes.base, lineHeight: 1.05, color: theme.colors.text.main, fontWeight: theme.typography.weights.semibold }}>{appName}</strong>
              {subtitle && !compact ? (
                <span
                  style={{
                    fontSize: '11px',
                    color: theme.colors.text.muted,
                    whiteSpace: 'nowrap',
                    maxWidth: 316,
                  }}
                >
                  {subtitle}
                </span>
              ) : null}
            </div>
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, width: '100%', maxWidth: compact ? '100%' : 708 }}>
          {compact ? (
            <>
              <Button variant="outline" onClick={() => openPanel('search')}>
                <SearchIcon size={16} color="currentColor" />
                Search
              </Button>
              <select
                value={currentWorkspace.id}
                onChange={(event) => { void switchWorkspace(event.target.value); }}
                aria-label="Select workspace"
                style={{
                  minWidth: 0,
                  maxWidth: 150,
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  borderRadius: theme.borderRadius.xl,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.backgroundAlt,
                  color: theme.colors.text.main,
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.semibold,
                  outline: 'none',
                }}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{getWorkspaceSelectorLabel(workspace)}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <div
                onClick={() => openPanel('search')}
                style={{
                  flex: '1 1 500px',
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  padding: `0 14px`,
                  height: 40,
                  borderRadius: theme.borderRadius.xl,
                  border: `1px solid ${activePanel === 'search' ? theme.colors.primary : theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundAlt,
                  cursor: 'text',
                }}
              >
                <SearchIcon size={16} color={theme.colors.text.muted} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => openPanel('search')}
                  placeholder="Search risks, controls, evidence, audits, vendors, users, or reports"
                  aria-label="Global search"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: theme.colors.text.main,
                    fontSize: theme.typography.sizes.sm,
                    lineHeight: 1,
                  }}
                />
                <Badge variant="default" size="sm">/</Badge>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `7px 12px`,
                  borderRadius: theme.borderRadius.xl,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.backgroundAlt,
                  minWidth: 196,
                  maxWidth: 196,
                  flex: '0 0 196px',
                }}
              >
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted }}>Workspace</span>
                  <select
                    value={currentWorkspace.id}
                    onChange={(event) => { void switchWorkspace(event.target.value); }}
                    aria-label="Select workspace"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: theme.colors.text.main,
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.semibold,
                      minWidth: 0,
                      width: '100%',
                      lineHeight: 1,
                      outline: 'none',
                    }}
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>{getWorkspaceSelectorLabel(workspace)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', marginLeft: 8 }}>
          <CircleButton label="Quick actions" onClick={() => togglePanel('quickActions')} active={activePanel === 'quickActions'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </CircleButton>
          <CircleButton label="Notifications" onClick={() => togglePanel('notifications')} active={activePanel === 'notifications'} count={unreadCount}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </CircleButton>
          <CircleButton label="Activity hub" onClick={() => togglePanel('activity')} active={activePanel === 'activity'}>
            <ActivityIcon size={18} color="currentColor" />
          </CircleButton>
          <CircleButton label="Theme settings" onClick={() => setShowUserDropdown((current) => !current)} active={showUserDropdown}>
            <span style={{ fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.bold, textTransform: 'uppercase' }}>
              {themeMode === 'system' ? 'Auto' : themeLabel.slice(0, 4)}
            </span>
          </CircleButton>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowUserDropdown((current) => !current)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[3],
                padding: `6px 10px`,
                borderRadius: theme.borderRadius.xl,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: theme.borderRadius.full,
                  background: theme.colors.gradients.hero,
                  color: theme.colors.text.inverse,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.bold,
                }}
              >
                {userInitials}
              </div>
              <div style={{ display: 'grid', minWidth: 0, textAlign: 'left' }}>
                <span style={{ fontSize: '11px', fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main, maxWidth: 112, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </span>
                <span style={{ fontSize: '10px', color: theme.colors.text.muted }}>{roleLabel}</span>
              </div>
              <ChevronDownIcon size={16} color={theme.colors.text.muted} />
            </button>

            {showUserDropdown ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 260,
                  borderRadius: theme.borderRadius.xl,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.surface,
                  boxShadow: theme.shadows.lg,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                  <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>{displayName}</div>
                  <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{user?.email}</div>
                  <div style={{ marginTop: theme.spacing[2], display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                    <Badge variant="primary" size="sm">{roleLabel}</Badge>
                    <Badge variant="default" size="sm">{workspaceLabel}</Badge>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: theme.spacing[2], padding: theme.spacing[3] }}>
                  <div style={{ padding: `${theme.spacing[1]} ${theme.spacing[1]}` }}>
                    <div style={{ marginBottom: theme.spacing[2], fontSize: theme.typography.sizes.xs, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Theme
                    </div>
                    <div style={{ display: 'grid', gap: theme.spacing[2] }}>
                      {SHELL_THEME_OPTIONS.map((option) => {
                        const selected = option.value === themeMode;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setThemeMode(option.value)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: theme.spacing[3],
                              padding: theme.spacing[2],
                              borderRadius: theme.borderRadius.lg,
                              border: `1px solid ${selected ? theme.colors.primary : theme.colors.border}`,
                              background: selected ? theme.colors.primaryLight : theme.colors.surface,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>
                              <span style={{ display: 'block', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
                                {option.label}
                              </span>
                              <span style={{ display: 'block', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>
                                {option.description}
                              </span>
                            </span>
                            {selected ? <Badge variant="primary" size="sm">Active</Badge> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => { setShowUserDropdown(false); onNavigate('admin-security-settings'); }}>
                    <SettingsIcon size={16} color="currentColor" />
                    Security Settings
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowUserDropdown(false); onNavigate('workspace-members'); }}>
                    Team Access
                  </Button>
                  <Button variant="danger" onClick={() => { setShowUserDropdown(false); logout(); }}>
                    Sign out
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
