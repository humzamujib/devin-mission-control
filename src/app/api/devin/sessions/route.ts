import { listSessions, createSession } from "@/lib/devin";
import { batchCheckPRStatuses } from "@/lib/github-pr";
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

  return Response.json(Array.isArray(data) ? sessions : { ...data, sessions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await createSession(body.prompt);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
