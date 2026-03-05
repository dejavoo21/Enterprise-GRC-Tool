import { Router } from 'express';
import type { ApiResponse } from '../types/models.js';
import type { BoardReportData, BoardFrameworkSummary, BoardRiskSummary, BoardPolicySummary, BoardTrainingSummary, BoardAiPrivacySummary } from '../types/boardReport.js';
import { getWorkspaceId } from '../workspace.js';
import { query } from '../db.js';
import * as frameworksRepo from '../repositories/frameworksRepo.js';
import * as trainingCoursesRepo from '../repositories/trainingCoursesRepo.js';

const router = Router();

/**
 * Build BoardReportData for a workspace
 * This is extracted as a helper so it can be reused by both the overview route and the AI route
 */
export async function buildBoardReportData(workspaceId: string): Promise<BoardReportData> {
  // 1. Get default frameworks
  const frameworks = await frameworksRepo.getFrameworks({ isDefault: true });

  // 2. Build framework summaries
  const frameworkSummaries: BoardFrameworkSummary[] = [];

  for (const fw of frameworks) {
    // Get controls mapped to this framework
    const controlsResult = await query<any>(
      `SELECT DISTINCT c.id, c.status
       FROM controls c
       INNER JOIN control_mappings cm ON c.id = cm.control_id
       WHERE c.workspace_id = $1 AND cm.framework = $2`,
      [workspaceId, fw.code]
    );

    const controlIds = controlsResult.rows.map((r: any) => r.id);
    const totalControls = controlIds.length;

    // Count by status
    let implemented = 0;
    let inProgress = 0;
    let notImplemented = 0;
    let notApplicable = 0;

    for (const row of controlsResult.rows) {
      switch (row.status) {
        case 'implemented':
          implemented++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'not_implemented':
          notImplemented++;
          break;
        case 'not_applicable':
          notApplicable++;
          break;
        default:
          notImplemented++;
      }
    }

    // Controls with evidence
    let controlsWithEvidence = 0;
    if (controlIds.length > 0) {
      const evidenceResult = await query<any>(
        `SELECT COUNT(DISTINCT control_id) as count
         FROM evidence
         WHERE workspace_id = $1 AND control_id = ANY($2)`,
        [workspaceId, controlIds]
      );
      controlsWithEvidence = parseInt(evidenceResult.rows[0]?.count || '0', 10);
    }

    // Controls with policy links
    let controlsWithPolicy = 0;
    if (controlIds.length > 0) {
      const policyResult = await query<any>(
        `SELECT COUNT(DISTINCT control_id) as count
         FROM control_governance_documents
         WHERE workspace_id = $1 AND control_id = ANY($2)`,
        [workspaceId, controlIds]
      );
      controlsWithPolicy = parseInt(policyResult.rows[0]?.count || '0', 10);
    }

    // Controls with training links
    let controlsWithTraining = 0;
    if (controlIds.length > 0) {
      const trainingResult = await query<any>(
        `SELECT COUNT(DISTINCT control_id) as count
         FROM control_training_courses
         WHERE workspace_id = $1 AND control_id = ANY($2)`,
        [workspaceId, controlIds]
      );
      controlsWithTraining = parseInt(trainingResult.rows[0]?.count || '0', 10);
    }

    frameworkSummaries.push({
      frameworkCode: fw.code,
      frameworkName: fw.name,
      totalControls,
      implemented,
      inProgress,
      notImplemented,
      notApplicable,
      controlsWithEvidence,
      controlsWithPolicy,
      controlsWithTraining,
    });
  }

  // 3. Build risk summary
  const risksResult = await query<any>(
    `SELECT id, title, status, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact
     FROM risks
     WHERE workspace_id = $1
     ORDER BY (inherent_likelihood * inherent_impact) DESC`,
    [workspaceId]
  );

  const risks = risksResult.rows;
  let highRisks = 0;
  let mediumRisks = 0;
  let lowRisks = 0;
  let openRisks = 0;
  let closedRisks = 0;

  for (const risk of risks) {
    const severityScore = risk.inherent_likelihood * risk.inherent_impact;
    if (severityScore >= 12) {
      highRisks++;
    } else if (severityScore >= 6) {
      mediumRisks++;
    } else {
      lowRisks++;
    }

    if (risk.status === 'closed' || risk.status === 'accepted') {
      closedRisks++;
    } else {
      openRisks++;
    }
  }

  // Top 5 risks
  const topRisks = risks.slice(0, 5).map((r: any) => ({
    id: r.id,
    title: r.title,
    severityScore: r.inherent_likelihood * r.inherent_impact,
    status: r.status,
    linkedControlsCount: 0, // Could be fetched from risk_controls if such a table exists
  }));

  const riskSummary: BoardRiskSummary = {
    totalRisks: risks.length,
    highRisks,
    mediumRisks,
    lowRisks,
    openRisks,
    closedRisks,
    topRisks,
  };

  // 4. Build policy summary
  const policyResult = await query<any>(
    `SELECT status, next_review_date
     FROM governance_documents
     WHERE workspace_id = $1 AND status != 'retired'`,
    [workspaceId]
  );

  const docs = policyResult.rows;
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  let approved = 0;
  let inReview = 0;
  let overdueReviews = 0;
  let dueNext30Days = 0;

  for (const doc of docs) {
    if (doc.status === 'approved') approved++;
    if (doc.status === 'in_review') inReview++;

    if (doc.next_review_date) {
      const reviewDate = new Date(doc.next_review_date);
      if (reviewDate < today) {
        overdueReviews++;
      } else if (reviewDate <= thirtyDaysFromNow) {
        dueNext30Days++;
      }
    }
  }

  const policySummary: BoardPolicySummary = {
    totalDocuments: docs.length,
    approved,
    inReview,
    overdueReviews,
    dueNext30Days,
  };

  // 5. Build training summary
  const assignments = await trainingCoursesRepo.getTrainingAssignments(workspaceId);
  const campaigns = await trainingCoursesRepo.getAwarenessCampaigns(workspaceId);

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter(a => a.status === 'completed').length;
  const overdueAssignments = assignments.filter(a => a.status === 'overdue').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const overallCompletionRate = totalAssignments > 0
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  // Get last completed campaign for phish click rate
  const completedCampaigns = campaigns
    .filter(c => c.status === 'completed' && c.clickRate !== undefined)
    .sort((a, b) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime());

  const lastPhishClickRate = completedCampaigns[0]?.clickRate;

  const trainingSummary: BoardTrainingSummary = {
    overallCompletionRate,
    overdueAssignments,
    activeCampaigns,
    lastPhishClickRate,
  };

  // 6. Build AI & Privacy summary
  const aiHealthcareFrameworks = await frameworksRepo.getFrameworks({ isAiHealthcare: true });
  const privacyFrameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });

  const aiPrivacySummary: BoardAiPrivacySummary = {
    aiHealthcareSummary: aiHealthcareFrameworks.length > 0
      ? {
          frameworks: aiHealthcareFrameworks.map(f => f.code),
          overallScore: null, // Can be calculated if we have a readiness scoring function
        }
      : undefined,
    dataProtectionSummary: privacyFrameworks.length > 0
      ? {
          frameworks: privacyFrameworks.map(f => f.code),
          overallScore: null,
        }
      : undefined,
  };

  // 7. Get workspace name
  const workspaceResult = await query<any>(
    'SELECT name FROM workspaces WHERE id = $1',
    [workspaceId]
  );
  const workspaceName = workspaceResult.rows[0]?.name;

  return {
    workspaceId,
    workspaceName,
    generatedAt: new Date().toISOString(),
    frameworks: frameworkSummaries,
    riskSummary,
    policySummary,
    trainingSummary,
    aiPrivacySummary,
  };
}

// GET /api/v1/reports/board/overview
// Returns aggregated board report data
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
    console.error('Error building board report:', error);
    const response: ApiResponse<null> = {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to build board report',
      },
    };
    res.status(500).json(response);
  }
});

export default router;
