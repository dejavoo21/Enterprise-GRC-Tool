import { Router } from 'express';
import type { ApiResponse, DocumentReviewLog } from '../types/models.js';
import * as documentReviewLogsRepo from '../repositories/documentReviewLogsRepo.js';
import * as reviewTasksRepo from '../repositories/reviewTasksRepo.js';
import * as governanceDocumentsRepo from '../repositories/governanceDocumentsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/document-review-logs/by-document/:documentId
// Returns all review logs for a specific document
router.get('/by-document/:documentId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { documentId } = req.params;

    const logs = await documentReviewLogsRepo.getLogsForDocument(workspaceId, documentId);

    const response: ApiResponse<DocumentReviewLog[]> = {
      data: logs,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_LOGS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch review logs',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/document-review-logs/by-task/:taskId
// Returns all review logs for a specific task
router.get('/by-task/:taskId', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { taskId } = req.params;

    const logs = await documentReviewLogsRepo.getLogsByTaskId(workspaceId, taskId);

    const response: ApiResponse<DocumentReviewLog[]> = {
      data: logs,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_LOGS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch review logs',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/document-review-logs
// Creates a new review log entry
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Validation
    if (!input.documentId || !input.reviewTaskId || !input.reviewedBy || !input.decision) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'documentId, reviewTaskId, reviewedBy, and decision are required',
        },
      };
      return res.status(400).json(response);
    }

    // Verify task exists
    const task = await reviewTasksRepo.getReviewTaskById(workspaceId, input.reviewTaskId);
    if (!task) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Review task with ID ${input.reviewTaskId} not found`,
        },
      };
      return res.status(400).json(response);
    }

    // Verify document exists
    const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, input.documentId);
    if (!document) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Document with ID ${input.documentId} not found`,
        },
      };
      return res.status(400).json(response);
    }

    // Validate decision
    const validDecisions = ['no_change', 'update_required', 'retire'];
    if (!validDecisions.includes(input.decision)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid decision. Must be one of: ${validDecisions.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    const newLog = await documentReviewLogsRepo.createReviewLog(workspaceId, {
      documentId: input.documentId,
      reviewTaskId: input.reviewTaskId,
      reviewedBy: input.reviewedBy,
      decision: input.decision,
      comments: input.comments,
      newVersion: input.newVersion,
    });

    // If decision is 'retire', update document status
    if (input.decision === 'retire') {
      await governanceDocumentsRepo.updateGovernanceDocument(workspaceId, input.documentId, {
        status: 'retired',
      });
    }

    // If a new version was specified, update the document
    if (input.newVersion) {
      await governanceDocumentsRepo.updateGovernanceDocument(workspaceId, input.documentId, {
        currentVersion: input.newVersion,
      });
    }

    const response: ApiResponse<DocumentReviewLog> = {
      data: newLog,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_LOG_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create review log',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
