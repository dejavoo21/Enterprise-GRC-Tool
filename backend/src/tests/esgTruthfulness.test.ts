import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateEsgInput } from '../services/esgValidation.js';

test('ESG entry actions do not create synthetic production records', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/EsgManagement.tsx'), 'utf8');
  assert.doesNotMatch(page, /Date\.now\(\)\.toString\(\)\.slice/);
  assert.doesNotMatch(page, /Renewable energy coverage|Strategic supplier|ESG compliance deviation/);
  assert.equal((page.match(/setEntryKind\('/g) || []).length, 10);
  assert.match(page, /No persisted environmental, social, governance, carbon, supplier, or reporting records are available/);
  assert.match(page, /role="status"/);
});

test('ESG entry uses reviewed accessible forms for every supported record class', () => {
  const modal = readFileSync(resolve(process.cwd(), '../frontend/src/components/EsgEntryModal.tsx'), 'utf8');
  assert.match(modal, /export type EsgEntryKind = 'environmental' \| 'carbon' \| 'social' \| 'governance' \| 'risk' \| 'kpi' \| 'target' \| 'supplier' \| 'incident'/);
  assert.equal((modal.match(/case '/g) || []).length, 9);
  assert.match(modal, /<Modal accessibleDialog/);
  assert.match(modal, /const submitLock = useRef\(false\)/);
  assert.match(modal, /if \(submitLock\.current\) return/);
  assert.match(modal, /submitLock\.current = false/);
  assert.match(modal, /if \(!saving && !submitLock\.current\) onClose\(\)/);
  assert.match(modal, /<fieldset className="esgEntryFields" disabled=\{saving\} aria-busy=\{saving\}>/);
  assert.match(modal, /No owner, score, assessment, relationship, or assurance result is inferred/);
  assert.match(modal, /role="alert"/);
  assert.match(modal, /await onSaved/);
});

test('ESG reporting remains backed by the persisted report endpoint', () => {
  const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/EsgManagement.tsx'), 'utf8');
  assert.match(page, /generateEsgReport\(reportType\)/);
  assert.match(page, /handleAction\('report-csrd'/);
  assert.match(page, /handleAction\('report-esg'/);
});

test('ESG reads and startup do not create schema or sample business records', () => {
  const repository = readFileSync(resolve(process.cwd(), 'src/repositories/esgRepo.ts'), 'utf8');
  const startup = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'sql/migrations/20261125-esg-management-schema.sql'), 'utf8');
  assert.doesNotMatch(repository, /seedEsgDefaults|ensureEsgSchema|CREATE TABLE/);
  assert.doesNotMatch(startup, /ensureEsgSchema/);
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS esg_/g) || []).length, 14);
  assert.match(migration, /Additive only; no seed or business records/);
});

test('ESG writes require explicit reviewed values and preserve numeric zero', () => {
  assert.deepEqual(validateEsgInput('/risks', {}), [
    'title is required', 'category is required', 'severity is required', 'status is required',
    'owner is required', 'riskScore is required', 'mitigation is required',
  ]);
  assert.deepEqual(validateEsgInput('/risks', {
    title: 'Reviewed risk', category: 'climate', severity: 'low', status: 'identified',
    owner: 'Risk owner', riskScore: 0, mitigation: 'Monitor the recorded exposure.',
  }), []);
  assert.match(validateEsgInput('/targets', {
    targetName: 'Target', category: 'reduction', unit: '%', targetValue: 0, currentValue: 0,
    dueDate: 'not-a-date', owner: 'Owner', status: 'planned',
  }).join(' '), /dueDate must be a valid date/);
});
