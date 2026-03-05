import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/db.js';

async function test() {
  try {
    console.log('Testing database connection...');
    const result = await query('SELECT NOW()');
    console.log('Database connected successfully!');
    console.log('Current time:', result.rows[0]);
  } catch (error) {
    console.error('Database connection error:', error);
  }
}

test();
