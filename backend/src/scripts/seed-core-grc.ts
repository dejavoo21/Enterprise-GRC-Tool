/**
 * Seed script for core GRC entities (Risks, Controls, Mappings, Evidence)
 * Populates the PostgreSQL database with demo data from the in-memory store
 * 
 * Features:
 * - Idempotent: Safe to run multiple times (checks if records exist before inserting)
 * - FK-safe: Validates foreign keys before inserting child records
 * - Deterministic: Seeds in safe order (risks → controls → mappings → evidence)
 * - Graceful: Skips records with missing references and logs warnings
 */

import * as risksRepo from '../repositories/risksRepo.js';
import * as controlsRepo from '../repositories/controlsRepo.js';
import * as controlMappingsRepo from '../repositories/controlMappingsRepo.js';
import * as evidenceRepo from '../repositories/evidenceRepo.js';
import { risks, controls, controlMappings, evidenceItems } from '../store/index.js';
import { query } from '../db.js';

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

/**
 * Helper: Check if a record exists in a table
 */
async function recordExists(table: string, id: string): Promise<boolean> {
  try {
    const result = await query(`SELECT id FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    return result.rows.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Helper: Check if a risk exists in the database
 */
async function riskExists(riskId: string): Promise<boolean> {
  try {
    const result = await query(`SELECT id FROM risks WHERE id = $1 LIMIT 1`, [riskId]);
    return result.rows.length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Helper: Check if a control exists in the database
 */
async function controlExists(controlId: string): Promise<boolean> {
  try {
    const result = await query(`SELECT id FROM controls WHERE id = $1 LIMIT 1`, [controlId]);
    return result.rows.length > 0;
  } catch (err) {
    return false;
  }
}

async function seedRisks() {
  console.log(`\n📊 Seeding Risks (${risks.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const risk of risks) {
    const exists = await recordExists('risks', risk.id);
    if (exists) {
      console.log(`  ⏭️  Skipping risk ${risk.id} (already exists)`);
      skipped++;
      continue;
    }

    try {
      await risksRepo.createRisk('demo-workspace', {
        title: risk.title,
        description: risk.description,
        owner: risk.owner,
        category: risk.category,
        inherentLikelihood: risk.inherentLikelihood,
        inherentImpact: risk.inherentImpact,
        dueDate: risk.dueDate,
      });
      console.log(`  ✅ Seeded risk: ${risk.id} - ${risk.title}`);
      seeded++;
    } catch (err) {
      console.error(`  ❌ Failed to seed risk ${risk.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.risks = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedControls() {
  console.log(`\n📋 Seeding Controls (${controls.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const control of controls) {
    const exists = await recordExists('controls', control.id);
    if (exists) {
      console.log(`  ⏭️  Skipping control ${control.id} (already exists)`);
      skipped++;
      continue;
    }

    try {
      // Insert directly into controls table with the ID
      const result = await query(
        `INSERT INTO controls (id, workspace_id, title, description, owner, status, domain, primary_framework, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          control.id,
          control.workspaceId,
          control.title,
          control.description,
          control.owner,
          control.status,
          control.domain,
          control.primaryFramework,
          control.createdAt,
          control.updatedAt,
        ]
      );

      if (result.rows.length > 0) {
        console.log(`  ✅ Seeded control: ${control.id} - ${control.title}`);
        seeded++;
      }
    } catch (err) {
      console.error(`  ❌ Failed to seed control ${control.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.controls = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedControlMappings() {
  console.log(`\n🔗 Seeding Control Mappings (${controlMappings.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const mapping of controlMappings) {
    // FK validation: Check if control exists
    const controlExistsInDb = await controlExists(mapping.controlId);
    if (!controlExistsInDb) {
      console.warn(
        `  ⚠️  Skipping mapping ${mapping.id}: control ${mapping.controlId} not found in database`
      );
      skipped++;
      continue;
    }

    try {
      const result = await query(
        `INSERT INTO control_mappings (control_id, framework, reference, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          mapping.controlId,
          mapping.framework,
          mapping.reference,
          mapping.type || null,
        ]
      );

      if (result.rows.length > 0) {
        console.log(`  ✅ Seeded mapping: ${mapping.controlId} → ${mapping.framework}`);
        seeded++;
      }
    } catch (err) {
      console.error(`  ❌ Failed to seed mapping ${mapping.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.mappings = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedEvidence() {
  console.log(`\n📄 Seeding Evidence Items (${evidenceItems.length} records)...`);
  let seeded = 0;
  let skipped = 0;

  for (const evidence of evidenceItems) {
    // FK validation: Check if referenced control exists (if controlId is set)
    if (evidence.controlId) {
      const controlExistsInDb = await controlExists(evidence.controlId);
      if (!controlExistsInDb) {
        console.warn(
          `  ⚠️  Skipping evidence ${evidence.id}: control ${evidence.controlId} not found in database`
        );
        skipped++;
        continue;
      }
    }

    // FK validation: Check if referenced risk exists (if riskId is set)
    if (evidence.riskId) {
      const riskExistsInDb = await riskExists(evidence.riskId);
      if (!riskExistsInDb) {
        console.warn(
          `  ⚠️  Skipping evidence ${evidence.id}: risk ${evidence.riskId} not found in database`
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
          evidence.workspaceId,
          evidence.name,
          evidence.description,
          evidence.type,
          evidence.locationUrl || null,
          evidence.controlId || null,
          evidence.riskId || null,
          evidence.collectedBy,
          evidence.collectedAt,
          evidence.lastReviewedAt || null,
        ]
      );

      if (result.rows.length > 0) {
        console.log(`  ✅ Seeded evidence: ${evidence.id} - ${evidence.name}`);
        seeded++;
      }
    } catch (err) {
      console.error(`  ❌ Failed to seed evidence ${evidence.id}:`, (err as Error).message);
      skipped++;
    }
  }

  stats.evidence = { seeded, skipped };
  console.log(`  Summary: ${seeded} seeded, ${skipped} skipped`);
}

async function seedCoreGRC() {
  console.log('🌱 Starting GRC core data seeding (deterministic, FK-safe, idempotent)...');

  try {
    // Seed in order: risks → controls → mappings → evidence
    // This ensures all foreign keys are available when needed
    await seedRisks();
    await seedControls();
    await seedControlMappings();
    await seedEvidence();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✨ SEEDING SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Risks:       ${stats.risks.seeded} seeded, ${stats.risks.skipped} skipped`);
    console.log(`Controls:    ${stats.controls.seeded} seeded, ${stats.controls.skipped} skipped`);
    console.log(`Mappings:    ${stats.mappings.seeded} seeded, ${stats.mappings.skipped} skipped`);
    console.log(`Evidence:    ${stats.evidence.seeded} seeded, ${stats.evidence.skipped} skipped`);
    console.log('='.repeat(60));
    console.log('✨ GRC core data seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding GRC core data:', error);
    process.exit(1);
  }
}

// Run the seed script
seedCoreGRC();
