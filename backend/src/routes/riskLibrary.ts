import { Router } from 'express';
import { getWorkspaceId } from '../workspace.js';
import * as repo from '../repositories/riskLibraryRepo.js';
import { recordActivity, buildActivityFromRequest } from '../services/activityLedger/activityLedger.js';

const router = Router();
const statuses = new Set(['draft', 'active', 'archived']);
const categories = new Set(['information_security', 'privacy', 'vendor', 'operational', 'compliance', 'strategic']);
const cia = new Set(['Confidentiality', 'Integrity', 'Availability']);
const scenarioTypes = new Set(['event_based', 'asset_based']);

router.use((req, res, next) => {
  if (!req.authUser) return res.status(401).json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  if (getWorkspaceId(req) !== req.authUser.workspaceId) return res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Workspace does not match the authenticated session' } });
  next();
});

export function validateRiskLibraryInput(input: any, partial = false) {
  if (!partial && (!String(input.title || '').trim() || !String(input.category || '').trim())) return 'Title and category are required';
  if (input.category !== undefined && !categories.has(input.category)) return 'Invalid risk category';
  if (input.status !== undefined && !statuses.has(input.status)) return 'Invalid template status';
  if (input.scenarioType !== undefined && !scenarioTypes.has(input.scenarioType)) return 'Invalid scenario type';
  if (input.suggestedCiaImpacts !== undefined && (!Array.isArray(input.suggestedCiaImpacts) || input.suggestedCiaImpacts.some((value: unknown) => typeof value !== 'string' || !cia.has(value)))) return 'Invalid CIA impact';
  for (const key of ['suggestedInherentLikelihood', 'suggestedInherentImpact']) {
    if (input[key] != null && (!Number.isInteger(input[key]) || input[key] < 1 || input[key] > 10)) return `${key} must be an integer from 1 to 10`;
  }
  return null;
}

router.get('/', async (req, res) => {
  try {
    const workspaceId=getWorkspaceId(req);
    await repo.seedRiskLibraryDefaults(workspaceId);
    res.json({ data: await repo.list(workspaceId, { search: String(req.query.search || ''), status: String(req.query.status || ''), category: String(req.query.category || '') }), error: null });
  }
  catch (error) { res.status(500).json({ data: null, error: { code: 'RISK_LIBRARY_LIST_FAILED', message: error instanceof Error ? error.message : 'Unable to load Risk Library' } }); }
});

router.get('/:id', async (req, res) => {
  const item = await repo.get(getWorkspaceId(req), req.params.id);
  if (!item) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Risk template not found' } });
  res.json({ data: item, error: null });
});

router.post('/', async (req, res) => {
  const error = validateRiskLibraryInput(req.body);
  if (error) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: error } });
  const item = await repo.create(getWorkspaceId(req), req.authUser!.email, req.body);
  await recordActivity(buildActivityFromRequest(req, { action: 'risk_library_template_created', category: 'risk', targetType: 'risk_library_template', targetId: item.id, targetName: item.title, newValue: item, outcome: 'success', severity: 'info', source: 'backend' }));
  res.status(201).json({ data: item, error: null });
});

router.patch('/:id', async (req, res) => {
  const error = validateRiskLibraryInput(req.body, true);
  if (error) return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: error } });
  const previous = await repo.get(getWorkspaceId(req), req.params.id);
  if (!previous) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Risk template not found' } });
  const item = await repo.update(getWorkspaceId(req), req.params.id, req.authUser!.email, req.body);
  await recordActivity(buildActivityFromRequest(req, { action: req.body.status === 'archived' ? 'risk_library_template_archived' : 'risk_library_template_updated', category: 'risk', targetType: 'risk_library_template', targetId: req.params.id, targetName: item!.title, previousValue: previous, newValue: item, outcome: 'success', severity: 'info', source: 'backend' }));
  if (req.body.suggestedControls !== undefined || req.body.relatedControlIds !== undefined) {
    await recordActivity(buildActivityFromRequest(req, { action: 'risk_library_controls_changed', category: 'risk', targetType: 'risk_library_template', targetId: req.params.id, targetName: item!.title, previousValue: { suggestedControls: previous.suggestedControls, relatedControlIds: previous.relatedControlIds }, newValue: { suggestedControls: item!.suggestedControls, relatedControlIds: item!.relatedControlIds }, outcome: 'success', severity: 'info', source: 'backend' }));
  }
  if (req.body.relatedFrameworks !== undefined) {
    await recordActivity(buildActivityFromRequest(req, { action: 'risk_library_framework_mapping_changed', category: 'risk', targetType: 'risk_library_template', targetId: req.params.id, targetName: item!.title, previousValue: { relatedFrameworks: previous.relatedFrameworks }, newValue: { relatedFrameworks: item!.relatedFrameworks }, outcome: 'success', severity: 'info', source: 'backend' }));
  }
  res.json({ data: item, error: null });
});

router.post('/:id/record-use', async (req, res) => {
  const item = await repo.recordUse(getWorkspaceId(req), req.params.id);
  if (!item) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Risk template not found' } });
  await recordActivity(buildActivityFromRequest(req, { action: 'risk_created_from_template', category: 'risk', targetType: 'risk_library_template', targetId: item.id, targetName: item.title, newValue: { riskId: req.body?.riskId || null, libraryRiskId: item.libraryRiskId }, outcome: 'success', severity: 'info', source: 'backend' }));
  res.json({ data: item, error: null });
});

export default router;
