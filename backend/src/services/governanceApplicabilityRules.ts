export type RaciStatus = 'draft' | 'under_review' | 'approved' | 'archived';
export type SoaStatus = 'draft' | 'under_review' | 'approved' | 'superseded' | 'archived';
export type ImplementationStatus = 'implemented' | 'partially_implemented' | 'not_implemented' | 'not_applicable';

const raciTransitions: Record<RaciStatus, RaciStatus[]> = {
  draft: ['under_review', 'archived'], under_review: ['draft', 'approved'], approved: ['under_review', 'archived'], archived: [],
};
const soaTransitions: Record<SoaStatus, SoaStatus[]> = {
  draft: ['under_review', 'archived'], under_review: ['draft', 'approved'], approved: ['superseded'], superseded: ['archived'], archived: [],
};

export function validateRaciAssignment(input: { accountable?: string | null; responsible?: string[]; status?: RaciStatus }) {
  if (input.status === 'approved' && !input.accountable?.trim()) return 'An Accountable person or role is required before approval.';
  if (input.status === 'approved' && !(input.responsible || []).some(value => value.trim())) return 'At least one Responsible assignment is required before approval.';
  return null;
}

export function validateSoaControl(input: { applicable: boolean; justification?: string | null; implementationStatus?: ImplementationStatus; implementationDescription?: string | null }) {
  if (!input.justification?.trim()) return 'Applicability justification is required.';
  if (!input.applicable && input.implementationStatus && input.implementationStatus !== 'not_applicable') return 'Excluded controls must use the not_applicable implementation status.';
  if (input.applicable && input.implementationStatus === 'not_applicable') return 'Applicable controls cannot use the not_applicable implementation status.';
  if (input.implementationStatus === 'implemented' && !input.implementationDescription?.trim()) return 'Implemented controls require an actual implementation description.';
  return null;
}

export function assertRaciTransition(from: RaciStatus, to: RaciStatus) {
  if (!raciTransitions[from]?.includes(to)) throw new Error(`Invalid RACI transition from ${from} to ${to}.`);
}

export function assertSoaTransition(from: SoaStatus, to: SoaStatus) {
  if (!soaTransitions[from]?.includes(to)) throw new Error(`Invalid SoA transition from ${from} to ${to}.`);
}

export function assertIndependentApproval(createdBy: string, actor: string) {
  if (createdBy.trim().toLowerCase() === actor.trim().toLowerCase()) throw new Error('Independent approval is required; the author cannot approve this record.');
}

export function redactSoaControl<T extends Record<string, unknown>>(control: T) {
  const { evidence_ids: _evidence, risk_ids: _risks, implementation_description: _implementation, ...publicFields } = control;
  return publicFields;
}

export function validateImportRows(rows: Array<Record<string, unknown>>, kind: 'raci' | 'soa') {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const controlId = String(row.controlId || row.control_id || '').trim();
    const scope = String(row.scope || '').trim();
    const key = `${controlId.toLowerCase()}::${scope.toLowerCase()}`;
    const errors: string[] = [];
    if (!controlId) errors.push('Control ID is required.');
    if (!scope) errors.push('Scope is required.');
    if (seen.has(key)) errors.push('Duplicate control and scope assignment.');
    seen.add(key);
    if (kind === 'raci' && !String(row.accountable || '').trim()) errors.push('Accountable is required.');
    if (kind === 'raci' && !(Array.isArray(row.responsible) ? row.responsible : String(row.responsible || '').split(',')).some(value=>String(value).trim())) errors.push('Responsible is required.');
    if (kind === 'soa' && !String(row.documentId || row.document_id || '').trim()) errors.push('SoA document ID is required.');
    if (kind === 'soa' && !String(row.justification || '').trim()) errors.push('Justification is required.');
    if (kind === 'soa' && !String(row.implementationStatus || row.implementation_status || '').trim()) errors.push('Implementation status is required.');
    return { row: index + 1, controlId, valid: errors.length === 0, errors };
  });
}

export function assertImportTransition(from:string,to:string){
  const allowed:Record<string,string[]>={preview:['pending_approval'],pending_approval:['approved','rejected'],approved:['applied'],rejected:[],applied:[]};
  if(!allowed[from]?.includes(to))throw new Error(`Invalid governance import transition from ${from} to ${to}.`);
}
