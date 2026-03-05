import { Router } from 'express';
import type { ApiResponse, GovernanceDocument } from '../types/models.js';
import * as governanceDocumentsRepo from '../repositories/governanceDocumentsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';

const router = Router();

// GET /api/v1/governance-documents
// Returns all governance documents for the workspace
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { docType, status, dueForReviewOnly, frameworkCode } = req.query;

    const documents = await governanceDocumentsRepo.getGovernanceDocuments(workspaceId, {
      docType: typeof docType === 'string' ? docType : undefined,
      status: typeof status === 'string' ? status : undefined,
      dueForReviewOnly: dueForReviewOnly === 'true',
      frameworkCode: typeof frameworkCode === 'string' ? frameworkCode : undefined,
    });

    const response: ApiResponse<GovernanceDocument[]> = {
      data: documents,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_DOCUMENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch governance documents',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/governance-documents/summary
// Returns summary statistics
router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const allDocs = await governanceDocumentsRepo.getGovernanceDocuments(workspaceId);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const total = allDocs.length;
    const approved = allDocs.filter(d => d.status === 'approved').length;
    const draft = allDocs.filter(d => d.status === 'draft').length;
    const inReview = allDocs.filter(d => d.status === 'in_review').length;
    const retired = allDocs.filter(d => d.status === 'retired').length;

    // Due for review: next_review_date in the past or within 30 days
    const dueForReview = allDocs.filter(d => {
      if (!d.nextReviewDate) return false;
      const reviewDate = new Date(d.nextReviewDate);
      return reviewDate <= thirtyDaysFromNow;
    }).length;

    // Overdue: next_review_date in the past
    const overdue = allDocs.filter(d => {
      if (!d.nextReviewDate) return false;
      const reviewDate = new Date(d.nextReviewDate);
      return reviewDate < now;
    }).length;

    const response: ApiResponse<{
      total: number;
      approved: number;
      draft: number;
      inReview: number;
      retired: number;
      dueForReview: number;
      overdue: number;
    }> = {
      data: {
        total,
        approved,
        draft,
        inReview,
        retired,
        dueForReview,
        overdue,
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch document summary',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/governance-documents/:id
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, id);

    if (!document) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<GovernanceDocument> = {
      data: document,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_DOCUMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch governance document',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/governance-documents
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Validation
    if (!input.title || !input.docType || !input.owner) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title, docType, and owner are required',
        },
      };
      return res.status(400).json(response);
    }

    const validDocTypes = ['policy', 'procedure', 'standard', 'guideline', 'manual', 'other'];
    if (!validDocTypes.includes(input.docType)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid docType. Must be one of: ${validDocTypes.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    const newDocument = await governanceDocumentsRepo.createGovernanceDocument(workspaceId, {
      title: input.title,
      docType: input.docType,
      owner: input.owner,
      status: input.status || 'draft',
      currentVersion: input.currentVersion,
      locationUrl: input.locationUrl,
      reviewFrequencyMonths: input.reviewFrequencyMonths,
      nextReviewDate: input.nextReviewDate,
    });

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'governance_document',
        entityId: newDocument.id,
        action: 'create',
        summary: `Created ${input.docType} "${newDocument.title}"`,
        details: newDocument,
      }));
    }

    const response: ApiResponse<GovernanceDocument> = {
      data: newDocument,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_DOCUMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create governance document',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/governance-documents/:id
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    // Fetch existing document for logging
    const existingDocument = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, id);

    const updatedDocument = await governanceDocumentsRepo.updateGovernanceDocument(workspaceId, id, updates);

    if (!updatedDocument) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      const isStatusChange = existingDocument && updates.status && existingDocument.status !== updates.status;
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'governance_document',
        entityId: id,
        action: isStatusChange ? 'status_change' : 'update',
        summary: isStatusChange
          ? `Document "${updatedDocument.title}" status changed from ${existingDocument.status} to ${updates.status}`
          : `Updated ${updatedDocument.docType} "${updatedDocument.title}"`,
        details: { before: existingDocument, after: updatedDocument },
      }));
    }

    const response: ApiResponse<GovernanceDocument> = {
      data: updatedDocument,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_DOCUMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update governance document',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/governance-documents/:id
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    const deleted = await governanceDocumentsRepo.deleteGovernanceDocument(workspaceId, id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      data: { deleted: true },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'DELETE_DOCUMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete governance document',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Document-Framework Relationship Endpoints
// ============================================

// GET /api/v1/governance-documents/:id/frameworks
// Returns framework codes linked to a document
router.get('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    // Verify document exists
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, id);
    if (!document) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const frameworks = await governanceDocumentsRepo.getDocumentFrameworks(id);

    const response: ApiResponse<string[]> = {
      data: frameworks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_FRAMEWORKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch document frameworks',
      },
    };
    res.status(500).json(response);
  }
});

// PUT /api/v1/governance-documents/:id/frameworks
// Sets all frameworks for a document (replaces existing)
router.put('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { frameworkCodes } = req.body;

    // Verify document exists
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, id);
    if (!document) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    if (!Array.isArray(frameworkCodes)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'frameworkCodes must be an array of strings',
        },
      };
      return res.status(400).json(response);
    }

    await governanceDocumentsRepo.setDocumentFrameworks(id, frameworkCodes);
    const updatedFrameworks = await governanceDocumentsRepo.getDocumentFrameworks(id);

    const response: ApiResponse<string[]> = {
      data: updatedFrameworks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'SET_FRAMEWORKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to set document frameworks',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/governance-documents/:id/frameworks
// Adds a single framework to a document
router.post('/:id/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { frameworkCode } = req.body;

    // Verify document exists
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, id);
    if (!document) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    if (!frameworkCode || typeof frameworkCode !== 'string') {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'frameworkCode is required and must be a string',
        },
      };
      return res.status(400).json(response);
    }

    await governanceDocumentsRepo.addFrameworkToDocument(id, frameworkCode);
    const updatedFrameworks = await governanceDocumentsRepo.getDocumentFrameworks(id);

    const response: ApiResponse<string[]> = {
      data: updatedFrameworks,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'ADD_FRAMEWORK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to add framework to document',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/governance-documents/:id/frameworks/:frameworkCode
// Removes a framework from a document
router.delete('/:id/frameworks/:frameworkCode', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id, frameworkCode } = req.params;

    // Verify document exists
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, id);
    if (!document) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Governance document with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    await governanceDocumentsRepo.removeFrameworkFromDocument(id, frameworkCode);
    const updatedFrameworks = await governanceDocumentsRepo.getDocumentFrameworks(id);

    const response: ApiResponse<string[]> = {
      data: updatedFrameworks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'REMOVE_FRAMEWORK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to remove framework from document',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
