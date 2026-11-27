/**
 * TPRM (Third-Party Risk Management) Routes
 *
 * Provides CRUD endpoints for:
 * - Vendor Risk Assessments
 * - Vendor Questionnaires
 * - Vendor Subprocessors
 * - Vendor Contracts
 * - Vendor Incidents
 * - TPRM Summary for Executive Dashboard
 */

import { Router } from 'express';
import type { ApiResponse } from '../types/models.js';
import * as tprmRepo from '../repositories/tprmRepo.js';
import { requireAuth, requireRole, ROLES, getAuthenticatedWorkspaceId } from '../middleware/authMiddleware.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';
import { requireAuthenticatedWorkspace } from '../workspace.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { isSafeExternalReference } from '../utils/externalReference.js';

const router = Router();

// Apply auth to all TPRM routes
router.use(requireAuth);
router.use(requireAuthenticatedWorkspace);
router.use(requirePermission('Vendors', 'view'));

// ============================================
// TPRM Summary (Executive Dashboard)
// ============================================

router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const summary = await tprmRepo.getTPRMSummary(workspaceId);

    res.json({ data: summary, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_TPRM_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch TPRM summary',
      },
    });
  }
});

// ============================================
// Vendor Risk Assessments
// ============================================

router.get('/assessments', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, status, riskTier } = req.query;

    const assessments = await tprmRepo.getAssessments(workspaceId, {
      vendorId: typeof vendorId === 'string' ? vendorId : undefined,
      status: typeof status === 'string' ? status : undefined,
      riskTier: typeof riskTier === 'string' ? riskTier : undefined,
    });

    res.json({ data: assessments, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_ASSESSMENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch assessments',
      },
    });
  }
});

router.get('/assessments/:id', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const assessment = await tprmRepo.getAssessmentById(workspaceId, req.params.id);

    if (!assessment) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      });
      return;
    }

    res.json({ data: assessment, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch assessment',
      },
    });
  }
});

router.get('/assessments/:id/history', async (req, res) => {
  const data = await tprmRepo.getAssessmentHistory(getAuthenticatedWorkspaceId(req), req.params.id);
  res.json({ data, error: null });
});

router.post('/assessments', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, assessmentType, riskTier, dueDate, assessorId, notes } = req.body;

    if (!vendorId) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'vendorId is required' },
      });
      return;
    }

    const assessment = await tprmRepo.createAssessment(workspaceId, {
      vendorId,
      assessmentType,
      riskTier,
      dueDate,
      assessorId,
      notes,
    }, req.authUser?.userId);

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_assessment',
      entityId: assessment.id,
      action: 'create',
      summary: `Created vendor risk assessment for vendor ${vendorId}`,
      details: { assessmentType, riskTier },
    }));

    res.status(201).json({ data: assessment, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'CREATE_ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create assessment',
      },
    });
  }
});

router.patch('/assessments/:id', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const assessment = await tprmRepo.updateAssessment(workspaceId, req.params.id, req.body);

    if (!assessment) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_assessment',
      entityId: assessment.id,
      action: 'update',
      summary: `Updated vendor risk assessment`,
      details: { changes: Object.keys(req.body) },
    }));

    res.json({ data: assessment, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'UPDATE_ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update assessment',
      },
    });
  }
});

router.post('/assessments/:id/transition', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const decision = ['approved','approved_with_conditions','rejected'].includes(req.body?.status);
    if (decision) {
      return requirePermission('Vendors', 'approve')(req, res, async () => {
        try {
          const data = await tprmRepo.transitionAssessment(getAuthenticatedWorkspaceId(req), req.params.id, req.body.status, req.authUser!.userId, req.body.reason);
          if (!data) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Assessment not found.' } });
          await logActivity(buildLogInputFromRequest(req, { entityType:'vendor_assessment',entityId:data.id,action:'status_change',summary:`Assessment moved to ${data.status}`,details:{reason:req.body.reason||null} }));
          res.json({ data, error: null });
        } catch (error) { res.status(409).json({ data:null,error:{code:'ASSESSMENT_TRANSITION_FAILED',message:error instanceof Error?error.message:'Unable to change assessment status.'} }); }
      });
    }
    const data = await tprmRepo.transitionAssessment(getAuthenticatedWorkspaceId(req), req.params.id, req.body.status, req.authUser!.userId, req.body.reason);
    if (!data) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Assessment not found.' } });
    await logActivity(buildLogInputFromRequest(req, { entityType:'vendor_assessment',entityId:data.id,action:'status_change',summary:`Assessment moved to ${data.status}` }));
    res.json({ data, error: null });
  } catch (error) { res.status(409).json({ data:null,error:{code:'ASSESSMENT_TRANSITION_FAILED',message:error instanceof Error?error.message:'Unable to change assessment status.'} }); }
});

router.delete('/assessments/:id', requireRole(ROLES.ADMIN_LIKE), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const deleted = await tprmRepo.deleteAssessment(workspaceId, req.params.id);

    if (!deleted) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_assessment',
      entityId: req.params.id,
      action: 'delete',
      summary: `Deleted vendor risk assessment`,
    }));

    res.json({ data: { success: true }, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'DELETE_ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete assessment',
      },
    });
  }
});

// ============================================
// Vendor Questionnaires
// ============================================

router.get('/questionnaires', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, isTemplate, status } = req.query;

    const questionnaires = await tprmRepo.getQuestionnaires(workspaceId, {
      vendorId: typeof vendorId === 'string' ? vendorId : undefined,
      isTemplate: isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    res.json({ data: questionnaires, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_QUESTIONNAIRES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch questionnaires',
      },
    });
  }
});

router.get('/questionnaires/:id', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const questionnaire = await tprmRepo.getQuestionnaireById(workspaceId, req.params.id);

    if (!questionnaire) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Questionnaire not found' },
      });
      return;
    }

    // Also fetch questions if requested
    if (req.query.includeQuestions === 'true') {
      const questions = await tprmRepo.getQuestionsByQuestionnaireId(workspaceId, req.params.id);
      res.json({ data: { ...questionnaire, questions }, error: null });
      return;
    }

    res.json({ data: questionnaire, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_QUESTIONNAIRE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch questionnaire',
      },
    });
  }
});

router.post('/questionnaires', requirePermission('Vendors', 'create'), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, assessmentId, name, description, questionnaireType, isTemplate, dueDate } = req.body;

    if (!name) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'name is required' },
      });
      return;
    }
    if ((isTemplate && vendorId) || (!isTemplate && !vendorId)) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: isTemplate ? 'Templates cannot be assigned to a supplier.' : 'vendorId is required for a supplier questionnaire.' } });
      return;
    }

    const questionnaire = await tprmRepo.createQuestionnaire(
      workspaceId,
      { vendorId, assessmentId, name, description, questionnaireType, isTemplate, dueDate },
      req.authUser?.userId
    );

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_questionnaire',
      entityId: questionnaire.id,
      action: 'create',
      summary: `Created questionnaire: ${name}`,
      details: { questionnaireType, isTemplate },
    }));

    res.status(201).json({ data: questionnaire, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'CREATE_QUESTIONNAIRE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create questionnaire',
      },
    });
  }
});

router.patch('/questionnaires/:id', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const questionnaire = await tprmRepo.updateQuestionnaire(workspaceId, req.params.id, req.body);

    if (!questionnaire) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Questionnaire not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_questionnaire',
      entityId: questionnaire.id,
      action: 'update',
      summary: `Updated questionnaire: ${questionnaire.name}`,
      details: { changes: Object.keys(req.body) },
    }));

    res.json({ data: questionnaire, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'UPDATE_QUESTIONNAIRE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update questionnaire',
      },
    });
  }
});

router.post('/questionnaires/:id/transition', requirePermission('Vendors', 'edit'), async (req, res) => {
  const execute = async () => {
    try {
      const status = req.body?.status;
      const questionnaire = await tprmRepo.transitionQuestionnaire(
        getAuthenticatedWorkspaceId(req),
        req.params.id,
        status,
        req.authUser!.userId,
      );
      if (!questionnaire) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Questionnaire not found.' } });
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'vendor_questionnaire',
        entityId: questionnaire.id,
        action: 'status_change',
        summary: `Questionnaire moved to ${questionnaire.status}`,
        details: { status: questionnaire.status },
      }));
      return res.json({ data: questionnaire, error: null });
    } catch (error) {
      return res.status(409).json({ data: null, error: { code: 'QUESTIONNAIRE_TRANSITION_FAILED', message: error instanceof Error ? error.message : 'Unable to change questionnaire status.' } });
    }
  };
  if (req.body?.status === 'reviewed') return requirePermission('Vendors', 'approve')(req, res, execute);
  return execute();
});

router.delete('/questionnaires/:id', requireRole(ROLES.ADMIN_LIKE), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const deleted = await tprmRepo.deleteQuestionnaire(workspaceId, req.params.id);

    if (!deleted) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Questionnaire not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_questionnaire',
      entityId: req.params.id,
      action: 'delete',
      summary: `Deleted questionnaire`,
    }));

    res.json({ data: { success: true }, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'DELETE_QUESTIONNAIRE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete questionnaire',
      },
    });
  }
});

// Questionnaire Questions
router.get('/questionnaires/:id/questions', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const questions = await tprmRepo.getQuestionsByQuestionnaireId(workspaceId, req.params.id);
    res.json({ data: questions, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_QUESTIONS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch questions',
      },
    });
  }
});

router.post('/questionnaires/:id/questions', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { category, questionText, questionType, options, isRequired, weight, riskIfNegative, displayOrder, guidance } = req.body;

    if (!category || !questionText) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'category and questionText are required' },
      });
      return;
    }

    const question = await tprmRepo.createQuestion(workspaceId, {
      questionnaireId: req.params.id,
      category,
      questionText,
      questionType,
      options,
      isRequired,
      weight,
      riskIfNegative,
      displayOrder,
      guidance,
    });

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_questionnaire',
      entityId: req.params.id,
      action: 'update',
      summary: `Added questionnaire question: ${questionText}`,
      details: { questionId: question.id, category },
    }));
    res.status(201).json({ data: question, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'CREATE_QUESTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create question',
      },
    });
  }
});

router.get('/questionnaires/:id/responses', async (req, res) => {
  try {
    const responses = await tprmRepo.getResponsesByQuestionnaireId(getAuthenticatedWorkspaceId(req), req.params.id);
    res.json({ data: responses, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { code: 'FETCH_RESPONSES_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch responses' } });
  }
});

// Question Responses
router.post('/questions/:questionId/response', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { responseText, responseValue, fileUrl } = req.body;
    if ((!responseText || !String(responseText).trim()) && responseValue == null && !fileUrl) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A questionnaire response is required.' } });
      return;
    }
    if (typeof responseText === 'string' && responseText.length > 10000) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Questionnaire responses must be 10,000 characters or fewer.' } });
      return;
    }
    if (fileUrl && !isSafeExternalReference(fileUrl)) {
      res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Attachment references must use an approved HTTP(S) location.' } });
      return;
    }

    const response = await tprmRepo.upsertResponse(workspaceId, {
      questionId: req.params.questionId,
      responseText,
      responseValue,
      fileUrl,
    });

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_questionnaire',
      entityId: req.params.questionId,
      action: 'update',
      summary: 'Recorded supplier questionnaire response',
      details: { questionId: req.params.questionId, attachmentReferenceProvided: Boolean(fileUrl) },
    }));
    res.json({ data: response, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'SAVE_RESPONSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to save response',
      },
    });
  }
});

// ============================================
// Vendor Subprocessors
// ============================================

router.get('/subprocessors', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, riskTier, status } = req.query;

    const subprocessors = await tprmRepo.getSubprocessors(workspaceId, {
      vendorId: typeof vendorId === 'string' ? vendorId : undefined,
      riskTier: typeof riskTier === 'string' ? riskTier : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    res.json({ data: subprocessors, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_SUBPROCESSORS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch subprocessors',
      },
    });
  }
});

router.get('/subprocessors/:id', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const subprocessor = await tprmRepo.getSubprocessorById(workspaceId, req.params.id);

    if (!subprocessor) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Subprocessor not found' },
      });
      return;
    }

    res.json({ data: subprocessor, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_SUBPROCESSOR_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch subprocessor',
      },
    });
  }
});

router.post('/subprocessors', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, name, description, serviceType, dataAccess, dataTypes, location, riskTier, contractEndDate, notes } = req.body;

    if (!vendorId || !name) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'vendorId and name are required' },
      });
      return;
    }

    const subprocessor = await tprmRepo.createSubprocessor(workspaceId, {
      vendorId,
      name,
      description,
      serviceType,
      dataAccess,
      dataTypes,
      location,
      riskTier,
      contractEndDate,
      notes,
    });

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_subprocessor',
      entityId: subprocessor.id,
      action: 'create',
      summary: `Added subprocessor: ${name}`,
      details: { vendorId, riskTier },
    }));

    res.status(201).json({ data: subprocessor, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'CREATE_SUBPROCESSOR_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create subprocessor',
      },
    });
  }
});

router.patch('/subprocessors/:id', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const subprocessor = await tprmRepo.updateSubprocessor(workspaceId, req.params.id, req.body);

    if (!subprocessor) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Subprocessor not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_subprocessor',
      entityId: subprocessor.id,
      action: 'update',
      summary: `Updated subprocessor: ${subprocessor.name}`,
      details: { changes: Object.keys(req.body) },
    }));

    res.json({ data: subprocessor, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'UPDATE_SUBPROCESSOR_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update subprocessor',
      },
    });
  }
});

router.delete('/subprocessors/:id', requireRole(ROLES.ADMIN_LIKE), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const deleted = await tprmRepo.deleteSubprocessor(workspaceId, req.params.id);

    if (!deleted) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Subprocessor not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_subprocessor',
      entityId: req.params.id,
      action: 'delete',
      summary: `Deleted subprocessor`,
    }));

    res.json({ data: { success: true }, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'DELETE_SUBPROCESSOR_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete subprocessor',
      },
    });
  }
});

// ============================================
// Vendor Contracts
// ============================================

router.get('/contracts', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, status, contractType } = req.query;

    const contracts = await tprmRepo.getContracts(workspaceId, {
      vendorId: typeof vendorId === 'string' ? vendorId : undefined,
      status: typeof status === 'string' ? status : undefined,
      contractType: typeof contractType === 'string' ? contractType : undefined,
    });

    res.json({ data: contracts, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_CONTRACTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch contracts',
      },
    });
  }
});

router.get('/contracts/:id', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const contract = await tprmRepo.getContractById(workspaceId, req.params.id);

    if (!contract) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Contract not found' },
      });
      return;
    }

    res.json({ data: contract, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_CONTRACT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch contract',
      },
    });
  }
});

router.post('/contracts', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const {
      vendorId,
      contractName,
      contractType,
      effectiveDate,
      expirationDate,
      renewalType,
      renewalNoticeDays,
      contractValue,
      currency,
      keyTerms,
      documentUrl,
      ownerId,
      notes,
    } = req.body;

    if (!vendorId || !contractName) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'vendorId and contractName are required' },
      });
      return;
    }

    const contract = await tprmRepo.createContract(workspaceId, {
      vendorId,
      contractName,
      contractType,
      effectiveDate,
      expirationDate,
      renewalType,
      renewalNoticeDays,
      contractValue,
      currency,
      keyTerms,
      documentUrl,
      ownerId,
      notes,
    }, req.authUser!.userId);

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_contract',
      entityId: contract.id,
      action: 'create',
      summary: `Created contract: ${contractName}`,
      details: { vendorId, contractType, contractValue },
    }));

    res.status(201).json({ data: contract, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'CREATE_CONTRACT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create contract',
      },
    });
  }
});

router.patch('/contracts/:id', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const contract = await tprmRepo.updateContract(workspaceId, req.params.id, req.body);

    if (!contract) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Contract not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_contract',
      entityId: contract.id,
      action: 'update',
      summary: `Updated contract: ${contract.contractName}`,
      details: { changes: Object.keys(req.body) },
    }));

    res.json({ data: contract, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'UPDATE_CONTRACT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update contract',
      },
    });
  }
});

router.get('/contracts/:id/history', async (req, res) => {
  const data = await tprmRepo.getContractHistory(getAuthenticatedWorkspaceId(req), req.params.id);
  res.json({ data, error: null });
});

router.post('/contracts/:id/transition', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const approve = req.body?.status === 'approved';
    if (approve) {
      return requirePermission('Vendors', 'approve')(req, res, async () => {
        try {
          const data = await tprmRepo.transitionContract(getAuthenticatedWorkspaceId(req), req.params.id, req.body.status, req.authUser!.userId, req.body.reason);
          if (!data) return res.status(404).json({data:null,error:{code:'NOT_FOUND',message:'Contract not found.'}});
          await logActivity(buildLogInputFromRequest(req,{entityType:'vendor_contract',entityId:data.id,action:'status_change',summary:`Contract moved to ${data.status}`,details:{reason:req.body.reason||null}}));
          res.json({data,error:null});
        } catch(error){res.status(409).json({data:null,error:{code:'CONTRACT_TRANSITION_FAILED',message:error instanceof Error?error.message:'Unable to change contract status.'}});}
      });
    }
    const data = await tprmRepo.transitionContract(getAuthenticatedWorkspaceId(req), req.params.id, req.body.status, req.authUser!.userId, req.body.reason);
    if (!data) return res.status(404).json({data:null,error:{code:'NOT_FOUND',message:'Contract not found.'}});
    await logActivity(buildLogInputFromRequest(req,{entityType:'vendor_contract',entityId:data.id,action:'status_change',summary:`Contract moved to ${data.status}`}));
    res.json({data,error:null});
  } catch(error){res.status(409).json({data:null,error:{code:'CONTRACT_TRANSITION_FAILED',message:error instanceof Error?error.message:'Unable to change contract status.'}});}
});

router.delete('/contracts/:id', requireRole(ROLES.ADMIN_LIKE), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const deleted = await tprmRepo.transitionContract(workspaceId, req.params.id, 'archived', req.authUser!.userId, 'Archived through legacy delete endpoint');

    if (!deleted) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Contract not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_contract',
      entityId: req.params.id,
      action: 'delete',
      summary: `Deleted contract`,
    }));

    res.json({ data: deleted, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'DELETE_CONTRACT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete contract',
      },
    });
  }
});

// ============================================
// Vendor Incidents
// ============================================

router.get('/incidents', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const { vendorId, severity, status, incidentType } = req.query;

    const incidents = await tprmRepo.getIncidents(workspaceId, {
      vendorId: typeof vendorId === 'string' ? vendorId : undefined,
      severity: typeof severity === 'string' ? severity : undefined,
      status: typeof status === 'string' ? status : undefined,
      incidentType: typeof incidentType === 'string' ? incidentType : undefined,
    });

    res.json({ data: incidents, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_INCIDENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch incidents',
      },
    });
  }
});

router.get('/incidents/:id', async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const incident = await tprmRepo.getIncidentById(workspaceId, req.params.id);

    if (!incident) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      });
      return;
    }

    res.json({ data: incident, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'FETCH_INCIDENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch incident',
      },
    });
  }
});

router.post('/incidents', requirePermission('Vendors', 'create'), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const {
      vendorId,
      incidentType,
      severity,
      title,
      description,
      impact,
      dataAffected,
      dataTypesAffected,
      recordsAffected,
      occurredAt,
      detectedAt,
      assignedTo,
    } = req.body;

    if (!vendorId || !incidentType || !title) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'vendorId, incidentType, and title are required' },
      });
      return;
    }

    const incident = await tprmRepo.createIncident(
      workspaceId,
      {
        vendorId,
        incidentType,
        severity,
        title,
        description,
        impact,
        dataAffected,
        dataTypesAffected,
        recordsAffected,
        occurredAt,
        detectedAt,
        assignedTo,
      },
      req.authUser?.userId
    );

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_incident',
      entityId: incident.id,
      action: 'create',
      summary: `Reported incident: ${title}`,
      details: { vendorId, incidentType, severity },
    }));

    res.status(201).json({ data: incident, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'CREATE_INCIDENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create incident',
      },
    });
  }
});

router.patch('/incidents/:id', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const incident = await tprmRepo.updateIncident(workspaceId, req.params.id, req.body);

    if (!incident) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_incident',
      entityId: incident.id,
      action: 'update',
      summary: `Updated incident: ${incident.title}`,
      details: { changes: Object.keys(req.body) },
    }));

    res.json({ data: incident, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'UPDATE_INCIDENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update incident',
      },
    });
  }
});

router.post('/incidents/:id/transition', requirePermission('Vendors', 'edit'), async (req, res) => {
  try {
    const incident = await tprmRepo.transitionIncident(
      getAuthenticatedWorkspaceId(req),
      req.params.id,
      req.body?.status,
      { rootCause: req.body?.rootCause, remediation: req.body?.remediation, lessonsLearned: req.body?.lessonsLearned },
    );
    if (!incident) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Supplier incident not found.' } });
    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_incident', entityId: incident.id, action: 'status_change',
      summary: `Supplier incident moved to ${incident.status}`,
      details: { status: incident.status, resolutionEvidenceRecorded: Boolean(incident.rootCause && incident.remediation) },
    }));
    res.json({ data: incident, error: null });
  } catch (error) {
    res.status(409).json({ data: null, error: { code: 'INCIDENT_TRANSITION_FAILED', message: error instanceof Error ? error.message : 'Unable to change supplier incident status.' } });
  }
});

router.delete('/incidents/:id', requireRole(ROLES.ADMIN_LIKE), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const deleted = await tprmRepo.deleteIncident(workspaceId, req.params.id);

    if (!deleted) {
      res.status(404).json({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Incident not found' },
      });
      return;
    }

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_incident',
      entityId: req.params.id,
      action: 'delete',
      summary: `Deleted incident`,
    }));

    res.json({ data: { success: true }, error: null });
  } catch (error) {
    res.status(500).json({
      data: null,
      error: {
        code: 'DELETE_INCIDENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete incident',
      },
    });
  }
});

export default router;
