import type { Risk } from './riskEngine';
import { evaluateComplianceCoverage } from './complianceEngine';

export const DEFAULT_FRAMEWORKS = [
  'ISO27001',
  'ISO27701',
  'ISO42001',
  'NIST_CSF',
  'NIST_800_53',
  'CIS',
  'SOC1',
  'SOC2',
  'GDPR',
  'HIPAA',
  'PCI_DSS',
  'EU_AI_ACT',
  'COBIT',
] as const;

const FRAMEWORK_ALIASES: Record<string, string> = {
  'ISO 27001': 'ISO27001',
  ISO27001: 'ISO27001',
  'ISO 27701': 'ISO27701',
  ISO27701: 'ISO27701',
  'ISO 42001': 'ISO42001',
  ISO42001: 'ISO42001',
  'NIST CSF': 'NIST_CSF',
  NIST_CSF: 'NIST_CSF',
  'NIST 800-53': 'NIST_800_53',
  NIST_800_53: 'NIST_800_53',
  'CIS Controls': 'CIS',
  CIS: 'CIS',
  'SOC 1': 'SOC1',
  SOC1: 'SOC1',
  'SOC 2': 'SOC2',
  SOC2: 'SOC2',
  GDPR: 'GDPR',
  HIPAA: 'HIPAA',
  'PCI DSS': 'PCI_DSS',
  PCI_DSS: 'PCI_DSS',
  'EU AI Act': 'EU_AI_ACT',
  EU_AI_ACT: 'EU_AI_ACT',
  COBIT: 'COBIT',
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeFrameworkName(framework: string): string {
  const trimmed = framework.trim();
  return FRAMEWORK_ALIASES[trimmed] || trimmed.replace(/\s+/g, '_').toUpperCase();
}

export function aggregateFrameworkScores(
  risks: Risk[],
  frameworks: string[],
): Record<string, number> {
  const normalizedFrameworks = frameworks.map(normalizeFrameworkName);
  const scoreBuckets = new Map<string, number[]>();

  normalizedFrameworks.forEach((framework) => {
    scoreBuckets.set(framework, []);
  });

  risks.forEach((risk) => {
    const coverage = evaluateComplianceCoverage(risk, normalizedFrameworks);
    coverage.frameworkScores.forEach((frameworkScore) => {
      if (frameworkScore.totalMappings > 0) {
        const bucket = scoreBuckets.get(frameworkScore.framework) || [];
        bucket.push(frameworkScore.score);
        scoreBuckets.set(frameworkScore.framework, bucket);
      }
    });
  });

  const result: Record<string, number> = {};

  scoreBuckets.forEach((scores, framework) => {
    result[framework] =
      scores.length > 0 ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  });

  return result;
}
