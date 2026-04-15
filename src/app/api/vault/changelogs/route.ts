import { listVaultChangelogs, persistVaultChangelog } from "@/lib/storage";
import { readFile } from "@/lib/vault";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");

  if (name) {
    // Try to find content from Postgres changelogs first
    const all = await listVaultChangelogs(50);
    const match = all.find((c) => c.name === name);
    if (match && "body" in match && match.body) {
      return Response.json({ name, content: match.body });
    }

    // Fallback to GitHub
    const content = await readFile(`changelog/${name}`);
    if (!content) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ name, content });
  }

  const changelogs = await listVaultChangelogs();
  return Response.json({ changelogs });
}

export async function POST(request: NextRequest) {
  const { title, body, source } = await request.json();
  if (!title || !body) {
    return Response.json({ error: "Missing title or body" }, { status: 400 });
  }
  await persistVaultChangelog(title, body, source || "api");
  return Response.json({ success: true });
}
