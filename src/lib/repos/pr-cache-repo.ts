import { query } from '../db';

export type PRCacheRow = {
  id: number;
  repo: string;
  pr_number: number;
  title: string | null;
  author: string | null;
  status: string | null;
  ci_status: string | null;
  review_status: string | null;
  labels: string[];
  created_at: Date | null;
  updated_at: Date | null;
  cached_at: Date;
  raw_data: Record<string, unknown> | null;
};

export async function upsertPR(pr: Omit<PRCacheRow, 'id' | 'cached_at'>): Promise<void> {
  const sql = `
    INSERT INTO pr_cache (
      repo, pr_number, title, author, status, ci_status,
      review_status, labels, created_at, updated_at, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (repo, pr_number)
    DO UPDATE SET
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      status = EXCLUDED.status,
      ci_status = EXCLUDED.ci_status,
      review_status = EXCLUDED.review_status,
      labels = EXCLUDED.labels,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      raw_data = EXCLUDED.raw_data,
      cached_at = NOW()
  `;

  await query(sql, [
    pr.repo,
    pr.pr_number,
    pr.title,
    pr.author,
    pr.status,
    pr.ci_status,
    pr.review_status,
    JSON.stringify(pr.labels),
    pr.created_at,
    pr.updated_at,
    pr.raw_data ? JSON.stringify(pr.raw_data) : null,
  ]);
}

export async function getPR(repo: string, prNumber: number): Promise<PRCacheRow | null> {
  const sql = `
    SELECT id, repo, pr_number, title, author, status, ci_status,
           review_status, labels, created_at, updated_at, cached_at, raw_data
    FROM pr_cache
    WHERE repo = $1 AND pr_number = $2
  `;

  const result = await query(sql, [repo, prNumber]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    repo: row.repo,
    pr_number: row.pr_number,
    title: row.title,
    author: row.author,
    status: row.status,
    ci_status: row.ci_status,
    review_status: row.review_status,
    labels: Array.isArray(row.labels) ? row.labels : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    cached_at: row.cached_at,
    raw_data: row.raw_data,
  };
}

export async function getPRsByRepo(repo: string): Promise<PRCacheRow[]> {
  const sql = `
    SELECT id, repo, pr_number, title, author, status, ci_status,
           review_status, labels, created_at, updated_at, cached_at, raw_data
    FROM pr_cache
    WHERE repo = $1
    ORDER BY updated_at DESC
  `;

  const result = await query(sql, [repo]);

  return result.rows.map((row) => ({
    id: row.id,
    repo: row.repo,
    pr_number: row.pr_number,
    title: row.title,
    author: row.author,
    status: row.status,
    ci_status: row.ci_status,
    review_status: row.review_status,
    labels: Array.isArray(row.labels) ? row.labels : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    cached_at: row.cached_at,
    raw_data: row.raw_data,
  }));
}

export async function getStaleEntries(olderThan: Date): Promise<PRCacheRow[]> {
  const sql = `
    SELECT id, repo, pr_number, title, author, status, ci_status,
           review_status, labels, created_at, updated_at, cached_at, raw_data
    FROM pr_cache
    WHERE cached_at < $1
  `;

  const result = await query(sql, [olderThan]);

  return result.rows.map((row) => ({
    id: row.id,
    repo: row.repo,
    pr_number: row.pr_number,
    title: row.title,
    author: row.author,
    status: row.status,
    ci_status: row.ci_status,
    review_status: row.review_status,
    labels: Array.isArray(row.labels) ? row.labels : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    cached_at: row.cached_at,
    raw_data: row.raw_data,
  }));
}

export async function deletePR(repo: string, prNumber: number): Promise<void> {
  const sql = `
    DELETE FROM pr_cache
    WHERE repo = $1 AND pr_number = $2
  `;

  await query(sql, [repo, prNumber]);
}