type AppliedQueryFilterProps = {
  label: string;
  onRemove: () => void;
  routeReady?: boolean;
  description?: string;
};

export function AppliedQueryFilter({ label, onRemove, routeReady = false, description }: AppliedQueryFilterProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '10px 12px',
        border: '1px solid var(--color-border-soft)',
        borderRadius: '10px',
        background: 'var(--color-surface)',
        color: 'var(--color-text-secondary)',
        fontSize: '0.78rem',
      }}
    >
      <span style={{ minWidth: 0 }}>
        <strong style={{ color: 'var(--color-text-main)' }}>{label}</strong>
        {routeReady ? ' (route ready)' : ''}
        {description ? <span style={{ display: 'block', marginTop: '2px' }}>{description}</span> : null}
      </span>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
        style={{
          flex: '0 0 auto',
          border: '1px solid var(--color-border)',
          borderRadius: '999px',
          background: 'var(--color-surface-hover)',
          color: 'var(--color-text-main)',
          cursor: 'pointer',
          padding: '5px 9px',
          font: 'inherit',
          fontWeight: 700,
        }}
      >
        Remove
      </button>
    </div>
  );
}
