import { listVaultPatterns, persistVaultPattern } from "@/lib/storage";
import type { NextRequest } from "next/server";

export async function GET() {
  const patterns = await listVaultPatterns();
  return Response.json({ patterns });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.name || !body.body) {
    return Response.json({ error: "Missing name or body" }, { status: 400 });
  }
  await persistVaultPattern({
    name: body.name,
    path: `patterns/${body.name}.md`,
    tags: body.tags || [],
    repos: body.repos || [],
    confidence: body.confidence || "medium",
    last_referenced: body.last_referenced || "",
    reference_count: body.reference_count || 0,
    body: body.body,
  });
  return Response.json({ success: true });
}
