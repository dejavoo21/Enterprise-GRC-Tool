/**
 * Activity Log Types
 */

export type ActivityEntityType =
  | 'control'
  | 'risk'
  | 'governance_document'
  | 'training_course'
  | 'evidence'
  | 'link'
  | 'asset'
  | 'vendor';

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'link'
  | 'unlink'
  | 'review'
  | 'other';

export interface ActivityLogEntry {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityActionType;
  summary: string;
  details?: any;
  createdAt: string;
}

export interface ActivityLogFilters {
  entityType?: ActivityEntityType;
  entityId?: string;
  userId?: string;
  before?: string;
  limit?: number;
}
