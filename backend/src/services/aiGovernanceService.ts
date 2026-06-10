import * as aiRepo from '../repositories/aiGovernanceRepo.js';
import { recordActivity, type RecordActivityInput } from './activityLedger/activityLedger.js';
import type {
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

function classificationRank(classification: AiClassification) {
  switch (classification) {
    case 'prohibited':
      return 7;
    case 'high_risk':
      return 6;
    case 'generative_ai':
      return 5;
    case 'foundation_model':
      return 4;
    case 'general_purpose_ai':
      return 3;
    case 'limited_risk':
      return 2;
    case 'minimal_risk':
    default:
      return 1;
  }
}

export function deriveAiClassification(input: Partial<AiSystemRecord>): AiClassification {
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
  return 'limited_risk';
}

function deriveRiskRating(input: Partial<AiSystemRecord>, classification: AiClassification): AiSystemRecord['riskRating'] {
  if (classification === 'prohibited') return 'critical';
  if (classification === 'high_risk') return input.impact === 'severe' ? 'critical' : 'high';
  if (classification === 'generative_ai' || classification === 'foundation_model') return 'medium';
  return input.impact === 'low' ? 'low' : 'medium';
}

function deriveComplianceStatus(classification: AiClassification, riskRating: AiSystemRecord['riskRating']): AiSystemRecord['complianceStatus'] {
  if (classification === 'prohibited') return 'non_compliant';
  if (classification === 'high_risk' || riskRating === 'critical') return 'gap';
  if (classification === 'generative_ai' || classification === 'foundation_model') return 'monitoring';
  return 'compliant';
}

function deriveAssuranceStatus(complianceStatus: AiSystemRecord['complianceStatus'], inventoryCoveragePercent: number): AiSystemRecord['assuranceStatus'] {
  if (complianceStatus === 'non_compliant' || inventoryCoveragePercent < 70) return 'attention_required';
  if (complianceStatus === 'gap' || inventoryCoveragePercent < 85) return 'monitoring';
  return 'assured';
}

export async function getAiGovernanceState(workspaceId: string): Promise<AiGovernanceState> {
  await aiRepo.seedAiGovernanceDefaults(workspaceId);
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

  const baseTrend = avg(assessments.map((item) => item.overallRiskScore)) || 38;
  const modelRiskTrend = [
    { month: 'Jan', score: Math.max(0, baseTrend - 7) },
    { month: 'Feb', score: Math.max(0, baseTrend - 4) },
    { month: 'Mar', score: Math.max(0, baseTrend - 2) },
    { month: 'Apr', score: baseTrend + 1 },
    { month: 'May', score: baseTrend + 3 },
    { month: 'Jun', score: baseTrend },
  ];

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
  const classification = deriveAiClassification(input);
  const riskRating = deriveRiskRating(input, classification);
  const complianceStatus = deriveComplianceStatus(classification, riskRating);
  const inventoryCoveragePercent = input.inventoryCoveragePercent ?? (input.description && input.purpose ? 88 : 72);
  const record = await aiRepo.createAiSystem(workspaceId, {
    ...input,
    classification,
    riskRating,
    complianceStatus,
    assuranceStatus: deriveAssuranceStatus(complianceStatus, inventoryCoveragePercent),
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
  const merged: Partial<AiSystemRecord> = { ...current, ...input };
  const classification = deriveAiClassification(merged);
  const riskRating = deriveRiskRating(merged, classification);
  const complianceStatus = deriveComplianceStatus(classification, riskRating);
  const inventoryCoveragePercent = merged.inventoryCoveragePercent ?? current.inventoryCoveragePercent;

  const record = await aiRepo.updateAiSystem(workspaceId, id, {
    ...merged,
    classification,
    riskRating,
    complianceStatus,
    assuranceStatus: deriveAssuranceStatus(complianceStatus, inventoryCoveragePercent),
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

export async function createAiModel(workspaceId: string, input: Partial<AiModelRecord>, actor: ActorContext) {
  const record = await aiRepo.createAiModel(workspaceId, input);
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

export async function updateAiModel(workspaceId: string, id: string, input: Partial<AiModelRecord>, actor: ActorContext) {
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
    action: 'ai_assessment_completed',
    targetType: 'ai_assessment',
    targetId: record.id,
    targetName: record.assessmentName,
    newValue: { overallRiskScore: record.overallRiskScore, status: record.status },
    severity: record.overallRiskScore >= 60 ? 'high' : record.overallRiskScore >= 40 ? 'medium' : 'low',
    notes: `Completed AI risk assessment ${record.assessmentName}`,
  });
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

export async function createAiIncident(workspaceId: string, input: Partial<AiIncidentRecord>, actor: ActorContext) {
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
  const summary = [
    `${state.summary.aiSystems} AI systems are recorded with ${state.summary.aiInventoryCoverage}% inventory coverage.`,
    `${state.summary.highRiskAi} high-risk or elevated AI systems require heightened oversight.`,
    `${state.summary.aiComplianceScore}% compliance score versus ${state.summary.aiRiskScore}% composite risk pressure.`,
    `${state.summary.modelRiskScore}% model risk score across validation, drift, bias, and explainability measures.`,
  ];

  if (reportType === 'eu_ai_act_report') {
    const euProgram = state.compliancePrograms.find((item) => item.frameworkCode === 'EU_AI_ACT');
    summary.push(`EU AI Act score ${euProgram?.score || 0}% with ${euProgram?.gapCount || 0} gap items.`);
  }
  if (reportType === 'iso42001_report') {
    const isoProgram = state.compliancePrograms.find((item) => item.frameworkCode === 'ISO42001');
    summary.push(`ISO/IEC 42001 score ${isoProgram?.score || 0}% and documentation coverage ${isoProgram?.documentationCoveragePercent || 0}%.`);
  }
  if (reportType === 'board_ai_risk_pack') {
    summary.push(`${state.incidents.filter((item) => item.status !== 'resolved').length} open AI incidents remain in active response.`);
  }

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
    status: reportType === 'board_ai_risk_pack' ? 'approved' : 'generated',
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
