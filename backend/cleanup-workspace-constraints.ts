import { query } from './src/db.js';

async function cleanup() {
  try {
    console.log('Dropping old FK constraints...');
    
    const constraints = [
      'ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_workspace_fk;',
      'ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_workspace_fk;',
      'ALTER TABLE evidence DROP CONSTRAINT IF EXISTS evidence_workspace_fk;',
      'ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_workspace_fk;',
      'ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_workspace_fk;',
    ];

    for (const stmt of constraints) {
      try {
        await query(stmt);
        console.log(`✓ ${stmt.split(' ')[2]}`);
      } catch (err) {
        console.log(`  (constraint didn't exist, skipping)`);
      }
    }

    console.log('\nDone. Re-run run-workspace-schema.ts to apply new constraints.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

cleanup();
