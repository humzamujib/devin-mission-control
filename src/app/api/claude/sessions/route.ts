import { NextRequest } from "next/server";
import {
  createSession,
  getSessions,
} from "@/lib/claude-sdk";

export async function GET() {
  const sessions = getSessions();
  const list = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    repo: s.repo,
    title: s.title,
    status: s.status,
    createdAt: s.createdAt,
    messageCount: s.messages.length,
    sessionId: s.sessionId,
  }));
  return Response.json({ sessions: list });
}

export async function POST(request: NextRequest) {
  const { prompt, repo, title, model } = await request.json();
  if (!prompt || !repo) {
    return Response.json({ error: "Missing prompt or repo" }, { status: 400 });
  }
  const id = createSession({
    prompt,
    repo,
    title: title || prompt.slice(0, 60),
    model,
  });
  return Response.json({ id });
}
