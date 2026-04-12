import { listChangelogs, readFile } from "@/lib/vault";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");

  if (name) {
    const content = await readFile(`changelog/${name}`);
    if (!content) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ name, content });
  }

  const changelogs = await listChangelogs();
  return Response.json({ changelogs });
}
