import { getTeams } from "@/lib/linear";

export async function GET() {
  const teams = await getTeams();
  return Response.json({ teams });
}
