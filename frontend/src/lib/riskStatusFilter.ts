export function matchesRiskStatus(status: string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return status !== 'closed' && status !== 'cancelled';
  return status === filter;
}

export function matchesRiskReference(reference: string | null | undefined, filter: string | null): boolean {
  return !filter || reference === filter;
}
