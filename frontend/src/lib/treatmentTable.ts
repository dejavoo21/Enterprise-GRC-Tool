type SortableTreatment = {
  title: string;
  progressPercent: number;
  dueDate?: string;
  updatedAt?: string;
};

const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

export function sortTreatmentPlans<T extends SortableTreatment>(plans: readonly T[], sort: string): T[] {
  return [...plans].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'progress') return b.progressPercent - a.progressPercent;
    const first = timestamp(sort === 'updated' ? a.updatedAt : a.dueDate);
    const second = timestamp(sort === 'updated' ? b.updatedAt : b.dueDate);
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    return sort === 'updated' ? second - first : first - second;
  });
}

export function treatmentPage<T>(plans: readonly T[], pageSize: number, saved: {key: string; page: number}, key: string) {
  const pageCount = Math.max(1, Math.ceil(plans.length / pageSize));
  const page = Math.max(1, Math.min(saved.key === key ? saved.page : 1, pageCount));
  return {page, pageCount, visible: plans.slice((page - 1) * pageSize, page * pageSize)};
}
