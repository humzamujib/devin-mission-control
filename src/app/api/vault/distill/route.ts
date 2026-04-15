import { createSession } from "@/lib/claude-sdk";

const DISTILL_PROMPT = `You are running the weekly vault distillation — the vault's "garbage collection + learning" cycle.

## Your task

You have access to the Mission Control API at http://localhost:3000. Use fetch() to call these endpoints:

### Read endpoints
- GET /api/vault/changelogs — list recent changelogs
- GET /api/vault/patterns — list all patterns with metadata (tags, repos, confidence, reference_count, body_preview)
- GET /api/vault/patterns/{name} — get full pattern content
- GET /api/vault/sessions — list completed session records

### Write endpoints
- POST /api/vault/patterns — create/update a pattern. Body: { name, body, tags, repos, confidence }
- PUT /api/vault/patterns/{name} — update pattern metadata. Body: { confidence, last_referenced, reference_count }
- DELETE /api/vault/patterns/{name} — archive a pattern (removes from active)

### Changelog write
- POST with fetch("http://localhost:3000/api/vault/changelogs", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ title, body, source: "distill" }) })

Note: The changelogs POST endpoint doesn't exist yet, so write the digest as a pattern or use the patterns POST endpoint with a special name like "distill-digest-YYYY-MM-DD".

## Procedure

### 1. Read current state
- Fetch all patterns: GET /api/vault/patterns
- Fetch recent changelogs: GET /api/vault/changelogs
- Fetch session records: GET /api/vault/sessions

### 2. Extract pattern candidates from changelogs
Analyze changelogs from the last 7 days for:
- Themes appearing in 2+ entries (recurring approaches, decisions, fixes)
- "Patterns discovered" or lessons learned
- Decisions or approaches that were reused across sessions

For each candidate:
- Check if an existing pattern already covers it
- If existing pattern needs updating, note the specific update
- If genuinely new (2+ references), draft a new pattern

### 3. Apply decay rules
For each active pattern:
- If last_referenced > 30 days ago AND confidence is "high" → update to "medium"
- If last_referenced > 45 days ago AND confidence is "medium" → update to "low"
- If last_referenced > 90 days ago → archive (DELETE the pattern)

Use PUT /api/vault/patterns/{name} to update confidence.
Use DELETE /api/vault/patterns/{name} to archive.

### 4. Create/update patterns
- New patterns: POST /api/vault/patterns with confidence: "medium", reference_count: 0
- Updated patterns: POST /api/vault/patterns with full updated content
- Pattern body should be actionable rules ("always do X", "when Y, prefer Z"), not vague observations

### 5. Generate digest
Write a summary of what you did. Include:
- Changelogs processed (count, date range)
- New patterns created (name + 1-line description)
- Pattern updates (confidence changes)
- Patterns archived
- Patterns flagged for review (low confidence)
- Vault health: X active patterns, Y sessions recorded

Print the digest to stdout so it appears in the session result.

## Rules
- New patterns require 2+ changelog references before creation
- New patterns start at medium confidence
- Don't inflate reference_count — only working sessions increment it
- Don't delete patterns — archive them via DELETE endpoint
- Keep the digest concise — bullet points, not paragraphs
- Focus on actionable rules, not vague observations
`;

export async function POST() {
  try {
    const id = createSession({
      prompt: DISTILL_PROMPT,
      repo: "devin-mission-control",
      title: "Weekly Vault Distillation",
    });
    return Response.json({ id, message: "Distillation session started" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to start distillation" },
      { status: 500 }
    );
  }
}
