import { useState, useEffect, useCallback } from 'react';
import { theme } from '../theme';
import { PageHeader } from '../components';
import { DataTable } from '../components/DataTable';
import { fetchActivityLog } from '../lib/api';
import type {
  ActivityLogEntry,
  ActivityEntityType,
  ActivityActionType,
} from '../types/activity';

const ENTITY_TYPE_LABELS: Record<ActivityEntityType, string> = {
  control: 'Control',
  risk: 'Risk',
  governance_document: 'Document',
  training_course: 'Training',
  evidence: 'Evidence',
  link: 'Link',
  asset: 'Asset',
  vendor: 'Vendor',
};

const ACTION_TYPE_LABELS: Record<ActivityActionType, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status Changed',
  link: 'Linked',
  unlink: 'Unlinked',
  review: 'Reviewed',
  other: 'Other',
};

const ACTION_COLORS: Record<ActivityActionType, { bg: string; text: string }> = {
  create: { bg: '#D1FAE5', text: '#059669' },
  update: { bg: '#DBEAFE', text: '#2563EB' },
  delete: { bg: '#FEE2E2', text: '#DC2626' },
  status_change: { bg: '#FEF3C7', text: '#D97706' },
  link: { bg: '#E0E7FF', text: '#4F46E5' },
  unlink: { bg: '#FCE7F3', text: '#DB2777' },
  review: { bg: '#F3E8FF', text: '#7C3AED' },
  other: { bg: '#F3F4F6', text: '#6B7280' },
};

const ENTITY_TYPE_COLORS: Record<ActivityEntityType, { bg: string; text: string }> = {
  control: { bg: '#DBEAFE', text: '#2563EB' },
  risk: { bg: '#FEE2E2', text: '#DC2626' },
  governance_document: { bg: '#E0E7FF', text: '#4F46E5' },
  training_course: { bg: '#F3E8FF', text: '#7C3AED' },
  evidence: { bg: '#FEF3C7', text: '#D97706' },
  link: { bg: '#F3F4F6', text: '#6B7280' },
  asset: { bg: '#CFFAFE', text: '#0891B2' },
  vendor: { bg: '#D1FAE5', text: '#059669' },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<ActivityEntityType | ''>('');
  const [selectedAction, setSelectedAction] = useState<ActivityActionType | ''>('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = { limit: 100 };
      if (selectedEntityType) filters.entityType = selectedEntityType;

      const data = await fetchActivityLog(filters);

      // Client-side filter for action type (API only supports entityType filter)
      const filtered = selectedAction
        ? data.filter(e => e.action === selectedAction)
        : data;

      setEntries(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity log');
    } finally {
      setLoading(false);
    }
  }, [selectedEntityType, selectedAction]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpanded = (entryId: string) => {
    setExpandedEntry(prev => (prev === entryId ? null : entryId));
  };

  const columns = [
    {
      key: 'timestamp',
      header: 'When',
      width: '120px',
      render: (item: ActivityLogEntry) => (
        <div title={formatFullDate(item.createdAt)}>
          <span style={{ fontWeight: theme.typography.weights.medium }}>
            {formatRelativeTime(item.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      width: '200px',
      render: (item: ActivityLogEntry) => (
        <span style={{ color: theme.colors.text.main }}>
          {item.userEmail}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      width: '130px',
      render: (item: ActivityLogEntry) => {
        const colors = ACTION_COLORS[item.action];
        return (
          <span
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              backgroundColor: colors.bg,
              color: colors.text,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            {ACTION_TYPE_LABELS[item.action]}
          </span>
        );
      },
    },
    {
      key: 'entityType',
      header: 'Type',
      width: '120px',
      render: (item: ActivityLogEntry) => {
        const colors = ENTITY_TYPE_COLORS[item.entityType];
        return (
          <span
            style={{
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              backgroundColor: colors.bg,
              color: colors.text,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.xs,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            {ENTITY_TYPE_LABELS[item.entityType]}
          </span>
        );
      },
    },
    {
      key: 'summary',
      header: 'Summary',
      render: (item: ActivityLogEntry) => (
        <div>
          <div style={{ color: theme.colors.text.main }}>
            {item.summary}
          </div>
          {item.details && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpanded(item.id); }}
              style={{
                marginTop: theme.spacing[1],
                padding: 0,
                border: 'none',
                background: 'none',
                color: theme.colors.primary,
                fontSize: theme.typography.sizes.xs,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {expandedEntry === item.id ? 'Hide details' : 'Show details'}
            </button>
          )}
          {expandedEntry === item.id && item.details && (
            <pre
              style={{
                marginTop: theme.spacing[2],
                padding: theme.spacing[3],
                backgroundColor: '#F9FAFB',
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.sizes.xs,
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(item.details, null, 2)}
            </pre>
          )}
        </div>
      ),
    },
  ];

  const filterSection = (
    <div style={{ display: 'flex', gap: theme.spacing[3], marginBottom: theme.spacing[4], flexWrap: 'wrap' }}>
      <select
        value={selectedEntityType}
        onChange={e => setSelectedEntityType(e.target.value as ActivityEntityType | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Entity Types</option>
        <option value="control">Controls</option>
        <option value="risk">Risks</option>
        <option value="governance_document">Documents</option>
        <option value="training_course">Training</option>
        <option value="evidence">Evidence</option>
        <option value="link">Links</option>
        <option value="asset">Assets</option>
        <option value="vendor">Vendors</option>
      </select>

      <select
        value={selectedAction}
        onChange={e => setSelectedAction(e.target.value as ActivityActionType | '')}
        style={{
          padding: theme.spacing[2],
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.sm,
          minWidth: '150px',
        }}
      >
        <option value="">All Actions</option>
        <option value="create">Created</option>
        <option value="update">Updated</option>
        <option value="delete">Deleted</option>
        <option value="status_change">Status Changed</option>
        <option value="link">Linked</option>
        <option value="unlink">Unlinked</option>
        <option value="review">Reviewed</option>
      </select>

      <button
        onClick={fetchData}
        style={{
          padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: theme.typography.sizes.sm,
          fontWeight: theme.typography.weights.medium,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
        }}
      >
        Refresh
      </button>
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Activity Log"
          description="View a chronological history of changes across your GRC program."
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[12],
            color: theme.colors.text.secondary,
          }}
        >
          Loading activity log...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PageHeader
          title="Activity Log"
          description="View a chronological history of changes across your GRC program."
        />
        <div
          style={{
            padding: theme.spacing[6],
            backgroundColor: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: theme.borderRadius.lg,
            color: theme.colors.semantic.danger,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontWeight: theme.typography.weights.medium }}>Error loading activity log</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>{error}</p>
          <button
            onClick={fetchData}
            style={{
              marginTop: theme.spacing[4],
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              backgroundColor: theme.colors.semantic.danger,
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Activity Log"
        description="View a chronological history of changes across your GRC program."
      />

      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.spacing[4],
          marginBottom: theme.spacing[8],
        }}
      >
        {[
          { label: 'Total Entries', value: entries.length, color: theme.colors.primary },
          { label: 'Creates', value: entries.filter(e => e.action === 'create').length, color: '#059669' },
          { label: 'Updates', value: entries.filter(e => e.action === 'update' || e.action === 'status_change').length, color: '#2563EB' },
          { label: 'Links', value: entries.filter(e => e.action === 'link' || e.action === 'unlink').length, color: '#4F46E5' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              padding: theme.spacing[5],
              backgroundColor: 'white',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: theme.spacing[1] }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: theme.typography.weights.bold, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {filterSection}

      {entries.length === 0 ? (
        <div
          style={{
            padding: theme.spacing[12],
            backgroundColor: 'white',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.lg,
            textAlign: 'center',
            color: theme.colors.text.secondary,
          }}
        >
          <p style={{ margin: 0, fontSize: theme.typography.sizes.lg }}>No activity found</p>
          <p style={{ margin: `${theme.spacing[2]} 0 0`, fontSize: theme.typography.sizes.sm }}>
            Activity will appear here as users make changes to the GRC program.
          </p>
        </div>
      ) : (
        <DataTable
          data={entries}
          columns={columns}
          searchPlaceholder="Search activity..."
        />
      )}
    </div>
  );
}
