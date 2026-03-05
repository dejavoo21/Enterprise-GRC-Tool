import pg from 'pg';

const client = new pg.Client({
  user: 'postgres',
  // No password - trust authentication
  host: 'localhost',
  port: 5432,
  database: 'grc_suite',
});

client.connect().then(() => {
  console.log('Connected!');
  client.query('SELECT NOW()', (err, res) => {
    if (err) throw err;
    console.log('Query result:', res.rows[0]);
    client.end();
  });
}).catch(err => {
  console.error('Connection error:', err.message);
});
