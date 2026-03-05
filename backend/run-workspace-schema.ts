import { readFileSync } from 'fs';
import { query } from './src/db.js';

async function runWorkspaceSchemaSql() {
  try {
    console.log('Reading schema-workspaces.sql...');
    const sql = readFileSync('./sql/schema-workspaces.sql', 'utf-8');

    // Remove line comments (--) and split by semicolon
    const lines = sql
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        return commentIndex === -1 ? line : line.substring(0, commentIndex);
      })
      .join('\n');

    const statements = lines
      .split(';')
      .map(s => s.trim())
      .filter(s => s && s.length > 0)
      .map(s => s + ';');

    console.log(`Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 80).replace(/\n/g, ' ')}...`);
        await query(stmt);
        console.log('  ✓ Success\n');
        successCount++;
      } catch (err) {
        console.error(`  ✗ Error:`, (err as Error).message);
        // Continue on error to see all failures
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✓ Schema execution complete (${successCount}/${statements.length} successful)`);
    console.log('='.repeat(60));

    // Verify workspaces were created
    console.log('\nVerifying workspaces...');
    try {
      const result = await query('SELECT id, name FROM workspaces ORDER BY id');
      if (result.rows && result.rows.length > 0) {
        console.log('✓ Workspaces created:');
        result.rows.forEach((row: any) => {
          console.log(`  - ${row.id}: ${row.name}`);
        });
      } else {
        console.log('⚠ Workspaces table exists but no data found');
      }
    } catch (err) {
      console.error('⚠ Could not verify workspaces:', (err as Error).message);
    }

    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

runWorkspaceSchemaSql();
