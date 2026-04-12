import { listKnowledge, createKnowledge } from "@/lib/knowledge";
import type { NextRequest } from "next/server";

export async function GET() {
  const res = await listKnowledge();
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await createKnowledge(body);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
