import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'grc_suite',
});

pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Success:', result.rows[0]);
  }
  pool.end();
});
