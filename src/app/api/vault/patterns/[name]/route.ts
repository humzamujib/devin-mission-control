import { readFile } from "@/lib/vault";
import { updatePatternMetadata, archiveVaultPattern, listVaultPatterns } from "@/lib/storage";
import type { NextRequest } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Try Postgres first
  const patterns = await listVaultPatterns();
  const match = patterns.find((p) => p.name === name);
  if (match) {
    return Response.json({ content: match.body, ...match });
  }

  // Fallback to GitHub
  const content = await readFile(`patterns/${name}.md`);
  if (!content) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ content });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const body = await request.json();
  await updatePatternMetadata(name, {
    confidence: body.confidence,
    last_referenced: body.last_referenced,
    reference_count: body.reference_count,
  });
  return Response.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  await archiveVaultPattern(name);
  return Response.json({ success: true });
}
