import express from 'express';
import { query } from '../db.js';
import * as risksRepo from '../repositories/risksRepo.js';
import * as controlsRepo from '../repositories/controlsRepo.js';
import * as vendorsRepo from '../repositories/vendorsRepo.js';
import * as assetsRepo from '../repositories/assetsRepo.js';
import { getWorkspaceId } from '../workspace.js';

const router = express.Router();

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface OverviewReport {
  risks: {
    total: number;
    bySeverity: { low: number; medium: number; high: number; critical: number };
    open: number;
    accepted: number;
  };
  controls: {
    total: number;
    implemented: number;
    inProgress: number;
    notImplemented: number;
    notApplicable: number;
  };
  evidence: {
    total: number;
    withControlLink: number;
    withRiskLink: number;
  };
  vendors: {
    total: number;
    byRisk: { low: number; medium: number; high: number; critical: number };
    withoutDpa: boolean;
    overdueReviews: number;
  };
  assets: {
    total: number;
    byCriticality: { low: number; medium: number; high: number; critical: number };
    saasCount: number;
  };
}

export interface RiskProfileEntry {
  id: string;
  title: string;
  owner: string;
  category: string;
  status: string;
  severity: string;
  inherentLikelihood: number;
  inherentImpact: number;
  residualLikelihood: number;
  residualImpact: number;
  dueDate?: string;
}

export interface ControlCoverageEntry {
  id: string;
  title: string;
  owner: string;
  domain?: string;
  status: string;
  frameworks: string[];
  references: string[];
  evidenceCount: number;
  lastEvidenceAt?: string;
}

export interface VendorReportEntry {
  id: string;
  name: string;
  category: string;
  owner: string;
  riskLevel: string;
  status: string;
  nextReviewDate?: string;
  hasDpa: boolean;
  regions: string[];
  dataTypesProcessed: string[];
}

// ============================================
// HELPER: Calculate risk severity
// ============================================

function calculateSeverity(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

// ============================================
// ENDPOINT 1: GET /overview
// ============================================

router.get('/overview', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    // Fetch risks with severity calculation
    const risks = await risksRepo.getRisks(workspaceId);
    const riskBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    let openCount = 0;
    let acceptedCount = 0;

    for (const risk of risks) {
      const severity = calculateSeverity(risk.inherentLikelihood, risk.inherentImpact);
      riskBySeverity[severity as keyof typeof riskBySeverity]++;

      if (risk.status !== 'closed') openCount++;
      if (risk.status === 'accepted') acceptedCount++;
    }

    // Fetch controls by status
    const controls = await controlsRepo.getControls(workspaceId);
    const controlsByStatus = {
      implemented: 0,
      inProgress: 0,
      notImplemented: 0,
      notApplicable: 0,
    };

    for (const control of controls) {
      const status = (control.status || 'not_implemented').replace(/-/g, '_') as keyof typeof controlsByStatus;
      if (status in controlsByStatus) {
        controlsByStatus[status]++;
      }
    }

    // Fetch evidence counts
    const evidenceResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN control_id IS NOT NULL THEN 1 END) as with_control,
        COUNT(CASE WHEN risk_id IS NOT NULL THEN 1 END) as with_risk
      FROM evidence
    `);

    const evidenceData = evidenceResult.rows[0];

    // Fetch vendors
    const vendors = await vendorsRepo.getVendors(workspaceId);
    const vendorsByRisk = { low: 0, medium: 0, high: 0, critical: 0 };
    let overdueReviews = 0;

    for (const vendor of vendors) {
      const riskLevel = (vendor.riskLevel || 'low').toLowerCase() as keyof typeof vendorsByRisk;
      if (riskLevel in vendorsByRisk) {
        vendorsByRisk[riskLevel]++;
      }

      if (vendor.nextReviewDate && new Date(vendor.nextReviewDate) < new Date()) {
        if (vendor.status === 'active' || vendor.status === 'onboarding') {
          overdueReviews++;
        }
      }
    }

    // Fetch assets
    const assets = await assetsRepo.getAssets(workspaceId);
    const assetsByCriticality = { low: 0, medium: 0, high: 0, critical: 0 };
    let saasCount = 0;

    for (const asset of assets) {
      const criticality = (asset.criticality || 'low').toLowerCase() as keyof typeof assetsByCriticality;
      if (criticality in assetsByCriticality) {
        assetsByCriticality[criticality]++;
      }

      if (asset.type === 'saas') saasCount++;
    }

    const overview: OverviewReport = {
      risks: {
        total: risks.length,
        bySeverity: riskBySeverity,
        open: openCount,
        accepted: acceptedCount,
      },
      controls: {
        total: controls.length,
        implemented: controlsByStatus.implemented,
        inProgress: controlsByStatus.inProgress,
        notImplemented: controlsByStatus.notImplemented,
        notApplicable: controlsByStatus.notApplicable,
      },
      evidence: {
        total: parseInt(evidenceData.total || 0),
        withControlLink: parseInt(evidenceData.with_control || 0),
        withRiskLink: parseInt(evidenceData.with_risk || 0),
      },
      vendors: {
        total: vendors.length,
        byRisk: vendorsByRisk,
        withoutDpa: false, // Could calculate if needed
        overdueReviews,
      },
      assets: {
        total: assets.length,
        byCriticality: assetsByCriticality,
        saasCount,
      },
    };

    res.json({ data: overview, error: null });
  } catch (err) {
    console.error('Error fetching overview report:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// ENDPOINT 2: GET /risk-profile
// ============================================

router.get('/risk-profile', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, severity } = req.query;

    const risks = await risksRepo.getRisks(workspaceId);

    const entries: RiskProfileEntry[] = risks
      .map((risk) => {
        const riskSeverity = calculateSeverity(risk.inherentLikelihood, risk.inherentImpact);

        return {
          id: risk.id,
          title: risk.title,
          owner: risk.owner,
          category: risk.category,
          status: risk.status,
          severity: riskSeverity,
          inherentLikelihood: risk.inherentLikelihood,
          inherentImpact: risk.inherentImpact,
          residualLikelihood: risk.residualLikelihood || 1,
          residualImpact: risk.residualImpact || 1,
          dueDate: risk.dueDate,
        };
      })
      .filter((entry) => {
        if (status && entry.status !== status) return false;
        if (severity && entry.severity !== severity) return false;
        return true;
      });

    res.json({ data: entries, error: null });
  } catch (err) {
    console.error('Error fetching risk profile:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// ENDPOINT 3: GET /control-coverage
// ============================================

router.get('/control-coverage', async (req, res) => {
  try {
    // Fetch all controls with their mappings and evidence in one query
    const result = await query(`
      SELECT
        c.id,
        c.title,
        c.owner,
        c.domain,
        c.status,
        COALESCE(array_agg(DISTINCT cm.framework) FILTER (WHERE cm.framework IS NOT NULL), ARRAY[]::text[]) as frameworks,
        COALESCE(array_agg(DISTINCT cm.reference) FILTER (WHERE cm.reference IS NOT NULL), ARRAY[]::text[]) as references,
        COUNT(DISTINCT e.id) as evidence_count,
        MAX(e.collected_at)::text as last_evidence_at
      FROM controls c
      LEFT JOIN control_mappings cm ON c.id = cm.control_id
      LEFT JOIN evidence e ON c.id = e.control_id
      GROUP BY c.id, c.title, c.owner, c.domain, c.status
      ORDER BY c.id
    `);

    const entries: ControlCoverageEntry[] = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      owner: row.owner,
      domain: row.domain,
      status: row.status,
      frameworks: row.frameworks || [],
      references: row.references || [],
      evidenceCount: parseInt(row.evidence_count || 0),
      lastEvidenceAt: row.last_evidence_at ? new Date(row.last_evidence_at).toISOString().split('T')[0] : undefined,
    }));

    res.json({ data: entries, error: null });
  } catch (err) {
    console.error('Error fetching control coverage:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// ENDPOINT 4: GET /vendors
// ============================================

router.get('/vendors', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { riskLevel, status } = req.query;

    const vendors = await vendorsRepo.getVendors(workspaceId);

    const entries: VendorReportEntry[] = vendors
      .map((vendor: any) => ({
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        owner: vendor.owner,
        riskLevel: vendor.riskLevel || 'low',
        status: vendor.status,
        nextReviewDate: vendor.nextReviewDate,
        hasDpa: !!vendor.hasDpa,
        regions: Array.isArray(vendor.regions) ? vendor.regions : [],
        dataTypesProcessed: Array.isArray(vendor.dataTypesProcessed) ? vendor.dataTypesProcessed : [],
      }))
      .filter((entry) => {
        if (riskLevel && entry.riskLevel !== riskLevel) return false;
        if (status && entry.status !== status) return false;
        return true;
      });

    res.json({ data: entries, error: null });
  } catch (err) {
    console.error('Error fetching vendors report:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

// ============================================
// HELPER: Convert to CSV
// ============================================

function arrayToCsv(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const headerRow = headers.map((h) => `"${h}"`).join(',');

  const rows = data.map((row) => {
    return headers
      .map((header) => {
        let value = row[header];

        // Handle arrays (semicolon-separated)
        if (Array.isArray(value)) {
          value = value.join(';');
        }

        // Escape quotes and wrap in quotes if needed
        if (value === null || value === undefined) {
          return '';
        }

        value = String(value).replace(/"/g, '""');
        if (String(row[header]).includes(',') || String(row[header]).includes('"') || String(row[header]).includes('\n')) {
          return `"${value}"`;
        }

        return value;
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\n');
}

// ============================================
// CSV EXPORT ENDPOINTS
// ============================================

router.get('/risk-profile.csv', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, severity } = req.query;

    const risks = await risksRepo.getRisks(workspaceId);

    const entries: any[] = risks
      .map((risk) => {
        const riskSeverity = calculateSeverity(risk.inherentLikelihood, risk.inherentImpact);

        return {
          ID: risk.id,
          Title: risk.title,
          Owner: risk.owner,
          Category: risk.category,
          Status: risk.status,
          Severity: riskSeverity,
          'Inherent Likelihood': risk.inherentLikelihood,
          'Inherent Impact': risk.inherentImpact,
          'Residual Likelihood': risk.residualLikelihood || 1,
          'Residual Impact': risk.residualImpact || 1,
          'Due Date': risk.dueDate || '',
        };
      })
      .filter((entry) => {
        if (status && entry.Status !== status) return false;
        if (severity && entry.Severity !== severity) return false;
        return true;
      });

    const csv = arrayToCsv(entries);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="risk-profile-report.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error generating risk profile CSV:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

router.get('/control-coverage.csv', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.id,
        c.title,
        c.owner,
        c.domain,
        c.status,
        COALESCE(array_agg(DISTINCT cm.framework) FILTER (WHERE cm.framework IS NOT NULL), ARRAY[]::text[]) as frameworks,
        COALESCE(array_agg(DISTINCT cm.reference) FILTER (WHERE cm.reference IS NOT NULL), ARRAY[]::text[]) as references,
        COUNT(DISTINCT e.id) as evidence_count,
        MAX(e.collected_at)::text as last_evidence_at
      FROM controls c
      LEFT JOIN control_mappings cm ON c.id = cm.control_id
      LEFT JOIN evidence e ON c.id = e.control_id
      GROUP BY c.id, c.title, c.owner, c.domain, c.status
      ORDER BY c.id
    `);

    const entries: any[] = result.rows.map((row: any) => ({
      ID: row.id,
      Title: row.title,
      Owner: row.owner,
      Domain: row.domain || '',
      Status: row.status,
      Frameworks: (row.frameworks || []).join(';'),
      References: (row.references || []).join(';'),
      'Evidence Count': parseInt(row.evidence_count || 0),
      'Last Evidence At': row.last_evidence_at ? new Date(row.last_evidence_at).toISOString().split('T')[0] : '',
    }));

    const csv = arrayToCsv(entries);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="control-coverage-report.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error generating control coverage CSV:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

router.get('/vendors.csv', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { riskLevel, status } = req.query;

    const vendors = await vendorsRepo.getVendors(workspaceId);

    const entries: any[] = vendors
      .map((vendor: any) => ({
        ID: vendor.id,
        Name: vendor.name,
        Category: vendor.category,
        Owner: vendor.owner,
        'Risk Level': vendor.riskLevel || 'low',
        Status: vendor.status,
        'Next Review': vendor.nextReviewDate || '',
        'Has DPA': vendor.hasDpa ? 'Yes' : 'No',
        Regions: Array.isArray(vendor.regions) ? vendor.regions.join(';') : '',
        'Data Types': Array.isArray(vendor.dataTypesProcessed) ? vendor.dataTypesProcessed.join(';') : '',
      }))
      .filter((entry) => {
        if (riskLevel && entry['Risk Level'] !== riskLevel) return false;
        if (status && entry.Status !== status) return false;
        return true;
      });

    const csv = arrayToCsv(entries);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-risk-report.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Error generating vendors CSV:', err);
    res.status(500).json({
      data: null,
      error: { code: 'ERROR', message: (err as Error).message },
    });
  }
});

export default router;
