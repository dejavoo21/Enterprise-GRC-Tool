import type { ReactNode } from 'react';
import { theme } from '../../../theme';

export function RiskCockpitLayout({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '320px minmax(0, 1fr) 360px',
        gap: theme.spacing[3],
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>{left}</div>
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>{center}</div>
      <div style={{ display: 'grid', gap: theme.spacing[3] }}>{right}</div>
    </section>
  );
}

