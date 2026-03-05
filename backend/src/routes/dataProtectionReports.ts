import express from 'express';
import { query } from '../db.js';
import * as frameworksRepo from '../repositories/frameworksRepo.js';
import { getWorkspaceId } from '../workspace.js';
import {
  generateDataProtectionSummary,
  answerDataProtectionQuestion,
  isAIServiceAvailable,
} from '../services/aiAssistantService.js';

const router = express.Router();

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DataProtectionFrameworkStats {
  framework: string;      // framework.code, e.g. 'ISO27701', 'GDPR'
  name: string;           // framework.name
  totalControls: number;
  implemented: number;
  inProgress: number;
  notImplemented: number;
  notApplicable: number;
  controlsWithEvidence: number;
}

export interface DataProtectionControlMatrixRow {
  controlId: string;
  title: string;
  owner: string;
  domain?: string;
  status: string;             // ControlStatus
  frameworks: string[];       // codes for privacy frameworks mapped to this control
  references: string[];       // references for those mappings
  evidenceCount: number;
  lastEvidenceAt?: string;
  relatedRiskCount: number;
}

export interface DataProtectionOverviewReport {
  workspaceId: string;
  totalRelevantControls: number;
  totalEvidenceItems: number;
  totalRelatedRisks: number;
  frameworkStats: DataProtectionFrameworkStats[];
  controlMatrix: DataProtectionControlMatrixRow[];
}

// ============================================
// ENDPOINT: GET /overview
// Returns Data Protection overview report
// ============================================

router.get('/overview', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    // 1. Get all privacy-related frameworks (is_privacy = true)
    const privacyFrameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });
    const privacyFrameworkCodes = privacyFrameworks.map(f => f.code);

    if (privacyFrameworkCodes.length === 0) {
      // No privacy frameworks configured
      const emptyReport: DataProtectionOverviewReport = {
        workspaceId,
        totalRelevantControls: 0,
        totalEvidenceItems: 0,
        totalRelatedRisks: 0,
        frameworkStats: [],
        controlMatrix: [],
      };
      return res.json({ data: emptyReport, error: null });
    }

    // 2. Get all controls mapped to privacy frameworks, along with their mappings, evidence, and risk links
    const controlsResult = await query(`
      SELECT DISTINCT
        c.id,
        c.workspace_id,
        c.title,
        c.owner,
        c.domain,
        c.status
      FROM controls c
      INNER JOIN control_mappings cm ON c.id = cm.control_id
      WHERE c.workspace_id = $1
        AND cm.framework = ANY($2)
      ORDER BY c.id
    `, [workspaceId, privacyFrameworkCodes]);

    const controlIds = controlsResult.rows.map((r: any) => r.id);

    // 3. Get framework mappings for these controls (only privacy frameworks)
    let mappingsResult: { rows: any[] } = { rows: [] };
    if (controlIds.length > 0) {
      mappingsResult = await query(`
        SELECT control_id, framework, reference
        FROM control_mappings
        WHERE control_id = ANY($1)
          AND framework = ANY($2)
      `, [controlIds, privacyFrameworkCodes]);
    }

    // 4. Get evidence counts for these controls
    let evidenceResult: { rows: any[] } = { rows: [] };
    if (controlIds.length > 0) {
      evidenceResult = await query(`
        SELECT
          control_id,
          COUNT(*) as count,
          MAX(collected_at) as last_collected_at
        FROM evidence
        WHERE control_id = ANY($1)
        GROUP BY control_id
      `, [controlIds]);
    }

    // 5. Get risk links for these controls
    let riskLinksResult: { rows: any[] } = { rows: [] };
    if (controlIds.length > 0) {
      riskLinksResult = await query(`
        SELECT control_id, COUNT(*) as count
        FROM risk_control_links
        WHERE control_id = ANY($1)
        GROUP BY control_id
      `, [controlIds]);
    }

    // 6. Build lookup maps
    const mappingsByControl: Record<string, { framework: string; reference: string }[]> = {};
    for (const row of mappingsResult.rows) {
      if (!mappingsByControl[row.control_id]) {
        mappingsByControl[row.control_id] = [];
      }
      mappingsByControl[row.control_id].push({
        framework: row.framework,
        reference: row.reference,
      });
    }

    const evidenceByControl: Record<string, { count: number; lastAt?: string }> = {};
    for (const row of evidenceResult.rows) {
      evidenceByControl[row.control_id] = {
        count: parseInt(row.count, 10),
        lastAt: row.last_collected_at ? new Date(row.last_collected_at).toISOString() : undefined,
      };
    }

    const riskCountByControl: Record<string, number> = {};
    for (const row of riskLinksResult.rows) {
      riskCountByControl[row.control_id] = parseInt(row.count, 10);
    }

    // 7. Build control matrix
    const controlMatrix: DataProtectionControlMatrixRow[] = controlsResult.rows.map((control: any) => {
      const mappings = mappingsByControl[control.id] || [];
      const evidence = evidenceByControl[control.id] || { count: 0 };
      const riskCount = riskCountByControl[control.id] || 0;

      return {
        controlId: control.id,
        title: control.title,
        owner: control.owner,
        domain: control.domain || undefined,
        status: control.status,
        frameworks: [...new Set(mappings.map(m => m.framework))],
        references: mappings.map(m => m.reference),
        evidenceCount: evidence.count,
        lastEvidenceAt: evidence.lastAt,
        relatedRiskCount: riskCount,
      };
    });

    // 8. Calculate framework stats
    const frameworkStats: DataProtectionFrameworkStats[] = [];
    for (const fw of privacyFrameworks) {
      // Find controls that have this framework
      const controlsForFramework = controlMatrix.filter(c =>
        c.frameworks.includes(fw.code)
      );

      const stats: DataProtectionFrameworkStats = {
        framework: fw.code,
        name: fw.name,
        totalControls: controlsForFramework.length,
        implemented: controlsForFramework.filter(c => c.status === 'implemented').length,
        inProgress: controlsForFramework.filter(c => c.status === 'in_progress').length,
        notImplemented: controlsForFramework.filter(c => c.status === 'not_implemented').length,
        notApplicable: controlsForFramework.filter(c => c.status === 'not_applicable').length,
        controlsWithEvidence: controlsForFramework.filter(c => c.evidenceCount > 0).length,
      };

      frameworkStats.push(stats);
    }

    // 9. Calculate totals
    const totalEvidenceItems = Object.values(evidenceByControl).reduce(
      (sum, e) => sum + e.count, 0
    );
    const totalRelatedRisks = Object.values(riskCountByControl).reduce(
      (sum, count) => sum + count, 0
    );

    // 10. Build final report
    const report: DataProtectionOverviewReport = {
      workspaceId,
      totalRelevantControls: controlMatrix.length,
      totalEvidenceItems,
      totalRelatedRisks,
      frameworkStats,
      controlMatrix,
    };

    res.json({ data: report, error: null });
  } catch (err) {
    console.error('Error fetching Data Protection overview report:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// ENDPOINT: GET /summary
// Returns a simplified summary for dashboard cards
// ============================================

router.get('/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    // Get privacy frameworks
    const privacyFrameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });
    const privacyFrameworkCodes = privacyFrameworks.map(f => f.code);

    if (privacyFrameworkCodes.length === 0) {
      return res.json({
        data: {
          totalFrameworks: 0,
          totalControls: 0,
          implementedControls: 0,
          implementationRate: 0,
          controlsWithEvidence: 0,
          evidenceCoverage: 0,
          totalRisks: 0,
        },
        error: null,
      });
    }

    // Count unique controls mapped to privacy frameworks
    const controlsResult = await query(`
      SELECT
        COUNT(DISTINCT c.id) as total_controls,
        COUNT(DISTINCT CASE WHEN c.status = 'implemented' THEN c.id END) as implemented_controls
      FROM controls c
      INNER JOIN control_mappings cm ON c.id = cm.control_id
      WHERE c.workspace_id = $1
        AND cm.framework = ANY($2)
    `, [workspaceId, privacyFrameworkCodes]);

    const totalControls = parseInt(controlsResult.rows[0].total_controls, 10);
    const implementedControls = parseInt(controlsResult.rows[0].implemented_controls, 10);

    // Count controls with evidence
    const evidenceResult = await query(`
      SELECT COUNT(DISTINCT c.id) as controls_with_evidence
      FROM controls c
      INNER JOIN control_mappings cm ON c.id = cm.control_id
      INNER JOIN evidence e ON c.id = e.control_id
      WHERE c.workspace_id = $1
        AND cm.framework = ANY($2)
    `, [workspaceId, privacyFrameworkCodes]);

    const controlsWithEvidence = parseInt(evidenceResult.rows[0].controls_with_evidence, 10);

    // Count related risks
    const risksResult = await query(`
      SELECT COUNT(DISTINCT rcl.risk_id) as total_risks
      FROM risk_control_links rcl
      INNER JOIN controls c ON rcl.control_id = c.id
      INNER JOIN control_mappings cm ON c.id = cm.control_id
      WHERE c.workspace_id = $1
        AND cm.framework = ANY($2)
    `, [workspaceId, privacyFrameworkCodes]);

    const totalRisks = parseInt(risksResult.rows[0].total_risks, 10);

    const summary = {
      totalFrameworks: privacyFrameworks.length,
      totalControls,
      implementedControls,
      implementationRate: totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0,
      controlsWithEvidence,
      evidenceCoverage: totalControls > 0 ? Math.round((controlsWithEvidence / totalControls) * 100) : 0,
      totalRisks,
    };

    res.json({ data: summary, error: null });
  } catch (err) {
    console.error('Error fetching Data Protection summary:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// ENDPOINT: GET /frameworks
// Returns stats per privacy framework
// ============================================

router.get('/frameworks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    // Get privacy frameworks
    const privacyFrameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });
    const privacyFrameworkCodes = privacyFrameworks.map(f => f.code);

    if (privacyFrameworkCodes.length === 0) {
      return res.json({ data: [], error: null });
    }

    // Get control stats per framework
    const statsResult = await query(`
      SELECT
        cm.framework,
        COUNT(DISTINCT c.id) as total_controls,
        COUNT(DISTINCT CASE WHEN c.status = 'implemented' THEN c.id END) as implemented,
        COUNT(DISTINCT CASE WHEN c.status = 'in_progress' THEN c.id END) as in_progress,
        COUNT(DISTINCT CASE WHEN c.status = 'not_implemented' THEN c.id END) as not_implemented,
        COUNT(DISTINCT CASE WHEN c.status = 'not_applicable' THEN c.id END) as not_applicable
      FROM controls c
      INNER JOIN control_mappings cm ON c.id = cm.control_id
      WHERE c.workspace_id = $1
        AND cm.framework = ANY($2)
      GROUP BY cm.framework
    `, [workspaceId, privacyFrameworkCodes]);

    // Get evidence coverage per framework
    const evidenceResult = await query(`
      SELECT
        cm.framework,
        COUNT(DISTINCT c.id) as controls_with_evidence
      FROM controls c
      INNER JOIN control_mappings cm ON c.id = cm.control_id
      INNER JOIN evidence e ON c.id = e.control_id
      WHERE c.workspace_id = $1
        AND cm.framework = ANY($2)
      GROUP BY cm.framework
    `, [workspaceId, privacyFrameworkCodes]);

    // Build lookup for evidence counts
    const evidenceCounts: Record<string, number> = {};
    for (const row of evidenceResult.rows) {
      evidenceCounts[row.framework] = parseInt(row.controls_with_evidence, 10);
    }

    // Build lookup for stats
    const statsMap: Record<string, any> = {};
    for (const row of statsResult.rows) {
      statsMap[row.framework] = {
        totalControls: parseInt(row.total_controls, 10),
        implemented: parseInt(row.implemented, 10),
        inProgress: parseInt(row.in_progress, 10),
        notImplemented: parseInt(row.not_implemented, 10),
        notApplicable: parseInt(row.not_applicable, 10),
      };
    }

    // Build response for each privacy framework
    const frameworkStats: DataProtectionFrameworkStats[] = privacyFrameworks.map(fw => {
      const stats = statsMap[fw.code] || {
        totalControls: 0,
        implemented: 0,
        inProgress: 0,
        notImplemented: 0,
        notApplicable: 0,
      };

      return {
        framework: fw.code,
        name: fw.name,
        totalControls: stats.totalControls,
        implemented: stats.implemented,
        inProgress: stats.inProgress,
        notImplemented: stats.notImplemented,
        notApplicable: stats.notApplicable,
        controlsWithEvidence: evidenceCounts[fw.code] || 0,
      };
    });

    res.json({ data: frameworkStats, error: null });
  } catch (err) {
    console.error('Error fetching Data Protection framework stats:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// AI ASSISTANT ENDPOINTS
// ============================================

// Helper function to get full report for AI context
async function getReportForAI(workspaceId: string): Promise<DataProtectionOverviewReport> {
  const privacyFrameworks = await frameworksRepo.getFrameworks({ isPrivacy: true });
  const privacyFrameworkCodes = privacyFrameworks.map(f => f.code);

  if (privacyFrameworkCodes.length === 0) {
    return {
      workspaceId,
      totalRelevantControls: 0,
      totalEvidenceItems: 0,
      totalRelatedRisks: 0,
      frameworkStats: [],
      controlMatrix: [],
    };
  }

  // Get controls mapped to privacy frameworks
  const controlsResult = await query(`
    SELECT DISTINCT
      c.id, c.workspace_id, c.title, c.owner, c.domain, c.status
    FROM controls c
    INNER JOIN control_mappings cm ON c.id = cm.control_id
    WHERE c.workspace_id = $1 AND cm.framework = ANY($2)
    ORDER BY c.id
  `, [workspaceId, privacyFrameworkCodes]);

  const controlIds = controlsResult.rows.map((r: any) => r.id);

  // Get mappings, evidence, and risk links
  let mappingsResult: { rows: any[] } = { rows: [] };
  let evidenceResult: { rows: any[] } = { rows: [] };
  let riskLinksResult: { rows: any[] } = { rows: [] };

  if (controlIds.length > 0) {
    mappingsResult = await query(`
      SELECT control_id, framework, reference
      FROM control_mappings
      WHERE control_id = ANY($1) AND framework = ANY($2)
    `, [controlIds, privacyFrameworkCodes]);

    evidenceResult = await query(`
      SELECT control_id, COUNT(*) as count, MAX(collected_at) as last_collected_at
      FROM evidence WHERE control_id = ANY($1) GROUP BY control_id
    `, [controlIds]);

    riskLinksResult = await query(`
      SELECT control_id, COUNT(*) as count
      FROM risk_control_links WHERE control_id = ANY($1) GROUP BY control_id
    `, [controlIds]);
  }

  // Build lookups
  const mappingsByControl: Record<string, { framework: string; reference: string }[]> = {};
  for (const row of mappingsResult.rows) {
    if (!mappingsByControl[row.control_id]) mappingsByControl[row.control_id] = [];
    mappingsByControl[row.control_id].push({ framework: row.framework, reference: row.reference });
  }

  const evidenceByControl: Record<string, { count: number; lastAt?: string }> = {};
  for (const row of evidenceResult.rows) {
    evidenceByControl[row.control_id] = {
      count: parseInt(row.count, 10),
      lastAt: row.last_collected_at ? new Date(row.last_collected_at).toISOString() : undefined,
    };
  }

  const riskCountByControl: Record<string, number> = {};
  for (const row of riskLinksResult.rows) {
    riskCountByControl[row.control_id] = parseInt(row.count, 10);
  }

  // Build control matrix
  const controlMatrix: DataProtectionControlMatrixRow[] = controlsResult.rows.map((c: any) => {
    const mappings = mappingsByControl[c.id] || [];
    const evidence = evidenceByControl[c.id] || { count: 0 };
    return {
      controlId: c.id,
      title: c.title,
      owner: c.owner,
      domain: c.domain || undefined,
      status: c.status,
      frameworks: [...new Set(mappings.map(m => m.framework))],
      references: mappings.map(m => m.reference),
      evidenceCount: evidence.count,
      lastEvidenceAt: evidence.lastAt,
      relatedRiskCount: riskCountByControl[c.id] || 0,
    };
  });

  // Build framework stats
  const frameworkStats: DataProtectionFrameworkStats[] = privacyFrameworks.map(fw => {
    const controlsForFw = controlMatrix.filter(c => c.frameworks.includes(fw.code));
    return {
      framework: fw.code,
      name: fw.name,
      totalControls: controlsForFw.length,
      implemented: controlsForFw.filter(c => c.status === 'implemented').length,
      inProgress: controlsForFw.filter(c => c.status === 'in_progress').length,
      notImplemented: controlsForFw.filter(c => c.status === 'not_implemented').length,
      notApplicable: controlsForFw.filter(c => c.status === 'not_applicable').length,
      controlsWithEvidence: controlsForFw.filter(c => c.evidenceCount > 0).length,
    };
  });

  return {
    workspaceId,
    totalRelevantControls: controlMatrix.length,
    totalEvidenceItems: Object.values(evidenceByControl).reduce((s, e) => s + e.count, 0),
    totalRelatedRisks: Object.values(riskCountByControl).reduce((s, c) => s + c, 0),
    frameworkStats,
    controlMatrix,
  };
}

// ============================================
// ENDPOINT: GET /ai/status
// Check if AI assistant is available
// ============================================

router.get('/ai/status', (_req, res) => {
  res.json({
    data: {
      available: isAIServiceAvailable(),
      provider: 'stubbed', // Can change to 'openai', 'claude', etc. when integrated
    },
    error: null,
  });
});

// ============================================
// ENDPOINT: GET /ai/summary
// Returns AI-generated summary narrative of privacy posture
// ============================================

router.get('/ai/summary', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);

    // Get full report for AI context
    const report = await getReportForAI(workspaceId);

    // Generate AI summary
    const summary = await generateDataProtectionSummary(report);

    res.json({ data: summary, error: null });
  } catch (err) {
    console.error('Error generating AI summary:', err);
    res.status(500).json({
      data: null,
      error: { code: 'AI_ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// ENDPOINT: POST /ai/ask
// Answer a question about data protection posture
// ============================================

router.post('/ai/ask', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        data: null,
        error: { code: 'INVALID_INPUT', message: 'Question is required' },
      });
    }

    // Get full report for AI context
    const report = await getReportForAI(workspaceId);

    // Answer the question
    const answer = await answerDataProtectionQuestion(question, report);

    res.json({ data: answer, error: null });
  } catch (err) {
    console.error('Error answering AI question:', err);
    res.status(500).json({
      data: null,
      error: { code: 'AI_ERROR', message: (err as Error).message },
    });
  }
});

export default router;
