type EsgInput = Record<string, unknown>;

const requiredFields: Record<string, readonly string[]> = {
  '/environmental-metrics': ['metricName', 'category', 'unit', 'currentValue', 'targetValue', 'trend', 'owner', 'reportingFrequency', 'status', 'recordedAt'],
  '/carbon-records': ['scope', 'sourceName', 'tonnesCo2e', 'intensity', 'reportingYear', 'targetTonnesCo2e', 'reductionTargetPercent', 'trend'],
  '/social-metrics': ['metricName', 'category', 'currentValue', 'targetValue', 'unit', 'owner', 'businessUnit', 'status', 'trend'],
  '/governance-metrics': ['metricName', 'category', 'currentValue', 'targetValue', 'unit', 'owner', 'status', 'trend'],
  '/risks': ['title', 'category', 'severity', 'status', 'owner', 'riskScore', 'mitigation'],
  '/kpis': ['kpiName', 'category', 'targetValue', 'actualValue', 'variance', 'trend', 'owner', 'businessUnit', 'reportingFrequency', 'status'],
  '/targets': ['targetName', 'category', 'unit', 'targetValue', 'currentValue', 'dueDate', 'owner', 'status'],
  '/suppliers': ['supplierName', 'supplierEsgRating', 'supplierCarbonScore', 'humanRightsCompliance', 'sustainabilityPractices', 'environmentalPerformance', 'assessmentStatus', 'supplierRiskLevel'],
  '/incidents': ['title', 'incidentType', 'severity', 'status', 'owner', 'linkedDomain', 'summary', 'occurredAt'],
};

const numericFields = new Set(['currentValue', 'targetValue', 'tonnesCo2e', 'intensity', 'reportingYear', 'targetTonnesCo2e', 'reductionTargetPercent', 'riskScore', 'actualValue', 'variance', 'supplierEsgRating', 'supplierCarbonScore']);
const dateFields = new Set(['recordedAt', 'dueDate', 'occurredAt']);

export function validateEsgInput(path: string, input: EsgInput): string[] {
  const required = requiredFields[path];
  if (!required) return [];
  const errors: string[] = [];
  for (const field of required) {
    const value = input[field];
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      errors.push(`${field} is required`);
      continue;
    }
    if (numericFields.has(field) && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${field} must be a finite number`);
    if (dateFields.has(field) && Number.isNaN(Date.parse(String(value)))) errors.push(`${field} must be a valid date`);
  }
  return errors;
}
