import type { Evidence } from './riskEngine';

export type EvidenceEngineOptions = {
  freshnessDays?: number;
};

export type EvidenceConfidenceResult = {
  score: number;
  validEvidence: number;
  expiredEvidence: number;
  missingEvidence: number;
  expiringSoon: number;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function evaluateEvidenceConfidence(
  evidence: Evidence[],
  options: EvidenceEngineOptions = {},
): EvidenceConfidenceResult {
  const freshnessDays = Math.max(1, options.freshnessDays ?? 90);

  if (evidence.length === 0) {
    return {
      score: 0,
      validEvidence: 0,
      expiredEvidence: 0,
      missingEvidence: 0,
      expiringSoon: 0,
    };
  }

  const now = Date.now();
  let validEvidence = 0;
  let expiredEvidence = 0;
  let missingEvidence = 0;
  let expiringSoon = 0;

  evidence.forEach((item) => {
    if (item.status === 'missing') {
      missingEvidence += 1;
      return;
    }

    if (item.status === 'expired') {
      expiredEvidence += 1;
      return;
    }

    const ageDays = (now - item.lastUpdated.getTime()) / 86400000;
    if (ageDays > freshnessDays) {
      expiredEvidence += 1;
      return;
    }

    if (ageDays > freshnessDays * 0.75) {
      expiringSoon += 1;
    }

    validEvidence += 1;
  });

  const score =
    (validEvidence / evidence.length) * 100 -
    (expiredEvidence / evidence.length) * 35 -
    (missingEvidence / evidence.length) * 45 -
    (expiringSoon / evidence.length) * 10;

  return {
    score: round(clamp(score)),
    validEvidence,
    expiredEvidence,
    missingEvidence,
    expiringSoon,
  };
}
