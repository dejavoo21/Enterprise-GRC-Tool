import React from 'react';
import { theme } from '../theme';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumb, action }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: theme.spacing[6] }}>
      {breadcrumb && (
        <div
          style={{
            fontSize: theme.typography.sizes.sm,
            color: theme.colors.text.muted,
            marginBottom: theme.spacing[2],
            fontWeight: theme.typography.weights.medium,
          }}
        >
          {breadcrumb}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: theme.spacing[4] }}>
        <div>
          <h1
            style={{
              margin: 0,
              marginBottom: description ? theme.spacing[2] : 0,
              fontSize: theme.typography.sizes['2xl'],
              fontWeight: theme.typography.weights.bold,
              color: theme.colors.text.main,
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                margin: 0,
                color: theme.colors.text.secondary,
                fontSize: theme.typography.sizes.base,
                maxWidth: '600px',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {action && <div style={{ display: 'flex', gap: theme.spacing[3] }}>{action}</div>}
      </div>
    </div>
  );
}
