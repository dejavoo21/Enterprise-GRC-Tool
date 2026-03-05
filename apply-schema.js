/**
 * Apply missing database schemas
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/grc_suite'
});

const schemas = [
  'schema-frameworks.sql',
  'schema-training.sql',
  'schema-governance-review.sql',
  'schema-activity-log.sql'
];

async function applySchemas() {
  for (const schemaFile of schemas) {
    const filePath = path.join(__dirname, 'backend', 'sql', schemaFile);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${schemaFile} - file not found`);
      continue;
    }

    console.log(`Applying ${schemaFile}...`);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await pool.query(sql);
      console.log(`  ✓ ${schemaFile} applied successfully`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⚠ ${schemaFile} - tables already exist`);
      } else {
        console.error(`  ✗ ${schemaFile} failed: ${err.message}`);
      }
    }
  }

  await pool.end();
  console.log('\nDone!');
}

applySchemas().catch(console.error);
