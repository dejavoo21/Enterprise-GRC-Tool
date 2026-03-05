/**
 * Apply all database schemas
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/grc_suite'
});

const schemaOrder = [
  'schema-auth.sql',
  'schema-workspaces.sql',
  'schema-workspace-onboarding.sql',
  'schema-core-grc.sql',
  'schema-assets-vendors.sql',
  'schema-frameworks.sql',
  'schema-governance-review.sql',
  'schema-training.sql',
  'schema-training-practice.sql',
  'schema-control-governance-training.sql',
  'schema-activity-log.sql',
];

async function applySchemas() {
  console.log('Applying all database schemas...\n');

  for (const schemaFile of schemaOrder) {
    const filePath = path.join(__dirname, 'backend', 'sql', schemaFile);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠ Skipping ${schemaFile} - file not found`);
      continue;
    }

    console.log(`Applying ${schemaFile}...`);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await pool.query(sql);
      console.log(`  ✓ ${schemaFile}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
        console.log(`  ⚠ ${schemaFile} - already exists/applied`);
      } else {
        console.error(`  ✗ ${schemaFile}: ${err.message}`);
      }
    }
  }

  await pool.end();
  console.log('\nDone!');
}

applySchemas().catch(console.error);
