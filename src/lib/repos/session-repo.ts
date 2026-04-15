import { query } from '../db';

/**
 * Type definition mapping to the sessions table columns
 */
export type SessionRow = {
  id: string;
  status: string;
  prompt: string | null;
  repo: string | null;
  branch: string | null;
  pr_number: number | null;
  pr_url: string | null;
  pr_status: string | null;
  ci_status: string | null;
  started_at: Date;
  completed_at: Date | null;
  last_seen_at: Date;
  metadata: Record<string, unknown>;
};

/**
 * Insert a new session or update existing session by ID.
 * Updates all provided fields on conflict.
 * Never throws - logs errors and returns silently.
 */
export async function upsertSession(session: Partial<SessionRow> & { id: string }): Promise<void> {
  try {
    const fields = Object.keys(session).filter(key => key !== 'id');
    const values = fields.map(field => session[field as keyof typeof session]);

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const insertFields = ['id', ...fields].join(', ');
    const insertPlaceholders = Array.from({ length: fields.length + 1 }, (_, i) => `$${i + 1}`).join(', ');

    const sql = `
      INSERT INTO sessions (${insertFields})
      VALUES (${insertPlaceholders})
      ON CONFLICT (id) DO UPDATE SET
        ${setClause}
    `;

    await query(sql, [session.id, ...values]);
  } catch (error) {
    console.error('[SessionRepo] Failed to upsert session:', error, { sessionId: session.id });
  }
}

/**
 * Get a session by its ID.
 * Returns null if not found or on error.
 * Never throws.
 */
export async function getSessionById(id: string): Promise<SessionRow | null> {
  try {
    const result = await query('SELECT * FROM sessions WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as SessionRow;
  } catch (error) {
    console.error('[SessionRepo] Failed to get session by ID:', error, { sessionId: id });
    return null;
  }
}

/**
 * List all active sessions (not finished, done, or archived).
 * Returns empty array on error.
 * Never throws.
 */
export async function listActiveSessions(): Promise<SessionRow[]> {
  try {
    const result = await query(`
      SELECT * FROM sessions
      WHERE status NOT IN ('finished', 'done', 'archived')
      ORDER BY started_at DESC
    `);

    return result.rows as SessionRow[];
  } catch (error) {
    console.error('[SessionRepo] Failed to list active sessions:', error);
    return [];
  }
}

/**
 * Update session status and optionally set completion time.
 * Never throws - logs errors and returns silently.
 */
export async function updateSessionStatus(id: string, status: string, completedAt?: Date): Promise<void> {
  try {
    let sql: string;
    let params: unknown[];

    if (completedAt) {
      sql = 'UPDATE sessions SET status = $1, completed_at = $2, last_seen_at = NOW() WHERE id = $3';
      params = [status, completedAt, id];
    } else {
      sql = 'UPDATE sessions SET status = $1, last_seen_at = NOW() WHERE id = $2';
      params = [status, id];
    }

    await query(sql, params);
  } catch (error) {
    console.error('[SessionRepo] Failed to update session status:', error, { sessionId: id, status });
  }
}

/**
 * Get all sessions for a specific repository.
 * Returns empty array on error.
 * Never throws.
 */
export async function getSessionsByRepo(repo: string): Promise<SessionRow[]> {
  try {
    const result = await query(`
      SELECT * FROM sessions
      WHERE repo = $1
      ORDER BY started_at DESC
    `, [repo]);

    return result.rows as SessionRow[];
  } catch (error) {
    console.error('[SessionRepo] Failed to get sessions by repo:', error, { repo });
    return [];
  }
}

/**
 * Update the last_seen_at timestamp for a session to current time.
 * Never throws - logs errors and returns silently.
 */
export async function touchSession(id: string): Promise<void> {
  try {
    await query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [id]);
  } catch (error) {
    console.error('[SessionRepo] Failed to touch session:', error, { sessionId: id });
  }
}