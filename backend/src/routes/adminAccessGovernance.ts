import { Request, Response, Router } from 'express';
import * as repo from '../repositories/accessGovernanceRepo.js';
import {
  buildAccessReviewEvidence,
  defaultPermissionMatrix,
  flattenPermissionMatrix,
  getAccessGovernanceState,
} from '../services/accessGovernanceService.js';
import { appendGovernanceAuditLog, buildGovernanceAuditFromRequest } from '../services/governanceAuditService.js';
import { requireModulePermissions, requireStepUp } from '../middleware/permissionMiddleware.js';

const router = Router();

router.use(requireModulePermissions('Users', {
  GET: 'view',
  POST: 'create',
  PATCH: 'edit',
  DELETE: 'delete',
}));

router.get('/state', async (req: Request, res: Response) => {
  try {
    const state = await getAccessGovernanceState(req.authUser!.workspaceId);
    return res.json({ data: state, error: null });
  } catch (error) {
    console.error('Fetch governance state error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load access governance state' } });
  }
});

router.get('/roles', async (req: Request, res: Response) => {
  try {
    const roles = await repo.listRoles(req.authUser!.workspaceId);
    return res.json({ data: roles, error: null });
  } catch (error) {
    console.error('List roles error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load roles' } });
  }
});

router.post('/roles', async (req: Request, res: Response) => {
  try {
    const role = await repo.createRole(req.authUser!.workspaceId, req.body);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'role_created',
      targetType: 'role',
      targetId: role.id,
      targetName: role.name,
      previousValue: null,
      newValue: role.name,
      outcome: 'Created',
      notes: role.description,
    }));
    return res.status(201).json({ data: role, error: null });
  } catch (error) {
    console.error('Create role error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to create role' } });
  }
});

router.patch('/roles/:id', async (req: Request, res: Response) => {
  try {
    const updated = await repo.updateRole(req.authUser!.workspaceId, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Role not found' } });
    }
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'role_updated',
      targetType: 'role',
      targetId: updated.id,
      targetName: updated.name,
      previousValue: null,
      newValue: updated.name,
      outcome: 'Updated',
      notes: updated.description,
    }));
    return res.json({ data: updated, error: null });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update role' } });
  }
});

router.post('/roles/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const duplicated = await repo.duplicateRole(req.authUser!.workspaceId, req.params.id);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'role_duplicated',
      targetType: 'role',
      targetId: duplicated.id,
      targetName: duplicated.name,
      previousValue: req.params.id,
      newValue: duplicated.name,
      outcome: 'Duplicated',
      notes: 'Role duplicated from existing template.',
    }));
    return res.status(201).json({ data: duplicated, error: null });
  } catch (error) {
    console.error('Duplicate role error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to duplicate role' } });
  }
});

router.post('/roles/:id/disable', async (req: Request, res: Response) => {
  try {
    const role = await repo.updateRole(req.authUser!.workspaceId, req.params.id, { status: 'disabled' });
    if (!role) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Role not found' } });
    }
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'role_disabled',
      targetType: 'role',
      targetId: role.id,
      targetName: role.name,
      previousValue: 'active',
      newValue: 'disabled',
      outcome: 'Disabled',
      notes: 'Role disabled by admin action.',
    }));
    return res.json({ data: role, error: null });
  } catch (error) {
    console.error('Disable role error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to disable role' } });
  }
});

router.get('/permissions', async (req: Request, res: Response) => {
  try {
    const permissions = await repo.listRolePermissions(req.authUser!.workspaceId);
    return res.json({ data: permissions, error: null });
  } catch (error) {
    console.error('List permissions error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load permissions' } });
  }
});

router.patch('/permissions', requireStepUp('change_permissions'), async (req: Request, res: Response) => {
  try {
    const permissionMatrix = req.body?.resetToDefault ? defaultPermissionMatrix() : req.body.permissionMatrix || {};
    await repo.replaceRolePermissions(
      req.authUser!.workspaceId,
      flattenPermissionMatrix(req.authUser!.workspaceId, permissionMatrix),
    );
    await repo.recomputeSodConflicts(req.authUser!.workspaceId);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'permission_changed',
      targetType: 'permission_matrix',
      targetId: req.authUser!.workspaceId,
      targetName: 'Permission Matrix',
      previousValue: null,
      newValue: 'Updated',
      outcome: 'Saved',
      notes: 'Permission matrix updated.',
    }));
    return res.json({ data: await repo.listRolePermissions(req.authUser!.workspaceId), error: null });
  } catch (error) {
    console.error('Update permissions error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update permissions' } });
  }
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await repo.listUsers(req.authUser!.workspaceId), error: null });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load users' } });
  }
});

router.patch('/users/:id/role', requireStepUp('assign_admin_role'), async (req: Request, res: Response) => {
  try {
    const { roleId } = req.body as { roleId: string };
    if (!roleId) {
      return res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'roleId is required' } });
    }
    const user = await repo.assignUserRole(req.authUser!.workspaceId, req.params.id, roleId as any);
    await repo.recomputeSodConflicts(req.authUser!.workspaceId);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'role_assigned',
      targetType: 'user',
      targetId: req.params.id,
      targetName: user?.fullName,
      previousValue: null,
      newValue: user?.assignedRoleName || roleId,
      outcome: 'Assigned',
      notes: user?.accessScope || null,
    }));
    return res.json({ data: user, error: null });
  } catch (error) {
    console.error('Assign role error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update user role' } });
  }
});

router.patch('/users/:id/status', requireStepUp('revoke_access'), async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body as { status: 'active' | 'pending' | 'suspended' | 'revoked'; notes?: string };
    const user = await repo.updateUserStatus(req.authUser!.workspaceId, req.params.id, status, notes);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: status === 'suspended' ? 'user_suspended' : 'access_revoked',
      targetType: 'user',
      targetId: req.params.id,
      targetName: user?.fullName,
      previousValue: null,
      newValue: status,
      outcome: status,
      notes: notes || null,
    }));
    return res.json({ data: user, error: null });
  } catch (error) {
    console.error('Update user status error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update user status' } });
  }
});

router.post('/users/:id/require-mfa', async (req: Request, res: Response) => {
  try {
    const user = await repo.requireUserMfa(req.authUser!.workspaceId, req.params.id);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'mfa_required',
      targetType: 'user',
      targetId: req.params.id,
      targetName: user?.fullName,
      previousValue: null,
      newValue: 'required',
      outcome: 'MFA required',
      notes: 'MFA enforced by access governance.',
    }));
    return res.json({ data: user, error: null });
  } catch (error) {
    console.error('Require MFA error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to require MFA' } });
  }
});

router.delete('/users/:id/access', requireStepUp('revoke_access'), async (req: Request, res: Response) => {
  try {
    const user = await repo.updateUserStatus(req.authUser!.workspaceId, req.params.id, 'revoked', req.body?.notes || 'Access revoked');
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'access_revoked',
      targetType: 'user',
      targetId: req.params.id,
      targetName: user?.fullName,
      previousValue: null,
      newValue: 'revoked',
      outcome: 'Revoked',
      notes: req.body?.notes || null,
    }));
    return res.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error('Revoke access error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to revoke access' } });
  }
});

router.get('/access-requests', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await repo.listAccessRequests(req.authUser!.workspaceId), error: null });
  } catch (error) {
    console.error('List access requests error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load access requests' } });
  }
});

router.post('/access-requests/:id/approve', requireStepUp('approve_access_request'), async (req: Request, res: Response) => {
  try {
    const updated = await repo.updateAccessRequestDecision(req.authUser!.workspaceId, req.params.id, {
      status: 'approved',
      reviewer: req.authUser!.email,
      decisionNotes: req.body?.decisionNotes,
      requestedRoleId: req.body?.assignedRoleId,
      enforceMfaBeforeActivation: req.body?.enforceMfaBeforeActivation,
    });
    await repo.recomputeSodConflicts(req.authUser!.workspaceId);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'access_approved',
      targetType: 'access_request',
      targetId: req.params.id,
      targetName: updated?.requesterName,
      previousValue: 'pending',
      newValue: updated?.requestedRoleName || 'approved',
      outcome: 'Approved',
      notes: updated?.decisionNotes || null,
    }));
    return res.json({ data: updated, error: null });
  } catch (error) {
    console.error('Approve access request error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to approve access request' } });
  }
});

router.post('/access-requests/:id/reject', async (req: Request, res: Response) => {
  try {
    const updated = await repo.updateAccessRequestDecision(req.authUser!.workspaceId, req.params.id, {
      status: 'rejected',
      reviewer: req.authUser!.email,
      decisionNotes: req.body?.decisionNotes,
      requestedRoleId: req.body?.assignedRoleId,
      enforceMfaBeforeActivation: req.body?.enforceMfaBeforeActivation,
    });
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'access_rejected',
      targetType: 'access_request',
      targetId: req.params.id,
      targetName: updated?.requesterName,
      previousValue: 'pending',
      newValue: 'rejected',
      outcome: 'Rejected',
      notes: updated?.decisionNotes || null,
    }));
    return res.json({ data: updated, error: null });
  } catch (error) {
    console.error('Reject access request error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to reject access request' } });
  }
});

router.post('/access-requests/:id/request-info', async (req: Request, res: Response) => {
  try {
    const updated = await repo.updateAccessRequestDecision(req.authUser!.workspaceId, req.params.id, {
      status: 'needs_info',
      reviewer: req.authUser!.email,
      decisionNotes: req.body?.decisionNotes,
      requestedRoleId: req.body?.assignedRoleId,
      enforceMfaBeforeActivation: req.body?.enforceMfaBeforeActivation,
    });
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'request_more_info',
      targetType: 'access_request',
      targetId: req.params.id,
      targetName: updated?.requesterName,
      previousValue: 'pending',
      newValue: 'needs_info',
      outcome: 'Needs info',
      notes: updated?.decisionNotes || null,
    }));
    return res.json({ data: updated, error: null });
  } catch (error) {
    console.error('Request more info error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update access request' } });
  }
});

router.get('/access-reviews', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await repo.listAccessReviews(req.authUser!.workspaceId), error: null });
  } catch (error) {
    console.error('List access reviews error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load access reviews' } });
  }
});

router.post('/access-reviews', async (req: Request, res: Response) => {
  try {
    const review = await repo.createAccessReview(req.authUser!.workspaceId, req.body);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'access_review_launched',
      targetType: 'access_review',
      targetId: review.id,
      targetName: review.name,
      previousValue: null,
      newValue: review.name,
      outcome: 'Launched',
      notes: review.scopeSummary,
    }));
    return res.status(201).json({ data: review, error: null });
  } catch (error) {
    console.error('Create access review error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to create access review' } });
  }
});

router.patch('/access-reviews/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const review = await repo.updateAccessReviewItem(req.authUser!.workspaceId, req.params.id, req.params.itemId, req.body.decision, req.body.notes);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: review?.status === 'completed' ? 'access_review_completed' : 'access_review_updated',
      targetType: 'access_review',
      targetId: req.params.id,
      targetName: review?.name,
      previousValue: null,
      newValue: req.body.decision,
      outcome: review?.status || 'Updated',
      notes: req.body.notes || null,
    }));
    return res.json({ data: review, error: null });
  } catch (error) {
    console.error('Update access review item error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update access review decision' } });
  }
});

router.post('/access-reviews/:id/export-evidence', requireStepUp('export_access_review'), async (req: Request, res: Response) => {
  try {
    const review = await repo.markAccessReviewEvidenceExported(req.authUser!.workspaceId, req.params.id);
    if (!review) {
      return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Access review not found' } });
    }
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'review_evidence_exported',
      targetType: 'access_review',
      targetId: review.id,
      targetName: review.name,
      previousValue: null,
      newValue: 'exported',
      outcome: 'Exported',
      notes: 'Access review evidence exported.',
    }));
    return res.json({ data: { content: buildAccessReviewEvidence(review) }, error: null });
  } catch (error) {
    console.error('Export review evidence error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to export access review evidence' } });
  }
});

router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    return res.json({ data: await repo.listGovernanceAuditLogs(req.authUser!.workspaceId), error: null });
  } catch (error) {
    console.error('List governance audit logs error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load governance audit logs' } });
  }
});

router.get('/sod-conflicts', async (req: Request, res: Response) => {
  try {
    await repo.recomputeSodConflicts(req.authUser!.workspaceId);
    return res.json({ data: await repo.listSodConflicts(req.authUser!.workspaceId), error: null });
  } catch (error) {
    console.error('List SoD conflicts error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to load SoD conflicts' } });
  }
});

router.post('/sod-rules', async (req: Request, res: Response) => {
  try {
    const rule = await repo.createSodRule(req.authUser!.workspaceId, req.body);
    await repo.recomputeSodConflicts(req.authUser!.workspaceId);
    await appendGovernanceAuditLog(buildGovernanceAuditFromRequest(req, {
      action: 'sod_rule_created',
      targetType: 'sod_rule',
      targetId: rule.id,
      targetName: rule.title,
      previousValue: null,
      newValue: rule.title,
      outcome: 'Created',
      notes: rule.description,
    }));
    return res.status(201).json({ data: rule, error: null });
  } catch (error) {
    console.error('Create SoD rule error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to create SoD rule' } });
  }
});

router.patch('/sod-rules/:id', async (req: Request, res: Response) => {
  try {
    const rule = await repo.updateSodRule(req.authUser!.workspaceId, req.params.id, req.body);
    await repo.recomputeSodConflicts(req.authUser!.workspaceId);
    return res.json({ data: rule, error: null });
  } catch (error) {
    console.error('Update SoD rule error:', error);
    return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Unable to update SoD rule' } });
  }
});

export default router;
