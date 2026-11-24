import { Router } from 'express';
import type {
  ApiResponse,
  Control,
  ControlFrameworkMapping,
  ControlWithFrameworks,
  ControlFramework,
} from '../types/models.js';
import * as controlsRepo from '../repositories/controlsRepo.js';
import * as controlMappingsRepo from '../repositories/controlMappingsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { logActivity, buildLogInputFromRequest } from '../services/activityLogService.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import * as assuranceRepo from '../repositories/controlAssuranceRepo.js';
import { assertAssuranceDecision, assertAssuranceSubmission } from '../services/controlAssuranceRules.js';

const router = Router();
router.use(requirePermission('Controls', 'view'));

// Helper to enrich control with frameworks array
async function enrichControl(workspaceId: string, control: Control): Promise<ControlWithFrameworks> {
  const frameworks = (await controlMappingsRepo.getFrameworksForControl(workspaceId, control.id)) as ControlFramework[];
  return {
    ...control,
    frameworks,
  };
}

// GET /api/v1/controls
// Returns all controls with optional filtering
// Supports ?framework=ISO27001 to filter controls with that framework mapping
// Supports ?status=implemented to filter by status
// Supports ?domain=Access+Control to filter by domain
router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, domain, owner, framework } = req.query;

    let controls = await controlsRepo.getControls(workspaceId, {
      status: typeof status === 'string' ? status : undefined,
      domain: typeof domain === 'string' ? domain : undefined,
    });

    // Client-side owner filter
    if (owner && typeof owner === 'string') {
      controls = controls.filter(c => c.owner.toLowerCase().includes(owner.toLowerCase()));
    }

    // Framework filter
    if (framework && typeof framework === 'string') {
      const controlIdsForFramework = (await controlMappingsRepo.getAllMappings(workspaceId, framework))
        .map(m => m.controlId);
      controls = controls.filter(c => controlIdsForFramework.includes(c.id));
    }

    // Enrich controls with frameworks array
    const enrichedControls = await Promise.all(controls.map(c => enrichControl(workspaceId, c)));

    const response: ApiResponse<ControlWithFrameworks[]> = {
      data: enrichedControls,
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_CONTROLS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch controls',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/controls/summary
// Returns summary statistics for controls
router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const allControls = await controlsRepo.getControls(workspaceId);
    const allMappings = await controlMappingsRepo.getAllMappings(workspaceId);

    const totalControls = allControls.length;

    // Count by status
    const implemented = allControls.filter(c => c.status === 'implemented').length;
    const inProgress = allControls.filter(c => c.status === 'in_progress').length;
    const notImplemented = allControls.filter(c => c.status === 'not_implemented').length;
    const notApplicable = allControls.filter(c => c.status === 'not_applicable').length;

    // Count by framework
    const frameworkCounts: Record<string, number> = {};
    allMappings.forEach(m => {
      frameworkCounts[m.framework] = (frameworkCounts[m.framework] || 0) + 1;
    });

    // Get unique frameworks
    const frameworks = [...new Set(allMappings.map(m => m.framework))];

    // Get unique domains
    const domains = [...new Set(allControls.map(c => c.domain).filter(Boolean))] as string[];

    const response: ApiResponse<{
      totalControls: number;
      statusCounts: {
        implemented: number;
        inProgress: number;
        notImplemented: number;
        notApplicable: number;
      };
      frameworkCounts: Record<string, number>;
      frameworks: string[];
      domains: string[];
    }> = {
      data: {
        totalControls,
        statusCounts: {
          implemented,
          inProgress,
          notImplemented,
          notApplicable,
        },
        frameworkCounts,
        frameworks,
        domains,
      },
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'FETCH_SUMMARY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch control summary',
      },
    };
    res.status(500).json(response);
  }
});

// GET /api/v1/controls/:id
// Returns a single control by ID with frameworks array
router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const control = await controlsRepo.getControlById(workspaceId, id);

    if (!control) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Control with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<ControlWithFrameworks> = {
        data: await enrichControl(workspaceId, control),
        error: null,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'FETCH_CONTROL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch control',
        },
      };
      res.status(500).json(response);
    }
});

router.get('/:id/effectiveness', async(req,res)=>res.json({data:await assuranceRepo.listAssessments(getWorkspaceId(req),req.params.id),error:null}));
router.post('/:id/effectiveness', requirePermission('Controls','edit'), async(req,res)=>{
  try {
    if(!req.body?.testMethod) return res.status(400).json({data:null,error:{code:'VALIDATION_ERROR',message:'testMethod is required.'}});
    const data=await assuranceRepo.createAssessment(getWorkspaceId(req),req.params.id,req.authUser!.userId,req.body);
    await logActivity(buildLogInputFromRequest(req,{entityType:'control',entityId:req.params.id,action:'create',summary:`Created effectiveness assessment ${data.assessmentRef}`,details:{assessmentId:data.id}}));
    return res.status(201).json({data,error:null});
  } catch(error){const code=error&&typeof error==='object'&&'code' in error?String(error.code):'CREATE_ASSESSMENT_ERROR';return res.status(400).json({data:null,error:{code,message:error instanceof Error?error.message:'Unable to create assessment.'}});}
});
router.post('/:controlId/effectiveness/:id/submit', requirePermission('Controls','edit'), async(req,res)=>{
  const current=await assuranceRepo.getAssessment(getWorkspaceId(req),req.params.id);
  if(!current||current.controlId!==req.params.controlId)return res.status(404).json({data:null,error:{code:'NOT_FOUND',message:'Assessment not found.'}});
  try{assertAssuranceSubmission(current.status,current.evidenceIds);const data=await assuranceRepo.submitAssessment(getWorkspaceId(req),current.id,req.authUser!.userId);await logActivity(buildLogInputFromRequest(req,{entityType:'control',entityId:req.params.controlId,action:'review',summary:`Submitted effectiveness assessment ${current.assessmentRef}`,details:{assessmentId:current.id}}));return res.json({data,error:null});}
  catch(error){const code=error&&typeof error==='object'&&'code' in error?String(error.code):'SUBMIT_FAILED';return res.status(409).json({data:null,error:{code,message:error instanceof Error?error.message:'Unable to submit assessment.'}});}
});
router.post('/:controlId/effectiveness/:id/decision', requirePermission('Controls','approve'), async(req,res)=>{
  const current=await assuranceRepo.getAssessment(getWorkspaceId(req),req.params.id);
  if(!current||current.controlId!==req.params.controlId)return res.status(404).json({data:null,error:{code:'NOT_FOUND',message:'Assessment not found.'}});
  if(!['approved','rejected'].includes(req.body?.decision))return res.status(400).json({data:null,error:{code:'VALIDATION_ERROR',message:'Decision must be approved or rejected.'}});
  try{assertAssuranceDecision(current.status,current.createdBy,req.authUser!.userId);const data=await assuranceRepo.decideAssessment(getWorkspaceId(req),current.id,req.authUser!.userId,req.body.decision,req.body.notes);await logActivity(buildLogInputFromRequest(req,{entityType:'control',entityId:req.params.controlId,action:'review',summary:`${req.body.decision==='approved'?'Approved':'Rejected'} effectiveness assessment ${current.assessmentRef}`,details:{assessmentId:current.id,notes:req.body.notes||null}}));return res.json({data,error:null});}
  catch(error){const code=error&&typeof error==='object'&&'code' in error?String(error.code):'DECISION_FAILED';return res.status(409).json({data:null,error:{code,message:error instanceof Error?error.message:'Unable to decide assessment.'}});}
});

// POST /api/v1/controls
// Creates a new control
router.post('/', requirePermission('Controls', 'create'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const input = req.body;

    // Basic validation
    if (!input.title || !input.owner) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and owner are required',
        },
      };
      return res.status(400).json(response);
    }

    const newControl = await controlsRepo.createControl(workspaceId, {
      title: input.title,
      description: input.description || '',
      owner: input.owner,
      status: input.status || 'not_implemented',
      domain: input.domain,
      primaryFramework: input.primaryFramework,
    });

    // Log activity
    if (req.authUser) {
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'control',
        entityId: newControl.id,
        action: 'create',
        summary: `Created control "${newControl.title}"`,
        details: newControl,
      }));
    }

    const response: ApiResponse<ControlWithFrameworks> = {
      data: await enrichControl(workspaceId, newControl),
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'CREATE_CONTROL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create control',
      },
    };
    res.status(500).json(response);
  }
});

// PATCH /api/v1/controls/:id
// Updates an existing control
router.patch('/:id', requirePermission('Controls', 'edit'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const updates = req.body;

    // Fetch existing control for logging
    const existingControl = await controlsRepo.getControlById(workspaceId, id);

    const updatedControl = await controlsRepo.updateControl(workspaceId, id, updates);

    if (!updatedControl) {
      const response: ApiResponse<null> = {
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: `Control with ID ${id} not found`,
        },
      };
      return res.status(404).json(response);
    }

    // Log activity
    if (req.authUser) {
      const isStatusChange = existingControl && updates.status && existingControl.status !== updates.status;
      await logActivity(buildLogInputFromRequest(req, {
        entityType: 'control',
        entityId: id,
        action: isStatusChange ? 'status_change' : 'update',
        summary: isStatusChange
          ? `Control "${updatedControl.title}" status changed from ${existingControl.status} to ${updates.status}`
          : `Updated control "${updatedControl.title}"`,
        details: { before: existingControl, after: updatedControl },
      }));
    }

    const response: ApiResponse<ControlWithFrameworks> = {
      data: await enrichControl(workspaceId, updatedControl),
      error: null,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'UPDATE_CONTROL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update control',
      },
    };
    res.status(500).json(response);
  }
});

router.post('/:id/archive', requirePermission('Controls', 'delete'), async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const before = await controlsRepo.getControlById(workspaceId, req.params.id);
    if (!before) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Control not found.' } });
    const result = await controlsRepo.archiveControl(workspaceId, before.id);
    await logActivity(buildLogInputFromRequest(req, { entityType: 'control', entityId: before.id, action: 'status_change', summary: `Archived control "${before.title}" while preserving ${result.dependencies.evidence} evidence and ${result.dependencies.treatments} treatment links`, details: { before, after: result.control, dependencies: result.dependencies } }));
    return res.json({ data: result, error: null });
  } catch (error) {
    return res.status(500).json({ data: null, error: { code: 'ARCHIVE_CONTROL_ERROR', message: error instanceof Error ? error.message : 'Unable to archive control.' } });
  }
});

export default router;
