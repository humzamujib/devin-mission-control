import { listSessions, createSession } from "@/lib/devin";
import type { NextRequest } from "next/server";

export async function GET() {
  const res = await listSessions();
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await createSession(body.prompt);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
