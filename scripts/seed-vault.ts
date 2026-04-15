/**
 * Seed Postgres vault tables from the existing GitHub vault.
 * Run: npx tsx scripts/seed-vault.ts
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ path: ".env.local" });

const { Pool } = require("pg");
const vault = require("../src/lib/vault");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function seedSessionRecords() {
  console.log("Fetching session records from GitHub vault...");
  const records = await vault.listSessionRecords();
  console.log(`Found ${records.length} session records`);

  let inserted = 0;
  for (const r of records) {
    try {
      await pool.query(
        `INSERT INTO vault_session_records (id, title, repo, prompt, result, status, source, model, duration_ms, cost_usd, tools_used, messages, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.title, r.repo, r.prompt, r.result, r.status, r.source,
          r.model || null, r.duration_ms || null, r.cost_usd || null,
          JSON.stringify(r.tools_used || []), JSON.stringify(r.messages || []),
          r.created_at || null, r.completed_at,
        ]
      );
      inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Failed to insert session record ${r.id}: ${msg}`);
    }
  }
  console.log(`Inserted ${inserted}/${records.length} session records`);
}

async function seedPatterns() {
  console.log("Fetching patterns from GitHub vault...");
  const patterns = await vault.listPatterns();
  console.log(`Found ${patterns.length} patterns`);

  let inserted = 0;
  for (const p of patterns) {
    try {
      await pool.query(
        `INSERT INTO vault_patterns (name, tags, repos, confidence, last_referenced, reference_count, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO UPDATE SET
           tags = EXCLUDED.tags,
           repos = EXCLUDED.repos,
           confidence = EXCLUDED.confidence,
           reference_count = EXCLUDED.reference_count,
           body = EXCLUDED.body,
           updated_at = NOW()`,
        [
          p.name, JSON.stringify(p.tags), JSON.stringify(p.repos),
          p.confidence, p.last_referenced || null, p.reference_count, p.body,
        ]
      );
      inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Failed to insert pattern ${p.name}: ${msg}`);
    }
  }
  console.log(`Inserted ${inserted}/${patterns.length} patterns`);
}

async function seedChangelogs() {
  console.log("Fetching changelogs from GitHub vault...");
  const changelogs = await vault.listChangelogs(50);
  console.log(`Found ${changelogs.length} changelogs`);

  let inserted = 0;
  for (const c of changelogs) {
    const content = await vault.readFile(c.path);
    if (!content) continue;

    const dateMatch = c.name.match(/^(\d{4}-\d{2}-\d{2})/);
    const createdAt = dateMatch ? new Date(dateMatch[1]) : new Date();
    const title = c.name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "").replace(/-/g, " ");

    try {
      await pool.query(
        `INSERT INTO vault_changelogs (title, body, source, created_at)
         VALUES ($1, $2, $3, $4)`,
        [title, content, "github-vault-seed", createdAt]
      );
      inserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Failed to insert changelog ${c.name}: ${msg}`);
    }
  }
  console.log(`Inserted ${inserted}/${changelogs.length} changelogs`);
}

async function main() {
  console.log("Seeding Postgres vault from GitHub vault...\n");

  await seedSessionRecords();
  console.log();
  await seedPatterns();
  console.log();
  await seedChangelogs();

  console.log("\nDone!");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
