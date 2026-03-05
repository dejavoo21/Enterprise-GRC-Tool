/**
 * AI Prompt Library
 *
 * Centralizes all AI prompts with:
 * - Consistent tone and structure per audience/use-case
 * - Framework-aware constraints
 * - "When unsure, say you're unsure" behavior
 * - Controlled temperature/maxTokens per use-case
 */

import type { BoardReportData, BoardReportAudience } from '../types/boardReport.js';
import type { Framework } from '../types/models.js';
import type { DataProtectionOverviewReport } from '../routes/dataProtectionReports.js';

// ============================================
// TYPES
// ============================================

export interface PromptContextBase {
  workspaceId: string;
  workspaceName?: string | null;
  frameworks?: Framework[];
}

export interface BoardReportPromptContext extends PromptContextBase {
  data: BoardReportData;
  audience: BoardReportAudience;
}

export interface DataProtectionPromptContext extends PromptContextBase {
  report: DataProtectionOverviewReport;
}

export interface TrainingProposalPromptContext extends PromptContextBase {
  engagement: {
    id: string;
    title: string;
    clientName?: string | null;
    engagementType: string;
    status: string;
    primaryContact?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    estimatedUsers?: number | null;
  };
  pricingModel?: {
    name: string;
    currency: string;
    unitPrice: number;
    billingBasis: string;
    notes?: string | null;
  } | null;
  frameworkCodes: string[];
  frameworkNames: string[];
}

export interface DataProtectionQuestionContext extends PromptContextBase {
  report: DataProtectionOverviewReport;
  question: string;
}

export interface TrainingQuestionContext extends PromptContextBase {
  engagement: TrainingProposalPromptContext['engagement'];
  pricingModel?: TrainingProposalPromptContext['pricingModel'];
  frameworkCodes: string[];
  frameworkNames: string[];
  question: string;
}

/**
 * A built prompt ready to send to the LLM
 */
export interface BuiltPrompt {
  system: string;
  user: string;
}

/**
 * Configuration for a specific AI use case
 */
export interface PromptConfig {
  maxTokens: number;
  temperature: number;
}

// ============================================
// PROMPT CONFIGURATIONS PER USE CASE
// ============================================

export const PROMPT_CONFIGS: Record<string, PromptConfig> = {
  boardReport: { maxTokens: 2000, temperature: 0.3 },
  dataProtectionSummary: { maxTokens: 1500, temperature: 0.25 },
  dataProtectionQuestion: { maxTokens: 800, temperature: 0.4 },
  trainingProposal: { maxTokens: 2500, temperature: 0.5 },
  trainingQuestion: { maxTokens: 800, temperature: 0.4 },
};

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Build a description of configured frameworks for inclusion in prompts.
 * Enforces that the AI only references these frameworks.
 */
export function buildFrameworksDescription(frameworks: Framework[] | undefined): string {
  if (!frameworks || frameworks.length === 0) {
    return 'No frameworks are explicitly configured for this workspace.';
  }

  const names = frameworks.map((f) => `${f.code}: ${f.name}`).join(', ');
  return (
    'The following compliance and security frameworks are explicitly configured and MUST be treated as the only valid reference set:\n' +
    names +
    '\n\n' +
    'Do NOT invent or assume frameworks that are not in this list. ' +
    'If asked about a framework that isn\'t listed, clearly state that it is not configured in this workspace.'
  );
}

/**
 * Build standard guardrails text for all prompts
 */
function buildGuardrails(): string {
  return [
    'Always be honest about uncertainty and data limitations.',
    'If you do not have enough information to make a definitive statement, say so explicitly.',
    'Never invent or assume data, frameworks, controls, or regulations that are not provided.',
    'Do not claim full compliance; instead describe posture, gaps, and residual risks.',
  ].join(' ');
}

// ============================================
// BOARD REPORT PROMPT BUILDER
// ============================================

/**
 * Build a prompt for generating executive board report narratives
 */
export function buildBoardReportPrompt(context: BoardReportPromptContext): BuiltPrompt {
  const { data, audience, workspaceName, frameworks } = context;

  const frameworkText = buildFrameworksDescription(frameworks);

  const audienceDescription =
    audience === 'board'
      ? 'Board of Directors'
      : audience === 'audit_committee'
        ? 'Audit & Risk Committee'
        : 'Regulator or supervisory authority';

  const audienceGuidance =
    audience === 'board'
      ? 'Use executive-level language, focus on strategic implications and key risks. Avoid technical jargon.'
      : audience === 'audit_committee'
        ? 'Include more detail on control effectiveness, evidence coverage, and compliance gaps. Be precise about numbers.'
        : 'Use formal language, cite specific frameworks and compliance requirements. Be factual and conservative in assessments.';

  const system = [
    'You are an expert GRC and security advisor.',
    'You write clear, concise executive-level summaries.',
    'Avoid technical jargon unless absolutely necessary.',
    'Structure your answer with headings and short paragraphs.',
    buildGuardrails(),
  ].join(' ');

  // Calculate aggregate metrics for the prompt
  const totalControls = data.frameworks.reduce((sum, f) => sum + f.totalControls, 0);
  const totalImplemented = data.frameworks.reduce((sum, f) => sum + f.implemented, 0);
  const totalWithEvidence = data.frameworks.reduce((sum, f) => sum + f.controlsWithEvidence, 0);
  const totalWithPolicy = data.frameworks.reduce((sum, f) => sum + f.controlsWithPolicy, 0);
  const totalWithTraining = data.frameworks.reduce((sum, f) => sum + f.controlsWithTraining, 0);
  const overallImplRate = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0;
  const evidenceCoverage = totalControls > 0 ? Math.round((totalWithEvidence / totalControls) * 100) : 0;
  const policyCoverage = totalControls > 0 ? Math.round((totalWithPolicy / totalControls) * 100) : 0;
  const trainingCoverage = totalControls > 0 ? Math.round((totalWithTraining / totalControls) * 100) : 0;

  const frameworkStats = data.frameworks.map(f => {
    const implRate = f.totalControls > 0 ? Math.round((f.implemented / f.totalControls) * 100) : 0;
    return `- ${f.frameworkName} (${f.frameworkCode}): ${f.totalControls} controls, ${implRate}% implemented, ${f.controlsWithEvidence} with evidence`;
  }).join('\n');

  const topRisksText = data.riskSummary.topRisks.length > 0
    ? data.riskSummary.topRisks.map(r => `- ${r.title} (Score: ${r.severityScore}, Status: ${r.status})`).join('\n')
    : 'No high-priority risks identified';

  const user = [
    `You are preparing an executive security & compliance report for the ${audienceDescription}.`,
    audienceGuidance,
    workspaceName ? `Workspace/Client Name: ${workspaceName}.` : '',
    '',
    'You MUST base your assessment ONLY on the following structured data and framework list.',
    '',
    '=== FRAMEWORKS CONFIGURED IN THIS WORKSPACE ===',
    frameworkText,
    '',
    '=== AGGREGATE METRICS ===',
    `Total Controls: ${totalControls}`,
    `Overall Implementation Rate: ${overallImplRate}%`,
    `Evidence Coverage: ${evidenceCoverage}%`,
    `Policy Coverage: ${policyCoverage}%`,
    `Training Coverage: ${trainingCoverage}%`,
    '',
    '=== FRAMEWORK BREAKDOWN ===',
    frameworkStats,
    '',
    '=== RISK POSTURE ===',
    `Total Risks: ${data.riskSummary.totalRisks}`,
    `High Risks: ${data.riskSummary.highRisks}`,
    `Medium Risks: ${data.riskSummary.mediumRisks}`,
    `Low Risks: ${data.riskSummary.lowRisks}`,
    `Open Risks: ${data.riskSummary.openRisks}`,
    `Closed Risks: ${data.riskSummary.closedRisks}`,
    '',
    'Top Risks:',
    topRisksText,
    '',
    '=== POLICY HEALTH ===',
    `Total Documents: ${data.policySummary.totalDocuments}`,
    `Approved: ${data.policySummary.approved}`,
    `In Review: ${data.policySummary.inReview}`,
    `Overdue Reviews: ${data.policySummary.overdueReviews}`,
    `Due in Next 30 Days: ${data.policySummary.dueNext30Days}`,
    '',
    '=== TRAINING & AWARENESS ===',
    `Completion Rate: ${data.trainingSummary.overallCompletionRate}%`,
    `Overdue Assignments: ${data.trainingSummary.overdueAssignments}`,
    `Active Campaigns: ${data.trainingSummary.activeCampaigns}`,
    data.trainingSummary.lastPhishClickRate !== undefined
      ? `Last Phishing Click Rate: ${data.trainingSummary.lastPhishClickRate}%`
      : 'Last Phishing Click Rate: N/A',
    '',
    '=== AI & DATA PROTECTION ===',
    `AI/Healthcare Frameworks: ${data.aiPrivacySummary.aiHealthcareSummary?.frameworks.join(', ') || 'None'}`,
    `Data Protection Frameworks: ${data.aiPrivacySummary.dataProtectionSummary?.frameworks.join(', ') || 'None'}`,
    '',
    'Please produce a narrative that includes the following sections:',
    '1. Executive Summary (2–4 short paragraphs).',
    '2. Risk Posture (highlight high/critical risks and trends).',
    '3. Controls & Framework Coverage (focus on gaps and strengths).',
    '4. Policy & Governance (reviews, overdue items, key issues).',
    '5. Training & Awareness (completion, weaknesses, behavioural signals).',
    '6. AI & Data Protection (AI/healthcare + privacy posture).',
    '7. Top 3–5 Recommended Actions (short, very concrete).',
    '',
    'Guidelines:',
    '- Be specific about what is strong vs weak.',
    '- If some data is missing or limited, explicitly say so instead of guessing.',
    '- Do not promise compliance; focus on posture and gaps.',
  ].join('\n');

  return { system, user };
}

// ============================================
// DATA PROTECTION PROMPT BUILDERS
// ============================================

/**
 * Build a prompt for generating data protection summary
 */
export function buildDataProtectionSummaryPrompt(context: DataProtectionPromptContext): BuiltPrompt {
  const { report, workspaceName, frameworks } = context;

  const frameworkText = buildFrameworksDescription(frameworks);

  // Calculate metrics
  const totalControls = report.totalRelevantControls;
  const frameworkStats = report.frameworkStats;
  const totalImplemented = frameworkStats.reduce((sum, f) => sum + f.implemented, 0);
  const implementationRate = totalControls > 0
    ? Math.round((totalImplemented / totalControls) * 100)
    : 0;
  const totalWithEvidence = frameworkStats.reduce((sum, f) => sum + f.controlsWithEvidence, 0);
  const evidenceCoverage = totalControls > 0
    ? Math.round((totalWithEvidence / totalControls) * 100)
    : 0;

  const frameworkSummary = frameworkStats.map(f => {
    const rate = f.totalControls > 0 ? Math.round((f.implemented / f.totalControls) * 100) : 0;
    return `- ${f.name} (${f.framework}): ${f.totalControls} controls, ${rate}% implemented, ${f.controlsWithEvidence} with evidence`;
  }).join('\n');

  const system = [
    'You are a privacy, data protection, and security compliance expert.',
    'You understand GDPR, NDPA, ISO 27701, HIPAA, HITRUST, and related frameworks.',
    'You write in a regulator- and auditor-friendly style: factual, structured, and measured.',
    'Never state that a client is "fully compliant"; instead describe posture and residual risks.',
    'If the data does not cover a particular area, say so explicitly instead of speculating.',
    'Never reference frameworks or laws that are not in the provided list.',
  ].join(' ');

  const user = [
    workspaceName ? `Client/Workspace: ${workspaceName}` : '',
    '',
    '=== PRIVACY & DATA PROTECTION FRAMEWORKS CONFIGURED ===',
    frameworkText,
    '',
    '=== DATA PROTECTION OVERVIEW METRICS ===',
    `Total Privacy Controls: ${totalControls}`,
    `Implementation Rate: ${implementationRate}%`,
    `Evidence Coverage: ${evidenceCoverage}%`,
    `Related Risks: ${report.totalRelatedRisks}`,
    '',
    '=== FRAMEWORK BREAKDOWN ===',
    frameworkSummary,
    '',
    'Please provide:',
    '1. Overall privacy & data protection posture summary.',
    '2. Key strengths.',
    '3. Key gaps and high-risk areas.',
    '4. Suggested next steps (practical, 3–7 bullet points).',
    '',
    'Keep it concise and structured. Avoid legalese, but do not oversimplify.',
  ].join('\n');

  return { system, user };
}

/**
 * Build a prompt for answering data protection questions
 */
export function buildDataProtectionQuestionPrompt(context: DataProtectionQuestionContext): BuiltPrompt {
  const { report, question, workspaceName, frameworks } = context;

  const frameworkText = buildFrameworksDescription(frameworks);

  // Calculate metrics
  const totalControls = report.totalRelevantControls;
  const frameworkStats = report.frameworkStats;
  const totalImplemented = frameworkStats.reduce((sum, f) => sum + f.implemented, 0);
  const implementationRate = totalControls > 0
    ? Math.round((totalImplemented / totalControls) * 100)
    : 0;
  const totalWithEvidence = frameworkStats.reduce((sum, f) => sum + f.controlsWithEvidence, 0);
  const evidenceCoverage = totalControls > 0
    ? Math.round((totalWithEvidence / totalControls) * 100)
    : 0;

  const frameworkSummary = frameworkStats.map(f => {
    const rate = f.totalControls > 0 ? Math.round((f.implemented / f.totalControls) * 100) : 0;
    return `- ${f.name} (${f.framework}): ${f.totalControls} controls, ${f.implemented} implemented (${rate}%), ${f.inProgress} in progress, ${f.controlsWithEvidence} with evidence`;
  }).join('\n');

  const system = [
    'You are a data protection compliance expert answering questions accurately based on provided data.',
    'If the question asks about a framework not in the configured list, state that it is not configured.',
    'If you cannot answer definitively from the data, say so clearly.',
    'Respond with valid JSON only.',
  ].join(' ');

  const user = [
    workspaceName ? `Client/Workspace: ${workspaceName}` : '',
    '',
    '=== CONFIGURED FRAMEWORKS ===',
    frameworkText,
    '',
    '=== COMPLIANCE DATA ===',
    `Total Privacy Controls: ${totalControls}`,
    `Overall Implementation Rate: ${implementationRate}%`,
    `Evidence Coverage: ${evidenceCoverage}%`,
    `Related Risks: ${report.totalRelatedRisks}`,
    '',
    '=== FRAMEWORK DETAILS ===',
    frameworkSummary,
    '',
    `USER QUESTION: ${question}`,
    '',
    'Please answer the question based on the data provided. Be specific and cite relevant numbers.',
    '',
    'Format your response as JSON with the following structure:',
    '{',
    '  "answer": "Your detailed answer here",',
    '  "confidence": "high" | "medium" | "low",',
    '  "sources": ["source1", "source2"]',
    '}',
  ].join('\n');

  return { system, user };
}

// ============================================
// TRAINING PROPOSAL PROMPT BUILDERS
// ============================================

/**
 * Build a prompt for generating training proposals
 */
export function buildTrainingProposalPrompt(context: TrainingProposalPromptContext): BuiltPrompt {
  const { engagement, pricingModel, frameworkCodes, frameworkNames, workspaceName, frameworks } = context;

  const frameworkText = buildFrameworksDescription(frameworks);

  const engagementTypeLabels: Record<string, string> = {
    'one_off': 'One-Time Training Engagement',
    'ongoing_program': 'Ongoing Training Program',
    'managed_service': 'Managed Training Service',
    'retainer': 'Training Retainer Arrangement',
  };

  const startDate = engagement.startDate
    ? new Date(engagement.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';
  const endDate = engagement.endDate
    ? new Date(engagement.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';

  let pricingInfo = 'Pricing to be determined';
  if (pricingModel) {
    pricingInfo = `${pricingModel.name}: ${pricingModel.currency} ${pricingModel.unitPrice} per ${pricingModel.billingBasis.replace('_', ' ')}`;
    if (engagement.estimatedUsers) {
      const estimatedTotal = engagement.estimatedUsers * pricingModel.unitPrice;
      pricingInfo += ` (Est. total: ${pricingModel.currency} ${estimatedTotal.toLocaleString()} for ${engagement.estimatedUsers} users)`;
    }
  }

  const system = [
    'You are a security awareness and training consultant.',
    'You design realistic, value-focused security awareness programmes.',
    'You write proposals and statements of work that are clear, scoped, and commercially realistic.',
    'Never invent pricing or frameworks beyond what is provided; use relative language if exact numbers are missing.',
  ].join(' ');

  const user = [
    workspaceName ? `Client/Workspace: ${workspaceName}` : '',
    '',
    '=== FRAMEWORKS CONFIGURED ===',
    frameworkText,
    '',
    '=== ENGAGEMENT DETAILS ===',
    `Title: ${engagement.title}`,
    `Client: ${engagement.clientName || 'Not specified'}`,
    `Type: ${engagementTypeLabels[engagement.engagementType] || engagement.engagementType}`,
    `Primary Contact: ${engagement.primaryContact || 'TBD'}`,
    `Start Date: ${startDate}`,
    `End Date: ${endDate}`,
    `Estimated Users: ${engagement.estimatedUsers || 'TBD'}`,
    '',
    '=== COMPLIANCE FRAMEWORKS FOR THIS ENGAGEMENT ===',
    frameworkNames.length > 0 ? frameworkNames.join(', ') : 'Not specified',
    '',
    '=== PRICING ===',
    pricingInfo,
    '',
    'Write a structured training and awareness proposal including:',
    '1. Objectives tied to the frameworks and risk context.',
    '2. Scope (audiences, formats, geographies).',
    '3. Delivery approach (live, virtual, LMS, simulations, tabletop exercises).',
    '4. Timeline (phased if relevant).',
    '5. KPIs and success metrics.',
    '6. Commercial model description (but do not invent specific prices beyond what is provided).',
    '',
    'Use proper markdown formatting with headers, tables, and bullet points.',
    'Keep it 1–2 pages worth of text, but still concise and easy to skim.',
  ].join('\n');

  return { system, user };
}

/**
 * Build a prompt for answering training engagement questions
 */
export function buildTrainingQuestionPrompt(context: TrainingQuestionContext): BuiltPrompt {
  const { engagement, pricingModel, frameworkCodes, frameworkNames, question, workspaceName, frameworks } = context;

  const frameworkText = buildFrameworksDescription(frameworks);

  const engagementTypeLabels: Record<string, string> = {
    'one_off': 'One-Time Training',
    'ongoing_program': 'Ongoing Program',
    'managed_service': 'Managed Service',
    'retainer': 'Retainer',
  };

  let pricingInfo = 'Not assigned';
  if (pricingModel) {
    pricingInfo = `${pricingModel.name}: ${pricingModel.currency} ${pricingModel.unitPrice} per ${pricingModel.billingBasis.replace('_', ' ')}`;
  }

  const system = [
    'You are a training program expert answering questions accurately based on engagement data.',
    'If the question asks about something not in the provided data, say so clearly.',
    'Respond with valid JSON only.',
  ].join(' ');

  const user = [
    workspaceName ? `Client/Workspace: ${workspaceName}` : '',
    '',
    '=== CONFIGURED FRAMEWORKS ===',
    frameworkText,
    '',
    '=== ENGAGEMENT DETAILS ===',
    `Title: ${engagement.title}`,
    `Client: ${engagement.clientName || 'Not specified'}`,
    `Type: ${engagementTypeLabels[engagement.engagementType] || engagement.engagementType}`,
    `Status: ${engagement.status}`,
    `Primary Contact: ${engagement.primaryContact || 'Not assigned'}`,
    `Start Date: ${engagement.startDate || 'TBD'}`,
    `End Date: ${engagement.endDate || 'TBD'}`,
    `Estimated Users: ${engagement.estimatedUsers || 'Not specified'}`,
    '',
    `PRICING: ${pricingInfo}`,
    '',
    `FRAMEWORKS: ${frameworkNames.length > 0 ? frameworkNames.join(', ') : 'None assigned'}`,
    '',
    `USER QUESTION: ${question}`,
    '',
    'Please answer the question based on the engagement data. Be specific and helpful.',
    '',
    'Format your response as JSON:',
    '{',
    '  "answer": "Your detailed answer",',
    '  "confidence": "high" | "medium" | "low",',
    '  "sources": ["relevant data source 1", "source 2"]',
    '}',
  ].join('\n');

  return { system, user };
}
