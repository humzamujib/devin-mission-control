export type PRInfo = {
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  merged_at: string | null;
  merged_by: string | null;
  html_url: string;
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
};

function getHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "devin-mission-control"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Cache for merged PRs — a merged PR can never un-merge, so cache indefinitely
const mergedPRCache = new Map<string, {
  state: "open" | "closed";
  merged: boolean;
  closed: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
  title: string;
}>();

let rateLimitRemaining: number | null = null;

function updateRateLimit(response: Response) {
  const remaining = response.headers.get("X-RateLimit-Remaining");
  if (remaining !== null) {
    rateLimitRemaining = parseInt(remaining, 10);
    if (rateLimitRemaining < 100) {
      console.warn(`[GitHub] Rate limit low: ${rateLimitRemaining} remaining`);
    }
  }
}

/**
 * Parse GitHub PR URL to extract owner, repo, and PR number
 * Example: https://github.com/biltrewards/bilt-frontend/pull/31764
 * Returns: { owner: "biltrewards", repo: "bilt-frontend", number: 31764 }
 */
export function parsePRUrl(url: string): { owner: string; repo: string; number: number } | null {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;

    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[3], 10)
    };
  } catch {
    return null;
  }
}

/**
 * Fetch PR information from GitHub API
 */
export async function fetchPRInfo(owner: string, repo: string, prNumber: number): Promise<PRInfo | null> {
  // Skip if rate limit is critically low
  if (rateLimitRemaining !== null && rateLimitRemaining < 50) {
    console.warn(`[GitHub] Skipping PR fetch — rate limit too low (${rateLimitRemaining})`);
    return null;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: getHeaders(),
      cache: "no-store"
    });

    updateRateLimit(response);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`PR not found: ${owner}/${repo}#${prNumber}`);
        return null;
      }
      if (response.status === 403) {
        // Rate limited — set remaining to 0 to stop further calls this cycle
        rateLimitRemaining = 0;
        const resetHeader = response.headers.get("X-RateLimit-Reset");
        const resetTime = resetHeader ? new Date(parseInt(resetHeader, 10) * 1000).toISOString() : "unknown";
        console.warn(`[GitHub] Rate limited on ${owner}/${repo}#${prNumber}. Resets at ${resetTime}`);
        return null;
      }
      console.error(`GitHub API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      merged: data.merged || false,
      merged_at: data.merged_at,
      merged_by: data.merged_by?.login || null,
      html_url: data.html_url,
      base: {
        ref: data.base?.ref || 'main'
      },
      head: {
        ref: data.head?.ref || 'unknown'
      }
    };
  } catch (error) {
    console.error(`Error fetching PR info for ${owner}/${repo}#${prNumber}:`, error);
    return null;
  }
}

/**
 * Check PR status - merged, closed, or open
 */
export async function checkPRStatus(prUrl: string): Promise<{
  state: "open" | "closed";
  merged: boolean;
  closed: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
  title: string;
} | null> {
  const parsed = parsePRUrl(prUrl);
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
 * Check if a PR URL points to a merged PR (legacy function for backward compatibility)
 */
export async function checkPRMerged(prUrl: string): Promise<{
  merged: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
} | null> {
  const parsed = parsePRUrl(prUrl);
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
 * Batch check multiple PR URLs for full status (merged, closed, open)
 * Uses cache for merged PRs and respects rate limits.
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

  for (let i = 0; i < prUrls.length; i++) {
    const url = prUrls[i];

    // Return cached result for merged PRs (merged state is permanent)
    const cached = mergedPRCache.get(url);
    if (cached) {
      results.set(url, cached);
      continue;
    }

    // Stop if rate limit is exhausted
    if (rateLimitRemaining !== null && rateLimitRemaining < 50) {
      console.warn(`[GitHub] Stopping batch at ${i}/${prUrls.length} — rate limit low (${rateLimitRemaining})`);
      break;
    }

    // Add small delay to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = await checkPRStatus(url);
    if (result) {
      results.set(url, result);
      // Cache merged PRs permanently
      if (result.merged) {
        mergedPRCache.set(url, result);
      }
    }
  }

  return results;
}

/**
 * Batch check multiple PR URLs for merge status (legacy function for backward compatibility)
 * Uses cache for merged PRs and respects rate limits.
 */
export async function batchCheckPRsMerged(prUrls: string[]): Promise<Map<string, {
  merged: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
}>> {
  const results = new Map();

  for (let i = 0; i < prUrls.length; i++) {
    const url = prUrls[i];

    // Return cached result for merged PRs
    const cached = mergedPRCache.get(url);
    if (cached) {
      results.set(url, { merged: cached.merged, mergedAt: cached.mergedAt, mergedBy: cached.mergedBy });
      continue;
    }

    // Stop if rate limit is exhausted
    if (rateLimitRemaining !== null && rateLimitRemaining < 50) {
      break;
    }

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = await checkPRMerged(url);
    if (result) {
      results.set(url, result);
    }
  }

  return results;
}