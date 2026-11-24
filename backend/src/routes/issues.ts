import { Router } from 'express';
import type { ApiResponse, DashboardIssueRecord } from '../types/models.js';
import * as issuesRepo from '../repositories/issuesRepo.js';
import * as actionsRepo from '../repositories/riskActionsRepo.js';
import { getWorkspaceId } from '../workspace.js';
import { buildActivityFromRequest, getActivitiesForTarget, recordActivity } from '../services/activityLedger/activityLedger.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { resolveEnterpriseRole } from '../middleware/permissionMiddleware.js';
import { validateActionStatusChange } from '../services/riskActionWorkflow.js';
import * as governanceRepo from '../repositories/accessGovernanceRepo.js';
import type { Request } from 'express';
import type { PermissionModule } from '../types/accessGovernance.js';

const statuses = new Set(['Open','In Progress','Blocked','Awaiting Evidence','Awaiting Review','Completed','Deferred','Cancelled']);
const priorities = new Set(['Low','Medium','High','Critical']);
const sources = new Set(['Risk','Treatment','Control','Evidence','Audit Readiness','Regulatory','Workflow','Incident','Vulnerability','Access Review','Asset Review','Vendor','Review Task','Training','Manual']);
const permissionModules = new Set<PermissionModule>(['Dashboard','AI','Risks','Incidents','Controls','Evidence','Audits','Resilience','Regulatory','Vendors','Policies','Training','Reports','Users','Settings']);
const sourceModules: Record<Exclude<DashboardIssueRecord['sourceType'], 'Workflow'>, PermissionModule> = {
  Risk: 'Risks', Treatment: 'Risks', Control: 'Controls', Evidence: 'Evidence',
  'Audit Readiness': 'Audits', Regulatory: 'Regulatory', Incident: 'Incidents', Vulnerability: 'Incidents',
  'Access Review': 'Users', 'Asset Review': 'Controls', Vendor: 'Vendors', 'Review Task': 'Policies',
  Training: 'Training', Manual: 'Risks',
};

export function actionPermissionModule(action: Pick<DashboardIssueRecord, 'sourceType' | 'domain'>): PermissionModule | null {
  if (action.sourceType === 'Evidence' && action.domain === 'Audit Evidence Request') return 'Audits';
  if (action.sourceType !== 'Workflow') return sourceModules[action.sourceType];
  return permissionModules.has(action.domain as PermissionModule) ? action.domain as PermissionModule : null;
}

async function readableActionModules(req: Request, actions: DashboardIssueRecord[]) {
  const requested = new Set(actions.map(actionPermissionModule).filter((moduleName): moduleName is PermissionModule => Boolean(moduleName)));
  const readable = new Set<PermissionModule>(['Risks']);
  const roleId = await resolveEnterpriseRole(req);
  if (!roleId || !req.authUser) return readable;
  await Promise.all([...requested].filter(moduleName => moduleName !== 'Risks').map(async moduleName => {
    if (await governanceRepo.hasPermission(req.authUser!.workspaceId, roleId as Parameters<typeof governanceRepo.hasPermission>[1], moduleName, 'view')) readable.add(moduleName);
  }));
  return readable;
}

async function canReadAction(req: Request, action: DashboardIssueRecord) {
  const moduleName = actionPermissionModule(action);
  return Boolean(moduleName && (await readableActionModules(req, [action])).has(moduleName));
}

async function log(req: Parameters<typeof buildActivityFromRequest>[0], action: string, current: DashboardIssueRecord, previous?: DashboardIssueRecord) {
  await recordActivity(buildActivityFromRequest(req, { action, category:'issue', targetType:'risk_action', targetId:current.id, targetName:current.actionRef || current.title, previousValue:previous, newValue:current, source:'backend' }));
}

const router = Router();

router.get('/', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
    const overdue = req.query.overdue === 'true';
    if ((source && !sources.has(source)) || (status && !statuses.has(status)) || (priority && !priorities.has(priority))) {
      return res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid action filter' } });
    }
    const derived = await issuesRepo.getDerivedIssues(workspaceId);
    await actionsRepo.syncDerived(workspaceId, derived);
    const listed = await actionsRepo.list(workspaceId, {
      source: source as DashboardIssueRecord['sourceType'],
      status: status as DashboardIssueRecord['status'],
      priority: priority as DashboardIssueRecord['priority'],
      overdue,
    });
    const readableModules = await readableActionModules(req, listed);
    const data = listed.filter(action => {
      const moduleName = actionPermissionModule(action);
      return Boolean(moduleName && readableModules.has(moduleName));
    });

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

router.get('/history/:id',async(req,res)=>{try{const workspaceId=getWorkspaceId(req);const action=await actionsRepo.get(workspaceId,req.params.id);if(!action||!await canReadAction(req,action))return res.status(404).json({data:null,error:{code:'ACTION_NOT_FOUND',message:'Action not found'}});const data=await getActivitiesForTarget(workspaceId,'risk_action',action.id);res.json({data,error:null});}catch(error){res.status(500).json({data:null,error:{code:'ACTION_HISTORY_FAILED',message:error instanceof Error?error.message:'Failed to load action history'}});}});

router.get('/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const issue = await actionsRepo.get(workspaceId, req.params.id);

    if (!issue || !await canReadAction(req, issue)) {
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
      data: { ...issue, activityHistory: await getActivitiesForTarget(workspaceId,'risk_action',issue.id) },
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

router.post('/', requirePermission('Risks','edit'), async (req, res) => {
  try {
    const workspaceId=getWorkspaceId(req); const {title,owner,status='Open',priority='Medium'}=req.body;
    if(!String(title||'').trim()||!String(owner||'').trim()||!statuses.has(status)||!priorities.has(priority)) return res.status(400).json({data:null,error:{code:'VALIDATION_ERROR',message:'Title, owner, valid status and valid priority are required'}});
    const action=await actionsRepo.createManual(workspaceId,{...req.body,title:String(title).trim(),owner:String(owner).trim(),status,priority}); await log(req,'risk_action_created',action); res.status(201).json({data:action,error:null});
  } catch(error){res.status(500).json({data:null,error:{code:'ACTION_CREATE_FAILED',message:error instanceof Error?error.message:'Failed to create action'}});}
});

router.patch('/:id', requirePermission('Risks','edit'), async (req,res)=>{
  try{
    const workspaceId=getWorkspaceId(req); const previous=await actionsRepo.get(workspaceId,req.params.id); if(!previous||!await canReadAction(req,previous))return res.status(404).json({data:null,error:{code:'ACTION_NOT_FOUND',message:'Action not found'}});
    if(req.body.status!==undefined&&!statuses.has(req.body.status))return res.status(400).json({data:null,error:{code:'VALIDATION_ERROR',message:'Invalid action status'}});
    if(req.body.priority!==undefined&&!priorities.has(req.body.priority))return res.status(400).json({data:null,error:{code:'VALIDATION_ERROR',message:'Invalid action priority'}});
    if (req.body.status !== undefined) { const transitionError=validateActionStatusChange(previous,req.body.status); if(transitionError)return res.status(409).json({data:null,error:{code:'SOURCE_WORKFLOW_REQUIRED',message:transitionError}}); }
    const current=await actionsRepo.update(workspaceId,req.params.id,req.body); if(!current)return res.status(404).json({data:null,error:{code:'ACTION_NOT_FOUND',message:'Action not found'}});
    const activity=previous.status!==current.status?(current.status==='Completed'?'risk_action_completed':previous.status==='Completed'?'risk_action_reopened':'risk_action_status_changed'):previous.owner!==current.owner?'risk_action_owner_changed':previous.dueDate!==current.dueDate?'risk_action_due_date_changed':'risk_action_updated';
    await log(req,activity,current,previous); res.json({data:current,error:null});
  }catch(error){res.status(500).json({data:null,error:{code:'ACTION_UPDATE_FAILED',message:error instanceof Error?error.message:'Failed to update action'}});}
});

export default router;
