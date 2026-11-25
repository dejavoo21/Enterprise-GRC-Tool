import * as aiRepo from '../repositories/aiGovernanceRepo.js';
import { recordActivity, type RecordActivityInput } from './activityLedger/activityLedger.js';
import { assertWorkspaceLinks } from './workspaceLinkValidation.js';
import { assertAiSystemDecision, assertAssessmentTransition, assertControlTransition, assertIncidentTransition } from './aiLifecycleRules.js';
import type {
  AiCiaImpact,
  AiClassification,
  AiComplianceProgramRecord,
  AiControlRecord,
  AiGovernanceState,
  AiIncidentRecord,
  AiModelRecord,
  AiReportRecord,
  AiReportType,
  AiRiskAssessmentRecord,
  AiSystemRecord,
  AiTrainingProgramRecord,
  AiVendorRecord,
} from '../types/aiGovernance.js';

interface ActorContext {
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
}

async function logAiActivity(workspaceId: string, entry: Omit<RecordActivityInput, 'workspaceId' | 'category' | 'source'>) {
  await recordActivity({
    workspaceId,
    category: 'ai',
    source: 'backend',
    severity: 'medium',
    outcome: 'success',
    ...entry,
  });
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

const AI_CLASSIFICATIONS: ReadonlySet<AiClassification> = new Set([
  'minimal_risk',
  'limited_risk',
  'high_risk',
  'prohibited',
  'not_classified',
  'to_be_determined',
  'general_purpose_ai',
  'foundation_model',
  'generative_ai',
]);

function normalizeCiaImpacts(input: Partial<AiSystemRecord>): AiCiaImpact[] {
  const explicit = Array.isArray(input.ciaImpacts)
    ? input.ciaImpacts.filter((value): value is AiCiaImpact => ['Confidentiality', 'Integrity', 'Availability'].includes(value))
    : [];
  if (explicit.length > 0) {
    return Array.from(new Set(explicit));
  }

  const inferred = new Set<AiCiaImpact>();
  const dataType = (input.dataType || '').toLowerCase();
  const useCase = (input.useCase || '').toLowerCase();
  const impact = input.impact || 'medium';

  if (dataType.includes('pii') || dataType.includes('financial') || dataType.includes('regulated') || dataType.includes('health')) {
    inferred.add('Confidentiality');
    inferred.add('Integrity');
  }
  if (useCase.includes('underwriting') || useCase.includes('credit') || useCase.includes('decision')) {
    inferred.add('Integrity');
  }
  if (impact === 'severe' || impact === 'high' || useCase.includes('support') || useCase.includes('productivity')) {
    inferred.add('Availability');
  }

  return inferred.size > 0 ? Array.from(inferred) : ['Integrity'];
}

function classificationRank(classification: AiClassification) {
  switch (classification) {
    case 'prohibited':
      return 7;
    case 'high_risk':
      return 6;
    case 'to_be_determined':
      return 5;
    case 'generative_ai':
      return 4;
    case 'foundation_model':
      return 3;
    case 'general_purpose_ai':
      return 2;
    case 'not_classified':
      return 1;
    case 'limited_risk':
      return 1;
    case 'minimal_risk':
    default:
      return 0;
  }
}

export function deriveAiClassification(input: Partial<AiSystemRecord>): AiClassification {
  if (input.classification && AI_CLASSIFICATIONS.has(input.classification)) {
    return input.classification;
  }
  const useCase = (input.useCase || '').toLowerCase();
  const dataType = (input.dataType || '').toLowerCase();
  const industry = (input.industry || '').toLowerCase();
  const jurisdictions = (input.jurisdictions || []).map((item) => item.toLowerCase());
  const modelType = (input.modelType || '').toLowerCase();
  const impact = input.impact || 'medium';

  const isGenerative = modelType.includes('generative') || useCase.includes('chat') || useCase.includes('assistant');
  const isFoundation = modelType.includes('foundation');
  const highImpactUseCase =
    useCase.includes('credit') ||
    useCase.includes('employment') ||
    useCase.includes('biometric') ||
    useCase.includes('identity') ||
    useCase.includes('medical') ||
    useCase.includes('underwriting');
  const prohibitedPattern =
    useCase.includes('social scoring') ||
    useCase.includes('emotion recognition') ||
    useCase.includes('indiscriminate surveillance');
  const sensitiveData =
    dataType.includes('pii') ||
    dataType.includes('biometric') ||
    dataType.includes('health') ||
    dataType.includes('financial') ||
    dataType.includes('regulated');

  if (prohibitedPattern) return 'prohibited';
  if (highImpactUseCase || (sensitiveData && (impact === 'high' || impact === 'severe')) || jurisdictions.includes('eu') && industry === 'financial_services') {
    return 'high_risk';
  }
  if (isGenerative) return 'generative_ai';
  if (isFoundation) return 'foundation_model';
  if (modelType.includes('general purpose') || useCase.includes('productivity')) return 'general_purpose_ai';
  if (impact === 'low' && !sensitiveData) return 'minimal_risk';
  if (!useCase && !modelType) return 'to_be_determined';
  return 'limited_risk';
}

function deriveRiskRating(input: Partial<AiSystemRecord>, classification: AiClassification): AiSystemRecord['riskRating'] {
  if (classification === 'prohibited') return 'critical';
  if (classification === 'high_risk') return input.impact === 'severe' ? 'critical' : 'high';
  if (classification === 'to_be_determined' || classification === 'not_classified') return 'medium';
  if (classification === 'generative_ai' || classification === 'foundation_model') return 'medium';
  return input.impact === 'low' ? 'low' : 'medium';
}

function deriveComplianceStatus(classification: AiClassification, riskRating: AiSystemRecord['riskRating']): AiSystemRecord['complianceStatus'] {
  if (classification === 'prohibited') return 'non_compliant';
  if (classification === 'high_risk' || riskRating === 'critical') return 'gap';
  if (classification === 'to_be_determined' || classification === 'not_classified') return 'monitoring';
  if (classification === 'generative_ai' || classification === 'foundation_model') return 'monitoring';
  return 'compliant';
}

function deriveAssuranceStatus(complianceStatus: AiSystemRecord['complianceStatus'], inventoryCoveragePercent: number): AiSystemRecord['assuranceStatus'] {
  if (complianceStatus === 'non_compliant' || inventoryCoveragePercent < 70) return 'attention_required';
  if (complianceStatus === 'gap' || inventoryCoveragePercent < 85) return 'monitoring';
  return 'assured';
}

export async function getAiGovernanceState(workspaceId: string): Promise<AiGovernanceState> {
  const [summary, inventory, models, assessments, controls, incidents, vendors, trainingPrograms, reports, compliancePrograms] = await Promise.all([
    aiRepo.getAiGovernanceSummary(workspaceId),
    aiRepo.listAiSystems(workspaceId),
    aiRepo.listAiModels(workspaceId),
    aiRepo.listAiAssessments(workspaceId),
    aiRepo.listAiControls(workspaceId),
    aiRepo.listAiIncidents(workspaceId),
    aiRepo.listAiVendors(workspaceId),
    aiRepo.listAiTrainingPrograms(workspaceId),
    aiRepo.listAiReports(workspaceId),
    aiRepo.listAiCompliancePrograms(workspaceId),
  ]);

  const assuranceHighlights = [
    { label: 'High-risk inventory under active review', value: inventory.filter((item) => item.classification === 'high_risk' || item.riskRating === 'critical').length, detail: 'High-risk systems' },
    { label: 'Independent validations completed', value: models.filter((item) => item.validationStatus === 'validated').length, detail: 'Validated models' },
    { label: 'Open AI incidents requiring response', value: incidents.filter((item) => item.status !== 'resolved').length, detail: 'Open incidents' },
    { label: 'Framework programs below target', value: compliancePrograms.filter((item) => item.score < item.targetScore).length, detail: 'Programs below target' },
  ];

  const modelRiskTrend: AiGovernanceState['modelRiskTrend'] = [];

  return {
    summary,
    inventory: inventory.sort((left, right) => classificationRank(right.classification) - classificationRank(left.classification)),
    models,
    assessments,
    controls,
    incidents,
    vendors,
    trainingPrograms,
    reports,
    compliancePrograms,
    assuranceHighlights,
    modelRiskTrend,
  };
}

export async function createAiSystem(workspaceId: string, input: Partial<AiSystemRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, {
    risks: input.linkedRiskIds,
    controls: input.linkedControlIds,
    evidence: input.linkedEvidenceIds,
    vendors: input.linkedVendorIds,
    aiIncidents: input.linkedIncidentIds,
  });
  const classification = deriveAiClassification(input);
  const riskRating = deriveRiskRating(input, classification);
  const complianceStatus = deriveComplianceStatus(classification, riskRating);
  const inventoryCoverageRecorded = input.inventoryCoveragePercent !== undefined;
  const inventoryCoveragePercent = inventoryCoverageRecorded ? Number(input.inventoryCoveragePercent) : 0;
  const record = await aiRepo.createAiSystem(workspaceId, {
    ...input,
    classification,
    riskRating,
    complianceStatus,
    ciaImpacts: normalizeCiaImpacts(input),
    linkedRiskIds: input.linkedRiskIds || [],
    linkedControlIds: input.linkedControlIds || [],
    linkedEvidenceIds: input.linkedEvidenceIds || [],
    linkedVendorIds: input.linkedVendorIds || [],
    linkedIncidentIds: input.linkedIncidentIds || [],
    inventoryCoverageRecorded,
    assuranceStatus: inventoryCoverageRecorded ? deriveAssuranceStatus(complianceStatus, inventoryCoveragePercent) : 'monitoring',
    inventoryCoveragePercent,
  });

  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_system_registered',
    targetType: 'ai_system',
    targetId: record.id,
    targetName: record.systemName,
    newValue: { classification: record.classification, riskRating: record.riskRating, complianceStatus: record.complianceStatus },
    notes: `Registered AI system ${record.systemName}`,
  });

  return record;
}

export async function updateAiSystem(workspaceId: string, id: string, input: Partial<AiSystemRecord>, actor: ActorContext) {
  const current = (await aiRepo.listAiSystems(workspaceId)).find((item) => item.id === id) || null;
  if (!current) return null;
  await assertWorkspaceLinks(workspaceId, {
    risks: input.linkedRiskIds,
    controls: input.linkedControlIds,
    evidence: input.linkedEvidenceIds,
    vendors: input.linkedVendorIds,
    aiIncidents: input.linkedIncidentIds,
  });
  const merged: Partial<AiSystemRecord> = { ...current, ...input };
  const classification = deriveAiClassification(merged);
  const riskRating = deriveRiskRating(merged, classification);
  const complianceStatus = deriveComplianceStatus(classification, riskRating);
  const inventoryCoverageRecorded = input.inventoryCoveragePercent !== undefined || current.inventoryCoverageRecorded;
  const inventoryCoveragePercent = input.inventoryCoveragePercent ?? current.inventoryCoveragePercent;

  const record = await aiRepo.updateAiSystem(workspaceId, id, {
    ...merged,
    classification,
    riskRating,
    complianceStatus,
    ciaImpacts: normalizeCiaImpacts(merged),
    inventoryCoverageRecorded,
    assuranceStatus: inventoryCoverageRecorded ? deriveAssuranceStatus(complianceStatus, inventoryCoveragePercent) : 'monitoring',
    inventoryCoveragePercent,
  });
  if (!record) return null;

  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_system_updated',
    targetType: 'ai_system',
    targetId: record.id,
    targetName: record.systemName,
    previousValue: current,
    newValue: record,
    notes: `Updated AI system ${record.systemName}`,
  });

  return record;
}

export async function decideAiSystem(workspaceId: string, id: string, decision: 'approved'|'rejected', actor: ActorContext) {
  const current = (await aiRepo.listAiSystems(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertAiSystemDecision(current.lifecycleStatus);
  return updateAiSystem(workspaceId, id, { lifecycleStatus: decision === 'approved' ? 'active' : 'rejected' }, actor);
}

export async function createAiModel(workspaceId: string, input: Partial<AiModelRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { aiSystems: input.systemId ? [input.systemId] : undefined });
  const record = await aiRepo.createAiModel(workspaceId, input, actor.actorUserId || undefined);
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: record.approvalStatus === 'approved' ? 'model_created_and_approved' : 'model_created',
    targetType: 'ai_model',
    targetId: record.id,
    targetName: record.modelName,
    newValue: { validationStatus: record.validationStatus, approvalStatus: record.approvalStatus, drift: record.drift },
    notes: `Created model ${record.modelName}`,
  });
  return record;
}

export async function getAiModelHistory(workspaceId: string, id: string) {
  return aiRepo.listAiModelEvents(workspaceId, id);
}

export async function submitAiModelForReview(workspaceId: string, id: string, actor: ActorContext) {
  const current = await aiRepo.getAiModel(workspaceId, id);
  if (!current) return null;
  const { assertModelSubmission } = await import('./aiModelReviewRules.js');
  assertModelSubmission(current.approvalStatus, current.validationStatus);
  const record = await aiRepo.submitAiModel(workspaceId, id, actor.actorUserId!);
  if (record) await logAiActivity(workspaceId, { ...actor, action: 'model_submitted', targetType: 'ai_model', targetId: id, targetName: current.modelName, previousValue: current.approvalStatus, newValue: 'in_review', notes: 'Model submitted for independent review.' });
  return record;
}

export async function decideAiModelReview(workspaceId: string, id: string, decision: 'approved'|'rejected', notes: string | undefined, actor: ActorContext) {
  const current = await aiRepo.getAiModel(workspaceId, id);
  if (!current) return null;
  const { assertIndependentModelDecision } = await import('./aiModelReviewRules.js');
  assertIndependentModelDecision(current.approvalStatus, current.createdBy, actor.actorUserId!);
  const record = await aiRepo.decideAiModel(workspaceId, id, actor.actorUserId!, decision, notes);
  if (record) await logAiActivity(workspaceId, { ...actor, action: `model_${decision}`, targetType: 'ai_model', targetId: id, targetName: current.modelName, previousValue: current.approvalStatus, newValue: decision, severity: decision === 'rejected' ? 'high' : 'medium', notes: notes || 'Independent model review recorded.' });
  return record;
}

export async function updateAiModel(workspaceId: string, id: string, input: Partial<AiModelRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { aiSystems: input.systemId ? [input.systemId] : undefined });
  const current = (await aiRepo.listAiModels(workspaceId)).find((item) => item.id === id) || null;
  const record = await aiRepo.updateAiModel(workspaceId, id, input);
  if (!record) return null;
  const action = record.approvalStatus === 'retired' ? 'model_retired' : record.approvalStatus === 'approved' ? 'model_approved' : 'model_updated';
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action,
    targetType: 'ai_model',
    targetId: record.id,
    targetName: record.modelName,
    previousValue: current,
    newValue: record,
    severity: record.validationStatus === 'failed' ? 'high' : 'medium',
    notes: `Updated model ${record.modelName}`,
  });
  return record;
}

export async function createAiAssessment(workspaceId: string, input: Partial<AiRiskAssessmentRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { aiSystems: input.systemId ? [input.systemId] : undefined });
  const risks = [
    input.biasRisk,
    input.fairnessRisk,
    input.transparencyRisk,
    input.privacyRisk,
    input.securityRisk,
    input.hallucinationRisk,
    input.explainabilityRisk,
    input.ethicalRisk,
    input.safetyRisk,
    input.regulatoryRisk,
    input.operationalRisk,
    input.vendorRisk,
  ].map((value) => value || 0);
  const overallRiskScore = input.overallRiskScore ?? avg(risks);
  const record = await aiRepo.createAiAssessment(workspaceId, {
    ...input,
    overallRiskScore,
  });
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_assessment_created',
    targetType: 'ai_assessment',
    targetId: record.id,
    targetName: record.assessmentName,
    newValue: { overallRiskScore: record.overallRiskScore, status: record.status },
    severity: record.overallRiskScore >= 60 ? 'high' : record.overallRiskScore >= 40 ? 'medium' : 'low',
    notes: `Created AI risk assessment ${record.assessmentName}`,
  });
  return record;
}

export async function transitionAiAssessment(workspaceId: string, id: string, status: AiRiskAssessmentRecord['status'], actor: ActorContext) {
  const current = (await aiRepo.listAiAssessments(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertAssessmentTransition(current.status, status, status === 'approved' || status === 'rejected');
  const record = await aiRepo.updateAiAssessmentStatus(workspaceId, id, status);
  if (record) await logAiActivity(workspaceId, { ...actor, action: 'ai_assessment_status_changed', targetType: 'ai_assessment', targetId: id, targetName: record.assessmentName, previousValue: current.status, newValue: status, notes: `AI assessment status changed to ${status}.` });
  return record;
}

export async function createAiControl(workspaceId: string, input: Partial<AiControlRecord>, actor: ActorContext) {
  const record = await aiRepo.createAiControl(workspaceId, input);
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_control_registered',
    targetType: 'ai_control',
    targetId: record.id,
    targetName: record.controlName,
    newValue: { category: record.category, mappedFrameworks: record.mappedFrameworks },
    notes: `Registered AI control ${record.controlName}`,
  });
  return record;
}

export async function transitionAiControl(workspaceId: string, id: string, status: AiControlRecord['status'], actor: ActorContext) {
  const current = (await aiRepo.listAiControls(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertControlTransition(current.status, status);
  const record = await aiRepo.updateAiControlStatus(workspaceId, id, status);
  if (record) await logAiActivity(workspaceId, { ...actor, action: 'ai_control_status_changed', targetType: 'ai_control', targetId: id, targetName: record.controlName, previousValue: current.status, newValue: status, notes: `AI control status changed to ${status}.` });
  return record;
}

export async function createAiIncident(workspaceId: string, input: Partial<AiIncidentRecord>, actor: ActorContext) {
  await assertWorkspaceLinks(workspaceId, { aiSystems: input.systemId ? [input.systemId] : undefined });
  const record = await aiRepo.createAiIncident(workspaceId, input);
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_incident_raised',
    targetType: 'ai_incident',
    targetId: record.id,
    targetName: record.title,
    newValue: { incidentType: record.incidentType, severity: record.severity, status: record.status },
    severity: record.severity === 'critical' ? 'critical' : record.severity === 'high' ? 'high' : 'medium',
    notes: `Raised AI incident ${record.title}`,
  });
  return record;
}

export async function transitionAiIncident(workspaceId: string, id: string, status: AiIncidentRecord['status'], actor: ActorContext) {
  const current = (await aiRepo.listAiIncidents(workspaceId)).find((item) => item.id === id);
  if (!current) return null;
  assertIncidentTransition(current.status, status);
  const record = await aiRepo.updateAiIncidentStatus(workspaceId, id, status);
  if (record) await logAiActivity(workspaceId, { ...actor, action: 'ai_incident_status_changed', targetType: 'ai_incident', targetId: id, targetName: record.title, previousValue: current.status, newValue: status, severity: record.severity === 'critical' ? 'critical' : record.severity === 'high' ? 'high' : 'medium', notes: `AI incident status changed to ${status}.` });
  return record;
}

export async function createAiVendor(workspaceId: string, input: Partial<AiVendorRecord>, actor: ActorContext) {
  const record = await aiRepo.createAiVendor(workspaceId, input);
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_vendor_assessed',
    targetType: 'ai_vendor',
    targetId: record.id,
    targetName: record.vendorName,
    newValue: { riskRating: record.riskRating, complianceScore: record.complianceScore },
    notes: `Recorded AI vendor ${record.vendorName}`,
  });
  return record;
}

export async function createAiTrainingProgram(workspaceId: string, input: Partial<AiTrainingProgramRecord>, actor: ActorContext) {
  const record = await aiRepo.createAiTrainingProgram(workspaceId, input);
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_training_assigned',
    targetType: 'ai_training_program',
    targetId: record.id,
    targetName: record.programName,
    newValue: { completionRate: record.completionRate, status: record.status },
    notes: `Added AI training program ${record.programName}`,
  });
  return record;
}

export async function upsertAiComplianceProgram(workspaceId: string, input: Partial<AiComplianceProgramRecord>, actor: ActorContext) {
  const record = await aiRepo.upsertAiComplianceProgram(workspaceId, input);
  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_compliance_status_changed',
    targetType: 'ai_framework_program',
    targetId: record.id,
    targetName: record.frameworkName,
    newValue: { score: record.score, gapCount: record.gapCount, status: record.status },
    severity: record.status === 'critical' ? 'high' : record.status === 'watch' ? 'medium' : 'low',
    notes: `Updated compliance program ${record.frameworkName}`,
  });
  return record;
}

function buildReportSummary(reportType: AiReportType, state: AiGovernanceState) {
  const score = (value: number | null, label: string) => value === null ? `${label} is not assessed.` : `${label} is ${value}%.`;
  const summary = [
    state.summary.aiInventoryCoverage === null
      ? `${state.summary.aiSystems} AI systems are recorded; inventory coverage has not been explicitly assessed.`
      : `${state.summary.aiSystems} AI systems are recorded with ${state.summary.aiInventoryCoverage}% explicitly assessed inventory coverage.`,
    `${state.summary.highRiskAi} high-risk or elevated AI systems require heightened oversight.`,
    `${score(state.summary.aiComplianceScore, 'Compliance')} ${score(state.summary.aiRiskScore, 'Composite risk pressure')}`,
    score(state.summary.modelRiskScore, 'Model risk'),
  ];

  if (reportType === 'eu_ai_act_report') {
    const euProgram = state.compliancePrograms.find((item) => item.frameworkCode === 'EU_AI_ACT');
    summary.push(euProgram
      ? `EU AI Act score ${euProgram.score}% with ${euProgram.gapCount} recorded gap items.`
      : 'EU AI Act readiness has not been assessed in a recorded compliance program.');
  }
  if (reportType === 'iso42001_report') {
    const isoProgram = state.compliancePrograms.find((item) => item.frameworkCode === 'ISO42001');
    summary.push(isoProgram
      ? `ISO/IEC 42001 score ${isoProgram.score}% and documentation coverage ${isoProgram.documentationCoveragePercent}%.`
      : 'ISO/IEC 42001 readiness has not been assessed in a recorded compliance program.');
  }
  if (reportType === 'board_ai_risk_pack') {
    summary.push(`${state.incidents.filter((item) => item.status !== 'resolved').length} open AI incidents remain in active response.`);
  }

  summary.push('This is a current workspace snapshot. Generation does not imply formal approval or distribution.');

  return summary;
}

export async function generateAiReport(workspaceId: string, reportType: AiReportType, actor: ActorContext): Promise<AiReportRecord> {
  const state = await getAiGovernanceState(workspaceId);
  const titles: Record<AiReportType, string> = {
    ai_governance_report: 'AI Governance Report',
    ai_risk_report: 'AI Risk Report',
    model_risk_report: 'Model Risk Report',
    eu_ai_act_report: 'EU AI Act Readiness Report',
    iso42001_report: 'ISO/IEC 42001 Management Report',
    executive_ai_dashboard: 'Executive AI Dashboard',
    board_ai_risk_pack: 'Board AI Risk Pack',
  };

  const report = await aiRepo.createAiReport(workspaceId, {
    reportType,
    title: `${titles[reportType]} - ${new Date().toLocaleDateString('en-GB')}`,
    status: 'generated',
    generatedBy: actor.actorName,
    summary: buildReportSummary(reportType, state),
    generatedAt: new Date().toISOString(),
  });

  await logAiActivity(workspaceId, {
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRole: actor.actorRole,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    device: actor.device,
    action: 'ai_report_generated',
    targetType: 'ai_report',
    targetId: report.id,
    targetName: report.title,
    newValue: { reportType, summaryLines: report.summary.length },
    severity: reportType === 'board_ai_risk_pack' ? 'high' : 'medium',
    notes: `Generated ${report.title}`,
  });

  return report;
}
