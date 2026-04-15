import { Pool, QueryResult } from 'pg';

// Global reference to survive Next.js hot-reload in dev mode
const globalForPg = globalThis as unknown as { pgPool?: Pool };

/**
 * Lazily creates and returns a PostgreSQL connection pool.
 * Returns null if DATABASE_URL is not set.
 * Never throws - logs errors and returns null for silent failures.
 */
export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  // Return existing pool if already created
  if (globalForPg.pgPool) {
    return globalForPg.pgPool;
  }

  try {
    // Create new pool with configuration for local development
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,                        // Enough for local dev
      idleTimeoutMillis: 30000,      // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Fail fast if can't connect
    });

    // Store on globalThis to survive Next.js hot-reload
    globalForPg.pgPool = pool;

    console.log('[DB] PostgreSQL connection pool created');
    return pool;
  } catch (error) {
    console.error('[DB] Failed to create connection pool:', error);
    return null;
  }
}

/**
 * Execute a SQL query using the connection pool.
 * Returns empty result object if pool is not available.
 * Never throws - designed for dual-write pattern compatibility.
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const pool = getPool();

  if (!pool) {
    // Return empty-ish result for safe destructuring when DB not available
    return {
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: []
    } as QueryResult;
  }

  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('[DB] Query failed:', error, { text, params });
    // Return empty result instead of throwing
    return {
      rows: [],
      rowCount: 0,
      command: '',
      oid: 0,
      fields: []
    } as QueryResult;
  }
}

/**
 * Test database connectivity.
 * Returns true if connection successful, false otherwise.
 * Never throws.
 */
export async function isDbAvailable(): Promise<boolean> {
  try {
    const result = await query('SELECT 1');
    return result.rowCount === 1;
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}