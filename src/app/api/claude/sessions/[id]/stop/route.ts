import { stopSession } from "@/lib/claude-sdk";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = stopSession(id);

  if (!success) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
