import { query } from '../db';

export type VaultSessionRecordRow = {
  id: string;
  title: string;
  repo: string | null;
  prompt: string | null;
  result: string | null;
  status: string | null;
  source: string | null;
  model: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  tools_used: string[];
  messages: { type: string; text: string; timestamp: string }[];
  created_at: Date | null;
  completed_at: Date;
};

/**
 * Insert or update a session record.
 * Never throws.
 */
export async function upsertSessionRecord(record: VaultSessionRecordRow): Promise<void> {
  try {
    await query(`
      INSERT INTO vault_session_records (id, title, repo, prompt, result, status, source, model, duration_ms, cost_usd, tools_used, messages, created_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        result = EXCLUDED.result,
        status = EXCLUDED.status,
        tools_used = EXCLUDED.tools_used,
        messages = EXCLUDED.messages,
        completed_at = EXCLUDED.completed_at
    `, [
      record.id, record.title, record.repo, record.prompt, record.result,
      record.status, record.source, record.model, record.duration_ms, record.cost_usd,
      JSON.stringify(record.tools_used), JSON.stringify(record.messages),
      record.created_at, record.completed_at,
    ]);
  } catch (error) {
    console.error('[VaultSessionRecordRepo] Failed to upsert:', error, { id: record.id });
  }
}

/**
 * List session records, most recent first.
 * Never throws.
 */
export async function listSessionRecords(limit = 30): Promise<VaultSessionRecordRow[]> {
  try {
    const result = await query(
      'SELECT * FROM vault_session_records ORDER BY completed_at DESC LIMIT $1',
      [limit]
    );
    return result.rows as VaultSessionRecordRow[];
  } catch (error) {
    console.error('[VaultSessionRecordRepo] Failed to list:', error);
    return [];
  }
}

/**
 * Get a session record by ID.
 * Never throws.
 */
export async function getSessionRecordById(id: string): Promise<VaultSessionRecordRow | null> {
  try {
    const result = await query('SELECT * FROM vault_session_records WHERE id = $1', [id]);
    return result.rows.length > 0 ? (result.rows[0] as VaultSessionRecordRow) : null;
  } catch (error) {
    console.error('[VaultSessionRecordRepo] Failed to get by ID:', error, { id });
    return null;
  }
}
