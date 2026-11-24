import { useMemo, useState, type ReactNode } from 'react';
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filteredData = useMemo(() => data.filter((item) => {
    const record = item as Record<string, unknown>;
    const matchesSearch = !search.trim() || Object.values(record).some((value) => ['string', 'number'].includes(typeof value) && String(value).toLowerCase().includes(search.trim().toLowerCase()));
    const matchesFilter = !filter || String(record.status ?? '') === filter;
    return matchesSearch && matchesFilter;
  }), [data, filter, search]);
  const pageCount = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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
              type="search"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
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
                aria-label="Filter table by status"
                value={filter}
                onChange={(event) => { setFilter(event.target.value); setPage(1); }}
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
              {visibleData.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                  }}
                  onClick={() => onRowClick?.(item)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => { if (onRowClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(item); } }}
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
              {visibleData.length === 0 ? <tr><td colSpan={columns.length} style={{ padding: theme.spacing[6], textAlign: 'center', color: theme.colors.text.muted }}>No records match the current search and filter.</td></tr> : null}
            </tbody>
          </table>
        </div>

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
            Showing {filteredData.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results
          </span>
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
              Previous
            </Button>
            <span aria-live="polite" style={{ alignSelf: 'center', fontSize: theme.typography.sizes.sm }}>Page {currentPage} of {pageCount}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(Math.min(pageCount, currentPage + 1))}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
