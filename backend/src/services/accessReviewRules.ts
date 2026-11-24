export interface AccessReviewInput {
  name?: string;
  selectedRoles?: string[];
  selectedModules?: string[];
  selectedUserIds?: string[];
  reviewers?: string[];
  dueDate?: string;
}

export function validateAccessReviewInput(input: AccessReviewInput, now = new Date()): string | null {
  if (!input.name?.trim()) return 'Review campaign name is required.';
  if (!input.selectedRoles?.length && !input.selectedModules?.length) return 'Select at least one role or module.';
  if (!input.selectedUserIds?.length) return 'Select at least one workspace user.';
  if (!input.reviewers?.some((reviewer) => reviewer.trim())) return 'At least one reviewer is required.';
  const due = input.dueDate ? new Date(input.dueDate) : null;
  if (!due || !Number.isFinite(due.getTime())) return 'A valid due date is required.';
  if (due.getTime() <= now.getTime()) return 'The due date must be in the future.';
  return null;
}
