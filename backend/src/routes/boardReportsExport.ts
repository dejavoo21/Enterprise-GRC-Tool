import { Router } from 'express';
import type { ApiResponse } from '../types/models.js';
import type { BoardReportAudience } from '../types/boardReport.js';
import { getWorkspaceId } from '../workspace.js';
import { buildBoardReportData } from './boardReports.js';
import { generateBoardReportNarrative } from '../services/aiAssistantService.js';
import {
  buildBoardReportExport,
  buildBoardReportMarkdown,
  buildBoardReportPdfBuffer,
} from '../services/boardReportExportService.js';

const router = Router();

/**
 * POST /api/v1/reports/board/export/markdown
 * Generate and return the board report as Markdown
 */
router.post('/markdown', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const audience: BoardReportAudience = req.body.audience || 'board';

    // Build report data
    const data = await buildBoardReportData(workspaceId);

    // Generate AI narrative
    const aiResult = await generateBoardReportNarrative(data, audience);

    // Build export
    const exportResult = buildBoardReportExport(data, aiResult.narrative, audience);

    const response: ApiResponse<{ markdown: string; generatedAt: string }> = {
      data: {
        markdown: exportResult.markdown,
        generatedAt: new Date().toISOString(),
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating markdown export:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to generate markdown export',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/reports/board/export/html
 * Generate and return the board report as HTML
 */
router.post('/html', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const audience: BoardReportAudience = req.body.audience || 'board';

    // Build report data
    const data = await buildBoardReportData(workspaceId);

    // Generate AI narrative
    const aiResult = await generateBoardReportNarrative(data, audience);

    // Build export
    const exportResult = buildBoardReportExport(data, aiResult.narrative, audience);

    const response: ApiResponse<{ html: string; generatedAt: string }> = {
      data: {
        html: exportResult.html,
        generatedAt: new Date().toISOString(),
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating HTML export:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to generate HTML export',
      },
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/v1/reports/board/export/pdf
 * Generate and return the board report as PDF binary
 */
router.post('/pdf', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const audience: BoardReportAudience = req.body.audience || 'board';

    // Build report data
    const data = await buildBoardReportData(workspaceId);

    // Generate AI narrative
    const aiResult = await generateBoardReportNarrative(data, audience);

    // Build markdown first (used as source for PDF)
    const markdown = buildBoardReportMarkdown(data, aiResult.narrative, audience);

    // Generate PDF buffer
    const pdfBuffer = await buildBoardReportPdfBuffer(markdown, data, audience);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="board-report.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF export:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to generate PDF export',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
