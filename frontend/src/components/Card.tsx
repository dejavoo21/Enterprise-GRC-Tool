import React from 'react';
import { theme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, style, noPadding = false, hover = false, onClick }: CardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => hover && setIsHovered(true)}
      onMouseLeave={() => hover && setIsHovered(false)}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        padding: noPadding ? 0 : theme.spacing[6],
        boxShadow: isHovered ? theme.shadows.cardHover : theme.shadows.card,
        border: `1px solid ${theme.colors.border}`,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
