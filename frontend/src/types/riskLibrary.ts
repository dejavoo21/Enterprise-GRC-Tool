import type { CiaImpact, RiskCategory } from './risk';
export type RiskLibraryStatus = 'draft' | 'active' | 'archived';
export type RiskScenarioType = 'event_based' | 'asset_based';
export interface RiskLibraryTemplate {
  id:string; workspaceId:string; libraryRiskId:string; title:string; description:string; category:RiskCategory;
  scenarioType:RiskScenarioType; riskSource?:string|null; threatEvent?:string|null; vulnerability?:string|null;
  predisposingCondition?:string|null; likelihoodRationale?:string|null; impactRationale?:string|null;
  suggestedOwner?:string|null; suggestedCiaImpacts:CiaImpact[]; commonCauses:string[]; commonConsequences:string[];
  suggestedInherentLikelihood?:number|null; suggestedInherentImpact?:number|null; suggestedControls:string[];
  suggestedEvidence:string[]; relatedFrameworks:string[]; relatedControlIds:string[]; treatmentSuggestions:string[];
  monitoringIndicators:string[]; tags:string[]; status:RiskLibraryStatus; usageCount:number; createdAt:string; updatedAt:string;
}
export type RiskLibraryTemplateInput = Omit<RiskLibraryTemplate,'id'|'workspaceId'|'libraryRiskId'|'usageCount'|'createdAt'|'updatedAt'>;
