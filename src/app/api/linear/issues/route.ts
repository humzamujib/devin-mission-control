import { getIssues } from "@/lib/linear";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const teamKey = request.nextUrl.searchParams.get("team") || undefined;
  const result = await getIssues(teamKey);
  return Response.json(result);
}
