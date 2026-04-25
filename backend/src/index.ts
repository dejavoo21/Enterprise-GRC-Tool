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
import dataProtectionReportsRouter from './routes/dataProtectionReports.js';
import kpiRouter from './routes/kpi.js';
import trainingAiRouter from './routes/trainingAi.js';
import controlLinkingRouter from './routes/controlLinking.js';
import boardReportsRouter from './routes/boardReports.js';
import boardReportsAiRouter from './routes/boardReportsAi.js';
import boardReportsExportRouter from './routes/boardReportsExport.js';
import authRouter from './routes/auth.js';
import activityLogRouter from './routes/activityLog.js';
import tprmRouter from './routes/tprm.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { startReminderScheduler } from './services/reviewReminderScheduler.js';

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
      backendUrl: 'https://courteous-beauty-production.up.railway.app',
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

app.use('/api/v1/workspaces', requireAuth, workspacesRouter);
app.use('/api/v1/audit-readiness', requireAuth, auditReadinessRouter);
app.use('/api/v1/training', requireAuth, trainingRouter);
app.use('/api/v1/risks', requireAuth, risksRouter);
app.use('/api/v1/controls', requireAuth, controlsRouter);
app.use('/api/v1/control-mappings', requireAuth, controlMappingsRouter);
app.use('/api/v1/evidence', requireAuth, evidenceRouter);
app.use('/api/v1/assets', requireAuth, assetsRouter);
app.use('/api/v1/vendors', requireAuth, vendorsRouter);
app.use('/api/v1/reports', requireAuth, reportsRouter);
app.use('/api/v1/pricing-models', requireAuth, pricingModelsRouter);
app.use('/api/v1/training-engagements', requireAuth, trainingEngagementsRouter);
app.use('/api/v1/awareness-content', requireAuth, awarenessContentRouter);
app.use('/api/v1/governance-documents', requireAuth, governanceDocumentsRouter);
app.use('/api/v1/review-tasks', requireAuth, reviewTasksRouter);
app.use('/api/v1/document-review-logs', requireAuth, documentReviewLogsRouter);
app.use('/api/v1/frameworks', requireAuth, frameworksRouter);
app.use('/api/v1/reports/data-protection', requireAuth, dataProtectionReportsRouter);
app.use('/api/v1/kpi', requireAuth, kpiRouter);
app.use('/api/v1/ai/training-engagements', requireAuth, trainingAiRouter);
app.use('/api/v1/links', requireAuth, controlLinkingRouter);
app.use('/api/v1/reports/board', requireAuth, boardReportsRouter);
app.use('/api/v1/ai/board-report', requireAuth, boardReportsAiRouter);
app.use('/api/v1/reports/board/export', requireAuth, boardReportsExportRouter);
app.use('/api/v1/activity', requireAuth, activityLogRouter);
app.use('/api/v1/tprm', tprmRouter); // Auth handled internally

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

// Start server
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

  // Start the review reminder scheduler
  startReminderScheduler();
});

// Error handling
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
