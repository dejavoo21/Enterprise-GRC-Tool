import { Router } from 'express';
import type { ApiResponse } from '../types/models.js';
import * as trainingEngagementsRepo from '../repositories/trainingEngagementsRepo.js';
import * as pricingModelsRepo from '../repositories/pricingModelsRepo.js';
import * as kpiRepo from '../repositories/kpiRepo.js';
import * as frameworksRepo from '../repositories/frameworksRepo.js';
import * as aiAssistantService from '../services/aiAssistantService.js';
import { getWorkspaceId } from '../workspace.js';

const router = Router();

// GET /api/v1/ai/training-engagements/:id/proposal
// Generates an AI-powered training proposal for the engagement
router.get('/:id/proposal', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    // Fetch engagement
    const engagement = await trainingEngagementsRepo.getTrainingEngagementById(workspaceId, id);
    if (!engagement) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Fetch pricing model if assigned
    let pricingModel = undefined;
    if (engagement.pricingModelId) {
      pricingModel = await pricingModelsRepo.getPricingModelById(engagement.pricingModelId) || undefined;
    }

    // Fetch frameworks
    const frameworkCodes = await trainingEngagementsRepo.getEngagementFrameworks(id);
    const allFrameworks = await frameworksRepo.getFrameworks();
    const frameworkNames = frameworkCodes.map(code => {
      const fw = allFrameworks.find(f => f.code === code);
      return fw ? fw.name : code;
    });

    // Fetch KPI snapshots for this engagement
    const kpiSnapshots = await kpiRepo.getKpiSnapshots(workspaceId, { engagementId: id });
    const kpiDefinitions = await kpiRepo.getKpiDefinitions();

    // Generate proposal
    const proposalResult = await aiAssistantService.generateTrainingProposal({
      engagement,
      pricingModel,
      frameworkCodes,
      frameworkNames,
      kpiSnapshots,
      kpiDefinitions,
    }, workspaceId);

    const response: ApiResponse<{ proposal: string; generatedAt: string; debug?: typeof proposalResult.debug }> = {
      data: {
        proposal: proposalResult.proposal,
        generatedAt: proposalResult.generatedAt,
        debug: proposalResult.debug,
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'GENERATE_PROPOSAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate training proposal',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/ai/training-engagements/:id/ask
// Answers a question about the training engagement
router.post('/:id/ask', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Question is required and must be a string',
        },
      };
      return res.status(400).json(response);
    }

    // Fetch engagement
    const engagement = await trainingEngagementsRepo.getTrainingEngagementById(workspaceId, id);
    if (!engagement) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Training engagement with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Fetch pricing model if assigned
    let pricingModel = undefined;
    if (engagement.pricingModelId) {
      pricingModel = await pricingModelsRepo.getPricingModelById(engagement.pricingModelId) || undefined;
    }

    // Fetch frameworks
    const frameworkCodes = await trainingEngagementsRepo.getEngagementFrameworks(id);
    const allFrameworks = await frameworksRepo.getFrameworks();
    const frameworkNames = frameworkCodes.map(code => {
      const fw = allFrameworks.find(f => f.code === code);
      return fw ? fw.name : code;
    });

    // Fetch KPI snapshots for this engagement
    const kpiSnapshots = await kpiRepo.getKpiSnapshots(workspaceId, { engagementId: id });
    const kpiDefinitions = await kpiRepo.getKpiDefinitions();

    // Answer question
    const aiResponse = await aiAssistantService.answerTrainingEngagementQuestion(question, {
      engagement,
      pricingModel,
      frameworkCodes,
      frameworkNames,
      kpiSnapshots,
      kpiDefinitions,
    }, workspaceId);

    const response: ApiResponse<typeof aiResponse> = {
      data: aiResponse,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'ANSWER_QUESTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to answer question',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
