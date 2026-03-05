import { Router } from 'express';
import type { ApiResponse } from '../types/models.js';
import { getWorkspaceId } from '../workspace.js';
import * as linkingRepo from '../repositories/controlLinkingRepo.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';

const router = Router();

// ============================================
// Control ↔ Governance Document Endpoints
// ============================================

// GET /api/v1/links/controls/:controlId/documents
// Returns governance documents linked to a control
router.get('/controls/:controlId/documents', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId } = req.params;

    const documents = await linkingRepo.getDocumentsForControl(workspaceId, controlId);

    const response: ApiResponse<typeof documents> = {
      data: documents,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_LINKED_DOCUMENTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch linked documents',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/links/controls/:controlId/documents
// Links a governance document to a control
router.post('/controls/:controlId/documents', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId } = req.params;
    const { documentId, relationType } = req.body;

    if (!documentId) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'documentId is required',
        },
      };
      return res.status(400).json(response);
    }

    const link = await linkingRepo.linkControlToDocument(
      workspaceId,
      controlId,
      documentId,
      relationType
    );

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'link',
        entityId: `${controlId}::doc::${documentId}`,
        action: 'link',
        summary: `Linked control ${controlId} to document ${documentId}`,
        details: { controlId, documentId, relationType },
      }));
    }

    const response: ApiResponse<typeof link> = {
      data: link,
      error: null,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'LINK_DOCUMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to link document',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/links/controls/:controlId/documents/:documentId
// Unlinks a governance document from a control
router.delete('/controls/:controlId/documents/:documentId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId, documentId } = req.params;

    const deleted = await linkingRepo.unlinkControlFromDocument(workspaceId, controlId, documentId);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Link not found',
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'link',
        entityId: `${controlId}::doc::${documentId}`,
        action: 'unlink',
        summary: `Unlinked control ${controlId} from document ${documentId}`,
        details: { controlId, documentId },
      }));
    }

    const response: ApiResponse<{ success: boolean }> = {
      data: { success: true },
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UNLINK_DOCUMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to unlink document',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Control ↔ Training Course Endpoints
// ============================================

// GET /api/v1/links/controls/:controlId/courses
// Returns training courses linked to a control
router.get('/controls/:controlId/courses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId } = req.params;

    const courses = await linkingRepo.getTrainingForControl(workspaceId, controlId);

    const response: ApiResponse<typeof courses> = {
      data: courses,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_LINKED_COURSES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch linked courses',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/links/controls/:controlId/courses
// Links a training course to a control
router.post('/controls/:controlId/courses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId } = req.params;
    const { courseId, relationType } = req.body;

    if (!courseId) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'courseId is required',
        },
      };
      return res.status(400).json(response);
    }

    const link = await linkingRepo.linkControlToTraining(
      workspaceId,
      controlId,
      courseId,
      relationType
    );

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'link',
        entityId: `${controlId}::training::${courseId}`,
        action: 'link',
        summary: `Linked control ${controlId} to training course ${courseId}`,
        details: { controlId, courseId, relationType },
      }));
    }

    const response: ApiResponse<typeof link> = {
      data: link,
      error: null,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'LINK_COURSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to link course',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/links/controls/:controlId/courses/:courseId
// Unlinks a training course from a control
router.delete('/controls/:controlId/courses/:courseId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { controlId, courseId } = req.params;

    const deleted = await linkingRepo.unlinkControlFromTraining(workspaceId, controlId, courseId);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Link not found',
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'link',
        entityId: `${controlId}::training::${courseId}`,
        action: 'unlink',
        summary: `Unlinked control ${controlId} from training course ${courseId}`,
        details: { controlId, courseId },
      }));
    }

    const response: ApiResponse<{ success: boolean }> = {
      data: { success: true },
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UNLINK_COURSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to unlink course',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Governance Document ↔ Training Course Endpoints
// ============================================

// GET /api/v1/links/documents/:documentId/courses
// Returns training courses linked to a document
router.get('/documents/:documentId/courses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { documentId } = req.params;

    const courses = await linkingRepo.getTrainingForDocument(workspaceId, documentId);

    const response: ApiResponse<typeof courses> = {
      data: courses,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_DOC_LINKED_COURSES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch linked courses',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/links/documents/:documentId/courses
// Links a training course to a document
router.post('/documents/:documentId/courses', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { documentId } = req.params;
    const { courseId, relationType } = req.body;

    if (!courseId) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'courseId is required',
        },
      };
      return res.status(400).json(response);
    }

    const link = await linkingRepo.linkDocumentToTraining(
      workspaceId,
      documentId,
      courseId,
      relationType
    );

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'link',
        entityId: `${documentId}::training::${courseId}`,
        action: 'link',
        summary: `Linked document ${documentId} to training course ${courseId}`,
        details: { documentId, courseId, relationType },
      }));
    }

    const response: ApiResponse<typeof link> = {
      data: link,
      error: null,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'LINK_DOC_COURSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to link course to document',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/links/documents/:documentId/courses/:courseId
// Unlinks a training course from a document
router.delete('/documents/:documentId/courses/:courseId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { documentId, courseId } = req.params;

    const deleted = await linkingRepo.unlinkDocumentFromTraining(workspaceId, documentId, courseId);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Link not found',
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'link',
        entityId: `${documentId}::training::${courseId}`,
        action: 'unlink',
        summary: `Unlinked document ${documentId} from training course ${courseId}`,
        details: { documentId, courseId },
      }));
    }

    const response: ApiResponse<{ success: boolean }> = {
      data: { success: true },
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UNLINK_DOC_COURSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to unlink course from document',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Document Controls Endpoint (reverse lookup)
// ============================================

// GET /api/v1/links/documents/:documentId/controls
// Returns controls linked to a document
router.get('/documents/:documentId/controls', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { documentId } = req.params;

    const controls = await linkingRepo.getControlsForDocument(workspaceId, documentId);

    const response: ApiResponse<typeof controls> = {
      data: controls,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_DOC_LINKED_CONTROLS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch linked controls',
      },
    };
    res.status(500).json(response);
  }
});

// ============================================
// Training Controls/Documents Endpoints (reverse lookup)
// ============================================

// GET /api/v1/links/training/:courseId/controls
// Returns controls linked to a training course
router.get('/training/:courseId/controls', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { courseId } = req.params;

    const controls = await linkingRepo.getControlsForTraining(workspaceId, courseId);

    const response: ApiResponse<typeof controls> = {
      data: controls,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_TRAINING_LINKED_CONTROLS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch linked controls',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/links/training/:courseId/documents
// Returns documents linked to a training course
router.get('/training/:courseId/documents', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { courseId } = req.params;

    const documents = await linkingRepo.getDocumentsForTraining(workspaceId, courseId);

    const response: ApiResponse<typeof documents> = {
      data: documents,
      error: null,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_TRAINING_LINKED_DOCS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch linked documents',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
