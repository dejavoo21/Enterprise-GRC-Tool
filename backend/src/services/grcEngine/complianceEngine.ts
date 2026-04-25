import type { Risk } from './riskEngine';
import { normalizeFrameworkName } from './frameworkEngine';

export type FrameworkComplianceScore = {
  framework: string;
  score: number;
  implementedMappings: number;
  totalMappings: number;
};

export type ComplianceCoverageResult = {
  overallScore: number;
  frameworkScores: FrameworkComplianceScore[];
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function evaluateComplianceCoverage(
  risk: Risk,
  configuredFrameworks?: string[],
): ComplianceCoverageResult {
  const implementedControls = new Set(
    risk.controls.filter((control) => control.status === 'implemented').map((control) => control.id),
  );

  const frameworks = configuredFrameworks && configuredFrameworks.length > 0
    ? configuredFrameworks.map(normalizeFrameworkName)
    : [...new Set(risk.frameworks.map((mapping) => normalizeFrameworkName(mapping.framework)))];

  const frameworkScores = frameworks.map((framework) => {
    const mappings = risk.frameworks.filter(
      (mapping) => normalizeFrameworkName(mapping.framework) === framework,
    );
    const implementedMappings = mappings.filter((mapping) => implementedControls.has(mapping.controlId)).length;
    const totalMappings = mappings.length;
    const score = totalMappings > 0 ? (implementedMappings / totalMappings) * 100 : 0;

    return {
      framework,
      score: round(score),
      implementedMappings,
      totalMappings,
    };
  });

  const activeFrameworkScores = frameworkScores.filter((item) => item.totalMappings > 0);
  const overallScore = activeFrameworkScores.length > 0
    ? round(
        activeFrameworkScores.reduce((sum, item) => sum + item.score, 0) /
          activeFrameworkScores.length,
      )
    : 0;

  return {
    overallScore,
    frameworkScores,
  };
}
