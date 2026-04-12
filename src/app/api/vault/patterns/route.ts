import { listPatterns } from "@/lib/vault";

export async function GET() {
  const patterns = await listPatterns();
  return Response.json({ patterns });
}
