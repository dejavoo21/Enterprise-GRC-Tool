export type RelationshipEntityType = 'risk' | 'asset' | 'control' | 'evidence' | 'supplier' | 'contract' | 'policy' | 'framework' | 'finding' | 'remediation' | 'business_process' | 'ai_system' | 'data_asset';
export type RelationshipType = 'risk_asset' | 'risk_control' | 'risk_evidence' | 'supplier_asset' | 'supplier_contract' | 'policy_control' | 'framework_control' | 'finding_remediation' | 'asset_business_process' | 'ai_system_data_asset';
export interface EnterpriseRelationship {
  id: string; workspaceId: string; sourceEntityType: RelationshipEntityType; sourceEntityId: string; sourceLabel: string;
  targetEntityType: RelationshipEntityType; targetEntityId: string; targetLabel: string; relationshipType: RelationshipType;
  status: 'active' | 'archived'; provenance: string; metadata: Record<string, unknown>; createdBy: string;
  createdAt: string; updatedAt: string; direction: 'outgoing' | 'incoming';
}
export interface RelationshipExplorerData {
  entity: { type: RelationshipEntityType; id: string; label: string };
  relationships: EnterpriseRelationship[];
  counts: Partial<Record<RelationshipEntityType, number>>;
}
export interface RelationshipEvent {
  id: string;
  relationshipId: string;
  eventType: 'created' | 'archived';
  actorName: string;
  occurredAt: string;
  snapshot: Record<string, unknown>;
}
