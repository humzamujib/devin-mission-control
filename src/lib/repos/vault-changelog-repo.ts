import { query } from '../db';

export type VaultChangelogRow = {
  id: number;
  title: string;
  body: string;
  source: string | null;
  created_at: Date;
};

/**
 * Insert a changelog entry.
 * Never throws.
 */
export async function insertChangelog(title: string, body: string, source?: string): Promise<void> {
  try {
    await query(
      'INSERT INTO vault_changelogs (title, body, source) VALUES ($1, $2, $3)',
      [title, body, source || null]
    );
  } catch (error) {
    console.error('[VaultChangelogRepo] Failed to insert:', error, { title });
  }
}

/**
 * List changelogs, most recent first.
 * Never throws.
 */
export async function listChangelogs(limit = 10): Promise<VaultChangelogRow[]> {
  try {
    const result = await query(
      'SELECT * FROM vault_changelogs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows as VaultChangelogRow[];
  } catch (error) {
    console.error('[VaultChangelogRepo] Failed to list:', error);
    return [];
  }
}

/**
 * Get a changelog by ID.
 * Never throws.
 */
export async function getChangelogById(id: number): Promise<VaultChangelogRow | null> {
  try {
    const result = await query('SELECT * FROM vault_changelogs WHERE id = $1', [id]);
    return result.rows.length > 0 ? (result.rows[0] as VaultChangelogRow) : null;
  } catch (error) {
    console.error('[VaultChangelogRepo] Failed to get by ID:', error, { id });
    return null;
  }
}
