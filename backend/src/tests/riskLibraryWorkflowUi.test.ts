import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const page = readFileSync(resolve(process.cwd(), '../frontend/src/pages/RiskLibrary.tsx'), 'utf8');

test('risk library mutations share one synchronous operation lock', () => {
  assert.match(page, /const mutationLock=useRef\(false\)/);
  assert.match(page, /const beginMutation=.*if\(mutationLock\.current\)return false/);
  assert.match(page, /mutationLock\.current=true/);
  assert.match(page, /const finishMutation=.*sequence===mutationSequence\.current.*mutationLock\.current=false/);
  assert.equal((page.match(/beginMutation\('(?:template|edit|archive|risk)'\)/g) || []).length, 4);
  assert.match(page, /onClose=\{closeCreate\}/);
  assert.match(page, /onClose=\{closeEdit\}/);
  assert.match(page, /onClose=\{closeRisk\}/);
  assert.equal((page.match(/<fieldset className="riskLibraryCreate" disabled=/g) || []).length, 2);
});

test('create-risk partial success cannot produce a duplicate live risk', () => {
  assert.match(page, /payload=JSON\.stringify\(riskDraft\)/);
  assert.match(page, /setSource\(null\);setRiskDraft\(null\);try\{await recordRiskLibraryUse/);
  assert.match(page, /was created, but the Risk Library usage count could not be updated/);
  assert.match(page, /catch\(e\)\{if\(sequence===mutationSequence\.current&&workspaceIdRef\.current===requestedWorkspaceId\)setMutationError\(e instanceof Error\?e\.message:'Unable to create the reviewed risk\.'/);
});

test('risk library binds reads, preparation and mutations to the active workspace', () => {
  assert.match(page, /const \{currentWorkspace\}=useWorkspace\(\)/);
  assert.match(page, /loadSequence=useRef\(0\),preparationSequence=useRef\(0\),mutationSequence=useRef\(0\)/);
  assert.match(page, /const sequence=\+\+loadSequence\.current,requestedWorkspaceId=workspaceIdRef\.current/);
  assert.match(page, /\[currentWorkspace\.id,load\]/);
  assert.match(page, /setItems\(\[\]\);setSelectedId\(null\);setCreating\(false\);setEditingId\(null\);setSource\(null\)/);
  assert.match(page, /const sequence=\+\+preparationSequence\.current,requestedWorkspaceId=workspaceIdRef\.current/);
  assert.equal((page.match(/sequence=\+\+mutationSequence\.current,requestedWorkspaceId=workspaceIdRef\.current/g) || []).length, 4);
  assert.match(page, /if\(sequence!==mutationSequence\.current\|\|workspaceIdRef\.current!==requestedWorkspaceId\)return;const riskRef/);
  assert.match(page, /finishMutation\(sequence,requestedWorkspaceId\)/);
});

test('template writes snapshot reviewed input and retain failed editors', () => {
  assert.equal((page.match(/JSON\.parse\(JSON\.stringify\(draft\)\) as RiskLibraryTemplateInput/g) || []).length, 2);
  assert.match(page, /Unable to create the risk template/);
  assert.match(page, /Unable to update the risk template/);
  assert.match(page, /role="alert">\{mutationError\}/);
});

test('summary KPIs apply restorable scenario scopes and expose the result set', () => {
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /parseQuickFilter\(searchParams\.get\('view'\)\)/);
  assert.match(page, /next\.set\('view',filter\)/);
  assert.match(page, /quickFilter!==\'framework_mapped\'\|\|item\.relatedFrameworks\.length>0/);
  assert.match(page, /quickFilter!==\'control_mapped\'\|\|item\.relatedControlIds\.length>0/);
  assert.match(page, /quickFilter!==\'recent\'\|\|Date\.now\(\)-new Date\(item\.createdAt\)\.getTime\(\)<30\*86400000/);
  assert.match(page, /resultsRef\.current\?\.scrollIntoView/);
  assert.match(page, /Viewing: \{activeSummaryLabel\}/);
});

test('unavailable usage KPI is not presented as an actionable filter', () => {
  assert.match(page, /const unavailable=metric\.key===\'most_used\'&&!mostUsedCategory/);
  assert.match(page, /disabled=\{unavailable\}/);
  assert.match(page, /No filter is available/);
});
