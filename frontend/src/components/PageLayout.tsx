import type { ReactNode } from 'react';
import { theme } from '../theme';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';

type MetricTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

type SummaryMetric = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: MetricTone;
};

const toneMap: Record<MetricTone, { accent: string; background: string }> = {
  default: { accent: theme.colors.text.main, background: theme.colors.surfaceHover },
  primary: { accent: theme.colors.primary, background: theme.colors.primaryLight },
  success: { accent: theme.colors.semantic.success, background: theme.colors.semantic.successLight },
  warning: { accent: theme.colors.semantic.warning, background: theme.colors.semantic.warningLight },
  danger: { accent: theme.colors.semantic.danger, background: theme.colors.semantic.dangerLight },
};

export function PageToolbar({
  children,
  actions,
}: {
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card style={{ padding: theme.spacing[4], minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing[3],
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', gap: theme.spacing[3], flexWrap: 'wrap', minWidth: 0 }}>
          {children}
        </div>
        {actions ? <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
    </Card>
  );
}

export function SummaryMetricStrip({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: theme.spacing[3],
        minWidth: 0,
      }}
    >
      {metrics.map((metric) => {
        const tone = toneMap[metric.tone || 'default'];
        return (
          <Card
            key={metric.label}
            style={{
              padding: theme.spacing[4],
              minWidth: 0,
              backgroundColor: tone.background,
            }}
          >
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {metric.label}
            </div>
            <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold, color: tone.accent }}>
              {metric.value}
            </div>
            {metric.detail ? (
              <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
                {metric.detail}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

export function EmptyStatePanel({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <Card
      style={{
        padding: theme.spacing[8],
        textAlign: 'center',
        minWidth: 0,
        backgroundColor: theme.colors.surface,
      }}
    >
      {eyebrow ? (
        <div style={{ fontSize: theme.typography.sizes.xs, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.colors.text.muted, marginBottom: theme.spacing[2] }}>
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.semibold, color: theme.colors.text.main }}>
        {title}
      </div>
      <div style={{ marginTop: theme.spacing[2], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, maxWidth: 520, marginInline: 'auto' }}>
        {description}
      </div>
      {actions ? (
        <div style={{ marginTop: theme.spacing[5], display: 'flex', justifyContent: 'center', gap: theme.spacing[3], flexWrap: 'wrap' }}>
          {actions}
        </div>
      ) : null}
    </Card>
  );
}

export function PageSectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card style={{ padding: theme.spacing[5], minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: theme.spacing[3],
          flexWrap: 'wrap',
          marginBottom: theme.spacing[4],
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: theme.typography.sizes.lg, color: theme.colors.text.main }}>{title}</h3>
          {subtitle ? (
            <div style={{ marginTop: theme.spacing[1], fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function DataTableShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageSectionCard title={title} subtitle={subtitle} action={action}>
      <div style={{ maxWidth: '100%', overflowX: 'hidden', minWidth: 0 }}>{children}</div>
    </PageSectionCard>
  );
}

export function ActivityFeed({
  title,
  subtitle,
  countLabel,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  countLabel?: string;
  empty?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <PageSectionCard
      title={title}
      subtitle={subtitle}
      action={countLabel ? <Badge variant="default" size="sm">{countLabel}</Badge> : null}
    >
      <div style={{ display: 'grid', gap: theme.spacing[3], minWidth: 0 }}>
        {children || empty}
      </div>
    </PageSectionCard>
  );
}

export function CompactStatBadge({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing[2],
        padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.full,
      }}
    >
      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary }}>{label}</span>
      <Badge variant={variant} size="sm">{value}</Badge>
    </div>
  );
}

export function ToolbarButtonRow({
  primaryLabel,
  onPrimary,
  secondaryActions = [],
}: {
  primaryLabel: string;
  onPrimary: () => void;
  secondaryActions?: Array<{ label: string; onClick: () => void }>;
}) {
  return (
    <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
      <Button variant="primary" onClick={onPrimary}>{primaryLabel}</Button>
      {secondaryActions.map((action) => (
        <Button key={action.label} variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}
