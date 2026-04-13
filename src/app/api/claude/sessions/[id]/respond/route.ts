import { NextRequest } from "next/server";
import { respondToSession } from "@/lib/claude-sdk";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message } = await request.json();

  if (!message) {
    return Response.json({ error: "Missing message" }, { status: 400 });
  }

  const success = await respondToSession(id, message);
  if (!success) {
    return Response.json({ error: "Session not found or not accepting input" }, { status: 404 });
  }

  return Response.json({ success: true });
}
