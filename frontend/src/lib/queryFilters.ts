export type QueryFilterValue = string | number | boolean | null | undefined;
export type QueryFilterUpdates = Record<string, QueryFilterValue>;

export function parseFilterMetadata(metadata: string): Record<string, string> {
  const params = new URLSearchParams(metadata);
  return Object.fromEntries(params.entries());
}

export function buildFilteredPath(path: string, metadata: string | QueryFilterUpdates): string {
  const params = new URLSearchParams();
  const filters = typeof metadata === 'string' ? parseFilterMetadata(metadata) : metadata;
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function updateQueryFilters(current: URLSearchParams, updates: QueryFilterUpdates): URLSearchParams {
  const next = new URLSearchParams(current);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, String(value));
  });
  return next;
}

export function readAllowedFilter<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T | null {
  const value = params.get(key);
  return value && allowed.includes(value as T) ? value as T : null;
}
