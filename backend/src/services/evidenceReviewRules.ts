export type EvidenceReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export function assertEvidenceSubmission(status: EvidenceReviewStatus): void {
  if (status !== 'draft' && status !== 'rejected') {
    throw Object.assign(new Error('Only draft or rejected evidence can be submitted for review.'), { code: 'INVALID_TRANSITION' });
  }
}

export function assertEvidenceDecision(status: EvidenceReviewStatus, createdBy: string | null | undefined, actorId: string): void {
  if (status !== 'pending_review') {
    throw Object.assign(new Error('Only evidence pending review can be approved or rejected.'), { code: 'INVALID_TRANSITION' });
  }
  if (createdBy && createdBy === actorId) {
    throw Object.assign(new Error('Evidence creators cannot approve or reject their own evidence.'), { code: 'SELF_APPROVAL' });
  }
}

export function assertEvidenceEditable(status: EvidenceReviewStatus): void {
  if (status !== 'draft' && status !== 'rejected') throw Object.assign(new Error('Only draft or rejected evidence can be edited.'), { code: 'INVALID_TRANSITION' });
}

export function assertExternalReference(locationUrl?: string): void {
  if (!locationUrl) return;
  let parsed: URL;
  try { parsed = new URL(locationUrl); } catch { throw Object.assign(new Error('Evidence location must be a valid HTTPS URL.'), { code: 'INVALID_LOCATION' }); }
  if (parsed.protocol !== 'https:') throw Object.assign(new Error('Evidence location must use HTTPS.'), { code: 'INVALID_LOCATION' });
}
