import { triggerLinearSync } from "@/lib/linear";

export async function POST() {
  const result = await triggerLinearSync();
  if (result.error) {
    return Response.json(result, { status: 502 });
  }
  return Response.json(result);
}
