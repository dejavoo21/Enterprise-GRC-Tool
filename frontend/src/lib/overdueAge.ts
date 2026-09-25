export const overdueAgeBands = [
  { label: 'Under 7 days', min: 0, max: 6 },
  { label: '7-30 days', min: 7, max: 30 },
  { label: '31-90 days', min: 31, max: 90 },
  { label: 'Over 90 days', min: 91, max: Infinity },
];

export function overdueDays(dueDate: string | undefined, asOf: number): number | null {
  if (!dueDate || !Number.isFinite(Date.parse(dueDate))) return null;
  return Math.max(0, Math.floor((asOf - Date.parse(dueDate)) / 86400000));
}
