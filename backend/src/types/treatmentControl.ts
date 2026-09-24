export const CONTROL_ROLES = ['Preventive', 'Detective', 'Corrective', 'Compensating', 'Recovery', 'Other'] as const;
export type TreatmentControlRole = typeof CONTROL_ROLES[number];
export interface TreatmentControlInput { controlId: string; role: TreatmentControlRole; implementationNote?: string }
export interface TreatmentControl extends TreatmentControlInput { title: string; domain?: string; primaryFramework?: string }
export function validateTreatmentControls(value: unknown): string | null {
  if (!Array.isArray(value) || value.length > 100) return 'Linked controls must be an array of at most 100 controls';
  const ids = new Set<string>();
  for (const link of value) {
    if (!link || typeof link.controlId !== 'string' || !link.controlId.trim() || link.controlId.length > 200) return 'A valid control ID is required';
    if (ids.has(link.controlId)) return 'Duplicate control links are not allowed';
    ids.add(link.controlId);
    if (!CONTROL_ROLES.includes(link.role)) return 'A valid control role is required';
    if (link.implementationNote != null && (typeof link.implementationNote !== 'string' || link.implementationNote.length > 4000)) return 'Control implementation note must be at most 4000 characters';
  }
  return null;
}
