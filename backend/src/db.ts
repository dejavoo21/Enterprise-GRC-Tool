import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple paths
dotenv.config({ path: path.join(process.cwd(), 'grc-tool', 'backend', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

console.log('Database URL from env:', process.env.DATABASE_URL);

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional: configure pool size
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors
pool.on('error', (error) => {
  console.error('Unexpected error on idle client in pool', error);
});

pool.on('connect', () => {
  console.log('New connection created in pool');
});

// Type-safe query helper
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    console.log(`Executed query (${duration}ms)`, { text, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

// Connection health check
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query<{ now: string }>('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed', error);
    return false;
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

// Generate a unique ID with a prefix
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomPart}`;
}

export { pool };
