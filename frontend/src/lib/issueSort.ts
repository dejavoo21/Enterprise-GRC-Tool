type SortableIssue = { title: string; priority: string; dueDate?: string };
const priorities = ['Critical', 'High', 'Medium', 'Low'];

export function sortIssues<T extends SortableIssue>(issues: readonly T[], sort: string): T[] {
  if (sort === 'source') return [...issues];
  return [...issues].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'priority') {
      const rank = (value: string) => priorities.includes(value) ? priorities.indexOf(value) : priorities.length;
      return rank(a.priority) - rank(b.priority);
    }
    const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity;
    const first = timestamp(a.dueDate), second = timestamp(b.dueDate);
    return first === second ? 0 : first < second ? -1 : 1;
  });
}
