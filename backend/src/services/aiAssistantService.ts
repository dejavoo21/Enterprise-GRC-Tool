/**
 * AI Assistant Service
 *
 * This service provides AI-powered analysis and Q&A capabilities for GRC data.
 * Uses the centralized prompt library for consistent, framework-aware prompts.
 */

import type { DataProtectionOverviewReport } from '../routes/dataProtectionReports.js';
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
import { parseAiAnswer, parseAiSummary, validateAiText } from './aiResponseValidation.js';

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

function requireConfiguredAi(mode: string): void {
  if (!isAIServiceAvailable(mode)) {
    throw new Error('AI assistance is unavailable because no approved provider is configured.');
  }
}

// ============================================
// DATA PROTECTION AI FUNCTIONS
// ============================================

/**
 * Generate a summary narrative for Data Protection posture
 * Requires an approved configured LLM provider
 */
export async function generateDataProtectionSummary(
  report: DataProtectionOverviewReport,
  workspaceId?: string
): Promise<AISummaryResponse> {
  const mode = process.env.AI_DATA_PROTECTION_MODE || 'auto';
  requireConfiguredAi(mode);

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

  // The availability guard above guarantees an approved configured provider.
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ];

    const response = await callLlm(messages, promptConfig);

    return { ...parseAiSummary(response), generatedAt: new Date().toISOString(), debug: debugInfo };
  } catch (error) {
    console.error('Error calling LLM for data protection summary:', error);
    throw error;
  }
}

/**
 * Answer a question about Data Protection posture
 * Requires an approved configured LLM provider
 */
export async function answerDataProtectionQuestion(
  question: string,
  report: DataProtectionOverviewReport,
  workspaceId?: string
): Promise<AIQAResponse> {
  const mode = process.env.AI_DATA_PROTECTION_MODE || 'auto';
  requireConfiguredAi(mode);

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

  // The availability guard above guarantees an approved configured provider.
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ];

    const response = await callLlm(messages, promptConfig);

    return { ...parseAiAnswer(response, 'data protection answer'), generatedAt: new Date().toISOString(), debug: debugInfo };
  } catch (error) {
    console.error('Error calling LLM for data protection question:', error);
    throw error;
  }
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
 * Returns true only when a real AI provider and its credential are configured.
 * Stub helpers remain test utilities and must never be advertised as live AI.
 */
export function isAIServiceAvailable(mode = 'auto'): boolean {
  return ['auto', 'real'].includes(mode) && isRealAiAvailable();
}

/**
 * Check if an approved AI provider is configured and available
 */
export function isRealAIConfigured(): boolean {
  return isRealAiAvailable();
}

// ============================================
// TRAINING ENGAGEMENT AI FUNCTIONS
// ============================================

/**
 * Generate a training proposal/SoW for a training engagement
 * Requires an approved configured LLM provider
 */
export async function generateTrainingProposal(
  context: TrainingEngagementContext,
  workspaceId?: string
): Promise<TrainingProposalResult> {
  const mode = process.env.AI_TRAINING_MODE || 'auto';
  requireConfiguredAi(mode);

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

  // The availability guard above guarantees an approved configured provider.
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ];

    const response = await callLlm(messages, promptConfig);

    return {
      proposal: validateAiText(response, 'training proposal'),
      generatedAt: new Date().toISOString(),
      debug: debugInfo,
    };
  } catch (error) {
    console.error('Error calling LLM for training proposal:', error);
    throw error;
  }
}

/**
 * Answer a question about a training engagement
 * Requires an approved configured LLM provider
 */
export async function answerTrainingEngagementQuestion(
  question: string,
  context: TrainingEngagementContext,
  workspaceId?: string
): Promise<AIQAResponse> {
  const mode = process.env.AI_TRAINING_MODE || 'auto';
  requireConfiguredAi(mode);

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

  // The availability guard above guarantees an approved configured provider.
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ];

    const response = await callLlm(messages, promptConfig);

    return { ...parseAiAnswer(response, 'training answer'), generatedAt: new Date().toISOString(), debug: debugInfo };
  } catch (error) {
    console.error('Error calling LLM for training question:', error);
    throw error;
  }
}

// ============================================
// BOARD REPORT AI FUNCTIONS
// ============================================

/**
 * Generate a board report narrative
 * Requires an approved configured LLM provider
 */
export async function generateBoardReportNarrative(
  data: BoardReportData,
  audience: BoardReportAudience = 'board'
): Promise<BoardReportNarrativeResult> {
  const mode = process.env.AI_BOARD_REPORT_MODE || 'auto';
  requireConfiguredAi(mode);

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

  // The availability guard above guarantees an approved configured provider.
  try {
    const messages: AiMessage[] = [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ];

    const response = await callLlm(messages, promptConfig);

    return {
      narrative: validateAiText(response, 'board report narrative'),
      generatedAt: new Date().toISOString(),
      debug: debugInfo,
    };
  } catch (error) {
    console.error('Error calling LLM for board report:', error);
    throw error;
  }
}
