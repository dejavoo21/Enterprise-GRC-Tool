import type { AiComplianceProgramRecord } from '../types/aiGovernance.js';

const FRAMEWORK_CODES: AiComplianceProgramRecord['frameworkCode'][] = ['ISO42001', 'EU_AI_ACT', 'NIST_AI_RMF', 'OECD_AI', 'RESPONSIBLE_AI'];
const PROGRAM_STATUSES: AiComplianceProgramRecord['status'][] = ['healthy', 'watch', 'critical'];
const PERCENT_FIELDS = ['score', 'targetScore', 'controlCoveragePercent', 'evidenceCoveragePercent', 'documentationCoveragePercent', 'trainingCoveragePercent'] as const;

export class AiComplianceValidationError extends Error {}

export function assertAiComplianceProgram(input: Partial<AiComplianceProgramRecord>) {
  if (!FRAMEWORK_CODES.includes(input.frameworkCode as AiComplianceProgramRecord['frameworkCode'])) {
    throw new AiComplianceValidationError('A supported AI governance framework is required.');
  }
  if (typeof input.frameworkName !== 'string' || input.frameworkName.trim().length < 3 || input.frameworkName.trim().length > 160) {
    throw new AiComplianceValidationError('Framework name must contain between 3 and 160 characters.');
  }
  for (const field of PERCENT_FIELDS) {
    const value = input[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 100) {
      throw new AiComplianceValidationError(`${field} must be a whole recorded percentage from 0 to 100.`);
    }
  }
  if (typeof input.gapCount !== 'number' || !Number.isInteger(input.gapCount) || input.gapCount < 0 || input.gapCount > 100000) {
    throw new AiComplianceValidationError('Gap count must be a whole recorded number from 0 to 100000.');
  }
  if (!PROGRAM_STATUSES.includes(input.status as AiComplianceProgramRecord['status'])) {
    throw new AiComplianceValidationError('A supported compliance program status is required.');
  }
}
