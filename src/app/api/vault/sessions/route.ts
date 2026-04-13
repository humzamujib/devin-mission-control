import { listSessionRecords } from "@/lib/vault";

export async function GET() {
  const records = await listSessionRecords();
  return Response.json({ sessions: records });
}
