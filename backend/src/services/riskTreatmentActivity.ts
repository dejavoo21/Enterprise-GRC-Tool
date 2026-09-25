type TreatmentState = { status: string; progressPercent: number };

export function riskTreatmentActivityAction(previous: TreatmentState, next: TreatmentState) {
  if (next.status !== previous.status) {
    return next.status === 'completed' ? 'risk_treatment_completed' : 'risk_treatment_status_changed';
  }
  return next.progressPercent !== previous.progressPercent
    ? 'risk_treatment_progress_changed'
    : 'risk_treatment_updated';
}
