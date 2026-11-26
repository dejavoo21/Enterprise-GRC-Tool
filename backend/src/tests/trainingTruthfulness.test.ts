import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('training completion stays unavailable until assignments exist', () => {
  const route = read('src/routes/training.ts');
  const boardRoute = read('src/routes/boardReports.ts');
  const repository = read('src/repositories/riskIntelligenceRepo.ts');
  const intelligence = read('src/services/riskIntelligenceService.ts');

  assert.match(route, /totalAssignments > 0[\s\S]*: null/);
  assert.match(boardRoute, /totalAssignments > 0[\s\S]*: null/);
  assert.doesNotMatch(repository, /COALESCE\(AVG\(CASE WHEN status IN \('completed'/);
  assert.match(repository, /completion_rate == null \? null/);
  assert.match(intelligence, /kri\.name !== 'Training Completion' \|\| trainingSignal\.completionRate !== null/);
});

test('training UI distinguishes zero results from unavailable evidence', () => {
  const repository = read('src/repositories/trainingCoursesRepo.ts');
  const page = read('../frontend/src/pages/Training.tsx');
  const dashboard = read('../frontend/src/pages/Dashboard.tsx');

  assert.match(repository, /click_rate == null \? undefined : parseFloat\(row\.click_rate\)/);
  assert.match(page, /clickRate === undefined \? 'Not assessed'/);
  assert.match(page, /overallCompletionRate === null \? 'Not assessed'/);
  assert.match(page, /course\.completionRate == null \? 'Not assessed'/);
  assert.match(dashboard, /formatOptionalPercent/);
  assert.match(dashboard, /const trainingTrendPoints = useMemo<TrendPoint\[\]>\(\(\) => \[\], \[\]\)/);
  assert.doesNotMatch(dashboard, /buildFlatTrend\(effectiveTrainingSummary\.overallCompletionRate/);
});

test('training workspace reads and mutation results reject stale responses', () => {
  const page = read('../frontend/src/pages/Training.tsx');
  assert.match(page, /const requestSequence = useRef\(0\)/);
  assert.match(page, /const requestedWorkspaceId = currentWorkspaceIdRef\.current/);
  assert.match(page, /sequence !== requestSequence\.current \|\| requestedWorkspaceId !== currentWorkspaceIdRef\.current/);
  assert.match(page, /\[currentWorkspace\.id, fetchData\]/);
  assert.match(page, /return \(\) => \{ sequenceRef\.current\+\+; \}/);
  assert.match(page, /setEditingCourse\(null\)/);
  assert.match(page, /setArchiveCourse\(null\)/);
  assert.match(page, /stateWorkspaceId !== currentWorkspace\.id/);
  assert.match(page, /headers: \{ 'X-Workspace-Id': requestedWorkspaceId \}/);
  assert.match(page, /if \(sequence === archiveSequence\.current && requestedWorkspaceId === currentWorkspaceIdRef\.current\) \{\s*setArchiveError/);
  assert.match(page, /if \(sequence === campaignTransitionSequence\.current && requestedWorkspaceId === currentWorkspaceIdRef\.current\) \{\s*setError/);
});

test('training operational queues reject stale workspace responses', () => {
  const page = read('../frontend/src/pages/TrainingOperationsPages.tsx');
  assert.match(page, /import \{ useWorkspace \} from '\.\.\/context\/WorkspaceContext'/);
  assert.equal((page.match(/const \{ currentWorkspace \} = useWorkspace\(\)/g) || []).length, 3);
  assert.equal((page.match(/const requestSequence = useRef\(0\)/g) || []).length, 3);
  assert.equal((page.match(/requestedWorkspaceId !== currentWorkspaceIdRef\.current/g) || []).length, 3);
  assert.match(page, /\[currentWorkspace\.id, loadAssignments\]/);
  assert.match(page, /\[currentWorkspace\.id, loadRecords\]/);
  assert.match(page, /\[currentWorkspace\.id, loadCampaigns\]/);
  assert.equal((page.match(/setStateWorkspaceId\(''\)/g) || []).length, 3);
  assert.equal((page.match(/stateWorkspaceId === currentWorkspace\.id/g) || []).length, 6);
  assert.match(page, /'Content-Type': 'application\/json', 'X-Workspace-Id': requestedWorkspaceId/);
  assert.match(page, /if \(sequence === transitionSequence\.current && requestedWorkspaceId === currentWorkspaceIdRef\.current\) await loadAssignments\(\)/);
});

test('training KPI and engagement views reject stale workspace responses', () => {
  const kpis = read('../frontend/src/pages/TrainingKpis.tsx');
  const engagements = read('../frontend/src/pages/TrainingEngagements.tsx');
  for (const page of [kpis, engagements]) {
    assert.match(page, /const \[stateWorkspaceId, setStateWorkspaceId\] = useState\(''\)/);
    assert.match(page, /const requestSequence = useRef\(0\)/);
    assert.match(page, /const requestedWorkspaceId = currentWorkspaceIdRef\.current/);
    assert.match(page, /sequence !== requestSequence\.current \|\| requestedWorkspaceId !== currentWorkspaceIdRef\.current/);
    assert.match(page, /if \(requestedWorkspaceId !== currentWorkspaceIdRef\.current\) return/);
    assert.match(page, /stateWorkspaceId !== currentWorkspace\.id/);
  }
  assert.match(kpis, /setSelectedEngagementId\(''\)/);
  assert.match(kpis, /setIsModalOpen\(false\)/);
  assert.match(kpis, /\[currentWorkspace\.id\]/);
  assert.match(engagements, /setSelectedEngagement\(null\)/);
  assert.match(engagements, /\[currentWorkspace\.id, fetchData\]/);
});

test('training reports and narratives preserve missing measurement states', () => {
  const reporting = read('src/services/reportingCenterService.ts');
  const exportService = read('src/services/boardReportExportService.ts');
  const assistant = read('src/services/aiAssistantService.ts');
  const prompts = read('src/services/promptLibrary.ts');

  assert.match(reporting, /Training completion is not assessed/);
  assert.match(reporting, /no recorded phishing simulation result is available/);
  assert.match(exportService, /'Not assessed'/);
  assert.match(prompts, /'Not assessed'/);
  assert.doesNotMatch(assistant, /Training completion has not been assessed/);
  assert.doesNotMatch(assistant, /Stub mode or fallback/);
});

test('enterprise posture excludes absent training evidence from its weighting', () => {
  const engine = read('../frontend/src/services/grcEngine/riskEngine.ts');
  assert.match(engine, /trainingScore === null \? weights\.trainingScore : 0/);
  assert.doesNotMatch(engine, /completionScore \?\? 75/);
});

test('training entry workflows reject duplicate requests and lock captured values', () => {
  const assignment = read('../frontend/src/components/TrainingAssignmentModal.tsx');
  const campaign = read('../frontend/src/components/AwarenessCampaignModal.tsx');
  const course = read('../frontend/src/components/TrainingCourseModal.tsx');
  const library = read('../frontend/src/pages/AwarenessLibrary.tsx');
  const engagement = read('../frontend/src/pages/TrainingEngagements.tsx');
  const kpi = read('../frontend/src/pages/TrainingKpis.tsx');
  for (const modal of [assignment, campaign]) {
    assert.match(modal, /const submitLock = useRef\(false\)/);
    assert.match(modal, /if \(submitLock\.current\) return;/);
    assert.match(modal, /submitLock\.current = false/);
    assert.match(modal, /<fieldset disabled=\{saving\} aria-busy=\{saving\}/);
  }
  assert.match(course, /const submitLock = useRef\(false\)/);
  assert.match(course, /if \(submitLock\.current\) return;/);
  assert.match(course, /submitLock\.current = false/);
  assert.match(course, /<fieldset disabled=\{isSubmitting\}/);
  assert.match(library, /const submitLock = useRef\(false\)/);
  assert.match(library, /if \(submitLock\.current\) return;/);
  assert.match(library, /submitLock\.current = false/);
  assert.match(library, /<fieldset disabled=\{isSubmitting\} aria-busy=\{isSubmitting\}/);
  for (const entry of [engagement, kpi]) {
    assert.match(entry, /const submitLock = useRef\(false\)/);
    assert.match(entry, /if \(submitLock\.current\) return;/);
    assert.match(entry, /submitLock\.current = false/);
    assert.match(entry, /<fieldset disabled=\{isSubmitting\} aria-busy=\{isSubmitting\}/);
  }
});
