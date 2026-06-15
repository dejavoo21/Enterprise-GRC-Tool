import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
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

  const railWidth = 84;
  const panelWidth = isMobile ? 'min(320px, calc(100vw - 108px))' : '292px';
  const panelOpen = isMobile ? isOpen : showWorkspacePanelOnDesktop;

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
          </div>
        </nav>
      </aside>
    </>
  );
}
