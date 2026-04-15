import { listVaultSessionRecords } from "@/lib/storage";

export async function GET() {
  const records = await listVaultSessionRecords();
  return Response.json({ sessions: records });
}
