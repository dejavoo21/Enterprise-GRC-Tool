import type { ActivityLedgerEntry } from './activityLedger.js';

export type EnterpriseEntityType =
  | 'organization'
  | 'business_unit'
  | 'user'
  | 'role'
  | 'asset'
  | 'risk'
  | 'control'
  | 'policy'
  | 'procedure'
  | 'framework'
  | 'assessment'
  | 'audit'
  | 'finding'
  | 'action'
  | 'evidence'
  | 'vendor'
  | 'contract'
  | 'regulation'
  | 'obligation'
  | 'ai_system'
  | 'data_asset'
  | 'dpia'
  | 'esg_metric'
  | 'incident'
  | 'training'
  | 'review'
  | 'task'
  | 'activity';

export interface EnterpriseReferenceRecord {
  id: string;
  workspaceId: string;
  referenceType: 'department' | 'region' | 'country' | 'business_unit' | 'framework' | 'category' | 'taxonomy' | 'risk_type' | 'control_type';
  code: string;
  label: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseWorkflowTemplate {
  id: string;
  workspaceId: string;
  workflowKey: 'risk' | 'audit' | 'vendor' | 'policy' | 'dpia' | 'incident' | 'control_review';
  title: string;
  stages: string[];
  approvalsRequired: string[];
  status: 'active' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseEntityNode {
  id: string;
  entityType: EnterpriseEntityType;
  name: string;
  routeKey: string;
  owner?: string | null;
  status?: string | null;
  severity?: string | null;
  businessUnit?: string | null;
  framework?: string | null;
  domain?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnterpriseRelationshipEdge {
  id: string;
  workspaceId: string;
  sourceType: EnterpriseEntityType;
  sourceId: string;
  sourceName: string;
  targetType: EnterpriseEntityType;
  targetId: string;
  targetName: string;
  relationshipType: string;
  strength: number;
  metadata?: Record<string, unknown>;
}

export interface EnterpriseTaskItem {
  id: string;
  workspaceId: string;
  sourceModule: string;
  sourceType: EnterpriseEntityType;
  sourceId: string;
  title: string;
  owner: string;
  dueDate?: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  progressPercent: number;
  routeKey: string;
  evidence?: string[];
}

export interface EnterpriseApprovalItem {
  id: string;
  workspaceId: string;
  approvalType: string;
  title: string;
  requester: string;
  approver?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'in_review';
  dueDate?: string | null;
  routeKey: string;
  entityType: EnterpriseEntityType;
  entityId: string;
  notes?: string | null;
}

export interface EnterpriseNotificationItem {
  id: string;
  channel: 'in_app' | 'email' | 'teams' | 'slack' | 'webhook';
  title: string;
  message: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  routeKey: string;
}

export interface EnterpriseAnalytics {
  riskByVendor: Array<{ vendor: string; count: number }>;
  riskByAsset: Array<{ asset: string; count: number }>;
  riskByAiSystem: Array<{ aiSystem: string; count: number }>;
  findingsByFramework: Array<{ framework: string; count: number }>;
  controlsByRegulation: Array<{ regulation: string; count: number }>;
  privacyByBusinessUnit: Array<{ businessUnit: string; count: number }>;
  esgBySupplier: Array<{ supplier: string; score: number }>;
  auditByDepartment: Array<{ department: string; count: number }>;
}

export interface EnterpriseExecutiveSummary {
  topRisks: Array<{ id: string; title: string; score: number; routeKey: string }>;
  controlCoverage: number;
  openFindings: number;
  vendorExposure: number;
  privacyExposure: number;
  esgExposure: number;
  aiExposure: number;
  crossDomainImpact: number;
}

export interface EnterpriseEntity360 {
  entity: EnterpriseEntityNode;
  overview: Array<{ label: string; value: string | number }>;
  relatedEntities: EnterpriseEntityNode[];
  relatedRelationships: EnterpriseRelationshipEdge[];
  activity: ActivityLedgerEntry[];
}

export interface EnterpriseOpsState {
  summary: {
    totalEntities: number;
    totalRelationships: number;
    openTasks: number;
    pendingApprovals: number;
    criticalNotifications: number;
    crossDomainImpact: number;
  };
  entities: EnterpriseEntityNode[];
  relationships: EnterpriseRelationshipEdge[];
  workflows: EnterpriseWorkflowTemplate[];
  taskCenter: EnterpriseTaskItem[];
  approvalQueue: EnterpriseApprovalItem[];
  notifications: EnterpriseNotificationItem[];
  analytics: EnterpriseAnalytics;
  executiveSummary: EnterpriseExecutiveSummary;
  references: EnterpriseReferenceRecord[];
}
