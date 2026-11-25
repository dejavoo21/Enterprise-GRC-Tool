import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { callLlm, getAiConfig, isAiDebugMode } from '../services/aiClient.js';
import { validateAiQuestion } from '../services/aiInputValidation.js';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('AI availability requires a configured real provider', () => {
  const service = read('src/services/aiAssistantService.ts');
  assert.match(service, /export function isAIServiceAvailable\(mode = 'auto'\): boolean \{\s*return \['auto', 'real'\]\.includes\(mode\) && isRealAiAvailable\(\);\s*\}/);
  assert.match(service, /requireConfiguredAi\(mode\)/);
  assert.doesNotMatch(service, /Always available - either real AI or stub mode/);
  assert.doesNotMatch(service, /Fall through to stub response/);
  assert.doesNotMatch(service, /Stub mode or fallback/);
  assert.doesNotMatch(service, /answerDataProtectionQuestionStub|answerTrainingQuestionStub/);
  assert.equal((service.match(/The availability guard above guarantees an approved configured provider\./g) || []).length, 5);
});

test('central AI calls fail closed instead of returning placeholder prose', async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.AI_PROVIDER;
    assert.equal(getAiConfig().provider, 'unavailable');
    await assert.rejects(callLlm([{ role: 'user', content: 'Summarise this record' }]), /no approved provider and credential/);

    process.env.AI_PROVIDER = 'stub';
    delete process.env.OPENAI_API_KEY;
    assert.equal(getAiConfig().provider, 'unavailable');
    await assert.rejects(callLlm([{ role: 'user', content: 'Summarise this record' }]), /no approved provider and credential/);

    process.env.AI_PROVIDER = 'unknown-provider';
    assert.equal(getAiConfig().provider, 'unavailable');
    await assert.rejects(callLlm([{ role: 'user', content: 'Summarise this record' }]), /no approved provider and credential/);

    process.env.AI_PROVIDER = 'openai';
    await assert.rejects(callLlm([{ role: 'user', content: 'Summarise this record' }]), /no approved provider and credential/);
  } finally {
    if (previousProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previousProvider;
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
});

test('AI prompt debug output is never enabled in production', () => {
  const previousDebug = process.env.AI_DEBUG_PROMPT;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.AI_DEBUG_PROMPT = 'true';
    process.env.NODE_ENV = 'development';
    assert.equal(isAiDebugMode(), true);

    process.env.NODE_ENV = 'production';
    assert.equal(isAiDebugMode(), false);
  } finally {
    if (previousDebug === undefined) delete process.env.AI_DEBUG_PROMPT;
    else process.env.AI_DEBUG_PROMPT = previousDebug;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('AI call options fail before provider access when outside controlled bounds', async () => {
  await assert.rejects(
    callLlm([{ role: 'user', content: 'Summarise this record' }], { maxTokens: 0 }),
    /maxTokens must be an integer between 1 and 4096/,
  );
  await assert.rejects(
    callLlm([{ role: 'user', content: 'Summarise this record' }], { maxTokens: 1.5 }),
    /maxTokens must be an integer between 1 and 4096/,
  );
  await assert.rejects(
    callLlm([{ role: 'user', content: 'Summarise this record' }], { temperature: Number.NaN }),
    /temperature must be a finite number between 0 and 1/,
  );
  await assert.rejects(
    callLlm([{ role: 'user', content: 'Summarise this record' }], { temperature: 1.1 }),
    /temperature must be a finite number between 0 and 1/,
  );
});

test('AI question and message envelopes reject unbounded provider input', async () => {
  assert.deepEqual(validateAiQuestion('  What is recorded?  '), { valid: true, question: 'What is recorded?' });
  assert.deepEqual(validateAiQuestion('   '), {
    valid: false,
    message: 'Question is required and must be a non-empty string.',
  });
  assert.deepEqual(validateAiQuestion('x'.repeat(2_001)), {
    valid: false,
    message: 'Question must not exceed 2000 characters.',
  });

  await assert.rejects(callLlm([]), /messages must contain between 1 and 20 entries/);
  await assert.rejects(
    callLlm([{ role: 'user', content: 'x'.repeat(100_001) }]),
    /message 1 exceeds 100000 characters/,
  );
  await assert.rejects(
    callLlm([
      { role: 'system', content: 'x'.repeat(75_001) },
      { role: 'user', content: 'x'.repeat(75_000) },
    ]),
    /messages exceed 150000 characters in total/,
  );
});

test('AI-only routes reject requests when no approved provider is configured', () => {
  for (const route of [
    'src/routes/dataProtectionReports.ts',
    'src/routes/trainingAi.ts',
    'src/routes/boardReportsAi.ts',
  ]) {
    const source = read(route);
    assert.match(source, /AI_SERVICE_UNAVAILABLE/);
    assert.match(source, /status\(503\)/);
    assert.match(source, /isAIServiceAvailable\(process\.env\.AI_/);
  }
});

test('AI provider failures do not expose upstream exception messages', () => {
  const client = read('src/services/aiClient.ts');
  const dataProtection = read('src/routes/dataProtectionReports.ts');
  const training = read('src/routes/trainingAi.ts');

  assert.doesNotMatch(client, /AI call failed:.*error\.message/);
  assert.match(client, /AI provider request failed\. Please try again later\./);
  assert.match(client, /providerErrorMetadata\(error\)/);
  assert.doesNotMatch(training, /error instanceof Error \? error\.message/);
  assert.match(dataProtection, /Unable to generate the data protection summary\./);
  assert.match(dataProtection, /Unable to answer the data protection question\./);
  assert.match(training, /Unable to generate the training proposal\./);
  assert.match(training, /Unable to answer the training question\./);
});

test('board exports omit AI narrative rather than substituting stub prose', () => {
  const route = read('src/routes/boardReportsExport.ts');
  assert.match(route, /if \(!isAIServiceAvailable\(process\.env\.AI_BOARD_REPORT_MODE \|\| 'auto'\)\) return '';/);
  assert.match(route, /getOptionalAiNarrative/);
  assert.doesNotMatch(route, /aiResult\.narrative/);
});
