export type DataClassificationLifecycleStatus = 'planned' | 'in_progress' | 'complete';

const allowedTransitions: Record<DataClassificationLifecycleStatus, DataClassificationLifecycleStatus[]> = {
  planned: ['planned', 'in_progress'],
  in_progress: ['in_progress', 'complete'],
  complete: ['complete'],
};

export function assertDataClassificationTransition(
  current: DataClassificationLifecycleStatus,
  next: DataClassificationLifecycleStatus,
) {
  if (!allowedTransitions[current]?.includes(next)) {
    throw Object.assign(
      new Error(`Data classification cannot move from ${current} to ${next}.`),
      { code: 'INVALID_CLASSIFICATION_TRANSITION' },
    );
  }
}
