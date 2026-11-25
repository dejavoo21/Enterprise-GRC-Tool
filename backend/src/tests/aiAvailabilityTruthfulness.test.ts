import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { callLlm } from '../services/aiClient.js';

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
    process.env.AI_PROVIDER = 'stub';
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(callLlm([{ role: 'user', content: 'Summarise this record' }]), /no approved provider and credential/);

    process.env.AI_PROVIDER = 'unknown-provider';
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

test('board exports omit AI narrative rather than substituting stub prose', () => {
  const route = read('src/routes/boardReportsExport.ts');
  assert.match(route, /if \(!isAIServiceAvailable\(process\.env\.AI_BOARD_REPORT_MODE \|\| 'auto'\)\) return '';/);
  assert.match(route, /getOptionalAiNarrative/);
  assert.doesNotMatch(route, /aiResult\.narrative/);
});
