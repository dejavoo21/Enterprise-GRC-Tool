import { theme } from '../theme';
import { Card, PageHeader } from '../components';

interface PlaceholderProps {
  title: string;
  description?: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title={title}
        description={description || `Manage and track ${title.toLowerCase()} in your GRC program.`}
      />

      <Card>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[16],
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: theme.borderRadius['2xl'],
              background: theme.colors.gradients.heroSubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing[6],
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>

          <h3
            style={{
              margin: 0,
              marginBottom: theme.spacing[2],
              fontSize: theme.typography.sizes.xl,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.text.main,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: 0,
              marginBottom: theme.spacing[4],
              fontSize: theme.typography.sizes.base,
              color: theme.colors.text.secondary,
              maxWidth: '520px',
            }}
          >
            This module is not part of the current production navigation. Use the active command centers and registers in the sidebar while this area is being finalized.
          </p>

          <div
            style={{
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              borderRadius: theme.borderRadius.full,
              backgroundColor: theme.colors.surfaceHover,
              color: theme.colors.text.secondary,
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            Production navigation intentionally hides unfinished modules
          </div>
        </div>
      </Card>
    </div>
  );
}
