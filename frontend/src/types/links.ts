// ============================================
// Control-Governance-Training Link Types
// ============================================

export type ControlRelationType = 'supports' | 'implements' | 'references';
export type ControlTrainingRelationType = 'reinforces' | 'introduces' | 'advanced';
export type DocumentTrainingRelationType = 'enforces' | 'explains';

export interface ControlDocumentLink {
  controlId: string;
  documentId: string;
  relationType: ControlRelationType;
}

export interface ControlTrainingLink {
  controlId: string;
  courseId: string;
  relationType: ControlTrainingRelationType;
}

export interface DocumentTrainingLink {
  documentId: string;
  courseId: string;
  relationType: DocumentTrainingRelationType;
}

// Labels for relation types (for UI display)
export const CONTROL_RELATION_LABELS: Record<ControlRelationType, string> = {
  supports: 'Supports',
  implements: 'Implements',
  references: 'References',
};

export const CONTROL_TRAINING_RELATION_LABELS: Record<ControlTrainingRelationType, string> = {
  reinforces: 'Reinforces',
  introduces: 'Introduces',
  advanced: 'Advanced',
};

export const DOCUMENT_TRAINING_RELATION_LABELS: Record<DocumentTrainingRelationType, string> = {
  enforces: 'Enforces',
  explains: 'Explains',
};

// Options for dropdowns
export const CONTROL_RELATION_OPTIONS: { value: ControlRelationType; label: string }[] = [
  { value: 'supports', label: 'Supports' },
  { value: 'implements', label: 'Implements' },
  { value: 'references', label: 'References' },
];

export const CONTROL_TRAINING_RELATION_OPTIONS: { value: ControlTrainingRelationType; label: string }[] = [
  { value: 'reinforces', label: 'Reinforces' },
  { value: 'introduces', label: 'Introduces' },
  { value: 'advanced', label: 'Advanced' },
];

export const DOCUMENT_TRAINING_RELATION_OPTIONS: { value: DocumentTrainingRelationType; label: string }[] = [
  { value: 'enforces', label: 'Enforces' },
  { value: 'explains', label: 'Explains' },
];
