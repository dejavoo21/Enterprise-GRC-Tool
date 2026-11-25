const caseCategories = new Set(['security_incident', 'insider_risk']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalText(value: unknown, maxLength: number) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length <= maxLength);
}

function optionalDate(value: unknown) {
  return value === undefined || value === null || value === ''
    || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

export function validateIncidentCaseContext(input: Record<string, unknown>, requireRationale = false): string | null {
  const caseCategory = input.caseCategory || 'security_incident';
  if (typeof caseCategory !== 'string' || !caseCategories.has(caseCategory)) return 'Use a supported case category.';
  if (input.subjectUserId && (typeof input.subjectUserId !== 'string' || !uuidPattern.test(input.subjectUserId))) return 'Select a valid subject workspace member ID.';
  if (!optionalText(input.indicatorSummary, 4000) || !optionalText(input.handlingBasis, 4000)) return 'Indicator summary and handling basis must not exceed 4,000 characters.';
  if (!optionalDate(input.reviewDueAt)) return 'Review due date must be a valid date.';
  if (input.riskGroupLabels !== undefined) {
    if (!Array.isArray(input.riskGroupLabels) || input.riskGroupLabels.length > 20
      || input.riskGroupLabels.some((label) => typeof label !== 'string' || !label.trim() || label.trim().length > 100)) {
      return 'Risk group labels must be an array of up to 20 non-empty labels, each no longer than 100 characters.';
    }
  }
  const hasInsiderContext = Boolean(input.subjectUserId || String(input.indicatorSummary || '').trim()
    || String(input.handlingBasis || '').trim() || input.reviewDueAt
    || (Array.isArray(input.riskGroupLabels) && input.riskGroupLabels.length));
  if (caseCategory !== 'insider_risk' && hasInsiderContext) return 'Insider-risk context must be removed before classifying this record as a security incident.';
  if (caseCategory === 'insider_risk' && (!input.subjectUserId || !String(input.indicatorSummary || '').trim() || !String(input.handlingBasis || '').trim())) {
    return 'A subject member ID, reviewed indicator summary and handling basis are required for an insider-risk case.';
  }
  if (requireRationale && (typeof input.notes !== 'string' || !input.notes.trim() || input.notes.trim().length > 4000)) {
    return 'Change rationale is required and must not exceed 4,000 characters.';
  }
  return null;
}
