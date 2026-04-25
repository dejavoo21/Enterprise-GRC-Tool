import { useState } from 'react';
import { theme } from '../theme';
import { ChevronDownIcon } from './icons';
import { useAuth } from '../context/AuthContext';

interface TopBarProps {
  appName: string;
  subtitle?: string;
  onToggleSidebar?: () => void;
}

const DEMO_LABELS = [/^demo\s+/i, /\s+demo$/i, /playwright-agents/i];

function sanitizeLabel(value: string | undefined, fallback: string): string {
  const cleaned = (value || '')
    .replace(DEMO_LABELS[0], '')
    .replace(DEMO_LABELS[1], '')
    .replace(DEMO_LABELS[2], '')
    .trim();
  return cleaned || fallback;
}

// Role display labels
const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  grc: 'GRC Analyst',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

export function TopBar({ appName, subtitle, onToggleSidebar }: TopBarProps) {
  const logoSrc = '/laflo-logo.png';
  const { user, role, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Get user initials for avatar
  const userInitials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const displayName = sanitizeLabel(user?.fullName || user?.email, 'User');
  const roleLabel = role ? ROLE_LABELS[role] || role : 'User';
  return (
    <header
      style={{
        height: '64px',
        backgroundColor: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${theme.spacing[6]}`,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          style={{
            marginRight: theme.spacing[4],
            background: 'none',
            border: 'none',
            color: theme.colors.text.secondary,
            cursor: 'pointer',
            padding: theme.spacing[2],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.borderRadius.md,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
        {/* Logo/Icon */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: theme.borderRadius.lg,
            backgroundColor: '#ffffff',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '4px',
          }}
        >
          <img
            src={logoSrc}
            alt="Laflo logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.sizes.lg,
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.text.main,
            }}
          >
            {appName}
          </h1>
          {subtitle && (
            <span
              style={{
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.text.muted,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right side - User */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: theme.spacing[4] }}>
        {/* User Section */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[3],
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              borderRadius: theme.borderRadius.lg,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: theme.borderRadius.full,
                background: theme.colors.gradients.hero,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
              }}
            >
              {userInitials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: theme.typography.sizes.sm,
                  fontWeight: theme.typography.weights.medium,
                  color: theme.colors.text.main,
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  fontSize: theme.typography.sizes.xs,
                  color: theme.colors.text.muted,
                }}
              >
                {roleLabel}
              </span>
            </div>
            <ChevronDownIcon size={16} color={theme.colors.text.muted} />
          </div>

          {/* User Dropdown Menu */}
          {showUserDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: theme.spacing[2],
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                minWidth: '180px',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              {/* User Info */}
              <div
                style={{
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    color: theme.colors.text.main,
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: theme.typography.sizes.xs,
                    color: theme.colors.text.muted,
                    marginTop: '2px',
                  }}
                >
                  {user?.email}
                </div>
                <div
                  style={{
                    fontSize: theme.typography.sizes.xs,
                    color: theme.colors.primary,
                    marginTop: '4px',
                    fontWeight: theme.typography.weights.medium,
                  }}
                >
                  {roleLabel}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  logout();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  width: '100%',
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: theme.typography.sizes.sm,
                  color: theme.colors.semantic.danger,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

