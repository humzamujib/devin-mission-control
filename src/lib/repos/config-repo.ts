import { query } from '../db';

/**
 * Get configuration value by key
 */
export async function getConfig(key: string): Promise<unknown | null> {
    const result = await query(
        'SELECT value FROM config_overrides WHERE key = $1',
        [key]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].value;
}

/**
 * Set configuration value
 */
export async function setConfig(
    key: string,
    value: unknown,
    description?: string,
    updatedBy?: string
): Promise<void> {
    await query(`
        INSERT INTO config_overrides (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
            description = EXCLUDED.description,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
    `, [key, JSON.stringify(value), description, updatedBy]);
}

/**
 * Get all configuration values as key-value object
 */
export async function getAllConfigs(): Promise<Record<string, unknown>> {
    const result = await query(
        'SELECT key, value FROM config_overrides',
        []
    );

    const configs: Record<string, unknown> = {};
    for (const row of result.rows) {
        configs[row.key] = row.value;
    }

    return configs;
}

/**
 * Delete configuration by key
 */
export async function deleteConfig(key: string): Promise<void> {
    await query(
        'DELETE FROM config_overrides WHERE key = $1',
        [key]
    );
}