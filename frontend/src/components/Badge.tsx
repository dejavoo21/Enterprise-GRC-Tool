import React from 'react';
import { theme } from '../theme';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'critical' | 'high' | 'medium' | 'low';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'default', size = 'sm', style }: BadgeProps) {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary };
      case 'success':
        return { backgroundColor: theme.colors.semantic.successLight, color: theme.colors.semantic.success };
      case 'warning':
        return { backgroundColor: theme.colors.semantic.warningLight, color: '#B45309' };
      case 'danger':
        return { backgroundColor: theme.colors.semantic.dangerLight, color: theme.colors.semantic.danger };
      case 'info':
        return { backgroundColor: theme.colors.semantic.infoLight, color: theme.colors.semantic.info };
      case 'critical':
        return { backgroundColor: theme.colors.risk.criticalBg, color: theme.colors.risk.critical };
      case 'high':
        return { backgroundColor: theme.colors.risk.highBg, color: theme.colors.risk.high };
      case 'medium':
        return { backgroundColor: theme.colors.risk.mediumBg, color: theme.colors.risk.medium };
      case 'low':
        return { backgroundColor: theme.colors.risk.lowBg, color: theme.colors.risk.low };
      default:
        return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.text.secondary };
    }
  };

  const sizeStyles = {
    sm: {
      padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
      fontSize: theme.typography.sizes.xs,
    },
    md: {
      padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
      fontSize: theme.typography.sizes.sm,
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: theme.borderRadius.full,
        fontWeight: theme.typography.weights.medium,
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
        ...getVariantStyles(),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
