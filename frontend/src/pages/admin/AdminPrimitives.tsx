import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AccessIcon, ActivityIcon, ControlIcon, UsersIcon } from '../../components/icons';
import './Administration.css';

export function AdminOverlay({ children }: { children: ReactNode }) {
  return createPortal(<div className="adminOverlay">{children}</div>, document.body);
}

export function AdminHero({ title, description, action, chips = [] }: {
  title: string; description: string; action?: ReactNode; chips?: string[];
}) {
  return <header className="adminHero">
    <div className="adminHeroCopy">
      <div className="adminBreadcrumb">Administration / {title}</div>
      <h1>{title}</h1><p>{description}</p>
      {chips.length > 0 && <ul className="adminChips">{chips.map(chip => <li key={chip}>{chip}</li>)}</ul>}
    </div>
    <img className="adminHeroImage" src="/admin-security-hero.webp" alt="" width="210" height="120" />
    <div className="adminHeroAction">{action}</div>
  </header>;
}

export type AdminMetric = { label: string; value: ReactNode; detail?: string; tone?: string; icon?: ReactNode };
export function AdminMetrics({ metrics }: { metrics: AdminMetric[] }) {
  const icons = [<ControlIcon size={21} />, <UsersIcon size={21} />, <AccessIcon size={21} />, <ActivityIcon size={21} />];
  return <div className="adminMetrics" style={{ '--admin-columns': metrics.length } as React.CSSProperties}>
    {metrics.map((metric, index) => <div className={`adminMetric adminTone-${metric.tone || 'primary'}`} key={metric.label}>
      <span className="adminIcon" aria-hidden="true">{metric.icon || icons[index % icons.length]}</span>
      <div><div className="adminMetricLabel">{metric.label}</div><strong>{metric.value}</strong>{metric.detail && <p>{metric.detail}</p>}</div>
    </div>)}
  </div>;
}

export function AdminCard({ title, description, action, children, className = '' }: {
  title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`adminCard ${className}`}>
    <div className="adminCardHeader"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
    {children}
  </section>;
}

export function AdminNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`adminNotice${error ? ' adminNoticeError' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>;
}
