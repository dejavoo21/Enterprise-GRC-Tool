export type ReadinessStatus = 'not_started' | 'in_progress' | 'ready';

// Flexible framework code - allows any string for data-driven frameworks
export type ControlFrameworkCode = string;

// Legacy alias for backwards compatibility
export type ControlFramework = ControlFrameworkCode;

export interface ReadinessSummary {
  framework: ControlFramework;
  readinessPercent: number; // 0–100
  totalAreas: number;
  readyAreas: number;
  openItems: number; // readiness items not "ready"
}

export interface ReadinessArea {
  id: string;
  framework: ControlFramework;
  domain: string;
  score: number;
  status: ReadinessStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessItem {
  id: string;
  areaId: string;
  controlId?: string;
  riskId?: string;
  question: string;
  status: ReadinessStatus;
  owner: string;
  dueDate?: string;
  evidenceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedReadinessItem extends ReadinessItem {
  framework?: ControlFramework;
  domain?: string;
}
