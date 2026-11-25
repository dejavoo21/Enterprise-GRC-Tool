export const MAX_AI_QUESTION_LENGTH = 2_000;

export type AiQuestionValidation =
  | { valid: true; question: string }
  | { valid: false; message: string };

export function validateAiQuestion(value: unknown): AiQuestionValidation {
  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, message: 'Question is required and must be a non-empty string.' };
  }

  const question = value.trim();
  if (question.length > MAX_AI_QUESTION_LENGTH) {
    return { valid: false, message: `Question must not exceed ${MAX_AI_QUESTION_LENGTH} characters.` };
  }

  return { valid: true, question };
}
