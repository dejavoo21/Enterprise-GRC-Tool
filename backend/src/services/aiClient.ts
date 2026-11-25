/**
 * Central AI Client for LLM interactions
 * Supports approved OpenAI and Anthropic providers. Misconfiguration fails closed.
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCallOptions {
  maxTokens?: number;
  temperature?: number;
}

interface NormalizedAiCallOptions {
  maxTokens: number;
  temperature: number;
}

const DEFAULT_MAX_TOKENS = 2_000;
const MAX_ALLOWED_TOKENS = 4_096;
const DEFAULT_TEMPERATURE = 0.7;
const AI_REQUEST_TIMEOUT_MS = 30_000;
const AI_REQUEST_MAX_RETRIES = 1;
const MAX_MESSAGE_COUNT = 20;
const MAX_MESSAGE_LENGTH = 100_000;
const MAX_TOTAL_MESSAGE_LENGTH = 150_000;

export type AiProvider = 'openai' | 'anthropic' | 'unavailable';

/**
 * Debug information returned when AI_DEBUG_PROMPT is enabled
 */
export interface AiDebugInfo {
  provider: AiProvider;
  model: string;
  prompt: {
    system: string;
    user: string;
  };
  options?: AiCallOptions;
}

/**
 * Check if AI debug mode is enabled (for non-production environments)
 */
export function isAiDebugMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AI_DEBUG_PROMPT === 'true';
}

/**
 * Get the configured AI provider from environment
 */
function getProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || '';
  if (provider === 'openai' || provider === 'anthropic') {
    return provider;
  }
  return 'unavailable';
}

/**
 * Get the configured model for the provider
 */
function getModel(provider: AiProvider): string {
  if (process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }
  // Default models per provider
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-sonnet-4-20250514';
    default:
      return 'unavailable';
  }
}

/**
 * Check if the provider has a valid API key configured
 */
function hasApiKey(provider: AiProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY;
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'unavailable':
      return false;
  }
}

function normalizeCallOptions(options: AiCallOptions): NormalizedAiCallOptions {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_ALLOWED_TOKENS) {
    throw new Error(`AI maxTokens must be an integer between 1 and ${MAX_ALLOWED_TOKENS}.`);
  }

  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
    throw new Error('AI temperature must be a finite number between 0 and 1.');
  }

  return { maxTokens, temperature };
}

function validateMessages(messages: AiMessage[]): void {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGE_COUNT) {
    throw new Error(`AI messages must contain between 1 and ${MAX_MESSAGE_COUNT} entries.`);
  }

  let totalLength = 0;
  for (const [index, message] of messages.entries()) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) {
      throw new Error(`AI message ${index + 1} has an invalid role.`);
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
      throw new Error(`AI message ${index + 1} must contain non-empty text.`);
    }
    if (message.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`AI message ${index + 1} exceeds ${MAX_MESSAGE_LENGTH} characters.`);
    }
    totalLength += message.content.length;
  }

  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    throw new Error(`AI messages exceed ${MAX_TOTAL_MESSAGE_LENGTH} characters in total.`);
  }
}

function providerErrorMetadata(error: unknown): { name: string; status?: number } {
  const name = error instanceof Error && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(error.name)
    ? error.name
    : 'UnknownError';
  const status = typeof error === 'object' && error !== null && 'status' in error
    && Number.isInteger((error as { status?: unknown }).status)
    ? (error as { status: number }).status
    : undefined;
  return status === undefined ? { name } : { name, status };
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: AiMessage[],
  model: string,
  options: NormalizedAiCallOptions
): Promise<string> {
  // Dynamic import to avoid requiring the package when not using OpenAI
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: AI_REQUEST_TIMEOUT_MS,
    maxRetries: AI_REQUEST_MAX_RETRIES,
  });

  const response = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: options.maxTokens,
    temperature: options.temperature,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  messages: AiMessage[],
  model: string,
  options: NormalizedAiCallOptions
): Promise<string> {
  // Dynamic import to avoid requiring the package when not using Anthropic
  const { default: Anthropic } = await import('@anthropic-ai/sdk');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: AI_REQUEST_TIMEOUT_MS,
    maxRetries: AI_REQUEST_MAX_RETRIES,
  });

  // Extract system message if present
  const systemMessage = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens,
    system: systemMessage?.content,
    messages: nonSystemMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Extract text from response
  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}

/**
 * Main function to call an LLM with the configured provider
 *
 * @param messages - Array of messages in the conversation
 * @param options - Optional configuration for the call
 * @returns The LLM's response text
 */
export async function callLlm(
  messages: AiMessage[],
  options: AiCallOptions = {}
): Promise<string> {
  const normalizedOptions = normalizeCallOptions(options);
  validateMessages(messages);
  const provider = getProvider();
  const model = getModel(provider);

  if (provider === 'unavailable' || !hasApiKey(provider)) {
    throw new Error('AI assistance is unavailable because no approved provider and credential are configured.');
  }

  try {
    switch (provider) {
      case 'openai':
        return await callOpenAI(messages, model, normalizedOptions);
      case 'anthropic':
        return await callAnthropic(messages, model, normalizedOptions);
      default:
        throw new Error('AI assistance is unavailable because no approved provider is configured.');
    }
  } catch (error) {
    console.error(`AI provider request failed (${provider}).`, providerErrorMetadata(error));
    throw new Error('AI provider request failed. Please try again later.');
  }
}

/**
 * Check if an approved AI provider and its credential are available.
 */
export function isRealAiAvailable(): boolean {
  const provider = getProvider();
  return provider !== 'unavailable' && hasApiKey(provider);
}

/**
 * Get current AI configuration for debugging
 */
export function getAiConfig(): { provider: AiProvider; model: string; hasKey: boolean } {
  const provider = getProvider();
  return {
    provider,
    model: getModel(provider),
    hasKey: hasApiKey(provider),
  };
}
