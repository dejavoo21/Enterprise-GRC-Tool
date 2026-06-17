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
  risks: { seeded: number; skipped: number };
  controls: { seeded: number; skipped: number };
  mappings: { seeded: number; skipped: number };
  evidence: { seeded: number; skipped: number };
}

const stats: SeedStats = {
  risks: { seeded: 0, skipped: 0 },
  controls: { seeded: 0, skipped: 0 },
  mappings: { seeded: 0, skipped: 0 },
  evidence: { seeded: 0, skipped: 0 },
};

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
    await seedRisks();
    await seedControls();
    await seedControlMappings();
    await seedEvidence();

    console.log('\n' + '='.repeat(60));
    console.log('SEEDING SUMMARY:');
    console.log('='.repeat(60));
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
