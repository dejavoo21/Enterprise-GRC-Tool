import { EmptyStatePanel, PageHeader, PageSectionCard } from '../components';
import { theme } from '../theme';

export function AppReviewRegister() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: theme.spacing[5] }}>
      <PageHeader title="Application Review Register" description="Govern periodic application assurance reviews and their findings when a persisted application-review source is connected." />
      <PageSectionCard title="Application review integration">
        <EmptyStatePanel eyebrow="Integration unavailable" title="No application review source is configured" description="LAFLO will not create sample applications, findings, owners, or review outcomes. Connect an approved persisted application inventory and review workflow before using this register." />
      </PageSectionCard>
    </div>
  );
}
