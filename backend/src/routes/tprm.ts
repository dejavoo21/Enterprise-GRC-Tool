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

const router = Router();

// Apply auth to all TPRM routes
router.use(requireAuth);

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
    });

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
      const questions = await tprmRepo.getQuestionsByQuestionnaireId(req.params.id);
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

router.post('/questionnaires', requireRole(ROLES.CAN_EDIT), async (req, res) => {
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

router.patch('/questionnaires/:id', requireRole(ROLES.CAN_EDIT), async (req, res) => {
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
    const questions = await tprmRepo.getQuestionsByQuestionnaireId(req.params.id);
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

router.post('/questionnaires/:id/questions', requireRole(ROLES.CAN_EDIT), async (req, res) => {
  try {
    const { category, questionText, questionType, options, isRequired, weight, riskIfNegative, displayOrder, guidance } = req.body;

    if (!category || !questionText) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'category and questionText are required' },
      });
      return;
    }

    const question = await tprmRepo.createQuestion({
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

// Question Responses
router.post('/questions/:questionId/response', async (req, res) => {
  try {
    const { responseText, responseValue, fileUrl } = req.body;

    const response = await tprmRepo.upsertResponse({
      questionId: req.params.questionId,
      responseText,
      responseValue,
      fileUrl,
    });

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
    });

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

router.delete('/contracts/:id', requireRole(ROLES.ADMIN_LIKE), async (req, res) => {
  try {
    const workspaceId = getAuthenticatedWorkspaceId(req);
    const deleted = await tprmRepo.deleteContract(workspaceId, req.params.id);

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

    res.json({ data: { success: true }, error: null });
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

router.post('/incidents', requireRole(ROLES.CAN_EDIT), async (req, res) => {
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

router.patch('/incidents/:id', requireRole(ROLES.CAN_EDIT), async (req, res) => {
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

    // Check if status changed to resolved/closed
    const action = req.body.status === 'resolved' || req.body.status === 'closed' ? 'status_change' : 'update';

    await logActivity(buildLogInputFromRequest(req, {
      entityType: 'vendor_incident',
      entityId: incident.id,
      action,
      summary: `Updated incident: ${incident.title}`,
      details: { changes: Object.keys(req.body), newStatus: req.body.status },
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
