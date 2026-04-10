import { sendMessage } from "@/lib/devin";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const res = await sendMessage(id, body.message);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
