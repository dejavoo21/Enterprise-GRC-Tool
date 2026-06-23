/**
 * Seed script for core GRC entities (Risks, Controls, Mappings, Evidence)
 * Populates the PostgreSQL database with demo data from the in-memory store
 *
 * Features:
 * - Idempotent: Safe to run multiple times
 * - FK-safe: Validates foreign keys before inserting child records
 * - Deterministic: Seeds in safe order (risks -> controls -> mappings -> evidence)
 * - Graceful: Skips records with missing references and logs warnings
 */

import { risks, controls, controlMappings, evidenceItems } from '../store/index.js';
import { query } from '../db.js';
import { resolveSeedWorkspace } from './resolveSeedWorkspace.js';

interface SeedStats {
  frameworks: { seeded: number; skipped: number };
  risks: { seeded: number; skipped: number };
  controls: { seeded: number; skipped: number };
  mappings: { seeded: number; skipped: number };
  evidence: { seeded: number; skipped: number };
}

const stats: SeedStats = {
  frameworks: { seeded: 0, skipped: 0 },
  risks: { seeded: 0, skipped: 0 },
  controls: { seeded: 0, skipped: 0 },
  mappings: { seeded: 0, skipped: 0 },
  evidence: { seeded: 0, skipped: 0 },
};

const FRAMEWORK_CODES = [
  'ISO27001',
  'ISO27701',
  'SOC1',
  'SOC2',
  'NIST_800_53',
  'NIST_CSF',
  'CIS',
  'PCI_DSS',
  'HIPAA',
  'HITRUST',
  'ISO42001',
  'EU_AI_ACT',
  'GDPR',
  'NIS2',
  'COBIT',
  'CUSTOM',
] as const;

const FRAMEWORK_CATALOG = [
  { code: 'CIS', name: 'CIS Controls', category: 'security', description: 'Center for Internet Security Critical Security Controls', isAiHealthcare: false, isPrivacy: false, isDefault: true, colorHex: '#059669' },
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
] as const;

async function ensureFrameworkCatalog() {
  const allowed = FRAMEWORK_CODES.map((code) => `'${code}'`).join(', ');

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

  console.log(`\nSeeding Framework Catalog (${FRAMEWORK_CATALOG.length} records)...`);
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
    stats.frameworks.seeded += 1;
  }
}

async function recordExists(table: string, id: string): Promise<boolean> {
  try {
    const result = await query(`SELECT id FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function riskExists(riskId: string): Promise<boolean> {
  try {
    const result = await query(`SELECT id FROM risks WHERE id = $1 LIMIT 1`, [riskId]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function controlExists(controlId: string): Promise<boolean> {
  try {
    const result = await query(`SELECT id FROM controls WHERE id = $1 LIMIT 1`, [controlId]);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function seededRiskExists(workspaceId: string, title: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM risks WHERE workspace_id = $1 AND title = $2 LIMIT 1`,
      [workspaceId, title],
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function controlMappingExists(controlId: string, framework: string, reference: string): Promise<boolean> {
  try {
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
  } catch {
    return false;
  }
}

async function evidenceExists(
  workspaceId: string,
  name: string,
  controlId: string | null,
  riskId: string | null,
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id
       FROM evidence
       WHERE workspace_id = $1
         AND name = $2
         AND (control_id IS NOT DISTINCT FROM $3)
         AND (risk_id IS NOT DISTINCT FROM $4)
       LIMIT 1`,
      [workspaceId, name, controlId, riskId],
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function seedRisks() {
  const workspace = await resolveSeedWorkspace();
  console.log(`\nSeeding Risks (${risks.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const risk of risks) {
    const exists = await seededRiskExists(workspace.id, risk.title);
    if (exists) {
      console.log(`  Skipping risk ${risk.id} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const result = await query(
        `INSERT INTO risks (
           id,
           workspace_id,
           title,
           description,
           owner,
           category,
           status,
           inherent_likelihood,
           inherent_impact,
           residual_likelihood,
           residual_impact,
           treatment_plan,
           due_date,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
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
          risk.dueDate,
          risk.createdAt,
          risk.updatedAt,
        ],
      );

      if (result.rows.length > 0) {
        console.log(`  Seeded risk: ${risk.id} - ${risk.title}`);
        seeded++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  Failed to seed risk ${risk.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.risks = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedControls() {
  const workspace = await resolveSeedWorkspace();
  console.log(`\nSeeding Controls (${controls.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const control of controls) {
    const exists = await recordExists('controls', control.id);
    if (exists) {
      console.log(`  Skipping control ${control.id} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const result = await query(
        `INSERT INTO controls (id, workspace_id, title, description, owner, status, domain, primary_framework, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          control.id,
          workspace.id,
          control.title,
          control.description,
          control.owner,
          control.status,
          control.domain,
          control.primaryFramework,
          control.createdAt,
          control.updatedAt,
        ],
      );

      if (result.rows.length > 0) {
        console.log(`  Seeded control: ${control.id} - ${control.title}`);
        seeded++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  Failed to seed control ${control.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.controls = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedControlMappings() {
  console.log(`\nSeeding Control Mappings (${controlMappings.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const mapping of controlMappings) {
    const controlExistsInDb = await controlExists(mapping.controlId);
    if (!controlExistsInDb) {
      console.warn(
        `  Skipping mapping ${mapping.id}: control ${mapping.controlId} not found in database`,
      );
      skipped++;
      continue;
    }

    const exists = await controlMappingExists(mapping.controlId, mapping.framework, mapping.reference);
    if (exists) {
      console.log(`  Skipping mapping ${mapping.id} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const result = await query(
        `INSERT INTO control_mappings (control_id, framework, reference, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [mapping.controlId, mapping.framework, mapping.reference, mapping.type || null],
      );

      if (result.rows.length > 0) {
        console.log(`  Seeded mapping: ${mapping.controlId} -> ${mapping.framework}`);
        seeded++;
      }
    } catch (err) {
      console.error(`  Failed to seed mapping ${mapping.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.mappings = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedEvidence() {
  const workspace = await resolveSeedWorkspace();
  console.log(`\nSeeding Evidence Items (${evidenceItems.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const evidence of evidenceItems) {
    const alreadyExists = await evidenceExists(
      workspace.id,
      evidence.name,
      evidence.controlId || null,
      evidence.riskId || null,
    );
    if (alreadyExists) {
      console.log(`  Skipping evidence ${evidence.id} (already exists)`);
      skipped++;
      continue;
    }

    if (evidence.controlId) {
      const controlExistsInDb = await controlExists(evidence.controlId);
      if (!controlExistsInDb) {
        console.warn(
          `  Skipping evidence ${evidence.id}: control ${evidence.controlId} not found in database`,
        );
        skipped++;
        continue;
      }
    }

    if (evidence.riskId) {
      const riskExistsInDb = await riskExists(evidence.riskId);
      if (!riskExistsInDb) {
        console.warn(
          `  Skipping evidence ${evidence.id}: risk ${evidence.riskId} not found in database`,
        );
        skipped++;
        continue;
      }
    }

    try {
      const result = await query(
        `INSERT INTO evidence (workspace_id, name, description, type, location_url, control_id, risk_id, collected_by, collected_at, last_reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          workspace.id,
          evidence.name,
          evidence.description,
          evidence.type,
          evidence.locationUrl || null,
          evidence.controlId || null,
          evidence.riskId || null,
          evidence.collectedBy,
          evidence.collectedAt,
          evidence.lastReviewedAt || null,
        ],
      );

      if (result.rows.length > 0) {
        console.log(`  Seeded evidence: ${evidence.id} - ${evidence.name}`);
        seeded++;
      }
    } catch (err) {
      console.error(`  Failed to seed evidence ${evidence.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.evidence = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedCoreGRC() {
  console.log('Starting GRC core data seeding (deterministic, FK-safe, idempotent)...');

  try {
    const workspace = await resolveSeedWorkspace();
    console.log(`Using workspace ${workspace.displayName || workspace.name} (${workspace.id})`);
    await ensureFrameworkCatalog();
    await seedRisks();
    await seedControls();
    await seedControlMappings();
    await seedEvidence();

    console.log('\n' + '='.repeat(60));
    console.log('SEEDING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Frameworks:  ${stats.frameworks.seeded} seeded, ${stats.frameworks.skipped} skipped`);
    console.log(`Risks:       ${stats.risks.seeded} seeded, ${stats.risks.skipped} skipped`);
    console.log(`Controls:    ${stats.controls.seeded} seeded, ${stats.controls.skipped} skipped`);
    console.log(`Mappings:    ${stats.mappings.seeded} seeded, ${stats.mappings.skipped} skipped`);
    console.log(`Evidence:    ${stats.evidence.seeded} seeded, ${stats.evidence.skipped} skipped`);
    console.log('='.repeat(60));
    console.log('GRC core data seeding completed successfully.');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding GRC core data:', error);
    process.exit(1);
  }
}

seedCoreGRC();
