import { Router } from 'express';
import type { ApiResponse, ReviewTask } from '../types/models.js';
import * as reviewTasksRepo from '../repositories/reviewTasksRepo.js';
import * as governanceDocumentsRepo from '../repositories/governanceDocumentsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/review-tasks
// Returns all review tasks for the workspace
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, assignee, documentId } = req.query;

    const tasks = await reviewTasksRepo.getReviewTasks(workspaceId, {
      status: typeof status === 'string' ? status as any : undefined,
      assignee: typeof assignee === 'string' ? assignee : undefined,
      documentId: typeof documentId === 'string' ? documentId : undefined,
    });

    const response: ApiResponse<ReviewTask[]> = {
      data: tasks,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_TASKS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch review tasks',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/review-tasks/summary
router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const allTasks = await reviewTasksRepo.getReviewTasks(workspaceId);

    const now = new Date();
    const total = allTasks.length;
    const open = allTasks.filter(t => t.status === 'open').length;
    const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const overdue = allTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      return new Date(t.dueAt) < now;
    }).length;

    const response: ApiResponse<{
      total: number;
      open: number;
      inProgress: number;
      completed: number;
      overdue: number;
    }> = {
      data: {
        total,
        open,
        inProgress,
        completed,
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
        message: error instanceof Error ? error.message : 'Failed to fetch task summary',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/review-tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const task = await reviewTasksRepo.getReviewTaskById(workspaceId, id);

    if (!task) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Review task with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ReviewTask> = {
      data: task,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_TASK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch review task',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/review-tasks
router.post('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Validation
    if (!input.documentId || !input.title || !input.assignee || !input.dueAt) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'documentId, title, assignee, and dueAt are required',
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

    const newTask = await reviewTasksRepo.createReviewTask(workspaceId, {
      documentId: input.documentId,
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      dueAt: input.dueAt,
      reminderDaysBefore: input.reminderDaysBefore,
    });

    const response: ApiResponse<ReviewTask> = {
      data: newTask,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_TASK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create review task',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/review-tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    const updatedTask = await reviewTasksRepo.updateReviewTask(workspaceId, id, updates);

    if (!updatedTask) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Review task with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ReviewTask> = {
      data: updatedTask,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_TASK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update review task',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/review-tasks/:id/complete
// Marks a task as completed and optionally updates the document's review dates
router.patch('/:id/complete', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { updateDocumentReviewDates } = req.body;

    const task = await reviewTasksRepo.getReviewTaskById(workspaceId, id);
    if (!task) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Review task with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const completedAt = new Date().toISOString();
    const updatedTask = await reviewTasksRepo.updateReviewTaskStatus(workspaceId, id, 'completed', completedAt);

    // Optionally update the document's lastReviewedAt and calculate nextReviewDate
    if (updateDocumentReviewDates !== false) {
      const document = await governanceDocumentsRepo.getGovernanceDocumentById(workspaceId, task.documentId);
      if (document) {
        const lastReviewedAt = completedAt;
        let nextReviewDate: string | undefined;

        if (document.reviewFrequencyMonths) {
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + document.reviewFrequencyMonths);
          nextReviewDate = nextDate.toISOString().split('T')[0];
        }

        await governanceDocumentsRepo.updateGovernanceDocument(workspaceId, task.documentId, {
          lastReviewedAt,
          nextReviewDate,
        });
      }
    }

    const response: ApiResponse<ReviewTask> = {
      data: updatedTask,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'COMPLETE_TASK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to complete review task',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/review-tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    const deleted = await reviewTasksRepo.deleteReviewTask(workspaceId, id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Review task with ID ${id} not found`,
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
        code: 'DELETE_TASK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete review task',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
