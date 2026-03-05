import { Router } from 'express';
import type { ApiResponse } from '../types/models.js';
import type { BoardReportData, BoardReportAudience, BoardReportNarrativeResponse } from '../types/boardReport.js';
import { getWorkspaceId } from '../workspace.js';
import { buildBoardReportData } from './boardReports.js';
import { generateBoardReportNarrative } from '../services/aiAssistantService.js';

const router = Router();

// GET /api/v1/ai/board-report/overview
// Debug/support endpoint - returns the raw BoardReportData
router.get('/overview', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const data = await buildBoardReportData(workspaceId);

    const response: ApiResponse<BoardReportData> = {
      data,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error building board report data:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to build board report data',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/ai/board-report/generate
// Generates an AI narrative for the board report
router.post('/generate', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { audience = 'board' } = req.body as { audience?: BoardReportAudience };

    // Validate audience
    const validAudiences: BoardReportAudience[] = ['board', 'audit_committee', 'regulator'];
    if (!validAudiences.includes(audience)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid audience. Must be one of: ${validAudiences.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    // Build the board report data
    const data = await buildBoardReportData(workspaceId);

    // Generate the AI narrative
    const aiResult = await generateBoardReportNarrative(data, audience);

    const result: BoardReportNarrativeResponse = {
      narrative: aiResult.narrative,
      generatedAt: aiResult.generatedAt,
      audience,
      debug: aiResult.debug,
    };

    const response: ApiResponse<BoardReportNarrativeResponse> = {
      data: result,
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating board report narrative:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate board report narrative',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
