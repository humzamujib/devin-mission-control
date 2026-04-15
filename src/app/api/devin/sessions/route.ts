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

  // Normalize sessions: convert singular PR to array and collect all PR URLs
  for (const s of sessions) {
    const singlePR = s.pull_request as { url?: string; merged?: boolean; closed?: boolean; merged_at?: string | null; merged_by?: string | null } | null;
    const arrayPRs = s.pull_requests as Array<{ url: string; merged?: boolean; closed?: boolean; merged_at?: string | null; merged_by?: string | null }> | undefined;

    // Normalize: if we have a singular PR but no array, convert to array
    if (singlePR?.url && !arrayPRs) {
      s.pull_requests = [singlePR];
    }
    // If we only have an array, keep the singular for backward compatibility (use first PR)
    else if (arrayPRs && arrayPRs.length > 0 && !singlePR?.url) {
      s.pull_request = arrayPRs[0];
    }
  }

  // Enrich sessions with PR merge status from GitHub (uses cache for merged PRs)
  const prUrls = [
    ...new Set(
      sessions.flatMap((s) => {
        const urls: string[] = [];
        // Collect from singular PR
        const singlePR = s.pull_request as { url?: string } | null;
        if (singlePR?.url) urls.push(singlePR.url);
        // Collect from PR array
        const arrayPRs = s.pull_requests as Array<{ url: string }> | undefined;
        if (arrayPRs) {
          urls.push(...arrayPRs.map(pr => pr.url));
        }
        return urls;
      }).filter((url): url is string => !!url)
    ),
  ];

  if (prUrls.length > 0) {
    const statuses = await batchCheckPRStatuses(prUrls);
    for (const s of sessions) {
      // Enrich singular PR
      const pr = s.pull_request as { url?: string } | null;
      if (pr?.url && statuses.has(pr.url)) {
        const st = statuses.get(pr.url)!;
        s.pull_request = { ...pr, merged: st.merged, closed: st.closed, merged_at: st.mergedAt, merged_by: st.mergedBy };
      }

      // Enrich PR array
      const arrayPRs = s.pull_requests as Array<{ url: string; merged?: boolean; closed?: boolean; merged_at?: string | null; merged_by?: string | null }> | undefined;
      if (arrayPRs) {
        s.pull_requests = arrayPRs.map(pr => {
          if (statuses.has(pr.url)) {
            const st = statuses.get(pr.url)!;
            return { ...pr, merged: st.merged, closed: st.closed, merged_at: st.mergedAt, merged_by: st.mergedBy };
          }
          return pr;
        });
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

    // Get all PRs (normalize from both singular and array)
    const singlePR = s.pull_request as { url?: string; merged?: boolean; closed?: boolean } | null;
    const arrayPRs = s.pull_requests as Array<{ url: string; merged?: boolean; closed?: boolean }> | undefined;
    const allPRs = arrayPRs || (singlePR?.url ? [singlePR] : []);
    const pr = singlePR; // Keep for backward compatibility

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
    const defaultSummary = allPRs.length > 0
      ? allPRs.every(p => p.merged) ? `${allPRs.length} PR${allPRs.length > 1 ? 's' : ''} merged`
        : allPRs.some(p => p.merged) ? `${allPRs.filter(p => p.merged).length}/${allPRs.length} PRs merged`
        : `${allPRs.length} PR${allPRs.length > 1 ? 's' : ''} created`
      : status;
    const summary = structuredOutput?.summary || devinSummary || defaultSummary;

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
    const prLines = allPRs.length > 0
      ? allPRs.length === 1
        ? `**PR:** [#${allPRs[0].url.split("/").pop()}](${allPRs[0].url})${allPRs[0].merged ? " (merged)" : allPRs[0].closed ? " (closed)" : ""}`
        : `**PRs:**\n${allPRs.map(p => `- [#${p.url.split("/").pop()}](${p.url})${p.merged ? " (merged)" : p.closed ? " (closed)" : ""}`).join('\n')}`
      : "";
    const changelogBody = [
      `## ${title}`,
      ``,
      `**Source:** Devin`,
      `**Completed:** ${new Date(completedAt).toLocaleString()}`,
      prLines,
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
