import type { Control } from './riskEngine';

export type ControlEffectivenessResult = {
  score: number;
  implementedPercentage: number;
  failedControls: number;
  topGaps: string[];
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function evaluateControlEffectiveness(controls: Control[]): ControlEffectivenessResult {
  if (controls.length === 0) {
    return {
      score: 0,
      implementedPercentage: 0,
      failedControls: 0,
      topGaps: ['No controls linked to risk'],
    };
  }

  const implementedControls = controls.filter((control) => control.status === 'implemented');
  const inProgressControls = controls.filter((control) => control.status === 'in_progress');
  const failedControls = controls.filter(
    (control) =>
      control.status !== 'implemented' || control.effectiveness < 50,
  ).length;

  const implementedPercentage = (implementedControls.length / controls.length) * 100;
  const effectivenessAverage =
    controls.reduce((sum, control) => sum + Math.max(0, Math.min(100, control.effectiveness)), 0) /
    controls.length;

  const weightedScore = implementedPercentage * 0.45 + effectivenessAverage * 0.55;
  const topGaps: string[] = [];

  if (controls.some((control) => control.status === 'not_implemented')) {
    topGaps.push(`${controls.filter((control) => control.status === 'not_implemented').length} controls not implemented`);
  }
  if (inProgressControls.length > 0) {
    topGaps.push(`${inProgressControls.length} controls still in progress`);
  }
  if (controls.some((control) => control.effectiveness < 60)) {
    topGaps.push(`${controls.filter((control) => control.effectiveness < 60).length} controls below 60% effectiveness`);
  }

  return {
    score: round(weightedScore),
    implementedPercentage: round(implementedPercentage),
    failedControls,
    topGaps,
  };
}
