/**
 * Central AI Client for LLM interactions
 * Supports OpenAI, Anthropic, and stub mode for testing
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCallOptions {
  maxTokens?: number;
  temperature?: number;
}

export type AiProvider = 'openai' | 'anthropic' | 'stub';

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
  return process.env.AI_DEBUG_PROMPT === 'true';
}

/**
 * Get the configured AI provider from environment
 */
function getProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || 'stub';
  if (provider === 'openai' || provider === 'anthropic' || provider === 'stub') {
    return provider;
  }
  console.warn(`Unknown AI_PROVIDER "${provider}", falling back to stub`);
  return 'stub';
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
      return 'stub';
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
    case 'stub':
      return true;
  }
}

/**
 * Generate a stub response for testing without API keys
 */
function generateStubResponse(messages: AiMessage[]): string {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  const promptPreview = lastUserMessage?.content.slice(0, 200) || 'No user message';

  return `[Stub AI Response]

This is a placeholder response because AI_PROVIDER is set to "stub" or no API key is configured.

Prompt preview:
${promptPreview}${lastUserMessage && lastUserMessage.content.length > 200 ? '...' : ''}

To enable real AI responses:
1. Set AI_PROVIDER=openai (or anthropic) in your .env file
2. Add OPENAI_API_KEY=your-key (or ANTHROPIC_API_KEY)
3. Optionally set AI_MODEL to override the default model`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: AiMessage[],
  model: string,
  options: AiCallOptions
): Promise<string> {
  // Dynamic import to avoid requiring the package when not using OpenAI
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.chat.completions.create({
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature ?? 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  messages: AiMessage[],
  model: string,
  options: AiCallOptions
): Promise<string> {
  // Dynamic import to avoid requiring the package when not using Anthropic
  const { default: Anthropic } = await import('@anthropic-ai/sdk');

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Extract system message if present
  const systemMessage = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens || 2000,
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
  const provider = getProvider();
  const model = getModel(provider);

  // Check for API key - fall back to stub if missing
  if (!hasApiKey(provider)) {
    console.warn(`No API key found for provider "${provider}", using stub response`);
    return generateStubResponse(messages);
  }

  // Return stub response if in stub mode
  if (provider === 'stub') {
    return generateStubResponse(messages);
  }

  try {
    switch (provider) {
      case 'openai':
        return await callOpenAI(messages, model, options);
      case 'anthropic':
        return await callAnthropic(messages, model, options);
      default:
        return generateStubResponse(messages);
    }
  } catch (error) {
    console.error(`Error calling ${provider} API:`, error);
    throw new Error(`AI call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if real AI is available (not in stub mode with valid key)
 */
export function isRealAiAvailable(): boolean {
  const provider = getProvider();
  return provider !== 'stub' && hasApiKey(provider);
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
