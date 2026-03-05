import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/grc_suite'
});

try {
  const client = await pool.connect();
  
  // Test 1: Check if workspaces table exists
  console.log('Testing workspaces table...');
  const result = await client.query('SELECT id, name, description FROM workspaces ORDER BY id');
  console.log(`Found ${result.rows.length} workspaces:`);
  console.log(JSON.stringify(result.rows, null, 2));
  
  client.release();
  await pool.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
