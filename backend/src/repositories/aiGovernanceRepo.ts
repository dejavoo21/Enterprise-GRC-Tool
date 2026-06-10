import { generateId, query } from '../db.js';
import type {
  AiAssessmentStatus,
  AiClassification,
  AiComplianceProgramRecord,
  AiComplianceStatus,
  AiControlCategory,
  AiControlRecord,
  AiCriticality,
  AiGovernanceSummary,
  AiIncidentRecord,
  AiIncidentStatus,
  AiIncidentType,
  AiModelRecord,
  AiReportRecord,
  AiReportType,
  AiRiskAssessmentRecord,
  AiSystemLifecycleStatus,
  AiSystemRecord,
  AiTrainingProgramRecord,
  AiVendorCategory,
  AiVendorRecord,
} from '../types/aiGovernance.js';

type Row = Record<string, unknown>;

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function num(value: unknown) {
  return Number(value || 0);
}

function mapSystem(row: Row): AiSystemRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemName: String(row.system_name),
    owner: String(row.owner),
    businessUnit: String(row.business_unit),
    purpose: String(row.purpose),
    description: String(row.description),
    modelType: String(row.model_type),
    vendor: String(row.vendor),
    deploymentModel: row.deployment_model as 'internal' | 'external',
    deploymentDate: toIso(row.deployment_date)!,
    lifecycleStatus: row.lifecycle_status as AiSystemLifecycleStatus,
    criticality: row.criticality as AiCriticality,
    classification: row.classification as AiClassification,
    riskRating: row.risk_rating as AiCriticality,
    complianceStatus: row.compliance_status as AiComplianceStatus,
    useCase: String(row.use_case),
    dataType: String(row.data_type),
    industry: String(row.industry),
    jurisdictions: asArray(row.jurisdictions),
    impact: row.impact as AiSystemRecord['impact'],
    inventoryCoveragePercent: num(row.inventory_coverage_percent),
    assuranceStatus: row.assurance_status as AiSystemRecord['assuranceStatus'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapModel(row: Row): AiModelRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemId: row.system_id ? String(row.system_id) : null,
    modelName: String(row.model_name),
    version: String(row.version),
    owner: String(row.owner),
    purpose: String(row.purpose),
    validationStatus: row.validation_status as AiModelRecord['validationStatus'],
    approvalStatus: row.approval_status as AiModelRecord['approvalStatus'],
    retirementDate: toIso(row.retirement_date),
    lifecycleStatus: row.lifecycle_status as AiSystemLifecycleStatus,
    modelFamily: String(row.model_family),
    accuracy: num(row.accuracy),
    precision: num(row.precision_score),
    recall: num(row.recall_score),
    drift: num(row.drift_score),
    biasScore: num(row.bias_score),
    robustnessScore: num(row.robustness_score),
    explainabilityScore: num(row.explainability_score),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapAssessment(row: Row): AiRiskAssessmentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemId: row.system_id ? String(row.system_id) : null,
    assessmentName: String(row.assessment_name),
    owner: String(row.owner),
    status: row.status as AiAssessmentStatus,
    biasRisk: num(row.bias_risk),
    fairnessRisk: num(row.fairness_risk),
    transparencyRisk: num(row.transparency_risk),
    privacyRisk: num(row.privacy_risk),
    securityRisk: num(row.security_risk),
    hallucinationRisk: num(row.hallucination_risk),
    explainabilityRisk: num(row.explainability_risk),
    ethicalRisk: num(row.ethical_risk),
    safetyRisk: num(row.safety_risk),
    regulatoryRisk: num(row.regulatory_risk),
    operationalRisk: num(row.operational_risk),
    vendorRisk: num(row.vendor_risk),
    overallRiskScore: num(row.overall_risk_score),
    dueDate: toIso(row.due_date),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapControl(row: Row): AiControlRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    controlName: String(row.control_name),
    category: row.category as AiControlCategory,
    description: String(row.description),
    owner: String(row.owner),
    status: row.status as AiControlRecord['status'],
    mappedFrameworks: asArray(row.mapped_frameworks),
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    automationLevel: row.automation_level as AiControlRecord['automationLevel'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapIncident(row: Row): AiIncidentRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    systemId: row.system_id ? String(row.system_id) : null,
    title: String(row.title),
    incidentType: row.incident_type as AiIncidentType,
    severity: row.severity as AiCriticality,
    status: row.status as AiIncidentStatus,
    owner: String(row.owner),
    detectedAt: toIso(row.detected_at)!,
    reportedExternally: Boolean(row.reported_externally),
    summary: String(row.summary),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapVendor(row: Row): AiVendorRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    vendorName: String(row.vendor_name),
    vendorCategory: row.vendor_category as AiVendorCategory,
    services: asArray(row.services),
    riskRating: row.risk_rating as AiCriticality,
    complianceScore: num(row.compliance_score),
    contractStatus: row.contract_status as AiVendorRecord['contractStatus'],
    securityReviewStatus: row.security_review_status as AiVendorRecord['securityReviewStatus'],
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapTraining(row: Row): AiTrainingProgramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    programName: String(row.program_name),
    focusArea: String(row.focus_area),
    completionRate: num(row.completion_rate),
    overdueLearners: num(row.overdue_learners),
    certificationStatus: row.certification_status as AiTrainingProgramRecord['certificationStatus'],
    status: row.status as AiTrainingProgramRecord['status'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function mapReport(row: Row): AiReportRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    reportType: row.report_type as AiReportType,
    title: String(row.title),
    status: row.status as AiReportRecord['status'],
    generatedBy: String(row.generated_by),
    summary: asArray(row.summary),
    generatedAt: toIso(row.generated_at)!,
  };
}

function mapComplianceProgram(row: Row): AiComplianceProgramRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    frameworkCode: row.framework_code as AiComplianceProgramRecord['frameworkCode'],
    frameworkName: String(row.framework_name),
    score: num(row.score),
    targetScore: num(row.target_score),
    gapCount: num(row.gap_count),
    controlCoveragePercent: num(row.control_coverage_percent),
    evidenceCoveragePercent: num(row.evidence_coverage_percent),
    documentationCoveragePercent: num(row.documentation_coverage_percent),
    trainingCoveragePercent: num(row.training_coverage_percent),
    status: row.status as AiComplianceProgramRecord['status'],
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

export async function ensureAiGovernanceSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ai_inventory (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      business_unit TEXT NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT NOT NULL,
      model_type TEXT NOT NULL,
      vendor TEXT NOT NULL,
      deployment_model TEXT NOT NULL,
      deployment_date TIMESTAMPTZ NOT NULL,
      lifecycle_status TEXT NOT NULL,
      criticality TEXT NOT NULL,
      classification TEXT NOT NULL,
      risk_rating TEXT NOT NULL,
      compliance_status TEXT NOT NULL,
      use_case TEXT NOT NULL,
      data_type TEXT NOT NULL,
      industry TEXT NOT NULL,
      jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
      impact TEXT NOT NULL,
      inventory_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      assurance_status TEXT NOT NULL DEFAULT 'monitoring',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_models (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_id TEXT,
      model_name TEXT NOT NULL,
      version TEXT NOT NULL,
      owner TEXT NOT NULL,
      purpose TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      retirement_date TIMESTAMPTZ,
      lifecycle_status TEXT NOT NULL,
      model_family TEXT NOT NULL,
      accuracy NUMERIC(10,2) NOT NULL DEFAULT 0,
      precision_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      recall_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      drift_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      bias_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      robustness_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      explainability_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_risk_assessments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_id TEXT,
      assessment_name TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      bias_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      fairness_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      transparency_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      privacy_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      security_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      hallucination_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      explainability_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      ethical_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      safety_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      regulatory_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      operational_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      vendor_risk NUMERIC(10,2) NOT NULL DEFAULT 0,
      overall_risk_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_controls (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      control_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      mapped_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
      evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      automation_level TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_incidents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      system_id TEXT,
      title TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      detected_at TIMESTAMPTZ NOT NULL,
      reported_externally BOOLEAN NOT NULL DEFAULT FALSE,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_vendors (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      vendor_category TEXT NOT NULL,
      services JSONB NOT NULL DEFAULT '[]'::jsonb,
      risk_rating TEXT NOT NULL,
      compliance_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      contract_status TEXT NOT NULL,
      security_review_status TEXT NOT NULL,
      evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_training_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      program_name TEXT NOT NULL,
      focus_area TEXT NOT NULL,
      completion_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      overdue_learners INTEGER NOT NULL DEFAULT 0,
      certification_status TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_reports (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      generated_by TEXT NOT NULL,
      summary JSONB NOT NULL DEFAULT '[]'::jsonb,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_compliance_programs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      framework_code TEXT NOT NULL,
      framework_name TEXT NOT NULL,
      score NUMERIC(10,2) NOT NULL DEFAULT 0,
      target_score NUMERIC(10,2) NOT NULL DEFAULT 0,
      gap_count INTEGER NOT NULL DEFAULT 0,
      control_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      evidence_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      documentation_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      training_coverage_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, framework_code)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_ai_inventory_workspace ON ai_inventory (workspace_id, classification, risk_rating, compliance_status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_models_workspace ON ai_models (workspace_id, validation_status, approval_status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_assessments_workspace ON ai_risk_assessments (workspace_id, status, overall_risk_score)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_controls_workspace ON ai_controls (workspace_id, category, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_incidents_workspace ON ai_incidents (workspace_id, severity, status, detected_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ai_vendors_workspace ON ai_vendors (workspace_id, risk_rating, contract_status)`);
}

export async function seedAiGovernanceDefaults(workspaceId: string): Promise<void> {
  const existing = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ai_inventory WHERE workspace_id = $1`, [workspaceId]);
  if (Number(existing.rows[0]?.count || 0) > 0) {
    return;
  }

  const systems: Partial<AiSystemRecord>[] = [
    {
      id: generateId('aisys'),
      systemName: 'Customer Support Copilot',
      owner: 'Head of Operations',
      businessUnit: 'Customer Experience',
      purpose: 'Assist agents with case summarization and response drafting',
      description: 'Generative assistant embedded in customer support workflows.',
      modelType: 'Generative LLM',
      vendor: 'OpenAI',
      deploymentModel: 'external',
      deploymentDate: new Date('2026-02-10').toISOString(),
      lifecycleStatus: 'production',
      criticality: 'high',
      classification: 'generative_ai',
      riskRating: 'high',
      complianceStatus: 'monitoring',
      useCase: 'customer support',
      dataType: 'customer_pii',
      industry: 'financial_services',
      jurisdictions: ['EU', 'UK', 'US'],
      impact: 'high',
      inventoryCoveragePercent: 92,
      assuranceStatus: 'monitoring',
    },
    {
      id: generateId('aisys'),
      systemName: 'Credit Decision Optimizer',
      owner: 'Chief Risk Officer',
      businessUnit: 'Lending',
      purpose: 'Prioritize underwriter reviews and scoring overlays',
      description: 'Decision-support model for credit intake and risk ranking.',
      modelType: 'Gradient Boosting Model',
      vendor: 'Internal',
      deploymentModel: 'internal',
      deploymentDate: new Date('2025-11-04').toISOString(),
      lifecycleStatus: 'monitoring',
      criticality: 'critical',
      classification: 'high_risk',
      riskRating: 'critical',
      complianceStatus: 'gap',
      useCase: 'credit underwriting',
      dataType: 'regulated_financial_data',
      industry: 'financial_services',
      jurisdictions: ['EU', 'UK'],
      impact: 'severe',
      inventoryCoveragePercent: 88,
      assuranceStatus: 'attention_required',
    },
    {
      id: generateId('aisys'),
      systemName: 'Developer Productivity Assistant',
      owner: 'VP Engineering',
      businessUnit: 'Technology',
      purpose: 'Support code suggestions and documentation drafting',
      description: 'Internal-only engineering assistant for low-risk productivity tasks.',
      modelType: 'Foundation Model',
      vendor: 'GitHub',
      deploymentModel: 'external',
      deploymentDate: new Date('2026-03-21').toISOString(),
      lifecycleStatus: 'pilot',
      criticality: 'medium',
      classification: 'foundation_model',
      riskRating: 'medium',
      complianceStatus: 'compliant',
      useCase: 'software engineering productivity',
      dataType: 'internal_operational_data',
      industry: 'technology',
      jurisdictions: ['UK', 'US'],
      impact: 'medium',
      inventoryCoveragePercent: 95,
      assuranceStatus: 'assured',
    },
  ];

  for (const system of systems) {
    await createAiSystem(workspaceId, system);
  }

  const insertedSystems = await listAiSystems(workspaceId);
  const supportSystem = insertedSystems.find((item) => item.systemName.includes('Support')) || insertedSystems[0];
  const creditSystem = insertedSystems.find((item) => item.systemName.includes('Credit')) || insertedSystems[1];
  const devSystem = insertedSystems.find((item) => item.systemName.includes('Developer')) || insertedSystems[2];

  const models: Partial<AiModelRecord>[] = [
    {
      id: generateId('aimodel'),
      systemId: supportSystem?.id || null,
      modelName: 'Support Copilot v3',
      version: '3.2.1',
      owner: 'AI Platform Team',
      purpose: 'Agent response drafting and summarization',
      validationStatus: 'conditional',
      approvalStatus: 'approved',
      retirementDate: null,
      lifecycleStatus: 'production',
      modelFamily: 'Generative',
      accuracy: 82,
      precision: 80,
      recall: 78,
      drift: 18,
      biasScore: 34,
      robustnessScore: 73,
      explainabilityScore: 61,
    },
    {
      id: generateId('aimodel'),
      systemId: creditSystem?.id || null,
      modelName: 'Credit Optimizer 2026',
      version: '2026.1',
      owner: 'Model Risk Office',
      purpose: 'Credit intake prioritization',
      validationStatus: 'validated',
      approvalStatus: 'restricted',
      retirementDate: null,
      lifecycleStatus: 'monitoring',
      modelFamily: 'Tabular ML',
      accuracy: 87,
      precision: 84,
      recall: 81,
      drift: 26,
      biasScore: 49,
      robustnessScore: 77,
      explainabilityScore: 68,
    },
    {
      id: generateId('aimodel'),
      systemId: devSystem?.id || null,
      modelName: 'Engineering Assistant Pilot',
      version: '0.9-beta',
      owner: 'Developer Experience',
      purpose: 'Internal engineering assistant',
      validationStatus: 'pending',
      approvalStatus: 'pending',
      retirementDate: null,
      lifecycleStatus: 'pilot',
      modelFamily: 'Foundation Model',
      accuracy: 76,
      precision: 72,
      recall: 70,
      drift: 12,
      biasScore: 22,
      robustnessScore: 68,
      explainabilityScore: 58,
    },
  ];
  for (const model of models) await createAiModel(workspaceId, model);

  const assessments: Partial<AiRiskAssessmentRecord>[] = [
    {
      id: generateId('aiasm'),
      systemId: supportSystem?.id || null,
      assessmentName: 'Support Copilot Responsible AI Assessment',
      owner: 'Responsible AI Office',
      status: 'in_review',
      biasRisk: 32,
      fairnessRisk: 28,
      transparencyRisk: 44,
      privacyRisk: 51,
      securityRisk: 47,
      hallucinationRisk: 63,
      explainabilityRisk: 52,
      ethicalRisk: 35,
      safetyRisk: 29,
      regulatoryRisk: 58,
      operationalRisk: 49,
      vendorRisk: 41,
      overallRiskScore: 44,
      dueDate: new Date(Date.now() + 21 * 86400000).toISOString(),
    },
    {
      id: generateId('aiasm'),
      systemId: creditSystem?.id || null,
      assessmentName: 'Credit Decision High-Risk AI Assessment',
      owner: 'Model Risk Office',
      status: 'approved',
      biasRisk: 61,
      fairnessRisk: 58,
      transparencyRisk: 49,
      privacyRisk: 45,
      securityRisk: 38,
      hallucinationRisk: 12,
      explainabilityRisk: 57,
      ethicalRisk: 53,
      safetyRisk: 24,
      regulatoryRisk: 72,
      operationalRisk: 55,
      vendorRisk: 22,
      overallRiskScore: 46,
      dueDate: new Date(Date.now() + 45 * 86400000).toISOString(),
    },
    {
      id: generateId('aiasm'),
      systemId: devSystem?.id || null,
      assessmentName: 'Engineering Assistant Pilot Review',
      owner: 'Engineering Governance',
      status: 'draft',
      biasRisk: 18,
      fairnessRisk: 16,
      transparencyRisk: 31,
      privacyRisk: 26,
      securityRisk: 29,
      hallucinationRisk: 41,
      explainabilityRisk: 36,
      ethicalRisk: 19,
      safetyRisk: 12,
      regulatoryRisk: 27,
      operationalRisk: 24,
      vendorRisk: 33,
      overallRiskScore: 26,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    },
  ];
  for (const assessment of assessments) await createAiAssessment(workspaceId, assessment);

  const controls: Partial<AiControlRecord>[] = [
    { controlName: 'AI Inventory and Ownership Register', category: 'governance', description: 'Maintain complete AI system ownership and classification.', owner: 'GRC Manager', status: 'implemented', mappedFrameworks: ['ISO42001', 'EU AI Act', 'NIST AI RMF'], evidenceCoveragePercent: 92, automationLevel: 'hybrid' },
    { controlName: 'Training Data Governance Review', category: 'data', description: 'Assess provenance, quality, bias, and lawful basis for training data.', owner: 'Data Governance Lead', status: 'implemented', mappedFrameworks: ['ISO42001', 'OECD AI'], evidenceCoveragePercent: 86, automationLevel: 'manual' },
    { controlName: 'Human Oversight Escalation Path', category: 'human_oversight', description: 'Ensure high-risk decisions are escalated to human reviewers.', owner: 'Operations Risk Lead', status: 'implemented', mappedFrameworks: ['EU AI Act', 'NIST AI RMF'], evidenceCoveragePercent: 83, automationLevel: 'manual' },
    { controlName: 'Prompt Injection Monitoring', category: 'security', description: 'Monitor prompt injection attempts and unsafe model interactions.', owner: 'Security Operations', status: 'planned', mappedFrameworks: ['NIST AI RMF'], evidenceCoveragePercent: 54, automationLevel: 'automated' },
    { controlName: 'Model Drift Monitoring', category: 'monitoring', description: 'Track drift, performance degradation, and threshold breaches.', owner: 'Model Risk Office', status: 'implemented', mappedFrameworks: ['ISO42001', 'NIST AI RMF'], evidenceCoveragePercent: 79, automationLevel: 'automated' },
    { controlName: 'AI Transparency and Notice Standard', category: 'transparency', description: 'Disclose AI usage to impacted stakeholders and customers.', owner: 'Compliance', status: 'needs_attention', mappedFrameworks: ['EU AI Act', 'OECD AI'], evidenceCoveragePercent: 49, automationLevel: 'manual' },
    { controlName: 'AI Incident Reporting Workflow', category: 'accountability', description: 'Route high-severity AI incidents to compliance and security teams.', owner: 'Incident Manager', status: 'implemented', mappedFrameworks: ['EU AI Act', 'ISO42001'], evidenceCoveragePercent: 88, automationLevel: 'hybrid' },
    { controlName: 'Privacy Red Team Testing', category: 'privacy', description: 'Test data leakage, privacy, and unauthorized memorization risks.', owner: 'Privacy Office', status: 'planned', mappedFrameworks: ['ISO42001', 'NIST AI RMF'], evidenceCoveragePercent: 57, automationLevel: 'manual' },
  ];
  for (const control of controls) await createAiControl(workspaceId, control);

  const incidents: Partial<AiIncidentRecord>[] = [
    {
      systemId: supportSystem?.id || null,
      title: 'Support Copilot hallucinated refund exception policy',
      incidentType: 'hallucination',
      severity: 'high',
      status: 'investigating',
      owner: 'Customer Operations',
      detectedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      reportedExternally: false,
      summary: 'Escalated after incorrect policy guidance surfaced in customer replies.',
    },
    {
      systemId: creditSystem?.id || null,
      title: 'Credit intake bias threshold exceeded in SME segment',
      incidentType: 'bias_event',
      severity: 'critical',
      status: 'reported',
      owner: 'Model Risk Office',
      detectedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      reportedExternally: true,
      summary: 'Bias threshold breach triggered enhanced validation and regulator-notification assessment.',
    },
  ];
  for (const incident of incidents) await createAiIncident(workspaceId, incident);

  const vendors: Partial<AiVendorRecord>[] = [
    { vendorName: 'OpenAI', vendorCategory: 'llm_provider', services: ['LLM API', 'Embeddings'], riskRating: 'high', complianceScore: 82, contractStatus: 'active', securityReviewStatus: 'complete', evidenceCoveragePercent: 84 },
    { vendorName: 'Microsoft Azure AI', vendorCategory: 'cloud_ai', services: ['Model hosting', 'Content safety'], riskRating: 'medium', complianceScore: 86, contractStatus: 'active', securityReviewStatus: 'complete', evidenceCoveragePercent: 87 },
    { vendorName: 'Anthropic', vendorCategory: 'third_party_model', services: ['Foundation model provider'], riskRating: 'medium', complianceScore: 74, contractStatus: 'review', securityReviewStatus: 'in_progress', evidenceCoveragePercent: 68 },
  ];
  for (const vendor of vendors) await createAiVendor(workspaceId, vendor);

  const trainingPrograms: Partial<AiTrainingProgramRecord>[] = [
    { programName: 'Responsible AI Foundations', focusArea: 'AI Awareness', completionRate: 91, overdueLearners: 4, certificationStatus: 'healthy', status: 'active' },
    { programName: 'Prompt Security and LLM Safety', focusArea: 'Prompt Security', completionRate: 76, overdueLearners: 12, certificationStatus: 'attention', status: 'active' },
    { programName: 'EU AI Act for Product Teams', focusArea: 'AI Governance', completionRate: 69, overdueLearners: 18, certificationStatus: 'critical', status: 'planned' },
  ];
  for (const training of trainingPrograms) await createAiTrainingProgram(workspaceId, training);

  const programs: Partial<AiComplianceProgramRecord>[] = [
    { frameworkCode: 'ISO42001', frameworkName: 'ISO/IEC 42001', score: 78, targetScore: 90, gapCount: 5, controlCoveragePercent: 84, evidenceCoveragePercent: 73, documentationCoveragePercent: 76, trainingCoveragePercent: 81, status: 'watch' },
    { frameworkCode: 'EU_AI_ACT', frameworkName: 'EU AI Act', score: 71, targetScore: 88, gapCount: 7, controlCoveragePercent: 75, evidenceCoveragePercent: 68, documentationCoveragePercent: 64, trainingCoveragePercent: 72, status: 'critical' },
    { frameworkCode: 'NIST_AI_RMF', frameworkName: 'NIST AI RMF', score: 82, targetScore: 90, gapCount: 3, controlCoveragePercent: 86, evidenceCoveragePercent: 79, documentationCoveragePercent: 80, trainingCoveragePercent: 85, status: 'healthy' },
    { frameworkCode: 'OECD_AI', frameworkName: 'OECD AI Principles', score: 80, targetScore: 90, gapCount: 4, controlCoveragePercent: 83, evidenceCoveragePercent: 74, documentationCoveragePercent: 79, trainingCoveragePercent: 82, status: 'watch' },
    { frameworkCode: 'RESPONSIBLE_AI', frameworkName: 'Responsible AI Program', score: 77, targetScore: 92, gapCount: 6, controlCoveragePercent: 81, evidenceCoveragePercent: 72, documentationCoveragePercent: 75, trainingCoveragePercent: 79, status: 'watch' },
  ];
  for (const program of programs) await upsertAiComplianceProgram(workspaceId, program);

  await createAiReport(workspaceId, {
    reportType: 'executive_ai_dashboard',
    title: 'Executive AI Dashboard - Q2',
    status: 'approved',
    generatedBy: 'System',
    summary: ['High-risk AI coverage increased to 88%.', 'One critical bias incident remains under regulator review.', 'EU AI Act gap closure remains the top priority.'],
  });
  await createAiReport(workspaceId, {
    reportType: 'ai_governance_report',
    title: 'AI Governance Baseline',
    status: 'generated',
    generatedBy: 'System',
    summary: ['Three AI systems recorded in the enterprise inventory.', 'Eight AI controls mapped across ISO 42001, EU AI Act, and NIST AI RMF.'],
  });
}

export async function listAiSystems(workspaceId: string): Promise<AiSystemRecord[]> {
  const result = await query(`SELECT * FROM ai_inventory WHERE workspace_id = $1 ORDER BY updated_at DESC, system_name`, [workspaceId]);
  return result.rows.map((row) => mapSystem(row as Row));
}

export async function createAiSystem(workspaceId: string, input: Partial<AiSystemRecord>): Promise<AiSystemRecord> {
  const result = await query(
    `INSERT INTO ai_inventory (
      id, workspace_id, system_name, owner, business_unit, purpose, description, model_type, vendor, deployment_model,
      deployment_date, lifecycle_status, criticality, classification, risk_rating, compliance_status, use_case, data_type, industry,
      jurisdictions, impact, inventory_coverage_percent, assurance_status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,$23
    ) RETURNING *`,
    [
      input.id || generateId('aisys'),
      workspaceId,
      input.systemName,
      input.owner,
      input.businessUnit,
      input.purpose,
      input.description,
      input.modelType,
      input.vendor,
      input.deploymentModel || 'internal',
      input.deploymentDate || new Date().toISOString(),
      input.lifecycleStatus || 'intake',
      input.criticality || 'medium',
      input.classification || 'limited_risk',
      input.riskRating || 'medium',
      input.complianceStatus || 'monitoring',
      input.useCase || '',
      input.dataType || '',
      input.industry || '',
      JSON.stringify(input.jurisdictions || []),
      input.impact || 'medium',
      input.inventoryCoveragePercent || 0,
      input.assuranceStatus || 'monitoring',
    ],
  );
  return mapSystem(result.rows[0] as Row);
}

export async function updateAiSystem(workspaceId: string, id: string, input: Partial<AiSystemRecord>): Promise<AiSystemRecord | null> {
  const current = await query(`SELECT * FROM ai_inventory WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0] as Row;
  const result = await query(
    `UPDATE ai_inventory
     SET system_name = $3, owner = $4, business_unit = $5, purpose = $6, description = $7, model_type = $8, vendor = $9,
         deployment_model = $10, deployment_date = $11, lifecycle_status = $12, criticality = $13, classification = $14, risk_rating = $15,
         compliance_status = $16, use_case = $17, data_type = $18, industry = $19, jurisdictions = $20::jsonb, impact = $21,
         inventory_coverage_percent = $22, assurance_status = $23, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.systemName ?? row.system_name,
      input.owner ?? row.owner,
      input.businessUnit ?? row.business_unit,
      input.purpose ?? row.purpose,
      input.description ?? row.description,
      input.modelType ?? row.model_type,
      input.vendor ?? row.vendor,
      input.deploymentModel ?? row.deployment_model,
      input.deploymentDate ?? row.deployment_date,
      input.lifecycleStatus ?? row.lifecycle_status,
      input.criticality ?? row.criticality,
      input.classification ?? row.classification,
      input.riskRating ?? row.risk_rating,
      input.complianceStatus ?? row.compliance_status,
      input.useCase ?? row.use_case,
      input.dataType ?? row.data_type,
      input.industry ?? row.industry,
      JSON.stringify(input.jurisdictions ?? row.jurisdictions ?? []),
      input.impact ?? row.impact,
      input.inventoryCoveragePercent ?? row.inventory_coverage_percent ?? 0,
      input.assuranceStatus ?? row.assurance_status,
    ],
  );
  return mapSystem(result.rows[0] as Row);
}

export async function listAiModels(workspaceId: string): Promise<AiModelRecord[]> {
  const result = await query(`SELECT * FROM ai_models WHERE workspace_id = $1 ORDER BY updated_at DESC, model_name`, [workspaceId]);
  return result.rows.map((row) => mapModel(row as Row));
}

export async function createAiModel(workspaceId: string, input: Partial<AiModelRecord>): Promise<AiModelRecord> {
  const result = await query(
    `INSERT INTO ai_models (
      id, workspace_id, system_id, model_name, version, owner, purpose, validation_status, approval_status, retirement_date,
      lifecycle_status, model_family, accuracy, precision_score, recall_score, drift_score, bias_score, robustness_score, explainability_score
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    ) RETURNING *`,
    [
      input.id || generateId('aimodel'),
      workspaceId,
      input.systemId || null,
      input.modelName,
      input.version,
      input.owner,
      input.purpose,
      input.validationStatus || 'pending',
      input.approvalStatus || 'pending',
      input.retirementDate || null,
      input.lifecycleStatus || 'pilot',
      input.modelFamily || '',
      input.accuracy || 0,
      input.precision || 0,
      input.recall || 0,
      input.drift || 0,
      input.biasScore || 0,
      input.robustnessScore || 0,
      input.explainabilityScore || 0,
    ],
  );
  return mapModel(result.rows[0] as Row);
}

export async function updateAiModel(workspaceId: string, id: string, input: Partial<AiModelRecord>): Promise<AiModelRecord | null> {
  const current = await query(`SELECT * FROM ai_models WHERE workspace_id = $1 AND id = $2 LIMIT 1`, [workspaceId, id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0] as Row;
  const result = await query(
    `UPDATE ai_models
     SET system_id = $3, model_name = $4, version = $5, owner = $6, purpose = $7, validation_status = $8, approval_status = $9,
         retirement_date = $10, lifecycle_status = $11, model_family = $12, accuracy = $13, precision_score = $14, recall_score = $15,
         drift_score = $16, bias_score = $17, robustness_score = $18, explainability_score = $19, updated_at = NOW()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      input.systemId ?? row.system_id ?? null,
      input.modelName ?? row.model_name,
      input.version ?? row.version,
      input.owner ?? row.owner,
      input.purpose ?? row.purpose,
      input.validationStatus ?? row.validation_status,
      input.approvalStatus ?? row.approval_status,
      input.retirementDate ?? row.retirement_date ?? null,
      input.lifecycleStatus ?? row.lifecycle_status,
      input.modelFamily ?? row.model_family,
      input.accuracy ?? row.accuracy ?? 0,
      input.precision ?? row.precision_score ?? 0,
      input.recall ?? row.recall_score ?? 0,
      input.drift ?? row.drift_score ?? 0,
      input.biasScore ?? row.bias_score ?? 0,
      input.robustnessScore ?? row.robustness_score ?? 0,
      input.explainabilityScore ?? row.explainability_score ?? 0,
    ],
  );
  return mapModel(result.rows[0] as Row);
}

export async function listAiAssessments(workspaceId: string): Promise<AiRiskAssessmentRecord[]> {
  const result = await query(`SELECT * FROM ai_risk_assessments WHERE workspace_id = $1 ORDER BY overall_risk_score DESC, updated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapAssessment(row as Row));
}

export async function createAiAssessment(workspaceId: string, input: Partial<AiRiskAssessmentRecord>): Promise<AiRiskAssessmentRecord> {
  const result = await query(
    `INSERT INTO ai_risk_assessments (
      id, workspace_id, system_id, assessment_name, owner, status, bias_risk, fairness_risk, transparency_risk, privacy_risk,
      security_risk, hallucination_risk, explainability_risk, ethical_risk, safety_risk, regulatory_risk, operational_risk, vendor_risk,
      overall_risk_score, due_date
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
    ) RETURNING *`,
    [
      input.id || generateId('aiasm'),
      workspaceId,
      input.systemId || null,
      input.assessmentName,
      input.owner,
      input.status || 'draft',
      input.biasRisk || 0,
      input.fairnessRisk || 0,
      input.transparencyRisk || 0,
      input.privacyRisk || 0,
      input.securityRisk || 0,
      input.hallucinationRisk || 0,
      input.explainabilityRisk || 0,
      input.ethicalRisk || 0,
      input.safetyRisk || 0,
      input.regulatoryRisk || 0,
      input.operationalRisk || 0,
      input.vendorRisk || 0,
      input.overallRiskScore || 0,
      input.dueDate || null,
    ],
  );
  return mapAssessment(result.rows[0] as Row);
}

export async function listAiControls(workspaceId: string): Promise<AiControlRecord[]> {
  const result = await query(`SELECT * FROM ai_controls WHERE workspace_id = $1 ORDER BY category, control_name`, [workspaceId]);
  return result.rows.map((row) => mapControl(row as Row));
}

export async function createAiControl(workspaceId: string, input: Partial<AiControlRecord>): Promise<AiControlRecord> {
  const result = await query(
    `INSERT INTO ai_controls (
      id, workspace_id, control_name, category, description, owner, status, mapped_frameworks, evidence_coverage_percent, automation_level
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10
    ) RETURNING *`,
    [
      input.id || generateId('aictrl'),
      workspaceId,
      input.controlName,
      input.category,
      input.description,
      input.owner,
      input.status || 'planned',
      JSON.stringify(input.mappedFrameworks || []),
      input.evidenceCoveragePercent || 0,
      input.automationLevel || 'manual',
    ],
  );
  return mapControl(result.rows[0] as Row);
}

export async function listAiIncidents(workspaceId: string): Promise<AiIncidentRecord[]> {
  const result = await query(`SELECT * FROM ai_incidents WHERE workspace_id = $1 ORDER BY detected_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapIncident(row as Row));
}

export async function createAiIncident(workspaceId: string, input: Partial<AiIncidentRecord>): Promise<AiIncidentRecord> {
  const result = await query(
    `INSERT INTO ai_incidents (
      id, workspace_id, system_id, title, incident_type, severity, status, owner, detected_at, reported_externally, summary
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    ) RETURNING *`,
    [
      input.id || generateId('aiinc'),
      workspaceId,
      input.systemId || null,
      input.title,
      input.incidentType,
      input.severity || 'medium',
      input.status || 'open',
      input.owner,
      input.detectedAt || new Date().toISOString(),
      input.reportedExternally || false,
      input.summary,
    ],
  );
  return mapIncident(result.rows[0] as Row);
}

export async function listAiVendors(workspaceId: string): Promise<AiVendorRecord[]> {
  const result = await query(`SELECT * FROM ai_vendors WHERE workspace_id = $1 ORDER BY risk_rating DESC, vendor_name`, [workspaceId]);
  return result.rows.map((row) => mapVendor(row as Row));
}

export async function createAiVendor(workspaceId: string, input: Partial<AiVendorRecord>): Promise<AiVendorRecord> {
  const result = await query(
    `INSERT INTO ai_vendors (
      id, workspace_id, vendor_name, vendor_category, services, risk_rating, compliance_score, contract_status, security_review_status, evidence_coverage_percent
    ) VALUES (
      $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10
    ) RETURNING *`,
    [
      input.id || generateId('aivnd'),
      workspaceId,
      input.vendorName,
      input.vendorCategory,
      JSON.stringify(input.services || []),
      input.riskRating || 'medium',
      input.complianceScore || 0,
      input.contractStatus || 'active',
      input.securityReviewStatus || 'in_progress',
      input.evidenceCoveragePercent || 0,
    ],
  );
  return mapVendor(result.rows[0] as Row);
}

export async function listAiTrainingPrograms(workspaceId: string): Promise<AiTrainingProgramRecord[]> {
  const result = await query(`SELECT * FROM ai_training_programs WHERE workspace_id = $1 ORDER BY completion_rate DESC, program_name`, [workspaceId]);
  return result.rows.map((row) => mapTraining(row as Row));
}

export async function createAiTrainingProgram(workspaceId: string, input: Partial<AiTrainingProgramRecord>): Promise<AiTrainingProgramRecord> {
  const result = await query(
    `INSERT INTO ai_training_programs (
      id, workspace_id, program_name, focus_area, completion_rate, overdue_learners, certification_status, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8
    ) RETURNING *`,
    [
      input.id || generateId('aitrn'),
      workspaceId,
      input.programName,
      input.focusArea,
      input.completionRate || 0,
      input.overdueLearners || 0,
      input.certificationStatus || 'healthy',
      input.status || 'planned',
    ],
  );
  return mapTraining(result.rows[0] as Row);
}

export async function listAiReports(workspaceId: string): Promise<AiReportRecord[]> {
  const result = await query(`SELECT * FROM ai_reports WHERE workspace_id = $1 ORDER BY generated_at DESC`, [workspaceId]);
  return result.rows.map((row) => mapReport(row as Row));
}

export async function createAiReport(workspaceId: string, input: Partial<AiReportRecord>): Promise<AiReportRecord> {
  const result = await query(
    `INSERT INTO ai_reports (id, workspace_id, report_type, title, status, generated_by, summary, generated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [
      input.id || generateId('airpt'),
      workspaceId,
      input.reportType,
      input.title,
      input.status || 'generated',
      input.generatedBy,
      JSON.stringify(input.summary || []),
      input.generatedAt || new Date().toISOString(),
    ],
  );
  return mapReport(result.rows[0] as Row);
}

export async function listAiCompliancePrograms(workspaceId: string): Promise<AiComplianceProgramRecord[]> {
  const result = await query(`SELECT * FROM ai_compliance_programs WHERE workspace_id = $1 ORDER BY framework_name`, [workspaceId]);
  return result.rows.map((row) => mapComplianceProgram(row as Row));
}

export async function upsertAiComplianceProgram(workspaceId: string, input: Partial<AiComplianceProgramRecord>): Promise<AiComplianceProgramRecord> {
  const result = await query(
    `INSERT INTO ai_compliance_programs (
      id, workspace_id, framework_code, framework_name, score, target_score, gap_count, control_coverage_percent,
      evidence_coverage_percent, documentation_coverage_percent, training_coverage_percent, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
    )
    ON CONFLICT (workspace_id, framework_code)
    DO UPDATE SET framework_name = EXCLUDED.framework_name,
                  score = EXCLUDED.score,
                  target_score = EXCLUDED.target_score,
                  gap_count = EXCLUDED.gap_count,
                  control_coverage_percent = EXCLUDED.control_coverage_percent,
                  evidence_coverage_percent = EXCLUDED.evidence_coverage_percent,
                  documentation_coverage_percent = EXCLUDED.documentation_coverage_percent,
                  training_coverage_percent = EXCLUDED.training_coverage_percent,
                  status = EXCLUDED.status,
                  updated_at = NOW()
    RETURNING *`,
    [
      input.id || generateId('aicmp'),
      workspaceId,
      input.frameworkCode,
      input.frameworkName,
      input.score || 0,
      input.targetScore || 0,
      input.gapCount || 0,
      input.controlCoveragePercent || 0,
      input.evidenceCoveragePercent || 0,
      input.documentationCoveragePercent || 0,
      input.trainingCoveragePercent || 0,
      input.status || 'watch',
    ],
  );
  return mapComplianceProgram(result.rows[0] as Row);
}

export async function getAiGovernanceSummary(workspaceId: string): Promise<AiGovernanceSummary> {
  const [systems, assessments, controls, incidents, vendors, models, training, programs] = await Promise.all([
    listAiSystems(workspaceId),
    listAiAssessments(workspaceId),
    listAiControls(workspaceId),
    listAiIncidents(workspaceId),
    listAiVendors(workspaceId),
    listAiModels(workspaceId),
    listAiTrainingPrograms(workspaceId),
    listAiCompliancePrograms(workspaceId),
  ]);

  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const aiComplianceScore = avg(programs.map((item) => item.score));
  const aiRiskScore = avg(assessments.map((item) => item.overallRiskScore));
  const aiControlsCoverage = avg(controls.map((item) => item.evidenceCoveragePercent));
  const aiInventoryCoverage = avg(systems.map((item) => item.inventoryCoveragePercent));
  const aiAssuranceStatus = Math.max(0, 100 - (incidents.filter((item) => item.status !== 'resolved').length * 12) - (systems.filter((item) => item.assuranceStatus === 'attention_required').length * 8));
  const modelRiskScore = avg(models.map((item) => (item.drift + item.biasScore + (100 - item.robustnessScore)) / 3));
  const responsibleAiScore = avg([
    avg(training.map((item) => item.completionRate)),
    avg(controls.map((item) => item.evidenceCoveragePercent)),
    avg(programs.map((item) => item.documentationCoveragePercent)),
  ]);
  const aiMaturityScore = avg([aiComplianceScore, Math.max(0, 100 - aiRiskScore), aiControlsCoverage, aiInventoryCoverage, responsibleAiScore]);

  return {
    aiSystems: systems.length,
    highRiskAi: systems.filter((item) => item.classification === 'high_risk' || item.riskRating === 'critical' || item.riskRating === 'high').length,
    aiVendors: vendors.length,
    aiAssessments: assessments.length,
    aiIncidents: incidents.length,
    aiComplianceScore,
    aiRiskScore,
    aiControlsCoverage,
    aiInventoryCoverage,
    aiAssuranceStatus,
    modelRiskScore,
    responsibleAiScore,
    aiMaturityScore,
  };
}
