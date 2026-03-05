import type { ReactNode } from 'react';
import { theme } from '../theme';
import { Card } from './Card';
import { Button } from './Button';
import { SearchIcon, FilterIcon, PlusIcon } from './icons';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (item: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  filterOptions?: string[];
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  primaryAction,
  filterOptions = [],
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing[4],
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}
      >
        <div style={{ display: 'flex', gap: theme.spacing[3], flex: 1 }}>
          {/* Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.lg,
              padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
              minWidth: '240px',
              maxWidth: '320px',
            }}
          >
            <SearchIcon size={16} color={theme.colors.text.muted} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.text.main,
                width: '100%',
                fontFamily: theme.typography.fontFamily,
              }}
            />
          </div>

          {/* Filter */}
          {filterOptions.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[2],
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                cursor: 'pointer',
              }}
            >
              <FilterIcon size={16} color={theme.colors.text.muted} />
              <select
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: theme.typography.sizes.sm,
                  color: theme.colors.text.secondary,
                  cursor: 'pointer',
                  fontFamily: theme.typography.fontFamily,
                }}
              >
                <option value="">All Status</option>
                {filterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {primaryAction && (
          <Button variant="primary" onClick={primaryAction.onClick}>
            <PlusIcon size={16} /> {primaryAction.label}
          </Button>
        )}
      </div>

      {/* Table Card */}
      <Card noPadding>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: theme.typography.sizes.sm,
            }}
          >
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing[4]} ${theme.spacing[4]}`,
                      borderBottom: `2px solid ${theme.colors.border}`,
                      color: theme.colors.text.secondary,
                      fontWeight: theme.typography.weights.semibold,
                      whiteSpace: 'nowrap',
                      width: col.width,
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                  }}
                  onClick={() => onRowClick?.(item)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      style={{
                        padding: `${theme.spacing[4]} ${theme.spacing[4]}`,
                        borderBottom: `1px solid ${theme.colors.borderLight}`,
                        color: theme.colors.text.main,
                      }}
                    >
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key as string] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `${theme.spacing[4]} ${theme.spacing[4]}`,
            borderTop: `1px solid ${theme.colors.borderLight}`,
          }}
        >
          <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text.muted }}>
            Showing 1-{data.length} of {data.length} results
          </span>
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
