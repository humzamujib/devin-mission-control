import { query } from '../db';

export type VaultPatternRow = {
  name: string;
  tags: string[];
  repos: string[];
  confidence: string;
  last_referenced: Date | null;
  reference_count: number;
  body: string;
  created_at: Date;
  updated_at: Date;
};

/**
 * Insert or update a pattern.
 * Never throws.
 */
export async function upsertPattern(pattern: VaultPatternRow): Promise<void> {
  try {
    await query(`
      INSERT INTO vault_patterns (name, tags, repos, confidence, last_referenced, reference_count, body, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (name) DO UPDATE SET
        tags = EXCLUDED.tags,
        repos = EXCLUDED.repos,
        confidence = EXCLUDED.confidence,
        last_referenced = EXCLUDED.last_referenced,
        reference_count = EXCLUDED.reference_count,
        body = EXCLUDED.body,
        updated_at = NOW()
    `, [
      pattern.name, JSON.stringify(pattern.tags), JSON.stringify(pattern.repos),
      pattern.confidence, pattern.last_referenced, pattern.reference_count, pattern.body,
    ]);
  } catch (error) {
    console.error('[VaultPatternRepo] Failed to upsert:', error, { name: pattern.name });
  }
}

/**
 * List all patterns, sorted by name.
 * Never throws.
 */
export async function listPatterns(): Promise<VaultPatternRow[]> {
  try {
    const result = await query('SELECT * FROM vault_patterns ORDER BY name');
    return result.rows as VaultPatternRow[];
  } catch (error) {
    console.error('[VaultPatternRepo] Failed to list:', error);
    return [];
  }
}

/**
 * Get a pattern by name.
 * Never throws.
 */
export async function getPatternByName(name: string): Promise<VaultPatternRow | null> {
  try {
    const result = await query('SELECT * FROM vault_patterns WHERE name = $1', [name]);
    return result.rows.length > 0 ? (result.rows[0] as VaultPatternRow) : null;
  } catch (error) {
    console.error('[VaultPatternRepo] Failed to get by name:', error, { name });
    return null;
  }
}

/**
 * Update pattern metadata (confidence, last_referenced, reference_count).
 * Never throws.
 */
export async function updatePatternMetadata(
  name: string,
  updates: { confidence?: string; last_referenced?: Date; reference_count?: number }
): Promise<void> {
  try {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.confidence !== undefined) {
      setClauses.push(`confidence = $${idx++}`);
      params.push(updates.confidence);
    }
    if (updates.last_referenced !== undefined) {
      setClauses.push(`last_referenced = $${idx++}`);
      params.push(updates.last_referenced);
    }
    if (updates.reference_count !== undefined) {
      setClauses.push(`reference_count = $${idx++}`);
      params.push(updates.reference_count);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = NOW()');
    params.push(name);

    await query(
      `UPDATE vault_patterns SET ${setClauses.join(', ')} WHERE name = $${idx}`,
      params
    );
  } catch (error) {
    console.error('[VaultPatternRepo] Failed to update metadata:', error, { name });
  }
}

/**
 * Soft-delete a pattern by removing it from the active table.
 * Never throws.
 */
export async function deletePattern(name: string): Promise<void> {
  try {
    await query('DELETE FROM vault_patterns WHERE name = $1', [name]);
  } catch (error) {
    console.error('[VaultPatternRepo] Failed to delete:', error, { name });
  }
}
