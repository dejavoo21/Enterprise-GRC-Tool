import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.join(process.cwd(), 'grc-tool', 'backend', '.env') });
// Fallback: also try from current directory
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

import express from 'express';
import cors from 'cors';
import auditReadinessRouter from './routes/audit-readiness.js';
import trainingRouter from './routes/training.js';
import risksRouter from './routes/risks.js';
import riskMethodologiesRouter from './routes/riskMethodologies.js';
import controlsRouter from './routes/controls.js';
import controlMappingsRouter from './routes/control-mappings.js';
import evidenceRouter from './routes/evidence.js';
import assetsRouter from './routes/assets.js';
import vendorsRouter from './routes/vendors.js';
import reportsRouter from './routes/reports.js';
import workspacesRouter from './routes/workspaces.js';
import pricingModelsRouter from './routes/pricing-models.js';
import trainingEngagementsRouter from './routes/training-engagements.js';
import awarenessContentRouter from './routes/awareness-content.js';
import governanceDocumentsRouter from './routes/governance-documents.js';
import reviewTasksRouter from './routes/review-tasks.js';
import documentReviewLogsRouter from './routes/document-review-logs.js';
import frameworksRouter from './routes/frameworks.js';
import frameworkAssessmentScopesRouter from './routes/frameworkAssessmentScopes.js';
import dataProtectionReportsRouter from './routes/dataProtectionReports.js';
import kpiRouter from './routes/kpi.js';
import trainingAiRouter from './routes/trainingAi.js';
import controlLinkingRouter from './routes/controlLinking.js';
import boardReportsRouter from './routes/boardReports.js';
import boardReportsAiRouter from './routes/boardReportsAi.js';
import boardReportsExportRouter from './routes/boardReportsExport.js';
import authRouter from './routes/auth.js';
import activityLogRouter from './routes/activityLog.js';
import activityLedgerRouter from './routes/activityLedger.js';
import regulatoryRouter from './routes/regulatory.js';
import riskIntelligenceRouter from './routes/riskIntelligence.js';
import governanceApplicabilityRouter from './routes/governanceApplicability.js';
import reportingCenterRouter from './routes/reportingCenter.js';
import businessContinuityRouter from './routes/businessContinuity.js';
import aiGovernanceRouter from './routes/aiGovernance.js';
import esgRouter from './routes/esg.js';
import privacyRouter from './routes/privacy.js';
import enterpriseOpsRouter from './routes/enterpriseOps.js';
import tprmRouter from './routes/tprm.js';
import enterpriseWorkflowsRouter from './routes/enterpriseWorkflows.js';
import issuesRouter from './routes/issues.js';
import incidentManagementRouter from './routes/incidentManagement.js';
import continuousAssuranceRouter from './routes/continuousAssurance.js';
import riskTreatmentsRouter from './routes/riskTreatments.js';
import riskLibraryRouter from './routes/riskLibrary.js';
import dataQualityRouter from './routes/dataQuality.js';
import recordsGovernanceRouter from './routes/recordsGovernance.js';
import groupGovernanceRouter from './routes/groupGovernance.js';
import relationshipsRouter from './routes/relationships.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { syncAccessGovernanceDefaults } from './services/accessGovernanceBootstrap.js';
import adminAccessGovernanceRouter from './routes/adminAccessGovernance.js';
import { requireModulePermissions } from './middleware/permissionMiddleware.js';
import { startReminderScheduler } from './services/reviewReminderScheduler.js';
import { syncWorkspaceIdentities } from './repositories/workspacesRepo.js';
import { ensureContinuousAssuranceSchema } from './services/continuousAssurance/continuousAssurance.js';
import { runRuntimeSchemaBootstrap } from './services/startupSchemaPolicy.js';
import { requireAuthenticatedWorkspace } from './workspace.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from public directory
const publicPath = path.join(process.cwd(), 'grc-tool', 'backend', 'public');
app.use(express.static(publicPath));

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Service landing route so the backend root is not confused with the frontend app
app.get('/', (_req, res) => {
  res.json({
    data: {
      service: 'GRC Backend API',
      status: 'ok',
      docsHint: 'Use the frontend app URL for the user interface.',
      frontendUrl: 'https://amiable-acceptance-production.up.railway.app',
      backendUrl: 'https://enterprise-grc-tool-backend.up.railway.app',
      productName: 'Enterprise GRC Tool',
      healthUrl: '/health',
      apiBase: '/api/v1',
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

// ============================================
// Public Routes (no auth required)
// ============================================
app.use('/api/v1/auth', authRouter);

// ============================================
// Protected Routes (require authentication)
// ============================================
// All routes below require a valid JWT token

app.use('/api/v1/admin', requireAuth, requireAuthenticatedWorkspace, adminAccessGovernanceRouter);
app.use('/api/v1/workspaces', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Users'), workspacesRouter);
app.use('/api/v1/audit-readiness', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Audits'), auditReadinessRouter);
app.use('/api/v1/training', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Training'), trainingRouter);
app.use('/api/v1/risks', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Risks'), risksRouter);
app.use('/api/v1/risk-methodologies', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Risks'), riskMethodologiesRouter);
app.use('/api/v1/risk-intelligence', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Risks'), riskIntelligenceRouter);
app.use('/api/v1/governance', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Controls'), governanceApplicabilityRouter);
app.use('/api/v1/risk-treatments', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Risks'), riskTreatmentsRouter);
app.use('/api/v1/risk-library', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Risks'), riskLibraryRouter);
app.use('/api/v1/controls', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Controls'), controlsRouter);
app.use('/api/v1/control-mappings', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Controls'), controlMappingsRouter);
app.use('/api/v1/evidence', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Evidence'), evidenceRouter);
app.use('/api/v1/assets', requireAuth, requireAuthenticatedWorkspace, assetsRouter);
app.use('/api/v1/vendors', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Vendors'), vendorsRouter);
app.use('/api/v1/reports', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), reportsRouter);
app.use('/api/v1/pricing-models', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), pricingModelsRouter);
app.use('/api/v1/training-engagements', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Training'), trainingEngagementsRouter);
app.use('/api/v1/awareness-content', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Training'), awarenessContentRouter);
app.use('/api/v1/governance-documents', requireAuth, requireAuthenticatedWorkspace, governanceDocumentsRouter);
app.use('/api/v1/review-tasks', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Policies'), reviewTasksRouter);
app.use('/api/v1/document-review-logs', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Policies'), documentReviewLogsRouter);
app.use('/api/v1/frameworks', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Settings'), frameworksRouter);
app.use('/api/v1/framework-assessment-scopes', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Controls'), frameworkAssessmentScopesRouter);
app.use('/api/v1/reports/data-protection', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), dataProtectionReportsRouter);
app.use('/api/v1/kpi', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), kpiRouter);
app.use('/api/v1/ai/training-engagements', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Training'), trainingAiRouter);
app.use('/api/v1/links', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Controls'), controlLinkingRouter);
app.use('/api/v1/reports/board', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), boardReportsRouter);
app.use('/api/v1/ai/board-report', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), boardReportsAiRouter);
app.use('/api/v1/reports/board/export', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports', { POST: 'export' }), boardReportsExportRouter);
app.use('/api/v1/reporting-center', requireAuth, requireAuthenticatedWorkspace, reportingCenterRouter);
app.use('/api/v1/business-continuity', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Resilience'), businessContinuityRouter);
app.use('/api/v1/ai-governance', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('AI'), aiGovernanceRouter);
app.use('/api/v1/esg', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Reports'), esgRouter);
app.use('/api/v1/privacy', requireAuth, requireAuthenticatedWorkspace, privacyRouter);
app.use('/api/v1/enterprise-ops', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Dashboard'), enterpriseOpsRouter);
app.use('/api/v1/issues', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Risks'), issuesRouter);
app.use('/api/v1/incidents', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Incidents'), incidentManagementRouter);
app.use('/api/v1/continuous-assurance', requireAuth, requireAuthenticatedWorkspace, continuousAssuranceRouter);
app.use('/api/v1/activity', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Users'), activityLogRouter);
app.use('/api/v1/activity-ledger', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Users'), activityLedgerRouter);
app.use('/api/v1/regulatory', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Regulatory'), regulatoryRouter);
app.use('/api/v1/tprm', tprmRouter); // Auth handled internally
app.use('/api/v1/workflows', requireAuth, requireAuthenticatedWorkspace, enterpriseWorkflowsRouter);
app.use('/api/v1/data-quality', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Settings'), dataQualityRouter);
app.use('/api/v1/records-governance', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Settings'), recordsGovernanceRouter);
app.use('/api/v1/group-governance', requireAuth, requireAuthenticatedWorkspace, requireModulePermissions('Settings'), groupGovernanceRouter);
app.use('/api/v1/relationships', requireAuth, requireAuthenticatedWorkspace, relationshipsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Global error handler middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled route error:', err);
  res.status(500).json({
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

async function startServer() {
  await runRuntimeSchemaBootstrap({
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: process.env.ALLOW_RUNTIME_SCHEMA_BOOTSTRAP,
  }, [
    syncAccessGovernanceDefaults,
    syncWorkspaceIdentities,
    ensureContinuousAssuranceSchema,
  ]);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`GRC Backend API running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Auth API: http://localhost:${PORT}/api/v1/auth`);
    console.log(`Audit Readiness API: http://localhost:${PORT}/api/v1/audit-readiness`);
    console.log(`Training API: http://localhost:${PORT}/api/v1/training`);
    console.log(`Risks API: http://localhost:${PORT}/api/v1/risks`);
    console.log(`Controls API: http://localhost:${PORT}/api/v1/controls`);
    console.log(`Control Mappings API: http://localhost:${PORT}/api/v1/control-mappings`);
    console.log(`Evidence API: http://localhost:${PORT}/api/v1/evidence`);
    console.log(`Assets API: http://localhost:${PORT}/api/v1/assets`);
    console.log(`Vendors API: http://localhost:${PORT}/api/v1/vendors`);
    console.log(`Governance Documents API: http://localhost:${PORT}/api/v1/governance-documents`);
    console.log(`Review Tasks API: http://localhost:${PORT}/api/v1/review-tasks`);
    console.log(`Frameworks API: http://localhost:${PORT}/api/v1/frameworks`);
    console.log(`Data Protection Reports API: http://localhost:${PORT}/api/v1/reports/data-protection`);
    console.log(`Regulatory Change API: http://localhost:${PORT}/api/v1/regulatory`);

    startReminderScheduler();
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
