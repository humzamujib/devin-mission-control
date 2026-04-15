import { listSessions, createSession, persistSessions, hasVaultSessionRecord, persistVaultSessionRecord, persistVaultChangelog } from "@/lib/storage";
import { batchCheckPRStatuses } from "@/lib/storage";
import { getSession } from "@/lib/devin";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userEmail = request.nextUrl.searchParams.get("user_email") || undefined;
  const res = await listSessions(userEmail);
  if (!res.ok) {
    const data = await res.json();
    return Response.json(data, { status: res.status });
  }

  const data = await res.json();
  const sessions: Record<string, unknown>[] = Array.isArray(data) ? data : data.sessions ?? [];

  // Enrich sessions with PR merge status from GitHub (uses cache for merged PRs)
  const prUrls = [
    ...new Set(
      sessions
        .map((s) => (s.pull_request as { url?: string } | null)?.url)
        .filter((url): url is string => !!url)
    ),
  ];

  if (prUrls.length > 0) {
    const statuses = await batchCheckPRStatuses(prUrls);
    for (const s of sessions) {
      const pr = s.pull_request as { url?: string } | null;
      if (pr?.url && statuses.has(pr.url)) {
        const st = statuses.get(pr.url)!;
        s.pull_request = { ...pr, merged: st.merged, closed: st.closed, merged_at: st.mergedAt, merged_by: st.mergedBy };
      }
    }
  }

  // Fire-and-forget: cache sessions to Postgres
  persistSessions(sessions).catch(() => {});

  // Fire-and-forget: auto-create vault records for finished Devin sessions
  autoCreateVaultRecords(sessions).catch(() => {});

  return Response.json(Array.isArray(data) ? sessions : { ...data, sessions });
}

async function autoCreateVaultRecords(sessions: Record<string, unknown>[]) {
  const finishedStatuses = new Set(["finished", "stopped", "done", "suspended"]);

  for (const s of sessions) {
    const status = (s.status_enum as string || s.status as string || "").toLowerCase();
    if (!finishedStatuses.has(status)) continue;

    const id = (s.session_id as string) || (s.id as string) || "";
    if (!id) continue;

    // Skip if vault record already exists
    if (await hasVaultSessionRecord(id)) continue;

    const pr = s.pull_request as { url?: string; merged?: boolean; closed?: boolean } | null;
    const title = (s.title as string) || `Devin session ${id.slice(0, 8)}`;
    const completedAt = (s.updated_at as string) || new Date().toISOString();

    // Fetch session detail to get messages for a proper summary
    let messages: { type: string; message: string; timestamp: string; origin?: string }[] = [];
    let devinSummary = "";
    try {
      const detailRes = await getSession(id);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        messages = detail.messages || [];
        // Use the last Devin message (non-user) as the summary
        const devinMessages = messages.filter(
          (m: { origin?: string; type?: string }) => !m.origin || (m.origin !== "web" && m.origin !== "api" && m.origin !== "slack")
        );
        if (devinMessages.length > 0) {
          devinSummary = devinMessages[devinMessages.length - 1].message || "";
        }
      }
    } catch {}

    const structuredOutput = s.structured_output as { title?: string; summary?: string } | null;
    const summary = structuredOutput?.summary || devinSummary || (pr?.merged ? "PR merged" : status);

    await persistVaultSessionRecord({
      id,
      title,
      repo: (s.repo as string) || "",
      prompt: messages.length > 0 ? messages[0].message || title : title,
      result: summary,
      status,
      source: "devin",
      created_at: (s.created_at as string) || new Date().toISOString(),
      completed_at: completedAt,
      messages: messages.map((m) => ({ type: m.type || "message", text: m.message, timestamp: m.timestamp })),
    });

    // Also write a changelog entry with the actual summary
    const prLine = pr?.url ? `**PR:** [#${pr.url.split("/").pop()}](${pr.url})${pr.merged ? " (merged)" : pr.closed ? " (closed)" : ""}` : "";
    const changelogBody = [
      `## ${title}`,
      ``,
      `**Source:** Devin`,
      `**Completed:** ${new Date(completedAt).toLocaleString()}`,
      prLine,
      ``,
      summary && summary !== status ? `### Summary\n\n${summary}` : "",
    ].filter(Boolean).join("\n");

    persistVaultChangelog(title, changelogBody, "devin").catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await createSession(body.prompt);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
