import { Router } from 'express';
import type { ApiResponse, PricingModel } from '../types/models.js';
import * as pricingModelsRepo from '../repositories/pricingModelsRepo.js';

const router = Router();

// GET /api/v1/pricing-models
// Returns all pricing models (global - not workspace-specific)
router.get('/', async (_req, res) => {
  try {
    const pricingModels = await pricingModelsRepo.getPricingModels();

    const response: ApiResponse<PricingModel[]> = {
      data: pricingModels,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_PRICING_MODELS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch pricing models',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/pricing-models/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pricingModel = await pricingModelsRepo.getPricingModelById(id);

    if (!pricingModel) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Pricing model with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<PricingModel> = {
      data: pricingModel,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_PRICING_MODEL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch pricing model',
      },
    };
    res.status(500).json(response);
  }
});

// POST /api/v1/pricing-models
// Creates a new pricing model
router.post('/', async (req, res) => {
  try {
    const input = req.body;

    // Basic validation
    if (!input.code || !input.name || !input.billingBasis || input.unitPrice === undefined) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Code, name, billingBasis, and unitPrice are required',
        },
      };
      return res.status(400).json(response);
    }

    // Validate billing basis
    const validBillingBasis = ['per_user', 'per_department', 'per_year', 'fixed_fee'];
    if (!validBillingBasis.includes(input.billingBasis)) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid billing basis. Must be one of: ${validBillingBasis.join(', ')}`,
        },
      };
      return res.status(400).json(response);
    }

    const newPricingModel = await pricingModelsRepo.createPricingModel({
      code: input.code,
      name: input.name,
      billingBasis: input.billingBasis,
      currency: input.currency || 'USD',
      unitPrice: input.unitPrice,
      minUnits: input.minUnits,
      maxUnits: input.maxUnits,
      notes: input.notes,
    });

    const response: ApiResponse<PricingModel> = {
      data: newPricingModel,
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_PRICING_MODEL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create pricing model',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/pricing-models/:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedModel = await pricingModelsRepo.updatePricingModel(id, updates);

    if (!updatedModel) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Pricing model with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<PricingModel> = {
      data: updatedModel,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_PRICING_MODEL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update pricing model',
      },
    };
    res.status(500).json(response);
  }
});

// DELETE /api/v1/pricing-models/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await pricingModelsRepo.deletePricingModel(id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Pricing model with ID ${id} not found`,
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
        code: 'DELETE_PRICING_MODEL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete pricing model',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
