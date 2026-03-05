import React from 'react';
import { theme } from '../theme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, children, style, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);

    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2],
      borderRadius: theme.borderRadius.lg,
      fontWeight: theme.typography.weights.medium,
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      border: 'none',
      width: fullWidth ? '100%' : 'auto',
      outline: 'none',
      fontFamily: theme.typography.fontFamily,
      opacity: props.disabled ? 0.6 : 1,
    };

    const sizeStyles = {
      sm: {
        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
        fontSize: theme.typography.sizes.sm,
      },
      md: {
        padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
        fontSize: theme.typography.sizes.sm,
      },
      lg: {
        padding: `${theme.spacing[3]} ${theme.spacing[6]}`,
        fontSize: theme.typography.sizes.base,
      },
    };

    const getVariantStyles = () => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: isHovered ? theme.colors.primaryHover : theme.colors.primary,
            color: theme.colors.text.inverse,
          };
        case 'secondary':
          return {
            backgroundColor: isHovered ? theme.colors.surfaceHover : theme.colors.primaryLight,
            color: theme.colors.primary,
          };
        case 'ghost':
          return {
            backgroundColor: isHovered ? theme.colors.surfaceHover : 'transparent',
            color: theme.colors.text.secondary,
          };
        case 'outline':
          return {
            backgroundColor: isHovered ? theme.colors.surfaceHover : 'transparent',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text.main,
          };
        case 'danger':
          return {
            backgroundColor: isHovered ? '#DC2626' : theme.colors.semantic.danger,
            color: theme.colors.text.inverse,
          };
        default:
          return {};
      }
    };

    const combinedStyle: React.CSSProperties = {
      ...baseStyle,
      ...sizeStyles[size],
      ...getVariantStyles(),
      ...style,
    };

    return (
      <button
        ref={ref}
        style={combinedStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
