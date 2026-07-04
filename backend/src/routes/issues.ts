import { Router } from 'express';
import type { ApiResponse, DashboardIssueRecord } from '../types/models.js';
import * as issuesRepo from '../repositories/issuesRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const data = await issuesRepo.getDerivedIssues(workspaceId);

    const response: ApiResponse<DashboardIssueRecord[]> = {
      data,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ISSUES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch issues',
      },
    };
    res.status(500).json(response);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const issue = await issuesRepo.getDerivedIssueById(workspaceId, req.params.id);

    if (!issue) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'ISSUE_NOT_FOUND',
          message: `Issue ${req.params.id} was not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<DashboardIssueRecord> = {
      data: issue,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_ISSUE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch issue',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
