import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

import { query } from '../db.js';
import { risks as storeRisks, controls as storeControls, controlMappings as storeControlMappings, evidenceItems as storeEvidenceItems } from '../store/index.js';
import { resolveSeedWorkspace } from './resolveSeedWorkspace.js';
import { ensureRiskIntelligenceSchema, seedRiskIntelligenceDefaults } from '../repositories/riskIntelligenceRepo.js';
import { ensureActivityLedgerSchema, recordActivity } from '../services/activityLedger/activityLedger.js';

type FrameworkSeed = {
  code: string;
  name: string;
  category: string;
  description: string;
  isAiHealthcare: boolean;
  isPrivacy: boolean;
  isDefault: boolean;
  colorHex: string;
};

type SeedWorkspace = Awaited<ReturnType<typeof resolveSeedWorkspace>>;

type RiskDistribution = Record<string, number>;

type ControlStatusTarget = {
  status: string;
  target: number;
  label: string;
};

const FRAMEWORK_CATALOG: FrameworkSeed[] = [
  { code: 'CIS', name: 'CIS Controls', category: 'security', description: 'Center for Internet Security Critical Security Controls', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#0F9D58' },
  { code: 'COBIT', name: 'COBIT', category: 'governance', description: 'Control Objectives for Information Technologies', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#6366F1' },
  { code: 'CUSTOM', name: 'Custom', category: 'custom', description: 'Custom framework defined by the organization', isAiHealthcare: false, isPrivacy: false, isDefault: false, colorHex: '#6B7280' },
  { code: 'EU_AI_ACT', name: 'EU AI Act', category: 'ai', description: 'European Union Artificial Intelligence Act', isAiHealthcare: true, isPrivacy: false, isDefault: true, colorHex: '#2563EB' },
  { code: 'GDPR', name: 'GDPR', category: 'privacy', description: 'General Data Protection Regulation', isAiHealthcare: false, isPrivacy: true, isDefault: true, colorHex: '#4F46E5' },
  { code: 'HIPAA', name: 'HIPAA', category: 'healthcare', description: 'Health Insurance Portability and Accountability Act', isAiHealthcare: true, isPrivacy: true, isDefault: true, colorHex: '#DC2626' },
  { code: 'HITRUST', name: 'HITRUST CSF', category: 'healthcare', description: 'Health Information Trust Alliance Common Security Framework', isAiHealthcare: true, isPrivacy: false, isDefault: true, colorHex: '#BE185D' },
  { code: 'ISO27001', name: 'ISO 27001', category: 'security', description: 'Information Security Management System standard', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#0891B2' },
  { code: 'ISO27701', name: 'ISO 27701', category: 'privacy', description: 'Privacy Information Management System extension to ISO 27001', isAiHealthcare: false, isPrivacy: true, isDefault: true, colorHex: '#7C3AED' },
  { code: 'ISO42001', name: 'ISO 42001 (AI)', category: 'ai', description: 'Artificial Intelligence Management System standard', isAiHealthcare: true, isPrivacy: false, isDefault: true, colorHex: '#7C3AED' },
  { code: 'NIST_800_53', name: 'NIST 800-53', category: 'security', description: 'Security and Privacy Controls for Information Systems', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#0284C7' },
  { code: 'NIST_CSF', name: 'NIST CSF', category: 'security', description: 'NIST Cybersecurity Framework', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#0369A1' },
  { code: 'NIS2', name: 'NIS2', category: 'security', description: 'Network and Information Security Directive 2', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#0F766E' },
  { code: 'PCI_DSS', name: 'PCI DSS', category: 'security', description: 'Payment Card Industry Data Security Standard', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#D97706' },
  { code: 'SOC1', name: 'SOC 1', category: 'audit', description: 'Service Organization Control 1 - Financial Reporting Controls', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#DC2626' },
  { code: 'SOC2', name: 'SOC 2', category: 'audit', description: 'Service Organization Control 2 - Trust Services Criteria', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#EA580C' },
];

const RISK_CATEGORY_TARGETS: Array<{ category: string; target: number; owner: string; titlePrefix: string }> = [
  { category: 'information_security', target: 28, owner: 'Security Office', titlePrefix: 'Information Security Risk' },
  { category: 'operational', target: 22, owner: 'Operations Office', titlePrefix: 'Operational Resilience Risk' },
  { category: 'compliance', target: 15, owner: 'Compliance Office', titlePrefix: 'Compliance Obligation Risk' },
  { category: 'vendor', target: 10, owner: 'Third-Party Office', titlePrefix: 'Vendor Exposure Risk' },
  { category: 'strategic', target: 10, owner: 'Executive Office', titlePrefix: 'Strategic Transformation Risk' },
];

const CONTROL_STATUS_TARGETS: ControlStatusTarget[] = [
  { status: 'implemented', target: 68, label: 'Compliant' },
  { status: 'in_progress', target: 24, label: 'Partially Compliant' },
  { status: 'not_implemented', target: 14, label: 'Non Compliant' },
  { status: 'not_applicable', target: 6, label: 'Not Assessed' },
];

const RISK_MATRIX_PATTERN: Array<[number, number]> = [
  [5, 4], [4, 5], [5, 5], [4, 4], [3, 5],
  [5, 3], [4, 3], [3, 4], [3, 3], [2, 4],
  [4, 2], [2, 3], [3, 2], [2, 2], [1, 4],
  [4, 1], [1, 3], [2, 1], [1, 2], [1, 1],
];

const CONTROL_DOMAINS = [
  'Access Control',
  'Asset Management',
  'Business Continuity',
  'Change Management',
  'Communications Security',
  'Cryptography',
  'Governance',
  'Identity',
  'Incident Response',
  'Monitoring',
  'Operations Security',
  'Third-Party Risk',
];

const EVIDENCE_TYPES = ['policy', 'configuration', 'log', 'screenshot', 'report', 'other'] as const;

const TRAINING_COURSE_BLUEPRINTS = [
  { suffix: 'Security Awareness', format: 'e-learning', duration: 35, frameworks: ['ISO27001', 'SOC2', 'NIST_CSF'] },
  { suffix: 'Phishing & Social Engineering', format: 'simulation', duration: 20, frameworks: ['CIS', 'NIST_800_53', 'SOC2'] },
  { suffix: 'Privacy & Data Handling', format: 'e-learning', duration: 40, frameworks: ['GDPR', 'ISO27701', 'HIPAA'] },
  { suffix: 'Vendor Security Governance', format: 'workshop', duration: 55, frameworks: ['SOC2', 'COBIT', 'NIS2'] },
  { suffix: 'Board Reporting Controls', format: 'briefing', duration: 25, frameworks: ['SOC1', 'SOC2', 'COBIT'] },
  { suffix: 'AI Governance Fundamentals', format: 'e-learning', duration: 45, frameworks: ['EU_AI_ACT', 'ISO42001'] },
  { suffix: 'Regulatory Readiness', format: 'e-learning', duration: 50, frameworks: ['NIS2', 'PCI_DSS', 'HITRUST'] },
  { suffix: 'Healthcare Data Controls', format: 'e-learning', duration: 45, frameworks: ['HIPAA', 'HITRUST'] },
];

const ACTIVITY_BLUEPRINTS = [
  { action: 'Risk Created', category: 'risk', targetType: 'risk', outcome: 'success', severity: 'medium', note: 'Board exposure register updated after reassessment.' },
  { action: 'Risk Updated', category: 'risk', targetType: 'risk', outcome: 'success', severity: 'info', note: 'Residual score and treatment milestones were refreshed.' },
  { action: 'Control Tested', category: 'control', targetType: 'control', outcome: 'success', severity: 'info', note: 'Quarterly control test passed with minor observations.' },
  { action: 'Evidence Uploaded', category: 'evidence', targetType: 'evidence', outcome: 'success', severity: 'info', note: 'Audit evidence uploaded and linked to mapped control set.' },
  { action: 'Audit Created', category: 'report', targetType: 'audit', outcome: 'success', severity: 'medium', note: 'Readiness workpaper bundle opened for committee review.' },
  { action: 'Vendor Reviewed', category: 'vendor', targetType: 'vendor', outcome: 'success', severity: 'medium', note: 'Quarterly third-party review completed with remediation watchpoints.' },
];

function workspacePrefix(workspace: SeedWorkspace): string {
  return workspace.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatFrameworkReference(code: string, sequence: number): string {
  return `${code.replace(/_/g, '-')}-${String(sequence).padStart(3, '0')}`;
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hash.slice(18, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

async function ensureSqlSchema(filename: string) {
  const sqlPath = path.resolve(process.cwd(), 'sql', filename);
  const sql = await fs.readFile(sqlPath, 'utf8');
  await query(sql);
}

async function listTargetWorkspaces(): Promise<SeedWorkspace[]> {
  const explicitWorkspaceId = process.env.SEED_WORKSPACE_ID?.trim();
  if (explicitWorkspaceId) {
    return [await resolveSeedWorkspace()];
  }

  const result = await query<SeedWorkspace>(
    `SELECT id, name, display_name AS "displayName"
     FROM workspaces
     WHERE COALESCE(status, 'active') <> 'archived'
     ORDER BY created_at ASC`,
  );

  if (result.rows.length === 0) {
    throw new Error('No active workspaces found. Complete organization setup before running seed scripts.');
  }

  return result.rows;
}

async function ensureFrameworkCatalog() {
  const allowed = FRAMEWORK_CATALOG.map((framework) => `'${framework.code}'`).join(', ');
  await query(`
    ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_primary_framework_check;
    ALTER TABLE controls
      ADD CONSTRAINT controls_primary_framework_check
      CHECK (primary_framework IS NULL OR primary_framework IN (${allowed}));

    ALTER TABLE control_mappings DROP CONSTRAINT IF EXISTS control_mappings_framework_check;
    ALTER TABLE control_mappings
      ADD CONSTRAINT control_mappings_framework_check
      CHECK (framework IN (${allowed}));
  `);

  for (const framework of FRAMEWORK_CATALOG) {
    await query(
      `INSERT INTO frameworks (code, name, category, description, is_ai_healthcare, is_privacy, is_default, color_hex)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         description = EXCLUDED.description,
         is_ai_healthcare = EXCLUDED.is_ai_healthcare,
         is_privacy = EXCLUDED.is_privacy,
         is_default = EXCLUDED.is_default,
         color_hex = EXCLUDED.color_hex,
         updated_at = NOW()`,
      [
        framework.code,
        framework.name,
        framework.category,
        framework.description,
        framework.isAiHealthcare,
        framework.isPrivacy,
        framework.isDefault,
        framework.colorHex,
      ],
    );
  }
}

async function recordExists(table: string, id: string): Promise<boolean> {
  const result = await query(`SELECT id FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return result.rows.length > 0;
}

async function controlMappingExists(controlId: string, framework: string, reference: string): Promise<boolean> {
  const result = await query(
    `SELECT id
     FROM control_mappings
     WHERE control_id = $1
       AND framework = $2
       AND reference = $3
     LIMIT 1`,
    [controlId, framework, reference],
  );
  return result.rows.length > 0;
}

async function evidenceExists(workspaceId: string, name: string): Promise<boolean> {
  const result = await query(
    `SELECT id FROM evidence WHERE workspace_id = $1 AND name = $2 LIMIT 1`,
    [workspaceId, name],
  );
  return result.rows.length > 0;
}

async function seedStoreCoreData(workspace: SeedWorkspace) {
  for (const risk of storeRisks) {
    await query(
      `INSERT INTO risks (
         id, workspace_id, title, description, owner, category, status,
         inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
         treatment_plan, due_date, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        risk.id,
        workspace.id,
        risk.title,
        risk.description,
        risk.owner,
        risk.category,
        risk.status,
        risk.inherentLikelihood,
        risk.inherentImpact,
        risk.residualLikelihood,
        risk.residualImpact,
        risk.treatmentPlan ?? null,
        risk.dueDate ?? null,
        risk.createdAt ?? new Date().toISOString(),
        risk.updatedAt ?? new Date().toISOString(),
      ],
    );
  }

  for (const control of storeControls) {
    await query(
      `INSERT INTO controls (
         id, workspace_id, title, description, owner, status, domain, primary_framework, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        control.id,
        workspace.id,
        control.title,
        control.description,
        control.owner,
        control.status,
        control.domain,
        control.primaryFramework ?? null,
        control.createdAt ?? new Date().toISOString(),
        control.updatedAt ?? new Date().toISOString(),
      ],
    );
  }

  for (const mapping of storeControlMappings) {
    if (!(await controlMappingExists(mapping.controlId, mapping.framework, mapping.reference))) {
      await query(
        `INSERT INTO control_mappings (control_id, framework, reference, type)
         VALUES ($1, $2, $3, $4)`,
        [mapping.controlId, mapping.framework, mapping.reference, mapping.type ?? null],
      );
    }
  }

  for (const evidence of storeEvidenceItems) {
    if (await evidenceExists(workspace.id, evidence.name)) {
      continue;
    }
    await query(
      `INSERT INTO evidence (
         workspace_id, name, description, type, location_url, control_id, risk_id, collected_by, collected_at, last_reviewed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        workspace.id,
        evidence.name,
        evidence.description,
        evidence.type,
        evidence.locationUrl ?? null,
        evidence.controlId ?? null,
        evidence.riskId ?? null,
        evidence.collectedBy,
        evidence.collectedAt,
        evidence.lastReviewedAt ?? null,
      ],
    );
  }
}

async function getWorkspaceRiskCounts(workspaceId: string): Promise<RiskDistribution> {
  const result = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*)::text AS count
     FROM risks
     WHERE workspace_id = $1
     GROUP BY category`,
    [workspaceId],
  );

  return result.rows.reduce<RiskDistribution>((accumulator, row) => {
    accumulator[row.category] = Number(row.count);
    return accumulator;
  }, {});
}

async function seedEnterpriseRisks(workspace: SeedWorkspace) {
  const prefix = workspacePrefix(workspace);
  const now = new Date();
  const counts = await getWorkspaceRiskCounts(workspace.id);

  for (const categorySeed of RISK_CATEGORY_TARGETS) {
    const existing = counts[categorySeed.category] ?? 0;
    const needed = Math.max(0, categorySeed.target - existing);

    for (let index = 0; index < needed; index += 1) {
      const sequence = existing + index + 1;
      const [residualLikelihood, residualImpact] = RISK_MATRIX_PATTERN[(sequence - 1) % RISK_MATRIX_PATTERN.length];
      const inherentLikelihood = Math.min(5, residualLikelihood + (sequence % 3 === 0 ? 1 : 0));
      const inherentImpact = Math.min(5, residualImpact + (sequence % 4 === 0 ? 1 : 0));
      const dueDate = addDays(now, 15 + ((sequence * 7) % 120));
      const id = `RISK-${prefix}-${categorySeed.category.slice(0, 4).toUpperCase()}-${String(sequence).padStart(3, '0')}`;

      await query(
        `INSERT INTO risks (
           id, workspace_id, title, description, owner, category, status,
           inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
           treatment_plan, due_date, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           owner = EXCLUDED.owner,
           category = EXCLUDED.category,
           status = EXCLUDED.status,
           inherent_likelihood = EXCLUDED.inherent_likelihood,
           inherent_impact = EXCLUDED.inherent_impact,
           residual_likelihood = EXCLUDED.residual_likelihood,
           residual_impact = EXCLUDED.residual_impact,
           treatment_plan = EXCLUDED.treatment_plan,
           due_date = EXCLUDED.due_date,
           updated_at = NOW()`,
        [
          id,
          workspace.id,
          `${categorySeed.titlePrefix} ${sequence}`,
          `${categorySeed.titlePrefix} ${sequence} tracks workspace exposure across framework obligations, operational dependencies, and open remediation pressure.`,
          categorySeed.owner,
          categorySeed.category,
          sequence % 5 === 0 ? 'accepted' : sequence % 2 === 0 ? 'treated' : 'identified',
          inherentLikelihood,
          inherentImpact,
          residualLikelihood,
          residualImpact,
          `Update treatment milestones, confirm owner accountability, and track residual exposure for ${categorySeed.category.replace(/_/g, ' ')}.`,
          dueDate.toISOString(),
        ],
      );
    }
  }
}

async function getWorkspaceControlCounts(workspaceId: string): Promise<Record<string, number>> {
  const result = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count
     FROM controls
     WHERE workspace_id = $1
     GROUP BY status`,
    [workspaceId],
  );

  return result.rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.status] = Number(row.count);
    return accumulator;
  }, {});
}

async function seedEnterpriseControls(workspace: SeedWorkspace) {
  const prefix = workspacePrefix(workspace);
  let counts = await getWorkspaceControlCounts(workspace.id);

  let frameworkIndex = 0;
  let domainIndex = 0;

  for (const statusTarget of CONTROL_STATUS_TARGETS) {
    let existing = counts[statusTarget.status] ?? 0;
    let sequence = 1;

    while (existing < statusTarget.target) {
      const framework = FRAMEWORK_CATALOG[frameworkIndex % FRAMEWORK_CATALOG.length];
      const domain = CONTROL_DOMAINS[domainIndex % CONTROL_DOMAINS.length];
      const controlId = `CTRL-${prefix}-${statusTarget.status.slice(0, 4).toUpperCase()}-${String(sequence).padStart(3, '0')}`;

      sequence += 1;
      if (await recordExists('controls', controlId)) {
        continue;
      }

      await query(
        `INSERT INTO controls (
           id, workspace_id, title, description, owner, status, domain, primary_framework, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           owner = EXCLUDED.owner,
           status = EXCLUDED.status,
           domain = EXCLUDED.domain,
           primary_framework = EXCLUDED.primary_framework,
           updated_at = NOW()`,
        [
          controlId,
          workspace.id,
          `${framework.name} ${statusTarget.label} Control ${sequence}`,
          `${statusTarget.label} control ${sequence} aligns ${framework.name} obligations with ${domain.toLowerCase()} safeguards for the active workspace.`,
          domain.includes('Vendor') ? 'Third-Party Office' : domain.includes('Business') ? 'Operations Office' : 'Security Office',
          statusTarget.status,
          domain,
          framework.code,
        ],
      );

      if (!(await controlMappingExists(controlId, framework.code, formatFrameworkReference(framework.code, sequence)))) {
        await query(
          `INSERT INTO control_mappings (control_id, framework, reference, type)
           VALUES ($1,$2,$3,$4)`,
          [controlId, framework.code, formatFrameworkReference(framework.code, sequence - 1), 'TYPE_I'],
        );
      }

      if (existing % 3 === 0) {
        const secondary = FRAMEWORK_CATALOG[(frameworkIndex + 3) % FRAMEWORK_CATALOG.length];
        if (!(await controlMappingExists(controlId, secondary.code, formatFrameworkReference(secondary.code, sequence + 999)))) {
          await query(
            `INSERT INTO control_mappings (control_id, framework, reference, type)
             VALUES ($1,$2,$3,$4)`,
            [controlId, secondary.code, formatFrameworkReference(secondary.code, sequence + 999), 'TYPE_II'],
          );
        }
      }

      existing += 1;
      frameworkIndex += 1;
      domainIndex += 1;
    }
  }
}

async function seedRiskControlLinks(workspaceId: string) {
  const risksResult = await query<{ id: string }>(
    `SELECT id
     FROM risks
     WHERE workspace_id = $1
     ORDER BY created_at ASC, id ASC`,
    [workspaceId],
  );

  const controlsResult = await query<{ id: string; primary_framework: string | null }>(
    `SELECT id, primary_framework
     FROM controls
     WHERE workspace_id = $1
     ORDER BY created_at ASC, id ASC`,
    [workspaceId],
  );

  const frameworkBuckets = new Map<string, string[]>();
  for (const framework of FRAMEWORK_CATALOG) {
    frameworkBuckets.set(framework.code, []);
  }
  for (const control of controlsResult.rows) {
    const bucket = control.primary_framework ? frameworkBuckets.get(control.primary_framework) : null;
    if (bucket) {
      bucket.push(control.id);
    }
  }

  for (let index = 0; index < risksResult.rows.length; index += 1) {
    const riskId = risksResult.rows[index].id;
    const framework = FRAMEWORK_CATALOG[index % FRAMEWORK_CATALOG.length];
    const bucket = frameworkBuckets.get(framework.code) ?? [];
    if (bucket.length === 0) {
      continue;
    }

    for (let offset = 0; offset < Math.min(2, bucket.length); offset += 1) {
      const controlId = bucket[(index + offset) % bucket.length];
      await query(
        `INSERT INTO risk_control_links (risk_id, control_id)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1
           FROM risk_control_links
           WHERE risk_id = $1
             AND control_id = $2
         )`,
        [riskId, controlId],
      );
    }
  }
}

async function seedEnterpriseEvidence(workspace: SeedWorkspace) {
  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM evidence WHERE workspace_id = $1`,
    [workspace.id],
  );

  const current = Number(totalResult.rows[0]?.count ?? 0);
  const target = 1248;
  const needed = Math.max(0, target - current);

  if (needed === 0) {
    return;
  }

  const controlsResult = await query<{ id: string }>(
    `SELECT id
     FROM controls
     WHERE workspace_id = $1
     ORDER BY id ASC`,
    [workspace.id],
  );
  const risksResult = await query<{ id: string }>(
    `SELECT id
     FROM risks
     WHERE workspace_id = $1
     ORDER BY id ASC`,
    [workspace.id],
  );

  const eligibleControls = controlsResult.rows.slice(0, Math.max(1, controlsResult.rows.length - 10));
  const riskIds = risksResult.rows.map((row) => row.id);
  const controlIds = eligibleControls.map((row) => row.id);
  const prefix = workspacePrefix(workspace);
  const now = new Date();

  for (let index = 0; index < needed; index += 1) {
    const evidenceNumber = current + index + 1;
    const name = `EVID-${prefix}-${String(evidenceNumber).padStart(4, '0')}`;
    if (await evidenceExists(workspace.id, name)) {
      continue;
    }

    const controlId = controlIds[index % controlIds.length] ?? null;
    const riskId = riskIds.length > 0 && index % 5 === 0 ? riskIds[index % riskIds.length] : null;
    const collectedAt = addDays(now, -(index % 180));
    const lastReviewedAt =
      index % 17 === 0
        ? addDays(now, -(370 + (index % 25)))
        : index % 9 === 0
          ? addDays(now, -(330 + (index % 15)))
          : addDays(now, -(index % 85));

    await query(
      `INSERT INTO evidence (
         workspace_id, name, description, type, location_url, control_id, risk_id, collected_by, collected_at, last_reviewed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        workspace.id,
        name,
        `Evidence package ${evidenceNumber} supporting mapped control assurance and review readiness.`,
        EVIDENCE_TYPES[index % EVIDENCE_TYPES.length],
        `https://laflo.example/evidence/${name.toLowerCase()}`,
        controlId,
        riskId,
        index % 4 === 0 ? 'Audit Office' : 'Control Owner',
        collectedAt.toISOString(),
        lastReviewedAt.toISOString(),
      ],
    );
  }
}

async function seedEnterpriseVendors(workspace: SeedWorkspace) {
  const vendorResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM vendors WHERE workspace_id = $1`,
    [workspace.id],
  );
  const current = Number(vendorResult.rows[0]?.count ?? 0);
  const target = 18;
  const needed = Math.max(0, target - current);
  const prefix = workspacePrefix(workspace);
  const categories = ['Cloud Hosting', 'Payments', 'HRIS', 'Analytics', 'Legal', 'Support'];
  const risks = ['low', 'medium', 'high', 'critical'];
  const statuses = ['active', 'onboarding', 'active', 'offboarded'] as const;

  for (let index = 0; index < needed; index += 1) {
    const sequence = current + index + 1;
    const id = deterministicUuid(`${workspace.id}-vendor-${sequence}`);
    await query(
      `INSERT INTO vendors (
         id, workspace_id, name, category, owner, risk_level, status, next_review_date, has_dpa, regions, data_types_processed
       ) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8::date,$9,$10::text[],$11::text[])
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         owner = EXCLUDED.owner,
         risk_level = EXCLUDED.risk_level,
         status = EXCLUDED.status,
         next_review_date = EXCLUDED.next_review_date,
         has_dpa = EXCLUDED.has_dpa,
         regions = EXCLUDED.regions,
         data_types_processed = EXCLUDED.data_types_processed`,
      [
        id,
        workspace.id,
        `Enterprise Vendor ${sequence}`,
        categories[index % categories.length],
        index % 2 === 0 ? 'Third-Party Office' : 'Procurement',
        risks[index % risks.length],
        statuses[index % statuses.length],
        addDays(new Date(), 14 + (sequence % 120)).toISOString().slice(0, 10),
        index % 3 !== 0,
        index % 2 === 0 ? ['UK', 'EU', 'US'] : ['UK', 'US'],
        index % 3 === 0 ? ['employee_data', 'financial_data'] : ['customer_data', 'operational_data'],
      ],
    );
  }
}

async function seedTrainingData(workspace: SeedWorkspace) {
  const prefix = workspacePrefix(workspace);
  const users = Array.from({ length: 40 }, (_, index) => ({
    id: `USER-${prefix}-${String(index + 1).padStart(3, '0')}`,
    name: `Workspace User ${index + 1}`,
  }));

  for (let index = 0; index < TRAINING_COURSE_BLUEPRINTS.length; index += 1) {
    const blueprint = TRAINING_COURSE_BLUEPRINTS[index];
    const courseId = `COURSE-${prefix}-${String(index + 1).padStart(3, '0')}`;
    await query(
      `INSERT INTO training_courses (
         id, workspace_id, title, description, delivery_format, duration_minutes, mandatory, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         delivery_format = EXCLUDED.delivery_format,
         duration_minutes = EXCLUDED.duration_minutes,
         mandatory = EXCLUDED.mandatory,
         updated_at = NOW()`,
      [
        courseId,
        workspace.id,
        `${workspace.displayName ?? workspace.name} ${blueprint.suffix}`,
        `${blueprint.suffix} ensures the workforce can execute governance, risk, and compliance responsibilities across the supported framework catalog.`,
        blueprint.format,
        blueprint.duration,
        true,
      ],
    );

    for (const frameworkCode of blueprint.frameworks) {
      await query(
        `INSERT INTO training_course_frameworks (course_id, framework_code)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1
           FROM training_course_frameworks
           WHERE course_id = $1
             AND framework_code = $2
         )`,
        [courseId, frameworkCode],
      );
    }
  }

  const assignmentTarget = 320;
  for (let index = 0; index < assignmentTarget; index += 1) {
    const courseId = `COURSE-${prefix}-${String((index % TRAINING_COURSE_BLUEPRINTS.length) + 1).padStart(3, '0')}`;
    const user = users[index % users.length];
    const assignmentId = `ASSIGN-${prefix}-${String(index + 1).padStart(4, '0')}`;
    const status = index < 250 ? 'completed' : index < 308 ? 'in_progress' : 'overdue';
    const assignedAt = addDays(new Date(), -(90 - (index % 30)));
    const dueAt = addDays(assignedAt, 21);
    const completedAt = status === 'completed' ? addDays(assignedAt, 7 + (index % 8)).toISOString() : null;

    await query(
      `INSERT INTO training_assignments (
         id, workspace_id, course_id, user_id, user_name, status, assigned_at, due_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         course_id = EXCLUDED.course_id,
         user_id = EXCLUDED.user_id,
         user_name = EXCLUDED.user_name,
         status = EXCLUDED.status,
         assigned_at = EXCLUDED.assigned_at,
         due_at = EXCLUDED.due_at,
         completed_at = EXCLUDED.completed_at`,
      [
        assignmentId,
        workspace.id,
        courseId,
        user.id,
        user.name,
        status,
        assignedAt.toISOString(),
        dueAt.toISOString(),
        completedAt,
      ],
    );
  }

  for (let index = 0; index < 6; index += 1) {
    const campaignId = `AWARE-${prefix}-${String(index + 1).padStart(3, '0')}`;
    const completionRate = 72 + ((index * 3) % 12);
    await query(
      `INSERT INTO awareness_campaigns (
         id, workspace_id, title, topic, channel, start_date, end_date, status, participants, completion_rate, click_rate
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         topic = EXCLUDED.topic,
         channel = EXCLUDED.channel,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         status = EXCLUDED.status,
         participants = EXCLUDED.participants,
         completion_rate = EXCLUDED.completion_rate,
         click_rate = EXCLUDED.click_rate`,
      [
        campaignId,
        workspace.id,
        `Awareness Campaign ${index + 1}`,
        index % 2 === 0 ? 'phishing' : 'policy refresh',
        index % 2 === 0 ? 'email' : 'portal',
        addDays(new Date(), -(45 - index * 5)).toISOString().slice(0, 10),
        addDays(new Date(), 15 + index * 8).toISOString().slice(0, 10),
        index < 4 ? 'active' : 'planned',
        180 + index * 25,
        completionRate,
        6 + index,
      ],
    );
  }
}

async function seedGovernanceDocuments(workspace: SeedWorkspace) {
  const prefix = workspacePrefix(workspace);
  const types = ['policy', 'standard', 'procedure', 'guideline'];

  for (let index = 0; index < 16; index += 1) {
    const framework = FRAMEWORK_CATALOG[index % FRAMEWORK_CATALOG.length];
    const id = `DOC-${prefix}-${String(index + 1).padStart(3, '0')}`;
    await query(
      `INSERT INTO governance_documents (
         id, workspace_id, title, doc_type, owner, status, current_version, review_frequency_months, next_review_date, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         doc_type = EXCLUDED.doc_type,
         owner = EXCLUDED.owner,
         status = EXCLUDED.status,
         current_version = EXCLUDED.current_version,
         review_frequency_months = EXCLUDED.review_frequency_months,
         next_review_date = EXCLUDED.next_review_date,
         updated_at = NOW()`,
      [
        id,
        workspace.id,
        `${framework.name} Governance Document`,
        types[index % types.length],
        index % 2 === 0 ? 'Governance Office' : 'Compliance Office',
        index % 5 === 0 ? 'draft' : 'approved',
        `1.${index % 4}`,
        12,
        addDays(new Date(), 30 + index * 12).toISOString().slice(0, 10),
      ],
    );

    await query(
      `INSERT INTO governance_document_frameworks (id, document_id, framework_code)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1
         FROM governance_document_frameworks
         WHERE document_id = $2
           AND framework_code = $3
       )`,
      [`GDF-${prefix}-${String(index + 1).padStart(3, '0')}`, id, framework.code],
    );
  }
}

async function seedActivityFeed(workspace: SeedWorkspace) {
  try {
    await ensureActivityLedgerSchema();
  } catch {
    return;
  }

  const recentEvents = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM enterprise_activity_ledger
     WHERE workspace_id = $1`,
    [workspace.id],
  );

  if (Number(recentEvents.rows[0]?.count ?? 0) >= ACTIVITY_BLUEPRINTS.length) {
    return;
  }

  const risk = await query<{ id: string; title: string }>(
    `SELECT id, title FROM risks WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [workspace.id],
  );
  const control = await query<{ id: string; title: string }>(
    `SELECT id, title FROM controls WHERE workspace_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [workspace.id],
  );
  const vendor = await query<{ id: string; name: string }>(
    `SELECT id, name FROM vendors WHERE workspace_id = $1 ORDER BY next_review_date ASC LIMIT 1`,
    [workspace.id],
  );
  const evidence = await query<{ id: string; name: string }>(
    `SELECT id, name FROM evidence WHERE workspace_id = $1 ORDER BY collected_at DESC LIMIT 1`,
    [workspace.id],
  );

  for (let index = 0; index < ACTIVITY_BLUEPRINTS.length; index += 1) {
    const blueprint = ACTIVITY_BLUEPRINTS[index];
    const targetName =
      blueprint.targetType === 'risk'
        ? risk.rows[0]?.title
        : blueprint.targetType === 'control'
          ? control.rows[0]?.title
          : blueprint.targetType === 'vendor'
            ? vendor.rows[0]?.name
            : blueprint.targetType === 'evidence'
              ? evidence.rows[0]?.name
              : 'Executive Review';
    const targetId =
      blueprint.targetType === 'risk'
        ? risk.rows[0]?.id
        : blueprint.targetType === 'control'
          ? control.rows[0]?.id
          : blueprint.targetType === 'vendor'
            ? vendor.rows[0]?.id
            : blueprint.targetType === 'evidence'
              ? evidence.rows[0]?.id
              : null;

    await recordActivity({
      workspaceId: workspace.id,
      actorUserId: `seed-${index + 1}`,
      actorName: workspace.displayName ?? workspace.name,
      actorRole: 'Executive Office',
      action: blueprint.action,
      category: blueprint.category as any,
      targetType: blueprint.targetType,
      targetId,
      targetName,
      outcome: blueprint.outcome as any,
      severity: blueprint.severity as any,
      source: 'system',
      timestamp: addDays(new Date(), -index).toISOString(),
      notes: blueprint.note,
    } as any);
  }
}

async function runOptionalSeedScript(filename: string) {
  const scriptPath = path.resolve(process.cwd(), 'src', 'scripts', filename);
  try {
    await fs.access(scriptPath);
  } catch {
    return;
  }

  const tsxBin = path.resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn(tsxBin, [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${filename} exited with code ${code}`));
      }
    });
  });
}

async function runStep(label: string, fn: () => Promise<void>, options?: { optional?: boolean }) {
  try {
    await fn();
  } catch (error) {
    const message = `${label} failed: ${(error as Error).message}`;
    if (options?.optional) {
      console.warn(message);
      return;
    }
    throw error;
  }
}

async function seedWorkspace(workspace: SeedWorkspace) {
  console.log(`Seeding enterprise GRC data for ${workspace.displayName ?? workspace.name} (${workspace.id})`);

  await seedRiskIntelligenceDefaults(workspace.id);
  await seedStoreCoreData(workspace);
  await seedEnterpriseRisks(workspace);
  await seedEnterpriseControls(workspace);
  await runStep(`Risk-control linking for ${workspace.id}`, () => seedRiskControlLinks(workspace.id), { optional: true });
  await runStep(`Evidence seeding for ${workspace.id}`, () => seedEnterpriseEvidence(workspace), { optional: true });
  await runStep(`Vendor seeding for ${workspace.id}`, () => seedEnterpriseVendors(workspace), { optional: true });
  await runStep(`Training seeding for ${workspace.id}`, () => seedTrainingData(workspace), { optional: true });
  await runStep(`Governance document seeding for ${workspace.id}`, () => seedGovernanceDocuments(workspace), { optional: true });
  await runStep(`Activity feed seeding for ${workspace.id}`, () => seedActivityFeed(workspace), { optional: true });

  const summary = await query<{
    risks: string;
    controls: string;
    evidence: string;
    vendors: string;
    trainingAssignments: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM risks WHERE workspace_id = $1) AS risks,
       (SELECT COUNT(*)::text FROM controls WHERE workspace_id = $1) AS controls,
       (SELECT COUNT(*)::text FROM evidence WHERE workspace_id = $1) AS evidence,
       (SELECT COUNT(*)::text FROM vendors WHERE workspace_id = $1) AS vendors,
       (SELECT COUNT(*)::text FROM training_assignments WHERE workspace_id = $1) AS "trainingAssignments"`,
    [workspace.id],
  );

  console.log(`Enterprise seed complete for ${workspace.id}:`, summary.rows[0]);
}

async function seedEnterpriseGrc() {
  await ensureRiskIntelligenceSchema();
  await ensureFrameworkCatalog();

  const workspaces = await listTargetWorkspaces();
  for (const workspace of workspaces) {
    await seedWorkspace(workspace);
  }
}

seedEnterpriseGrc()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed enterprise GRC data:', error);
    process.exit(1);
  });
