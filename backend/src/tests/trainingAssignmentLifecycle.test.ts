import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  canTransitionTrainingAssignment,
  canTransitionAwarenessCampaign,
  isTrainingAssignmentStatus,
} from '../lib/trainingAssignmentLifecycle.js';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('training assignment lifecycle allows governed progress and completion', () => {
  assert.equal(canTransitionTrainingAssignment('assigned', 'in_progress'), true);
  assert.equal(canTransitionTrainingAssignment('in_progress', 'completed'), true);
  assert.equal(canTransitionTrainingAssignment('failed', 'refresher_required'), true);
  assert.equal(canTransitionTrainingAssignment('completed', 'in_progress'), false);
  assert.equal(canTransitionTrainingAssignment('cancelled', 'completed'), false);
  assert.equal(isTrainingAssignmentStatus('awaiting_acknowledgement'), true);
  assert.equal(isTrainingAssignmentStatus('deleted'), false);
  assert.equal(canTransitionAwarenessCampaign('planned', 'active'), true);
  assert.equal(canTransitionAwarenessCampaign('active', 'completed'), true);
  assert.equal(canTransitionAwarenessCampaign('completed', 'active'), false);
});

test('training assignment mutations enforce workspace membership, permissions and audit history', () => {
  const routes = read('src/routes/training.ts');
  const repository = read('src/repositories/trainingCoursesRepo.ts');

  assert.match(routes, /post\('\/assignments', requirePermission\('Training', 'create'\)/);
  assert.match(routes, /patch\('\/assignments\/:id\/status', requirePermission\('Training', 'edit'\)/);
  assert.match(routes, /getWorkspaceMembership\(userId, workspaceId\)/);
  assert.match(routes, /training_assignment_created/);
  assert.match(routes, /training_assignment_status_changed/);
  assert.match(routes, /post\('\/campaigns', requirePermission\('Training', 'create'\)/);
  assert.match(routes, /patch\('\/campaigns\/:id\/status', requirePermission\('Training', 'edit'\)/);
  assert.match(routes, /awareness_campaign_status_changed/);
  assert.match(repository, /workspace_id = \$1 AND id = \$2 FOR UPDATE/);
  assert.match(repository, /workspace_id = \$1 AND course_id = \$2 AND user_id = \$3/);
  assert.match(repository, /workspace_id = \$2 OR workspace_id IS NULL/);
});

test('training assignment UI uses reviewed real-record selection', () => {
  const page = read('../frontend/src/pages/Training.tsx');
  const modal = read('../frontend/src/components/TrainingAssignmentModal.tsx');
  const operations = read('../frontend/src/pages/TrainingOperationsPages.tsx');
  const pageStyles = read('../frontend/src/pages/Training.css');
  const campaignModal = read('../frontend/src/components/AwarenessCampaignModal.tsx');
  const awarenessLibrary = read('../frontend/src/pages/AwarenessLibrary.tsx');

  assert.match(page, /onAssignTraining/);
  assert.match(page, /TrainingAssignmentModal/);
  assert.match(modal, /workspaces\/\$\{currentWorkspace\.id\}\/members/);
  assert.match(modal, /Review and assign/);
  assert.match(modal, /does not send external notifications/);
  assert.match(operations, /assignments\/\$\{assignment\.id\}\/status/);
  assert.match(page, /AwarenessCampaignModal/);
  assert.match(page, /campaigns\/\$\{campaign\.id\}\/status/);
  assert.match(page, /className="training-page"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /title="Archive training course"/);
  assert.match(page, /Existing assignment and audit history is preserved/);
  assert.match(page, /role="alert"/);
  assert.match(page, /!response\.ok \|\| result\.error \|\| result\.data === null/);
  assert.match(page, /Missing data is not counted as zero/);
  assert.match(page, /!error \? \(/);
  assert.doesNotMatch(page, /console\.error\('Error fetching training data/);
  assert.doesNotMatch(page, /\b(confirm|alert)\(/);
  assert.match(pageStyles, /@media\(max-width:720px\)/);
  assert.match(campaignModal, /External delivery remains inactive/);
  assert.match(campaignModal, /accessibleDialog/);
  assert.match(awarenessLibrary, /const requestClose = \(\) => \{\s*if \(!isSubmitting\) onClose\(\);\s*\};/);
  assert.match(awarenessLibrary, /<Modal\s+accessibleDialog[\s\S]*onClose=\{requestClose\}/);
  assert.match(awarenessLibrary, /onClick=\{requestClose\} disabled=\{isSubmitting\}/);
  assert.match(awarenessLibrary, /role="alert"/);
  assert.match(awarenessLibrary, /repeat\(auto-fit, minmax\(220px, 1fr\)\)/);
  assert.match(operations, /className="training-operations__table"/);
  assert.doesNotMatch(modal, /sample|placeholder learner/i);
});
