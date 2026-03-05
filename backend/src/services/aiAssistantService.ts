/**
 * AI Assistant Service
 *
 * This service provides AI-powered analysis and Q&A capabilities for GRC data.
 * Uses the centralized prompt library for consistent, framework-aware prompts.
 */

import type { DataProtectionOverviewReport, DataProtectionFrameworkStats } from '../routes/dataProtectionReports.js';
import type { TrainingEngagement, PricingModel, KpiSnapshot, KpiDefinition, Framework } from '../types/models.js';
import type { BoardReportData, BoardReportAudience } from '../types/boardReport.js';
import { callLlm, isRealAiAvailable, isAiDebugMode, getAiConfig, type AiMessage, type AiDebugInfo } from './aiClient.js';
import {
  buildBoardReportPrompt as buildBoardReportPromptFromLibrary,
  buildDataProtectionSummaryPrompt,
  buildDataProtectionQuestionPrompt,
  buildTrainingProposalPrompt as buildTrainingProposalPromptFromLibrary,
  buildTrainingQuestionPrompt,
  PROMPT_CONFIGS,
  type BuiltPrompt,
} from './promptLibrary.js';
import * as frameworksRepo from '../repositories/frameworksRepo.js';
import { getWorkspaceById } from '../repositories/workspacesRepo.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AIAssistantContext {
  domain: 'data-protection' | 'ai-healthcare' | 'training-engagement' | 'general';
  workspaceId: string;
  reportData?: DataProtectionOverviewReport;
}

export interface TrainingEngagementContext {
  engagement: TrainingEngagement;
  pricingModel?: PricingModel;
  frameworkCodes: string[];
  frameworkNames: string[];
  kpiSnapshots?: KpiSnapshot[];
  kpiDefinitions?: KpiDefinition[];
}

export interface AISummaryResponse {
  narrative: string;
  keyInsights: string[];
  recommendations: string[];
  generatedAt: string;
  debug?: AiDebugInfo;
}

export interface AIQAResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources?: string[];
  generatedAt: string;
  debug?: AiDebugInfo;
}

export interface BoardReportNarrativeResult {
  narrative: string;
  generatedAt: string;
  debug?: AiDebugInfo;
}

export interface TrainingProposalResult {
  proposal: string;
  generatedAt: string;
  debug?: AiDebugInfo;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build debug info if debug mode is enabled
 */
function buildDebugInfo(prompt: BuiltPrompt, options?: { maxTokens?: number; temperature?: number }): AiDebugInfo | undefined {
  if (!isAiDebugMode()) {
    return undefined;
  }

  const config = getAiConfig();
  return {
    provider: config.provider,
    model: config.model,
    prompt: {
      system: prompt.system,
      user: prompt.user,
    },
    options,
  };
}

// ============================================
// DATA PROTECTION AI FUNCTIONS
// ============================================

/**
 * Generate a summary narrative for Data Protection posture
 * Uses real LLM if configured, otherwise generates a structured stub response
 */
export async function generateDataProtectionSummary(
  report: DataProtectionOverviewReport,
  workspaceId?: string
): Promise<AISummaryResponse> {
  const mode = process.env.AI_DATA_PROTECTION_MODE || 'auto';

  // Get workspace and framework context
  let workspaceName: string | null = null;
  let frameworks: Framework[] = [];

  if (workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);
    workspaceName = workspace?.displayName || workspace?.id || null;
  }

  try {
    frameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });
  } catch (error) {
    console.warn('Could not fetch privacy frameworks:', error);
  }

  // Build prompt using the centralized library
  const built = buildDataProtectionSummaryPrompt({
    workspaceId: workspaceId || 'unknown',
    workspaceName,
    frameworks,
    report,
  });

  const promptConfig = PROMPT_CONFIGS.dataProtectionSummary;
  const debugInfo = buildDebugInfo(built, promptConfig);

  // Use real AI if mode is 'real' or 'auto' with available API key
  if (mode === 'real' || (mode === 'auto' && isRealAiAvailable())) {
    try {
      const messages: AiMessage[] = [
        { role: 'system', content: built.system },
        { role: 'user', content: built.user },
      ];

      const response = await callLlm(messages, promptConfig);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          narrative: parsed.narrative || '',
          keyInsights: parsed.keyInsights || [],
          recommendations: parsed.recommendations || [],
          generatedAt: new Date().toISOString(),
          debug: debugInfo,
        };
      }
    } catch (error) {
      console.error('Error calling LLM for data protection summary:', error);
      // Fall through to stub response
    }
  }

  // Stub mode or fallback: Calculate key metrics
  const totalControls = report.totalRelevantControls;
  const frameworkStats = report.frameworkStats;

  // Calculate overall implementation rate
  const totalImplemented = frameworkStats.reduce((sum, f) => sum + f.implemented, 0);
  const implementationRate = totalControls > 0
    ? Math.round((totalImplemented / totalControls) * 100)
    : 0;

  // Calculate evidence coverage
  const totalWithEvidence = frameworkStats.reduce((sum, f) => sum + f.controlsWithEvidence, 0);
  const evidenceCoverage = totalControls > 0
    ? Math.round((totalWithEvidence / totalControls) * 100)
    : 0;

  // Find frameworks with lowest implementation
  const lowImplementation = frameworkStats
    .filter(f => f.totalControls > 0)
    .sort((a, b) => {
      const rateA = a.implemented / a.totalControls;
      const rateB = b.implemented / b.totalControls;
      return rateA - rateB;
    })
    .slice(0, 2);

  // Build narrative
  const frameworkNames = frameworkStats.map(f => f.name).join(', ');

  let narrative = `Your organization's data protection compliance posture spans ${frameworkStats.length} privacy framework${frameworkStats.length !== 1 ? 's' : ''}: ${frameworkNames}. `;

  if (totalControls === 0) {
    narrative += `Currently, there are no controls mapped to these frameworks. Consider mapping relevant controls to establish your compliance baseline.`;
  } else {
    narrative += `Across ${totalControls} relevant control${totalControls !== 1 ? 's' : ''}, `;
    narrative += `${implementationRate}% are fully implemented and ${evidenceCoverage}% have supporting evidence. `;

    if (report.totalRelatedRisks > 0) {
      narrative += `There are ${report.totalRelatedRisks} identified risk${report.totalRelatedRisks !== 1 ? 's' : ''} linked to these controls. `;
    }

    if (implementationRate < 50) {
      narrative += `The implementation rate is below 50%, indicating significant work remains to achieve compliance readiness.`;
    } else if (implementationRate < 80) {
      narrative += `Good progress has been made, but further work is needed to reach full compliance.`;
    } else {
      narrative += `Strong implementation progress positions your organization well for compliance audits.`;
    }
  }

  // Generate insights
  const keyInsights: string[] = [];

  if (totalControls > 0) {
    keyInsights.push(`Overall implementation rate: ${implementationRate}%`);
    keyInsights.push(`Evidence coverage: ${evidenceCoverage}% of controls have documented evidence`);

    if (lowImplementation.length > 0 && lowImplementation[0].totalControls > 0) {
      const lowest = lowImplementation[0];
      const lowestRate = Math.round((lowest.implemented / lowest.totalControls) * 100);
      keyInsights.push(`${lowest.name} has the lowest implementation rate at ${lowestRate}%`);
    }

    const inProgressCount = frameworkStats.reduce((sum, f) => sum + f.inProgress, 0);
    if (inProgressCount > 0) {
      keyInsights.push(`${inProgressCount} control${inProgressCount !== 1 ? 's' : ''} currently in progress`);
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (evidenceCoverage < 80) {
    recommendations.push('Prioritize evidence collection for implemented controls to support audit readiness');
  }

  if (implementationRate < 70) {
    recommendations.push('Focus on implementing high-priority controls, starting with those linked to identified risks');
  }

  for (const fw of lowImplementation) {
    if (fw.totalControls > 0 && fw.implemented / fw.totalControls < 0.5) {
      recommendations.push(`Accelerate ${fw.name} compliance - currently below 50% implementation`);
    }
  }

  if (report.totalRelatedRisks > 0) {
    recommendations.push('Review and address risks linked to privacy controls as part of your risk treatment plan');
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current momentum and schedule regular compliance reviews');
  }

  return {
    narrative,
    keyInsights,
    recommendations,
    generatedAt: new Date().toISOString(),
    debug: debugInfo,
  };
}

/**
 * Answer a question about Data Protection posture
 * Uses real LLM if configured, otherwise uses pattern-matching stub
 */
export async function answerDataProtectionQuestion(
  question: string,
  report: DataProtectionOverviewReport,
  workspaceId?: string
): Promise<AIQAResponse> {
  const mode = process.env.AI_DATA_PROTECTION_MODE || 'auto';

  // Get workspace and framework context
  let workspaceName: string | null = null;
  let frameworks: Framework[] = [];

  if (workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);
    workspaceName = workspace?.displayName || workspace?.id || null;
  }

  try {
    frameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });
  } catch (error) {
    console.warn('Could not fetch privacy frameworks:', error);
  }

  // Build prompt using the centralized library
  const built = buildDataProtectionQuestionPrompt({
    workspaceId: workspaceId || 'unknown',
    workspaceName,
    frameworks,
    report,
    question,
  });

  const promptConfig = PROMPT_CONFIGS.dataProtectionQuestion;
  const debugInfo = buildDebugInfo(built, promptConfig);

  // Use real AI if mode is 'real' or 'auto' with available API key
  if (mode === 'real' || (mode === 'auto' && isRealAiAvailable())) {
    try {
      const messages: AiMessage[] = [
        { role: 'system', content: built.system },
        { role: 'user', content: built.user },
      ];

      const response = await callLlm(messages, promptConfig);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          answer: parsed.answer || '',
          confidence: parsed.confidence || 'medium',
          sources: parsed.sources || [],
          generatedAt: new Date().toISOString(),
          debug: debugInfo,
        };
      }
    } catch (error) {
      console.error('Error calling LLM for data protection question:', error);
      // Fall through to stub response
    }
  }

  // Stub mode or fallback - use pattern matching
  return answerDataProtectionQuestionStub(question, report, debugInfo);
}

/**
 * Stub implementation for data protection Q&A
 */
function answerDataProtectionQuestionStub(
  question: string,
  report: DataProtectionOverviewReport,
  debugInfo?: AiDebugInfo
): AIQAResponse {
  const lowerQuestion = question.toLowerCase();

  // Calculate metrics for context
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

  // Pattern matching for common questions
  let answer = '';
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  const sources: string[] = [];

  if (lowerQuestion.includes('gdpr') && lowerQuestion.includes('status')) {
    const gdprStats = frameworkStats.find(f => f.framework === 'GDPR');
    if (gdprStats) {
      const gdprRate = gdprStats.totalControls > 0
        ? Math.round((gdprStats.implemented / gdprStats.totalControls) * 100)
        : 0;
      answer = `Your GDPR compliance status: ${gdprStats.implemented} of ${gdprStats.totalControls} controls are implemented (${gdprRate}%). `;
      answer += `${gdprStats.inProgress} controls are in progress, and ${gdprStats.controlsWithEvidence} controls have supporting evidence.`;
      confidence = 'high';
      sources.push('Control mappings for GDPR framework');
    } else {
      answer = 'No controls are currently mapped to the GDPR framework in your workspace.';
      confidence = 'high';
    }
  } else if (lowerQuestion.includes('implementation') && (lowerQuestion.includes('rate') || lowerQuestion.includes('status') || lowerQuestion.includes('progress'))) {
    answer = `Your overall data protection implementation rate is ${implementationRate}%. `;
    answer += `${totalImplemented} of ${totalControls} controls are fully implemented. `;
    const inProgress = frameworkStats.reduce((sum, f) => sum + f.inProgress, 0);
    if (inProgress > 0) {
      answer += `${inProgress} additional controls are currently in progress.`;
    }
    confidence = 'high';
    sources.push('Control implementation status');
  } else if (lowerQuestion.includes('evidence') && (lowerQuestion.includes('coverage') || lowerQuestion.includes('gap'))) {
    answer = `Evidence coverage across your privacy controls is ${evidenceCoverage}%. `;
    const withoutEvidence = totalControls - totalWithEvidence;
    if (withoutEvidence > 0) {
      answer += `${withoutEvidence} controls are missing evidence documentation. `;
    }
    answer += `Evidence is critical for demonstrating compliance during audits.`;
    confidence = 'high';
    sources.push('Evidence linked to controls');
  } else if (lowerQuestion.includes('risk') && (lowerQuestion.includes('privacy') || lowerQuestion.includes('data protection'))) {
    answer = `${report.totalRelatedRisks} risks are linked to your privacy controls. `;
    if (report.totalRelatedRisks > 0) {
      answer += `These risks should be reviewed as part of your risk treatment plan to ensure data protection compliance.`;
    } else {
      answer += `Consider performing a risk assessment to identify potential privacy risks.`;
    }
    confidence = 'high';
    sources.push('Risk-control linkages');
  } else if (lowerQuestion.includes('framework') && (lowerQuestion.includes('which') || lowerQuestion.includes('what') || lowerQuestion.includes('list'))) {
    const names = frameworkStats.map(f => f.name).join(', ');
    answer = `Your workspace tracks ${frameworkStats.length} privacy framework${frameworkStats.length !== 1 ? 's' : ''}: ${names}. `;
    confidence = 'high';
    sources.push('Framework configuration');
  } else if (lowerQuestion.includes('weakest') || lowerQuestion.includes('lowest') || lowerQuestion.includes('worst')) {
    const sorted = frameworkStats
      .filter(f => f.totalControls > 0)
      .sort((a, b) => {
        const rateA = a.implemented / a.totalControls;
        const rateB = b.implemented / b.totalControls;
        return rateA - rateB;
      });

    if (sorted.length > 0) {
      const weakest = sorted[0];
      const rate = Math.round((weakest.implemented / weakest.totalControls) * 100);
      answer = `${weakest.name} has the lowest implementation rate at ${rate}%. `;
      answer += `${weakest.notImplemented} controls are not yet implemented.`;
      confidence = 'high';
      sources.push('Framework implementation statistics');
    } else {
      answer = 'Unable to determine - no controls are mapped to privacy frameworks.';
      confidence = 'low';
    }
  } else if (lowerQuestion.includes('ready') && lowerQuestion.includes('audit')) {
    if (implementationRate >= 80 && evidenceCoverage >= 70) {
      answer = `Your organization appears well-positioned for a privacy audit with ${implementationRate}% implementation and ${evidenceCoverage}% evidence coverage. `;
      answer += `Ensure all in-progress controls are completed and evidence is up to date.`;
    } else if (implementationRate >= 60) {
      answer = `Moderate audit readiness with ${implementationRate}% implementation and ${evidenceCoverage}% evidence coverage. `;
      answer += `Focus on completing in-progress controls and filling evidence gaps before scheduling an audit.`;
    } else {
      answer = `Current audit readiness is limited with only ${implementationRate}% implementation. `;
      answer += `Significant work is needed before pursuing a formal compliance audit.`;
    }
    confidence = 'medium';
    sources.push('Implementation and evidence metrics');
  } else {
    // Generic response for unrecognized questions
    answer = `Based on your data protection posture: You have ${totalControls} controls mapped across ${frameworkStats.length} privacy frameworks. `;
    answer += `Implementation rate is ${implementationRate}% with ${evidenceCoverage}% evidence coverage. `;
    answer += `For more specific information, try asking about GDPR status, implementation progress, evidence gaps, or audit readiness.`;
    confidence = 'low';
    sources.push('General compliance metrics');
  }

  return {
    answer,
    confidence,
    sources,
    generatedAt: new Date().toISOString(),
    debug: debugInfo,
  };
}

/**
 * OLD: Build a prompt for answering data protection questions
 * @deprecated Use buildDataProtectionQuestionPrompt from promptLibrary instead
 */
function _buildDataProtectionQuestionPromptLegacy(
  question: string,
  report: DataProtectionOverviewReport
): string {
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

  return `
You are a data protection compliance expert answering questions about an organization's privacy compliance.

COMPLIANCE DATA:
Total Privacy Controls: ${totalControls}
Overall Implementation Rate: ${implementationRate}%
Evidence Coverage: ${evidenceCoverage}%
Related Risks: ${report.totalRelatedRisks}

FRAMEWORK DETAILS:
${frameworkSummary}

USER QUESTION: ${question}

Please answer the question based on the data provided. Be specific and cite relevant numbers.

Format your response as JSON with the following structure:
{
  "answer": "Your detailed answer here",
  "confidence": "high" | "medium" | "low",
  "sources": ["source1", "source2"]
}
`;
}

/**
 * Check if AI service is available
 * Returns true if real AI is configured or stub mode is active
 */
export function isAIServiceAvailable(): boolean {
  // Always available - either real AI or stub mode
  return true;
}

/**
 * Check if real AI (non-stub) is configured and available
 */
export function isRealAIConfigured(): boolean {
  return isRealAiAvailable();
}

// ============================================
// TRAINING ENGAGEMENT AI FUNCTIONS
// ============================================

/**
 * Generate a training proposal/SoW for a training engagement
 * Uses real LLM if configured, otherwise generates a structured stub response
 */
export async function generateTrainingProposal(
  context: TrainingEngagementContext,
  workspaceId?: string
): Promise<TrainingProposalResult> {
  const mode = process.env.AI_TRAINING_MODE || 'auto';

  // Get workspace and framework context
  let workspaceName: string | null = null;
  let frameworks: Framework[] = [];

  if (workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);
    workspaceName = workspace?.displayName || workspace?.id || null;
  }

  try {
    frameworks = await frameworksRepo.getFrameworks({});
  } catch (error) {
    console.warn('Could not fetch frameworks:', error);
  }

  // Build prompt using the centralized library
  const built = buildTrainingProposalPromptFromLibrary({
    workspaceId: workspaceId || 'unknown',
    workspaceName,
    frameworks,
    engagement: context.engagement,
    pricingModel: context.pricingModel,
    frameworkCodes: context.frameworkCodes,
    frameworkNames: context.frameworkNames,
  });

  const promptConfig = PROMPT_CONFIGS.trainingProposal;
  const debugInfo = buildDebugInfo(built, promptConfig);

  // Use real AI if mode is 'real' or 'auto' with available API key
  if (mode === 'real' || (mode === 'auto' && isRealAiAvailable())) {
    try {
      const messages: AiMessage[] = [
        { role: 'system', content: built.system },
        { role: 'user', content: built.user },
      ];

      const response = await callLlm(messages, promptConfig);

      return {
        proposal: response,
        generatedAt: new Date().toISOString(),
        debug: debugInfo,
      };
    } catch (error) {
      console.error('Error calling LLM for training proposal:', error);
      // Fall through to stub response
    }
  }

  // Stub mode or fallback
  const { engagement, pricingModel, frameworkCodes, frameworkNames, kpiSnapshots } = context;

  // Format date range
  const startDate = engagement.startDate
    ? new Date(engagement.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';
  const endDate = engagement.endDate
    ? new Date(engagement.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';

  // Format engagement type
  const engagementTypeLabels: Record<string, string> = {
    'one_off': 'One-Time Training Engagement',
    'ongoing_program': 'Ongoing Training Program',
    'managed_service': 'Managed Training Service',
    'retainer': 'Training Retainer Arrangement',
  };
  const engagementTypeLabel = engagementTypeLabels[engagement.engagementType] || engagement.engagementType;

  // Format billing basis
  const billingLabels: Record<string, string> = {
    'per_user': 'Per User',
    'per_department': 'Per Department',
    'per_year': 'Per Year',
    'fixed_fee': 'Fixed Fee',
  };

  // Build proposal
  let proposal = `# Training & Awareness Proposal\n\n`;
  proposal += `## Executive Summary\n\n`;
  proposal += `**Client:** ${engagement.clientName || 'Not Specified'}\n`;
  proposal += `**Engagement Title:** ${engagement.title}\n`;
  proposal += `**Engagement Type:** ${engagementTypeLabel}\n`;
  proposal += `**Primary Contact:** ${engagement.primaryContact || 'TBD'}\n\n`;

  proposal += `---\n\n`;

  proposal += `## Scope & Objectives\n\n`;
  proposal += `This engagement aims to deliver comprehensive training and awareness programs `;
  if (frameworkNames.length > 0) {
    proposal += `aligned with the following compliance frameworks: **${frameworkNames.join(', ')}**. `;
  }
  proposal += `The program is designed to enhance security awareness, reduce human-factor risks, and support organizational compliance requirements.\n\n`;

  proposal += `### Key Objectives\n\n`;
  proposal += `- Improve employee awareness of security best practices\n`;
  proposal += `- Reduce susceptibility to phishing and social engineering attacks\n`;
  proposal += `- Ensure compliance with regulatory training requirements\n`;
  if (frameworkCodes.includes('GDPR') || frameworkCodes.includes('NDPA_2023')) {
    proposal += `- Fulfill data protection training mandates\n`;
  }
  if (frameworkCodes.includes('HIPAA')) {
    proposal += `- Meet HIPAA workforce training requirements\n`;
  }
  if (frameworkCodes.includes('ISO27001')) {
    proposal += `- Support ISO 27001 awareness and competence requirements (A.7.2)\n`;
  }
  proposal += `- Establish measurable improvement in security behaviors\n\n`;

  proposal += `---\n\n`;

  proposal += `## Approach & Delivery\n\n`;
  proposal += `### Training Delivery Methods\n\n`;
  proposal += `- **E-Learning Modules**: Self-paced online courses accessible via your LMS\n`;
  proposal += `- **Live Workshops**: Interactive sessions (virtual or in-person) for key topics\n`;
  proposal += `- **Phishing Simulations**: Periodic simulated attacks to test and reinforce learning\n`;
  proposal += `- **Awareness Campaigns**: Posters, emails, and micro-learning content\n`;
  proposal += `- **Assessment & Certification**: Knowledge checks and completion certificates\n\n`;

  if (engagement.engagementType === 'ongoing_program' || engagement.engagementType === 'managed_service') {
    proposal += `### Ongoing Program Components\n\n`;
    proposal += `- Monthly phishing simulations with reporting\n`;
    proposal += `- Quarterly training content refreshes\n`;
    proposal += `- Regular compliance reporting and KPI dashboards\n`;
    proposal += `- Annual program review and optimization\n\n`;
  }

  proposal += `---\n\n`;

  proposal += `## Timeline\n\n`;
  proposal += `| Phase | Description | Duration |\n`;
  proposal += `|-------|-------------|----------|\n`;
  proposal += `| **Kickoff** | Requirements gathering, stakeholder alignment | Week 1 |\n`;
  proposal += `| **Content Development** | Customization of training materials | Weeks 2-3 |\n`;
  proposal += `| **Platform Setup** | LMS configuration, user enrollment | Week 3 |\n`;
  proposal += `| **Pilot Launch** | Limited rollout for feedback | Week 4 |\n`;
  proposal += `| **Full Deployment** | Organization-wide training launch | Week 5+ |\n\n`;

  proposal += `**Start Date:** ${startDate}\n`;
  proposal += `**End Date:** ${endDate}\n\n`;

  proposal += `---\n\n`;

  proposal += `## Pricing\n\n`;

  if (pricingModel) {
    const billingLabel = billingLabels[pricingModel.billingBasis] || pricingModel.billingBasis;
    proposal += `**Pricing Model:** ${pricingModel.name}\n`;
    proposal += `**Billing Basis:** ${billingLabel}\n`;
    proposal += `**Unit Price:** ${pricingModel.currency} ${pricingModel.unitPrice.toLocaleString()}\n`;

    if (engagement.estimatedUsers) {
      const estimatedTotal = engagement.estimatedUsers * pricingModel.unitPrice;
      proposal += `**Estimated Users:** ${engagement.estimatedUsers.toLocaleString()}\n`;
      proposal += `**Estimated Total:** ${pricingModel.currency} ${estimatedTotal.toLocaleString()}\n`;
    }

    if (pricingModel.notes) {
      proposal += `\n*Note: ${pricingModel.notes}*\n`;
    }
  } else {
    proposal += `*Pricing to be determined based on final scope and requirements.*\n`;
    if (engagement.estimatedUsers) {
      proposal += `\n**Estimated Users:** ${engagement.estimatedUsers.toLocaleString()}\n`;
    }
  }

  proposal += `\n---\n\n`;

  proposal += `## Success Metrics & KPIs\n\n`;
  proposal += `The following metrics will be tracked to measure program effectiveness:\n\n`;
  proposal += `| KPI | Baseline | Target | Measurement Method |\n`;
  proposal += `|-----|----------|--------|--------------------|\n`;
  proposal += `| Training Completion Rate | TBD | ≥95% | LMS tracking |\n`;
  proposal += `| Phishing Click Rate | TBD | <5% | Simulation reports |\n`;
  proposal += `| Knowledge Assessment Scores | TBD | ≥80% | Quiz results |\n`;
  proposal += `| Policy Acknowledgment Rate | TBD | 100% | Compliance system |\n`;

  if (kpiSnapshots && kpiSnapshots.length > 0) {
    proposal += `\n### Current Metrics (from existing data)\n\n`;
    for (const snapshot of kpiSnapshots.slice(0, 5)) {
      proposal += `- KPI ${snapshot.kpiId}: ${snapshot.value} (Period: ${snapshot.periodStart} to ${snapshot.periodEnd})\n`;
    }
  }

  proposal += `\n---\n\n`;

  proposal += `## Frameworks Covered\n\n`;
  if (frameworkNames.length > 0) {
    for (const fw of frameworkNames) {
      proposal += `- **${fw}**\n`;
    }
  } else {
    proposal += `*Frameworks to be determined based on client requirements.*\n`;
  }

  proposal += `\n---\n\n`;

  proposal += `## Next Steps\n\n`;
  proposal += `1. Review and approve this proposal\n`;
  proposal += `2. Schedule kickoff meeting with stakeholders\n`;
  proposal += `3. Execute Statement of Work\n`;
  proposal += `4. Begin requirements gathering phase\n\n`;

  proposal += `---\n\n`;

  proposal += `*This proposal was generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.*\n`;

  return {
    proposal,
    generatedAt: new Date().toISOString(),
    debug: debugInfo,
  };
}

/**
 * Answer a question about a training engagement
 * Uses real LLM if configured, otherwise uses pattern-matching stub
 */
export async function answerTrainingEngagementQuestion(
  question: string,
  context: TrainingEngagementContext,
  workspaceId?: string
): Promise<AIQAResponse> {
  const mode = process.env.AI_TRAINING_MODE || 'auto';

  // Get workspace and framework context
  let workspaceName: string | null = null;
  let frameworks: Framework[] = [];

  if (workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);
    workspaceName = workspace?.displayName || workspace?.id || null;
  }

  try {
    frameworks = await frameworksRepo.getFrameworks({});
  } catch (error) {
    console.warn('Could not fetch frameworks:', error);
  }

  // Build prompt using the centralized library
  const built = buildTrainingQuestionPrompt({
    workspaceId: workspaceId || 'unknown',
    workspaceName,
    frameworks,
    engagement: context.engagement,
    pricingModel: context.pricingModel,
    frameworkCodes: context.frameworkCodes,
    frameworkNames: context.frameworkNames,
    question,
  });

  const promptConfig = PROMPT_CONFIGS.trainingQuestion;
  const debugInfo = buildDebugInfo(built, promptConfig);

  // Use real AI if mode is 'real' or 'auto' with available API key
  if (mode === 'real' || (mode === 'auto' && isRealAiAvailable())) {
    try {
      const messages: AiMessage[] = [
        { role: 'system', content: built.system },
        { role: 'user', content: built.user },
      ];

      const response = await callLlm(messages, promptConfig);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          answer: parsed.answer || '',
          confidence: parsed.confidence || 'medium',
          sources: parsed.sources || [],
          generatedAt: new Date().toISOString(),
          debug: debugInfo,
        };
      }
    } catch (error) {
      console.error('Error calling LLM for training question:', error);
      // Fall through to stub response
    }
  }

  // Stub mode or fallback - use pattern matching
  return answerTrainingQuestionStub(question, context, debugInfo);
}

/**
 * Stub implementation for training engagement Q&A
 */
function answerTrainingQuestionStub(
  question: string,
  context: TrainingEngagementContext,
  debugInfo?: AiDebugInfo
): AIQAResponse {
  const { engagement, pricingModel, frameworkNames, kpiSnapshots } = context;
  const lowerQuestion = question.toLowerCase();

  let answer = '';
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  const sources: string[] = [];

  // Pattern matching for common questions
  if (lowerQuestion.includes('status') || lowerQuestion.includes('state')) {
    answer = `The engagement "${engagement.title}" is currently in **${engagement.status}** status. `;
    if (engagement.startDate) {
      answer += `It is scheduled to start on ${new Date(engagement.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. `;
    }
    confidence = 'high';
    sources.push('Engagement details');
  } else if (lowerQuestion.includes('price') || lowerQuestion.includes('cost') || lowerQuestion.includes('pricing')) {
    if (pricingModel) {
      answer = `This engagement uses the **${pricingModel.name}** pricing model. `;
      answer += `The billing basis is ${pricingModel.billingBasis.replace('_', ' ')} at ${pricingModel.currency} ${pricingModel.unitPrice} per unit. `;
      if (engagement.estimatedUsers) {
        const estimated = engagement.estimatedUsers * pricingModel.unitPrice;
        answer += `With ${engagement.estimatedUsers} estimated users, the total would be approximately ${pricingModel.currency} ${estimated.toLocaleString()}.`;
      }
      confidence = 'high';
      sources.push('Pricing model', 'Engagement details');
    } else {
      answer = `No pricing model has been assigned to this engagement yet. `;
      if (engagement.estimatedUsers) {
        answer += `The estimated number of users is ${engagement.estimatedUsers}.`;
      }
      confidence = 'medium';
      sources.push('Engagement details');
    }
  } else if (lowerQuestion.includes('framework') || lowerQuestion.includes('compliance')) {
    if (frameworkNames.length > 0) {
      answer = `This engagement covers ${frameworkNames.length} compliance framework${frameworkNames.length !== 1 ? 's' : ''}: ${frameworkNames.join(', ')}. `;
      answer += `Training content will be tailored to address the specific requirements of these frameworks.`;
      confidence = 'high';
      sources.push('Framework mappings');
    } else {
      answer = `No specific compliance frameworks have been assigned to this engagement yet. `;
      answer += `Consider adding relevant frameworks to ensure training content aligns with compliance requirements.`;
      confidence = 'medium';
    }
  } else if (lowerQuestion.includes('timeline') || lowerQuestion.includes('duration') || lowerQuestion.includes('when')) {
    if (engagement.startDate && engagement.endDate) {
      const start = new Date(engagement.startDate);
      const end = new Date(engagement.endDate);
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      answer = `The engagement runs from ${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} `;
      answer += `to ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} `;
      answer += `(approximately ${durationDays} days).`;
      confidence = 'high';
      sources.push('Engagement dates');
    } else if (engagement.startDate) {
      answer = `The engagement is scheduled to start on ${new Date(engagement.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. `;
      answer += `The end date has not been specified.`;
      confidence = 'medium';
    } else {
      answer = `The timeline for this engagement has not been defined yet.`;
      confidence = 'low';
    }
  } else if (lowerQuestion.includes('kpi') || lowerQuestion.includes('metric') || lowerQuestion.includes('performance')) {
    if (kpiSnapshots && kpiSnapshots.length > 0) {
      answer = `There are ${kpiSnapshots.length} KPI snapshot${kpiSnapshots.length !== 1 ? 's' : ''} recorded for this engagement. `;
      const latestSnapshot = kpiSnapshots[0];
      answer += `The most recent measurement shows a value of ${latestSnapshot.value} `;
      answer += `for the period ${latestSnapshot.periodStart} to ${latestSnapshot.periodEnd}.`;
      confidence = 'high';
      sources.push('KPI snapshots');
    } else {
      answer = `No KPI snapshots have been recorded for this engagement yet. `;
      answer += `Consider tracking metrics like training completion rate, phishing click rate, and policy acknowledgment rate.`;
      confidence = 'medium';
    }
  } else if (lowerQuestion.includes('contact') || lowerQuestion.includes('owner') || lowerQuestion.includes('responsible')) {
    if (engagement.primaryContact) {
      answer = `The primary contact for this engagement is **${engagement.primaryContact}**.`;
      confidence = 'high';
      sources.push('Engagement details');
    } else {
      answer = `No primary contact has been assigned to this engagement.`;
      confidence = 'high';
    }
  } else if (lowerQuestion.includes('type') || lowerQuestion.includes('model') || lowerQuestion.includes('arrangement')) {
    const typeLabels: Record<string, string> = {
      'one_off': 'a one-time training engagement',
      'ongoing_program': 'an ongoing training program',
      'managed_service': 'a managed training service',
      'retainer': 'a retainer arrangement',
    };
    answer = `This is ${typeLabels[engagement.engagementType] || engagement.engagementType}. `;
    if (engagement.engagementType === 'ongoing_program' || engagement.engagementType === 'managed_service') {
      answer += `This typically includes regular training updates, periodic assessments, and continuous improvement activities.`;
    } else if (engagement.engagementType === 'one_off') {
      answer += `This is a defined-scope project with specific deliverables and a clear end date.`;
    }
    confidence = 'high';
    sources.push('Engagement type');
  } else {
    // Generic response
    answer = `Regarding "${engagement.title}": This is a ${engagement.engagementType.replace('_', ' ')} engagement `;
    answer += `currently in ${engagement.status} status. `;
    if (engagement.clientName) {
      answer += `Client: ${engagement.clientName}. `;
    }
    if (frameworkNames.length > 0) {
      answer += `Frameworks: ${frameworkNames.join(', ')}. `;
    }
    answer += `For specific details, try asking about pricing, timeline, frameworks, or KPIs.`;
    confidence = 'low';
    sources.push('General engagement information');
  }

  return {
    answer,
    confidence,
    sources,
    generatedAt: new Date().toISOString(),
    debug: debugInfo,
  };
}

// ============================================
// BOARD REPORT AI FUNCTIONS
// ============================================

/**
 * Generate a board report narrative
 * Uses real LLM if configured, otherwise generates a structured stub response
 */
export async function generateBoardReportNarrative(
  data: BoardReportData,
  audience: BoardReportAudience = 'board'
): Promise<BoardReportNarrativeResult> {
  const mode = process.env.AI_BOARD_REPORT_MODE || 'auto';

  // Get workspace and framework context
  let frameworks: Framework[] = [];
  try {
    frameworks = await frameworksRepo.getFrameworks({});
  } catch (error) {
    console.warn('Could not fetch frameworks:', error);
  }

  // Build prompt using the centralized library
  const built = buildBoardReportPromptFromLibrary({
    workspaceId: data.workspaceId,
    workspaceName: data.workspaceName,
    frameworks,
    data,
    audience,
  });

  const promptConfig = PROMPT_CONFIGS.boardReport;
  const debugInfo = buildDebugInfo(built, promptConfig);

  // Use real AI if mode is 'real' or 'auto' with available API key
  if (mode === 'real' || (mode === 'auto' && isRealAiAvailable())) {
    try {
      const messages: AiMessage[] = [
        { role: 'system', content: built.system },
        { role: 'user', content: built.user },
      ];

      const response = await callLlm(messages, promptConfig);

      return {
        narrative: response,
        generatedAt: new Date().toISOString(),
        debug: debugInfo,
      };
    } catch (error) {
      console.error('Error calling LLM for board report:', error);
      // Fall through to stub response
    }
  }

  // Stub mode or fallback
    // Generate a stubbed but realistic narrative
    const totalControls = data.frameworks.reduce((sum, f) => sum + f.totalControls, 0);
    const totalImplemented = data.frameworks.reduce((sum, f) => sum + f.implemented, 0);
    const overallImplRate = totalControls > 0 ? Math.round((totalImplemented / totalControls) * 100) : 0;
    const evidenceCoverage = totalControls > 0
      ? Math.round((data.frameworks.reduce((sum, f) => sum + f.controlsWithEvidence, 0) / totalControls) * 100)
      : 0;

    const audienceLabel = {
      board: 'Board of Directors',
      audit_committee: 'Audit Committee',
      regulator: 'Regulatory Submission',
    }[audience];

    let narrative = `# GRC Executive Report\n\n`;
    narrative += `**Prepared for:** ${audienceLabel}\n`;
    narrative += `**Workspace:** ${data.workspaceName || data.workspaceId}\n`;
    narrative += `**Generated:** ${new Date(data.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`;
    narrative += `---\n\n`;

    // Executive Summary
    narrative += `## Executive Summary\n\n`;
    narrative += `The organization's compliance and risk posture across ${data.frameworks.length} framework(s) shows `;
    if (overallImplRate >= 80) {
      narrative += `strong progress with ${overallImplRate}% of controls implemented. `;
    } else if (overallImplRate >= 60) {
      narrative += `moderate progress with ${overallImplRate}% of controls implemented. `;
    } else {
      narrative += `areas requiring attention with only ${overallImplRate}% of controls implemented. `;
    }
    narrative += `${data.riskSummary.openRisks} risks remain open, with ${data.riskSummary.highRisks} classified as high severity. `;
    narrative += `Training completion stands at ${data.trainingSummary.overallCompletionRate}%.\n\n`;

    // Risk Posture
    narrative += `## Risk Posture\n\n`;
    narrative += `**Total Risks:** ${data.riskSummary.totalRisks} | **Open:** ${data.riskSummary.openRisks} | **Closed:** ${data.riskSummary.closedRisks}\n\n`;
    if (data.riskSummary.highRisks > 0) {
      narrative += `**High-severity risks require immediate attention.** `;
    }
    if (data.riskSummary.topRisks.length > 0) {
      narrative += `Top risks include:\n`;
      for (const risk of data.riskSummary.topRisks.slice(0, 3)) {
        narrative += `- ${risk.title} (Severity: ${risk.severityScore}, Status: ${risk.status})\n`;
      }
    }
    narrative += `\n`;

    // Controls & Coverage
    narrative += `## Controls & Coverage\n\n`;
    narrative += `| Metric | Value |\n`;
    narrative += `|--------|-------|\n`;
    narrative += `| Total Controls | ${totalControls} |\n`;
    narrative += `| Implemented | ${overallImplRate}% |\n`;
    narrative += `| Evidence Coverage | ${evidenceCoverage}% |\n\n`;

    if (data.frameworks.length > 0) {
      narrative += `**Framework Breakdown:**\n`;
      for (const fw of data.frameworks) {
        const rate = fw.totalControls > 0 ? Math.round((fw.implemented / fw.totalControls) * 100) : 0;
        narrative += `- ${fw.frameworkName}: ${rate}% implemented (${fw.implemented}/${fw.totalControls})\n`;
      }
    }
    narrative += `\n`;

    // Policy & Training
    narrative += `## Policy & Training\n\n`;
    narrative += `**Policy Health:**\n`;
    narrative += `- ${data.policySummary.totalDocuments} governance documents\n`;
    narrative += `- ${data.policySummary.approved} approved, ${data.policySummary.inReview} in review\n`;
    if (data.policySummary.overdueReviews > 0) {
      narrative += `- **${data.policySummary.overdueReviews} overdue for review** - requires immediate action\n`;
    }
    if (data.policySummary.dueNext30Days > 0) {
      narrative += `- ${data.policySummary.dueNext30Days} due for review in the next 30 days\n`;
    }
    narrative += `\n`;

    narrative += `**Training & Awareness:**\n`;
    narrative += `- Completion rate: ${data.trainingSummary.overallCompletionRate}%\n`;
    if (data.trainingSummary.overdueAssignments > 0) {
      narrative += `- **${data.trainingSummary.overdueAssignments} overdue assignments** need follow-up\n`;
    }
    narrative += `- ${data.trainingSummary.activeCampaigns} active awareness campaigns\n`;
    if (data.trainingSummary.lastPhishClickRate !== undefined) {
      narrative += `- Last phishing simulation click rate: ${data.trainingSummary.lastPhishClickRate}%\n`;
    }
    narrative += `\n`;

    // AI & Data Protection
    if (data.aiPrivacySummary.aiHealthcareSummary || data.aiPrivacySummary.dataProtectionSummary) {
      narrative += `## AI & Data Protection\n\n`;
      if (data.aiPrivacySummary.aiHealthcareSummary && data.aiPrivacySummary.aiHealthcareSummary.frameworks.length > 0) {
        narrative += `**AI/Healthcare Frameworks:** ${data.aiPrivacySummary.aiHealthcareSummary.frameworks.join(', ')}\n`;
      }
      if (data.aiPrivacySummary.dataProtectionSummary && data.aiPrivacySummary.dataProtectionSummary.frameworks.length > 0) {
        narrative += `**Data Protection Frameworks:** ${data.aiPrivacySummary.dataProtectionSummary.frameworks.join(', ')}\n`;
      }
      narrative += `\n`;
    }

    // Recommendations
    narrative += `## Recommendations\n\n`;
    const recommendations: string[] = [];

    if (data.riskSummary.highRisks > 0) {
      recommendations.push(`Address the ${data.riskSummary.highRisks} high-severity risk(s) through accelerated treatment plans`);
    }
    if (overallImplRate < 80) {
      recommendations.push(`Prioritize control implementation to reach 80%+ coverage`);
    }
    if (evidenceCoverage < 70) {
      recommendations.push(`Improve evidence documentation to support audit readiness`);
    }
    if (data.policySummary.overdueReviews > 0) {
      recommendations.push(`Complete overdue policy reviews (${data.policySummary.overdueReviews} documents)`);
    }
    if (data.trainingSummary.overdueAssignments > 0) {
      recommendations.push(`Follow up on ${data.trainingSummary.overdueAssignments} overdue training assignments`);
    }
    if (data.trainingSummary.lastPhishClickRate !== undefined && data.trainingSummary.lastPhishClickRate > 10) {
      recommendations.push(`Enhance phishing awareness training - click rate of ${data.trainingSummary.lastPhishClickRate}% exceeds target`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue current momentum and schedule regular compliance reviews');
    }

    for (let i = 0; i < Math.min(recommendations.length, 5); i++) {
      narrative += `${i + 1}. ${recommendations[i]}\n`;
    }

    narrative += `\n---\n\n`;
    narrative += `*This report was generated automatically. For detailed analysis, consult with your GRC team.*\n`;

    return {
      narrative,
      generatedAt: new Date().toISOString(),
      debug: debugInfo,
    };
}
