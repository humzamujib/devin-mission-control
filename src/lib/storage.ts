import { isDbAvailable } from './db';
import * as devin from './devin';
import * as githubPr from './github-pr';
import * as vault from './vault';
import * as sessionRepo from './repos/session-repo';
import * as prCacheRepo from './repos/pr-cache-repo';
import * as configRepo from './repos/config-repo';
import * as vaultSessionRecordRepo from './repos/vault-session-record-repo';
import * as vaultChangelogRepo from './repos/vault-changelog-repo';
import * as vaultPatternRepo from './repos/vault-pattern-repo';
import type { SessionRecord, PatternMeta } from './vault';

// Feature flags from environment
const POSTGRES_ENABLED = process.env.POSTGRES_ENABLED === 'true';
const POSTGRES_READ_ENABLED = process.env.POSTGRES_READ_ENABLED === 'true';

// ============================================================================
// SESSION STORAGE
// ============================================================================

/**
 * List sessions with database read preference when enabled
 * Falls back to Devin API when database unavailable or disabled
 */
export async function listSessions(userEmail?: string): Promise<Response> {
  // Devin API is always the source of truth for active sessions.
  // Postgres is a write-through cache populated by persistSessions().
  return devin.listSessions(userEmail);
}

/**
 * Get individual session detail (includes messages).
 * Always from Devin API — Postgres cache doesn't store messages.
 */
export async function getSession(sessionId: string): Promise<Response> {
  return devin.getSession(sessionId);
}

/**
 * Create session with fire-and-forget write to database when enabled
 * Always uses Devin API as primary source of truth
 */
export async function createSession(prompt: string): Promise<Response> {
  const response = await devin.createSession(prompt);

  if (POSTGRES_ENABLED && response.ok) {
    // Fire-and-forget write to database
    response.clone().json().then(async (data) => {
      try {
        if (data.id) {
          await sessionRepo.upsertSession({
            id: data.id,
            status: data.status || 'created',
            prompt: prompt,
            started_at: new Date()
          });
        }
      } catch (error) {
        console.error('[Storage] Failed to write session to database:', error);
      }
    }).catch((error) => {
      console.error('[Storage] Failed to parse session response for database write:', error);
    });
  }

  return response;
}

/**
 * Send message with fire-and-forget status update when enabled
 */
export async function sendMessage(sessionId: string, message: string): Promise<Response> {
  const response = await devin.sendMessage(sessionId, message);

  if (POSTGRES_ENABLED) {
    // Fire-and-forget status update
    sessionRepo.touchSession(sessionId).catch((error) => {
      console.error('[Storage] Failed to touch session in database:', error);
    });
  }

  return response;
}

/**
 * Terminate session with fire-and-forget status update when enabled
 */
export async function terminateSession(sessionId: string): Promise<Response> {
  const response = await devin.terminateSession(sessionId);

  if (POSTGRES_ENABLED && response.ok) {
    // Fire-and-forget status update
    sessionRepo.updateSessionStatus(sessionId, 'terminated', new Date()).catch((error) => {
      console.error('[Storage] Failed to update session status in database:', error);
    });
  }

  return response;
}

/**
 * Sleep session with fire-and-forget status update when enabled
 */
export async function sleepSession(sessionId: string): Promise<Response> {
  const response = await devin.sleepSession(sessionId);

  if (POSTGRES_ENABLED && response.ok) {
    // Fire-and-forget status update
    sessionRepo.updateSessionStatus(sessionId, 'sleeping').catch((error) => {
      console.error('[Storage] Failed to update session status in database:', error);
    });
  }

  return response;
}

/**
 * Update session status with fire-and-forget database write when enabled
 */
export async function updateSessionStatus(
  sessionId: string,
  targetStatus: "finished" | "idle" | "blocked"
): Promise<Response> {
  const response = await devin.updateSessionStatus(sessionId, targetStatus);

  if (POSTGRES_ENABLED) {
    // Fire-and-forget status update
    const completedAt = targetStatus === 'finished' ? new Date() : undefined;
    sessionRepo.updateSessionStatus(sessionId, targetStatus, completedAt).catch((error) => {
      console.error('[Storage] Failed to update session status in database:', error);
    });
  }

  return response;
}

// ============================================================================
// PR CACHE STORAGE
// ============================================================================

/**
 * Check if cached PR data is stale based on staleness rules
 * - Open PRs: 5 minutes staleness
 * - Merged PRs: infinite cache (merged state is permanent)
 */
function isPRCacheStale(cachedPR: prCacheRepo.PRCacheRow): boolean {
  const now = new Date();
  const cacheAge = now.getTime() - cachedPR.cached_at.getTime();

  // Merged PRs never go stale
  if (cachedPR.status === 'merged' || cachedPR.status === 'closed') {
    return false;
  }

  // Open PRs are stale after 5 minutes
  return cacheAge > 5 * 60 * 1000;
}

/**
 * Convert GitHub PR response to database cache format
 */
function prInfoToCacheRow(owner: string, repo: string, prInfo: githubPr.PRInfo): Omit<prCacheRepo.PRCacheRow, 'id' | 'cached_at'> {
  return {
    repo: `${owner}/${repo}`,
    pr_number: prInfo.number,
    title: prInfo.title,
    author: null, // Not available in basic PR info
    status: prInfo.merged ? 'merged' : prInfo.state,
    ci_status: null, // Would need additional API calls
    review_status: null, // Would need additional API calls
    labels: [], // Not included in basic fetch
    created_at: null, // Not included in basic fetch
    updated_at: null, // Not included in basic fetch
    raw_data: prInfo as Record<string, unknown>
  };
}

/**
 * Fetch PR info with database cache preference when enabled
 * Falls back to GitHub API when cache miss or disabled
 */
export async function fetchPRInfo(owner: string, repo: string, prNumber: number): Promise<githubPr.PRInfo | null> {
  if (POSTGRES_READ_ENABLED) {
    try {
      if (await isDbAvailable()) {
        const cached = await prCacheRepo.getPR(`${owner}/${repo}`, prNumber);

        if (cached && !isPRCacheStale(cached)) {
          // Return cached data if not stale
          const prInfo: githubPr.PRInfo = {
            number: cached.pr_number,
            title: cached.title || '',
            state: cached.status === 'merged' ? 'closed' : (cached.status as 'open' | 'closed'),
            merged: cached.status === 'merged',
            merged_at: cached.status === 'merged' ? (cached.updated_at?.toISOString() || null) : null,
            merged_by: null, // Not stored in cache
            html_url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
            base: { ref: 'main' }, // Default fallback
            head: { ref: 'unknown' } // Default fallback
          };

          if (cached.raw_data && typeof cached.raw_data === 'object') {
            return Object.assign(prInfo, cached.raw_data);
          }

          return prInfo;
        }
      }
    } catch (error) {
      console.error('[Storage] Database PR cache read failed, falling back to GitHub API:', error);
    }
  }

  // Fetch from GitHub API
  const prInfo = await githubPr.fetchPRInfo(owner, repo, prNumber);

  if (POSTGRES_ENABLED && prInfo) {
    // Fire-and-forget write to cache
    prCacheRepo.upsertPR(prInfoToCacheRow(owner, repo, prInfo)).catch((error) => {
      console.error('[Storage] Failed to cache PR info:', error);
    });
  }

  return prInfo;
}

/**
 * Check PR status with database cache preference when enabled
 * Falls back to GitHub API when cache miss or disabled
 */
export async function checkPRStatus(prUrl: string): Promise<{
  state: "open" | "closed";
  merged: boolean;
  closed: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
  title: string;
} | null> {
  const parsed = githubPr.parsePRUrl(prUrl);
  if (!parsed) return null;

  const prInfo = await fetchPRInfo(parsed.owner, parsed.repo, parsed.number);
  if (!prInfo) return null;

  return {
    state: prInfo.state,
    merged: prInfo.merged,
    closed: prInfo.state === "closed",
    mergedAt: prInfo.merged_at,
    mergedBy: prInfo.merged_by,
    title: prInfo.title
  };
}

/**
 * Check PR merged status with database cache preference when enabled
 */
export async function checkPRMerged(prUrl: string): Promise<{
  merged: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
} | null> {
  const parsed = githubPr.parsePRUrl(prUrl);
  if (!parsed) return null;

  const prInfo = await fetchPRInfo(parsed.owner, parsed.repo, parsed.number);
  if (!prInfo) return null;

  return {
    merged: prInfo.merged,
    mergedAt: prInfo.merged_at,
    mergedBy: prInfo.merged_by
  };
}

/**
 * Batch check PR statuses with database cache preference when enabled
 * Falls back to GitHub API for cache misses
 */
export async function batchCheckPRStatuses(prUrls: string[]): Promise<Map<string, {
  state: "open" | "closed";
  merged: boolean;
  closed: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
  title: string;
}>> {
  const results = new Map();

  for (const url of prUrls) {
    const result = await checkPRStatus(url);
    if (result) {
      results.set(url, result);
    }
  }

  return results;
}

/**
 * Batch check PR merge status with database cache preference when enabled
 */
export async function batchCheckPRsMerged(prUrls: string[]): Promise<Map<string, {
  merged: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
}>> {
  const results = new Map();

  for (const url of prUrls) {
    const result = await checkPRMerged(url);
    if (result) {
      results.set(url, result);
    }
  }

  return results;
}

// Re-export parsePRUrl utility function
export { parsePRUrl } from './github-pr';

// ============================================================================
// CONFIGURATION STORAGE
// ============================================================================

/**
 * Get configuration value with database override when enabled
 * Merges environment variables with database overrides
 */
export async function getConfig(key: string): Promise<unknown | null> {
  // Always check environment first
  const envValue = process.env[key];

  if (POSTGRES_READ_ENABLED) {
    try {
      if (await isDbAvailable()) {
        const dbValue = await configRepo.getConfig(key);

        // Database overrides environment
        if (dbValue !== null) {
          return dbValue;
        }
      }
    } catch (error) {
      console.error('[Storage] Database config read failed, using environment:', error);
    }
  }

  return envValue || null;
}

/**
 * Set configuration override in database when enabled
 */
export async function setConfig(
  key: string,
  value: unknown,
  description?: string,
  updatedBy?: string
): Promise<void> {
  if (!POSTGRES_ENABLED) {
    throw new Error('Configuration overrides require POSTGRES_ENABLED=true');
  }

  await configRepo.setConfig(key, value, description, updatedBy);
}

/**
 * Get all configuration values merged from environment and database
 */
export async function getAllConfigs(): Promise<Record<string, unknown>> {
  // Start with environment variables
  const configs: Record<string, unknown> = { ...process.env };

  if (POSTGRES_READ_ENABLED) {
    try {
      if (await isDbAvailable()) {
        const dbConfigs = await configRepo.getAllConfigs();

        // Database values override environment
        Object.assign(configs, dbConfigs);
      }
    } catch (error) {
      console.error('[Storage] Database config read failed, using environment only:', error);
    }
  }

  return configs;
}

/**
 * Delete configuration override from database when enabled
 */
export async function deleteConfig(key: string): Promise<void> {
  if (!POSTGRES_ENABLED) {
    throw new Error('Configuration overrides require POSTGRES_ENABLED=true');
  }

  await configRepo.deleteConfig(key);
}

// ============================================================================
// BACKWARD COMPATIBILITY - LEGACY PERSISTENCE FUNCTIONS
// ============================================================================

/**
 * Persist a single session to Postgres (fire-and-forget)
 * Legacy function for backward compatibility
 * Never throws - logs errors and returns silently
 */
export async function persistSession(session: any): Promise<void> {
  if (!POSTGRES_ENABLED) {
    return;
  }

  try {
    const sessionRow: Partial<sessionRepo.SessionRow> & { id: string } = {
      id: session.session_id || session.id,
      status: session.status,
      prompt: session.title || session.prompt || null,
      repo: session.repo || null,
      branch: session.branch || null,
      pr_number: session.pull_request ? extractPRNumber(session.pull_request.url) : session.pr_number || null,
      pr_url: session.pull_request?.url || session.pr_url || null,
      pr_status: session.pull_request
        ? (session.pull_request.merged ? 'merged' : (session.pull_request.closed ? 'closed' : 'open'))
        : session.pr_status || null,
      ci_status: session.ci_status || null,
      started_at: session.created_at ? new Date(session.created_at) : session.started_at || new Date(),
      completed_at: (session.status === 'finished' || session.status === 'done' || session.status === 'stopped')
        ? (session.updated_at ? new Date(session.updated_at) : session.completed_at || new Date())
        : null,
      last_seen_at: session.updated_at ? new Date(session.updated_at) : session.last_seen_at || new Date(),
      metadata: {
        requesting_user_email: session.requesting_user_email,
        tags: session.tags,
        structured_output: session.structured_output,
        url: session.url,
        source: session.metadata?.source || 'unknown',
        ...session.metadata
      }
    };

    await sessionRepo.upsertSession(sessionRow);
  } catch (error) {
    console.error('[Storage] Failed to persist session:', error);
  }
}

/**
 * Helper function to extract PR number from GitHub URL
 */
function extractPRNumber(url?: string): number | null {
  if (!url) return null;
  try {
    const match = url.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Persist multiple sessions to Postgres (fire-and-forget)
 * Legacy function for backward compatibility
 * Never throws - logs summary of results
 */
export async function persistSessions(sessions: any[]): Promise<void> {
  if (!POSTGRES_ENABLED || sessions.length === 0) {
    return;
  }

  try {
    const promises = sessions.map(session => persistSession(session));
    const results = await Promise.allSettled(promises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      console.error(`[Storage] Batch persist: ${successful} successful, ${failed} failed`);
    }
  } catch (error) {
    console.error('[Storage] Failed to persist sessions batch:', error);
  }
}

/**
 * Persist PR status data to Postgres cache (fire-and-forget)
 * Legacy function for backward compatibility
 * Never throws - logs errors and returns silently
 */
export async function persistPRStatus(
  repo: string,
  prNumber: number,
  prData: {
    title?: string;
    author?: string;
    status?: string;
    ci_status?: string;
    review_status?: string;
    labels?: string[];
    raw_data?: Record<string, unknown>;
    created_at?: Date;
    updated_at?: Date;
  }
): Promise<void> {
  if (!POSTGRES_ENABLED) {
    return;
  }

  try {
    const prRow: Omit<prCacheRepo.PRCacheRow, 'id' | 'cached_at'> = {
      repo,
      pr_number: prNumber,
      title: prData.title || null,
      author: prData.author || null,
      status: prData.status || null,
      ci_status: prData.ci_status || null,
      review_status: prData.review_status || null,
      labels: prData.labels || [],
      created_at: prData.created_at || null,
      updated_at: prData.updated_at || null,
      raw_data: prData.raw_data || null
    };

    await prCacheRepo.upsertPR(prRow);
  } catch (error) {
    console.error('[Storage] Failed to persist PR status:', error);
  }
}

// ============================================================================
// VAULT SESSION RECORDS
// ============================================================================

/**
 * List completed session records.
 * Tries Postgres first, falls back to GitHub vault.
 */
export async function listVaultSessionRecords(): Promise<SessionRecord[]> {
  if (POSTGRES_READ_ENABLED) {
    try {
      if (await isDbAvailable()) {
        const rows = await vaultSessionRecordRepo.listSessionRecords();
        if (rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            title: r.title,
            repo: r.repo || '',
            prompt: r.prompt || '',
            result: r.result || '',
            status: r.status || 'done',
            source: r.source || 'unknown',
            model: r.model || undefined,
            duration_ms: r.duration_ms || undefined,
            cost_usd: r.cost_usd || undefined,
            tools_used: r.tools_used || [],
            messages: r.messages || [],
            created_at: r.created_at?.toISOString() || new Date().toISOString(),
            completed_at: r.completed_at.toISOString(),
          }));
        }
      }
    } catch (error) {
      console.error('[Storage] DB read failed for vault session records, falling back to GitHub:', error);
    }
  }
  return vault.listSessionRecords();
}

/**
 * Persist a session record. Writes to Postgres and optionally GitHub vault.
 */
export async function persistVaultSessionRecord(record: SessionRecord): Promise<void> {
  // Write to Postgres
  if (POSTGRES_ENABLED) {
    try {
      if (await isDbAvailable()) {
        await vaultSessionRecordRepo.upsertSessionRecord({
          id: record.id,
          title: record.title,
          repo: record.repo,
          prompt: record.prompt,
          result: record.result,
          status: record.status,
          source: record.source,
          model: record.model || null,
          duration_ms: record.duration_ms || null,
          cost_usd: record.cost_usd || null,
          tools_used: record.tools_used || [],
          messages: record.messages || [],
          created_at: record.created_at ? new Date(record.created_at) : null,
          completed_at: new Date(record.completed_at),
        });
      }
    } catch (error) {
      console.error('[Storage] Failed to persist vault session record to DB:', error);
    }
  }

  // Also write to GitHub vault if configured (fire-and-forget)
  vault.writeSessionRecord(record).catch((e) =>
    console.error('[Storage] Failed to write session record to GitHub vault:', e)
  );
}

// ============================================================================
/**
 * Check if a vault session record exists by ID.
 */
export async function hasVaultSessionRecord(id: string): Promise<boolean> {
  if (!POSTGRES_READ_ENABLED) return false;
  try {
    if (await isDbAvailable()) {
      const record = await vaultSessionRecordRepo.getSessionRecordById(id);
      return record !== null;
    }
  } catch {}
  return false;
}

// VAULT CHANGELOGS
// ============================================================================

/**
 * List changelogs. Tries Postgres first, falls back to GitHub vault.
 */
export async function listVaultChangelogs(limit = 10): Promise<{ name: string; path: string; title?: string; body?: string; created_at?: string }[]> {
  if (POSTGRES_READ_ENABLED) {
    try {
      if (await isDbAvailable()) {
        const rows = await vaultChangelogRepo.listChangelogs(limit);
        if (rows.length > 0) {
          return rows.map((r) => ({
            name: r.title,
            path: `changelog/${r.id}`,
            title: r.title,
            body: r.body,
            created_at: r.created_at.toISOString(),
          }));
        }
      }
    } catch (error) {
      console.error('[Storage] DB read failed for changelogs, falling back to GitHub:', error);
    }
  }
  return vault.listChangelogs(limit);
}

/**
 * Persist a changelog entry. Writes to Postgres and optionally GitHub vault.
 */
export async function persistVaultChangelog(title: string, body: string, source?: string): Promise<void> {
  // Write to Postgres
  if (POSTGRES_ENABLED) {
    try {
      if (await isDbAvailable()) {
        await vaultChangelogRepo.insertChangelog(title, body, source);
      }
    } catch (error) {
      console.error('[Storage] Failed to persist changelog to DB:', error);
    }
  }

  // Also write to GitHub vault if configured (fire-and-forget)
  vault.writeChangelog(title, body).catch((e) =>
    console.error('[Storage] Failed to write changelog to GitHub vault:', e)
  );
}

// ============================================================================
// VAULT PATTERNS
// ============================================================================

/**
 * List patterns. Tries Postgres first, falls back to GitHub vault.
 */
export async function listVaultPatterns(): Promise<PatternMeta[]> {
  if (POSTGRES_READ_ENABLED) {
    try {
      if (await isDbAvailable()) {
        const rows = await vaultPatternRepo.listPatterns();
        if (rows.length > 0) {
          return rows.map((r) => ({
            name: r.name,
            path: `patterns/${r.name}.md`,
            tags: r.tags || [],
            repos: r.repos || [],
            confidence: r.confidence,
            last_referenced: r.last_referenced?.toISOString() || '',
            reference_count: r.reference_count,
            body: r.body,
          }));
        }
      }
    } catch (error) {
      console.error('[Storage] DB read failed for patterns, falling back to GitHub:', error);
    }
  }
  return vault.listPatterns();
}

/**
 * Persist a pattern to Postgres.
 */
export async function persistVaultPattern(pattern: PatternMeta): Promise<void> {
  if (!POSTGRES_ENABLED) return;
  try {
    if (await isDbAvailable()) {
      await vaultPatternRepo.upsertPattern({
        name: pattern.name,
        tags: pattern.tags || [],
        repos: pattern.repos || [],
        confidence: pattern.confidence || 'medium',
        last_referenced: pattern.last_referenced ? new Date(pattern.last_referenced) : null,
        reference_count: pattern.reference_count || 0,
        body: pattern.body,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  } catch (error) {
    console.error('[Storage] Failed to persist pattern:', error);
  }
}

/**
 * Update pattern metadata (confidence, last_referenced, etc.)
 */
export async function updatePatternMetadata(
  name: string,
  updates: { confidence?: string; last_referenced?: string; reference_count?: number }
): Promise<void> {
  if (!POSTGRES_ENABLED) return;
  try {
    if (await isDbAvailable()) {
      await vaultPatternRepo.updatePatternMetadata(name, {
        confidence: updates.confidence,
        last_referenced: updates.last_referenced ? new Date(updates.last_referenced) : undefined,
        reference_count: updates.reference_count,
      });
    }
  } catch (error) {
    console.error('[Storage] Failed to update pattern metadata:', error);
  }
}

/**
 * Archive (delete) a pattern from the active vault.
 */
export async function archiveVaultPattern(name: string): Promise<void> {
  if (!POSTGRES_ENABLED) return;
  try {
    if (await isDbAvailable()) {
      await vaultPatternRepo.deletePattern(name);
    }
  } catch (error) {
    console.error('[Storage] Failed to archive pattern:', error);
  }
}

// ============================================================================
// HEALTH AND UTILITIES
// ============================================================================

/**
 * Check if storage layer is properly configured and available
 */
export async function getStorageHealth(): Promise<{
  postgres_enabled: boolean;
  postgres_read_enabled: boolean;
  database_available: boolean;
}> {
  const dbAvailable = await isDbAvailable();

  return {
    postgres_enabled: POSTGRES_ENABLED,
    postgres_read_enabled: POSTGRES_READ_ENABLED,
    database_available: dbAvailable
  };
}