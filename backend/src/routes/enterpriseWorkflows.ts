import { Router, type NextFunction, type Request, type Response } from 'express';
import { getWorkspaceMembership } from '../repositories/authRepo.js';
import * as workflowRepo from '../repositories/enterpriseWorkflowRepo.js';
import { resolveResponsibility } from '../repositories/governanceApplicabilityRepo.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import type { PermissionAction, PermissionModule } from '../types/accessGovernance.js';
import type { WorkflowStageDefinition } from '../types/enterpriseWorkflow.js';
import { assertWorkspaceLinks, type WorkspaceLinkType } from '../services/workspaceLinkValidation.js';
import { recordActivity, buildActivityFromRequest } from '../services/activityLedger/activityLedger.js';
import { validateDecisionPayload, validateTemplateConfiguration } from '../services/enterpriseWorkflowRules.js';

const router = Router();
const sourceLinks: Record<string, WorkspaceLinkType> = { risk: 'risks', treatment: 'riskTreatments', control: 'controls', evidence: 'evidence', policy: 'policies', supplier: 'vendors', vendor: 'vendors', ai_system: 'aiSystems', finding: 'findings', asset: 'assets' };

async function requireSourcePermission(req: Request, res: Response, next: NextFunction, moduleName: PermissionModule, action: PermissionAction) {
  return requirePermission(moduleName, action)(req, res, next);
}

router.get('/state', requirePermission('Dashboard', 'view'), async (req, res) => {
  try { res.json({ data: await workflowRepo.getState(req.authUser!.workspaceId, req.authUser!.userId, req.enterpriseRoleId || null), error: null }); }
  catch (error) { res.status(500).json({ data: null, error: { code: 'WORKFLOW_STATE_FAILED', message: error instanceof Error ? error.message : 'Failed to load workflows' } }); }
});

router.get('/my', requirePermission('Dashboard', 'view'), async (req, res) => {
  try { res.json({ data: await workflowRepo.getState(req.authUser!.workspaceId, req.authUser!.userId, req.enterpriseRoleId || null), error: null }); }
  catch (error) { res.status(500).json({ data: null, error: { code: 'MY_WORKFLOWS_FAILED', message: error instanceof Error ? error.message : 'Failed to load personal workflows' } }); }
});

router.get('/initiation-options/:templateId', async (req, res, next) => {
  const template = await workflowRepo.getTemplate(req.authUser!.workspaceId, req.params.templateId);
  if (!template || template.status !== 'active') return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Active workflow template not found' } });
  res.locals.workflowTemplate = template;
  return requireSourcePermission(req, res, next, template.sourceModule, 'view');
}, async (req, res) => {
  try {
    const template = res.locals.workflowTemplate as Awaited<ReturnType<typeof workflowRepo.getTemplate>>;
    const records = await workflowRepo.listWorkflowSourceOptions(req.authUser!.workspaceId, template!.sourceRecordType);
    res.json({ data: { template, records, defaultOwnerUserId: req.authUser!.userId }, error: null });
  } catch (error) { res.status(400).json({ data: null, error: { code: 'WORKFLOW_OPTIONS_FAILED', message: error instanceof Error ? error.message : 'Workflow source records could not be loaded' } }); }
});

router.patch('/notifications/:notificationId', requirePermission('Dashboard', 'edit'), async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['read', 'archived'].includes(status)) return res.status(400).json({ data: null, error: { code: 'INVALID_NOTIFICATION_STATUS', message: 'Notification status must be read or archived' } });
    const notification = await workflowRepo.updateNotificationStatus(req.authUser!.workspaceId, req.params.notificationId, req.authUser!.userId, req.enterpriseRoleId || null, status as 'read' | 'archived');
    await recordActivity(buildActivityFromRequest(req, { action: `workflow_notification_${status}`, category: 'system', targetType: 'workflow_notification', targetId: notification.id, targetName: notification.event_type, outcome: 'success', severity: 'info', source: 'backend' }));
    res.json({ data: notification, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'NOTIFICATION_UPDATE_REJECTED', message: error instanceof Error ? error.message : 'Notification update rejected' } }); }
});

router.post('/templates', requirePermission('Settings', 'configure'), async (req, res) => {
  try {
    const stages = Array.isArray(req.body?.stages) ? req.body.stages as WorkflowStageDefinition[] : [];
    const escalationRules = Array.isArray(req.body?.escalationRules) ? req.body.escalationRules : [];
    const notificationEvents = Array.isArray(req.body?.notificationEvents) ? req.body.notificationEvents : [];
    const sourceModule = req.body?.sourceModule as PermissionModule;
    const sourceRecordType = String(req.body?.sourceRecordType || '');
    validateTemplateConfiguration({ sourceModule, sourceRecordType, stages, escalationRules, notificationEvents });
    for (const userId of stages.flatMap((stage) => stage.assignedUserIds || [])) if (!await getWorkspaceMembership(userId, req.authUser!.workspaceId)) return res.status(400).json({ data: null, error: { code: 'INVALID_ASSIGNEE', message: 'One or more assigned reviewers are unavailable in this workspace' } });
    for (const userId of escalationRules.map((rule: { targetUserId?: string }) => rule.targetUserId).filter(Boolean)) if (!await getWorkspaceMembership(String(userId), req.authUser!.workspaceId)) return res.status(400).json({ data: null, error: { code: 'INVALID_ESCALATION_TARGET', message: 'One or more escalation recipients are unavailable in this workspace' } });
    const template = await workflowRepo.createTemplate(req.authUser!.workspaceId, req.authUser!.userId, { name: String(req.body?.name || ''), sourceModule, sourceRecordType, stages, escalationRules, notificationEvents, status: req.body?.status || 'draft' });
    await recordActivity(buildActivityFromRequest(req, { action: 'workflow_template_created', category: 'system', targetType: 'workflow_template', targetId: template.id, targetName: template.name, outcome: 'success', severity: 'medium', source: 'backend', notes: `Version ${template.version} created as ${template.status} for ${template.sourceModule}:${template.sourceRecordType}` }));
    res.status(201).json({ data: template, error: null });
  } catch (error) { res.status(400).json({ data: null, error: { code: 'WORKFLOW_TEMPLATE_INVALID', message: error instanceof Error ? error.message : 'Invalid workflow template' } }); }
});

router.patch('/templates/:templateId/status', requirePermission('Settings', 'configure'), async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ data: null, error: { code: 'INVALID_TEMPLATE_STATUS', message: 'Template status must be active or inactive' } });
    const template = await workflowRepo.setTemplateStatus(req.authUser!.workspaceId, req.params.templateId, status as 'active' | 'inactive');
    await recordActivity(buildActivityFromRequest(req, { action: `workflow_template_${status}`, category: 'system', targetType: 'workflow_template', targetId: template.id, targetName: template.name, outcome: 'success', severity: 'medium', source: 'backend', notes: `Version ${template.version}` }));
    res.json({ data: template, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'TEMPLATE_STATUS_REJECTED', message: error instanceof Error ? error.message : 'Template status update rejected' } }); }
});

router.post('/', async (req, res, next) => {
  const template = await workflowRepo.getTemplate(req.authUser!.workspaceId, String(req.body?.templateId || ''));
  if (!template) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Workflow template not found' } });
  return requireSourcePermission(req, res, next, template.sourceModule, 'create');
}, async (req, res) => {
  try {
    const template = await workflowRepo.getTemplate(req.authUser!.workspaceId, String(req.body?.templateId || ''));
    const linkType = template ? sourceLinks[template.sourceRecordType] : undefined;
    if (!linkType) return res.status(400).json({ data: null, error: { code: 'UNSUPPORTED_SOURCE', message: 'Unsupported workflow source record type' } });
    const sourceRecordId = String(req.body?.sourceRecordId || '');
    await assertWorkspaceLinks(req.authUser!.workspaceId, { [linkType]: [sourceRecordId] });
    if (!await getWorkspaceMembership(String(req.body?.ownerUserId || ''), req.authUser!.workspaceId)) return res.status(400).json({ data: null, error: { code: 'INVALID_OWNER', message: 'Workflow owner is unavailable in this workspace' } });
    const ownerUserId = String(req.body.ownerUserId);
    const sourceOption = (await workflowRepo.listWorkflowSourceOptions(req.authUser!.workspaceId, template!.sourceRecordType)).find((item) => item.id === sourceRecordId);
    if (!sourceOption) return res.status(400).json({ data: null, error: { code: 'INVALID_SOURCE', message: 'Workflow source record is unavailable' } });
    const ownershipRecommendation = req.body?.controlId
      ? await resolveResponsibility(req.authUser!.workspaceId, String(req.body.controlId), req.body?.scopeId ? String(req.body.scopeId) : undefined, req.body?.location ? String(req.body.location) : undefined)
      : null;
    const workflow = await workflowRepo.createWorkflow(req.authUser!.workspaceId, req.authUser!.userId, { ...req.body, sourceRecordId, sourceRecordReference: sourceOption.reference, ownerUserId });
    await recordActivity(buildActivityFromRequest(req, { action: 'workflow_created', category: 'system', targetType: 'workflow', targetId: workflow.id, targetName: workflow.name, outcome: 'success', severity: 'medium', source: 'backend', notes: `Source ${workflow.sourceRecordType}:${workflow.sourceRecordId}` }));
    res.status(201).json({ data: { ...workflow, ownershipRecommendation }, error: null });
  } catch (error) { res.status(400).json({ data: null, error: { code: 'WORKFLOW_CREATE_FAILED', message: error instanceof Error ? error.message : 'Failed to create workflow' } }); }
});

router.post('/:workflowId/submit', async (req, res, next) => {
  const workflow = await workflowRepo.getWorkflow(req.authUser!.workspaceId, req.params.workflowId);
  if (!workflow) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Workflow not found' } });
  return requireSourcePermission(req, res, next, workflow.sourceModule, 'edit');
}, async (req, res) => {
  try {
    const workflow = await workflowRepo.submitWorkflow(req.authUser!.workspaceId, req.params.workflowId, req.authUser!.userId);
    await recordActivity(buildActivityFromRequest(req, { action: 'workflow_submitted', category: 'system', targetType: 'workflow', targetId: req.params.workflowId, targetName: workflow?.name, outcome: 'success', severity: 'medium', source: 'backend' }));
    res.json({ data: workflow, error: null });
  }
  catch (error) { res.status(409).json({ data: null, error: { code: 'WORKFLOW_SUBMIT_FAILED', message: error instanceof Error ? error.message : 'Failed to submit workflow' } }); }
});

router.post('/assignments/:assignmentId/decision', async (req, res, next) => {
  const state = await workflowRepo.getState(req.authUser!.workspaceId);
  const assignment = state.assignments.find((item) => item.id === req.params.assignmentId);
  const workflow = assignment ? state.workflows.find((item) => item.id === assignment.workflowId) : undefined;
  if (!workflow) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Workflow assignment not found' } });
  return requireSourcePermission(req, res, next, workflow.sourceModule, 'approve');
}, async (req, res) => {
  try {
    const payload = validateDecisionPayload(req.body?.decision, req.body?.comments, req.body?.supportingEvidenceIds ?? []);
    if (payload.evidenceIds.length) await assertWorkspaceLinks(req.authUser!.workspaceId, { evidence: payload.evidenceIds });
    const result = await workflowRepo.decideAssignment(req.authUser!.workspaceId, req.params.assignmentId, req.authUser!.userId, req.enterpriseRoleId || null, payload.decision, payload.comments, payload.evidenceIds);
    await recordActivity(buildActivityFromRequest(req, { action: `workflow_${payload.decision}`, category: 'system', targetType: 'workflow', targetId: result.workflowId, outcome: payload.decision === 'reject' ? 'blocked' : 'success', severity: 'high', source: 'backend', notes: payload.comments }));
    res.json({ data: result, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'WORKFLOW_DECISION_REJECTED', message: error instanceof Error ? error.message : 'Decision rejected' } }); }
});

router.post('/assignments/:assignmentId/acknowledge', requirePermission('Dashboard', 'edit'), async (req, res) => {
  try { res.json({ data: await workflowRepo.acknowledgeAssignment(req.authUser!.workspaceId, req.params.assignmentId, req.authUser!.userId), error: null }); }
  catch (error) { res.status(409).json({ data: null, error: { code: 'ACKNOWLEDGEMENT_REJECTED', message: error instanceof Error ? error.message : 'Acknowledgement rejected' } }); }
});

router.post('/assignments/:assignmentId/:operation(delegate|reassign)', requirePermission('Settings', 'configure'), async (req, res) => {
  try {
    const targetUserId = String(req.body?.targetUserId || '');
    if (!await getWorkspaceMembership(targetUserId, req.authUser!.workspaceId)) return res.status(400).json({ data: null, error: { code: 'INVALID_ASSIGNEE', message: 'Target user is unavailable in this workspace' } });
    const data = await workflowRepo.reassignAssignment(req.authUser!.workspaceId, req.params.assignmentId, req.authUser!.userId, targetUserId, req.params.operation === 'delegate');
    await recordActivity(buildActivityFromRequest(req, { action: req.params.operation === 'delegate' ? 'workflow_assignment_delegated' : 'workflow_assignment_reassigned', category: 'system', targetType: 'workflow_assignment', targetId: data.id, targetName: data.workflowId, outcome: 'success', severity: 'medium', source: 'backend', notes: `Assigned to authorised workspace member ${targetUserId}` }));
    res.json({ data, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'ASSIGNMENT_UPDATE_REJECTED', message: error instanceof Error ? error.message : 'Assignment update rejected' } }); }
});

router.post('/:workflowId/cancel', requirePermission('Dashboard', 'delete'), async (req, res) => {
  try {
    const rationale = String(req.body?.rationale || '');
    const data = await workflowRepo.cancelWorkflow(req.authUser!.workspaceId, req.params.workflowId, req.authUser!.userId, rationale);
    await recordActivity(buildActivityFromRequest(req, { action: 'workflow_cancelled', category: 'system', targetType: 'workflow', targetId: data.id, targetName: data.name, outcome: 'success', severity: 'high', source: 'backend', notes: rationale.trim() }));
    res.json({ data, error: null });
  }
  catch (error) { res.status(409).json({ data: null, error: { code: 'WORKFLOW_CANCEL_REJECTED', message: error instanceof Error ? error.message : 'Cancellation rejected' } }); }
});

router.post('/:workflowId/publish-source', requirePermission('Policies', 'approve'), async (req, res) => {
  try {
    const result = await workflowRepo.publishApprovedPolicy(req.authUser!.workspaceId, req.params.workflowId, req.authUser!.userId);
    if (result.changed) await recordActivity(buildActivityFromRequest(req, { action: 'policy_published', category: 'policy', targetType: 'governance_document', targetId: result.documentId, outcome: 'success', severity: 'high', source: 'backend', notes: `Published through approved workflow ${result.workflowId}` }));
    res.json({ data: result, error: null });
  } catch (error) { res.status(409).json({ data: null, error: { code: 'SOURCE_PUBLICATION_REJECTED', message: error instanceof Error ? error.message : 'Source publication rejected' } }); }
});

router.post('/escalations/evaluate', requirePermission('Settings', 'configure'), async (req, res) => {
  try { res.json({ data: await workflowRepo.escalateOverdue(req.authUser!.workspaceId, req.authUser!.userId), error: null }); }
  catch (error) { res.status(409).json({ data: null, error: { code: 'ESCALATION_FAILED', message: error instanceof Error ? error.message : 'Escalation evaluation failed' } }); }
});

export default router;
