import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertImportTransition, assertIndependentApproval, assertRaciTransition, assertSoaTransition, redactSoaControl, validateImportRows, validateRaciAssignment, validateSoaControl } from '../services/governanceApplicabilityRules.js';
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = path.resolve(process.cwd(), '../frontend/src');

describe('governance applicability rules', () => {
  it('requires accountable and responsible assignments for RACI approval', () => {
    assert.match(validateRaciAssignment({ status: 'approved', responsible: ['Owner'] }) || '', /Accountable/);
    assert.match(validateRaciAssignment({ status: 'approved', accountable: 'CISO', responsible: [] }) || '', /Responsible/);
    assert.equal(validateRaciAssignment({ status: 'approved', accountable: 'CISO', responsible: ['Control team'] }), null);
  });
  it('separates scope assignments and detects duplicate import rows', () => {
    const result = validateImportRows([{ controlId: 'A.5.1', scope: 'London', accountable: 'CISO', responsible:['Security'] }, { controlId: 'A.5.1', scope: 'Paris', accountable: 'CISO', responsible:['Security'] }, { controlId: 'A.5.1', scope: 'London', accountable: 'CISO', responsible:['Security'] }], 'raci');
    assert.deepEqual(result.map(item => item.valid), [true, true, false]);
  });
  it('enforces applicability and implementation integrity', () => {
    assert.match(validateSoaControl({ applicable: false, justification: '', implementationStatus: 'not_applicable' }) || '', /justification/);
    assert.match(validateSoaControl({ applicable: true, justification: 'Required', implementationStatus: 'implemented', implementationDescription: '' }) || '', /description/);
    assert.equal(validateSoaControl({ applicable: false, justification: 'Outside scope', implementationStatus: 'not_applicable' }), null);
  });
  it('protects lifecycle and independent approval', () => {
    assert.throws(() => assertRaciTransition('draft', 'approved'));
    assert.throws(() => assertSoaTransition('approved', 'draft'));
    assert.throws(() => assertIndependentApproval('author@example.com', 'AUTHOR@example.com'), /Independent/);
  });
  it('redacts confidential internal SoA fields from public exports', () => {
    assert.deepEqual(redactSoaControl({ control_id: 'A.5.1', implementation_description: 'secret', evidence_ids: ['E-1'], risk_ids: ['R-1'], justification: 'Included' }), { control_id: 'A.5.1', justification: 'Included' });
  });
  it('validates SoA dry-run imports without inventing values', () => {
    const result = validateImportRows([{ controlId: 'A.5.1', scope: 'ISMS', justification: '' }], 'soa');
    assert.equal(result[0].valid, false);
    assert.ok(result[0].errors.includes('Justification is required.'));
  });
  it('requires controlled approval before import application',()=>{
    assert.doesNotThrow(()=>assertImportTransition('preview','pending_approval'));
    assert.doesNotThrow(()=>assertImportTransition('pending_approval','approved'));
    assert.doesNotThrow(()=>assertImportTransition('approved','applied'));
    assert.throws(()=>assertImportTransition('preview','applied'),/Invalid governance import transition/);
  });
  it('uses canonical workspace selectors for SoA control relationships', () => {
    const page = fs.readFileSync(path.join(frontendRoot, 'pages/GovernanceApplicability.tsx'), 'utf8');
    const selector = fs.readFileSync(path.join(frontendRoot, 'components/SoaControlLinkSelector.tsx'), 'utf8');
    const controlSelector = fs.readFileSync(path.join(frontendRoot, 'components/GovernanceControlSelect.tsx'), 'utf8');
    assert.match(page, /<SoaControlLinkSelector/);
    assert.match(page, /<GovernanceControlSelect value=\{raciControlId\}/);
    assert.doesNotMatch(page, /name="(?:controlId|riskIds|policyIds|evidenceIds)"/);
    assert.ok(controlSelector.includes('/api/v1/controls'));
    for (const endpoint of ['/api/v1/risks', '/api/v1/governance-documents?docType=policy', '/api/v1/evidence']) assert.ok(selector.includes(endpoint));
    assert.match(selector, /sequence !== requestSequence\.current \|\| workspaceId !== currentWorkspace\.id/);
    assert.match(controlSelector, /sequence !== requestSequence\.current \|\| workspaceId !== currentWorkspace\.id/);
    assert.match(selector, /metadata is a governed reference and does not prove that a binary attachment is stored/);
  });
});
