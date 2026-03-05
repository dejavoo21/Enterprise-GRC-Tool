const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/grc_suite'
});

async function check() {
  const result = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('Tables in database:');
  result.rows.forEach(r => console.log(`  - ${r.table_name}`));
  await pool.end();
}

check().catch(console.error);
