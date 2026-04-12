import { updateKnowledge, deleteKnowledge } from "@/lib/knowledge";
import type { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const res = await updateKnowledge(id, body);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await deleteKnowledge(id);
  if (res.status === 204) {
    return new Response(null, { status: 204 });
  }
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
