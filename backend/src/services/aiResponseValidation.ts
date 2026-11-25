const MAX_TEXT_LENGTH = 50_000;
const MAX_STRUCTURED_RESPONSE_LENGTH = 100_000;
const MAX_LIST_ITEMS = 20;
const MAX_LIST_ITEM_LENGTH = 2_000;

function requiredText(value: unknown, field: string, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`AI provider returned an invalid ${field}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`AI provider returned ${field} exceeding ${maxLength} characters.`);
  }
  return normalized;
}

function requiredStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw new Error(`AI provider returned an invalid ${field}.`);
  }
  return value.map((item, index) => requiredText(item, `${field}[${index}]`, MAX_LIST_ITEM_LENGTH));
}

function parseJsonObject(response: string, label: string): Record<string, unknown> {
  if (typeof response !== 'string' || response.length > MAX_STRUCTURED_RESPONSE_LENGTH) {
    throw new Error(`AI provider returned an invalid ${label}.`);
  }

  const start = response.indexOf('{');
  if (start === -1) throw new Error(`AI provider returned an invalid ${label}.`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectText: string | undefined;

  for (let index = start; index < response.length; index += 1) {
    const character = response[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        objectText = response.slice(start, index + 1);
        break;
      }
    }
  }

  if (!objectText || depth !== 0 || inString) {
    throw new Error(`AI provider returned an invalid ${label}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(objectText);
  } catch {
    throw new Error(`AI provider returned an invalid ${label}.`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`AI provider returned an invalid ${label}.`);
  }
  return parsed as Record<string, unknown>;
}

export function validateAiText(response: unknown, label: string): string {
  return requiredText(response, label);
}

export function parseAiSummary(response: string): { narrative: string; keyInsights: string[]; recommendations: string[] } {
  const parsed = parseJsonObject(response, 'data protection summary');
  return {
    narrative: requiredText(parsed.narrative, 'data protection narrative'),
    keyInsights: requiredStringList(parsed.keyInsights, 'key insights'),
    recommendations: requiredStringList(parsed.recommendations, 'recommendations'),
  };
}

export function parseAiAnswer(response: string, label: string): { answer: string; confidence: 'high' | 'medium' | 'low'; sources: string[] } {
  const parsed = parseJsonObject(response, label);
  const confidence = parsed.confidence;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    throw new Error(`AI provider returned an invalid ${label} confidence.`);
  }
  return {
    answer: requiredText(parsed.answer, `${label} answer`),
    confidence,
    sources: requiredStringList(parsed.sources, `${label} sources`),
  };
}
